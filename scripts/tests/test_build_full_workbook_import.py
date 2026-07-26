from __future__ import annotations

import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from typing import Any
from unittest import mock
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/build_full_workbook_import.py"
WORKBOOK = ROOT / "data/raw/TSC_파트별_문제은행_그림포함.xlsx"
QUESTION_SAMPLE = ROOT / "data/working/question-sample"
PART4_FIXTURE = ROOT / "data/working/app-fixtures/part4"
COURSE_IMPORT = ROOT / "data/working/course-import-v1"

EXPECTED_WORKBOOK_SHA256 = (
    "a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f"
)
EXPECTED_PART_COUNTS = {1: 4, 2: 48, 3: 84, 4: 50, 5: 36, 6: 19, 7: 12}
PERSONAL_FIELDS = {"연습 상태", "최근 연습일", "내 답변 메모"}
EXPECTED_OUTPUT_FILES = {
    "sources.json",
    "source-references.json",
    "questions.json",
    "answer-points.json",
    "part-guides.json",
    "visual-assets.json",
    "visual-sets.json",
    "visual-set-assets.json",
    "visual-questions.json",
    "question-visual-sets.json",
    "model-answers.json",
    "story-guides.json",
    "course-question-link-candidates.json",
    "course-content-usage-candidates.json",
    "workbook-link-candidates.json",
    "unmapped-content.json",
    "review-queue.json",
    "manifest.json",
    "README.md",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def directory_digest(path: Path) -> str:
    digest = hashlib.sha256()
    for item in sorted(candidate for candidate in path.rglob("*") if candidate.is_file()):
        digest.update(item.relative_to(path).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(bytes.fromhex(sha256_file(item)))
    return digest.hexdigest()


def file_hashes(path: Path) -> dict[str, str]:
    return {
        item.relative_to(path).as_posix(): sha256_file(item)
        for item in sorted(candidate for candidate in path.rglob("*") if candidate.is_file())
    }


def run_builder(
    output_dir: Path,
    *arguments: str,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    command = [
        sys.executable,
        str(SCRIPT),
        "--output-dir",
        str(output_dir),
        *arguments,
    ]
    return subprocess.run(
        command,
        cwd=ROOT,
        check=check,
        text=True,
        capture_output=True,
    )


def read_json(output_dir: Path, filename: str) -> Any:
    return json.loads((output_dir / filename).read_text(encoding="utf-8"))


class FullWorkbookImportContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.input_hashes_before = {
            "workbook": sha256_file(WORKBOOK),
            "question_sample": directory_digest(QUESTION_SAMPLE),
            "part4_fixture": directory_digest(PART4_FIXTURE),
            "course_import": directory_digest(COURSE_IMPORT),
        }
        cls.temporary = tempfile.TemporaryDirectory(prefix="full-import-test-")
        cls.output_dir = Path(cls.temporary.name) / "full-import-v1"
        result = run_builder(cls.output_dir, check=False)
        if result.returncode != 0:
            raise AssertionError(
                "full workbook builder contract setup failed\n"
                f"stdout:\n{result.stdout}\n"
                f"stderr:\n{result.stderr}"
            )
        cls.payloads = {
            filename: read_json(cls.output_dir, filename)
            for filename in EXPECTED_OUTPUT_FILES
            if filename.endswith(".json")
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def test_exact_output_file_set(self) -> None:
        self.assertEqual(
            {path.name for path in self.output_dir.iterdir()},
            EXPECTED_OUTPUT_FILES,
        )

    def test_questions_are_all_253_canonical_rows(self) -> None:
        questions = self.payloads["questions.json"]
        self.assertEqual(len(questions), 253)
        self.assertEqual(
            Counter(question["part"] for question in questions),
            Counter(EXPECTED_PART_COUNTS),
        )
        ids = [question["question_id"] for question in questions]
        self.assertEqual(len(ids), len(set(ids)))
        for question in questions:
            self.assertRegex(
                question["question_id"],
                rf"^P{question['part']}-\d{{3}}$",
            )
            self.assertNotEqual(question["question_zh"], "")
            self.assertEqual(question["question_status"], "raw")
            self.assertFalse(PERSONAL_FIELDS & set(question))
            self.assertFalse(
                {
                    "source_id",
                    "source_locator",
                    "source_grade",
                    "source_name",
                    "source_url",
                    "originality",
                    "answer_point",
                }
                & set(question)
            )

    def test_part7_common_instruction_is_preserved_twelve_times(self) -> None:
        part7 = [
            item
            for item in self.payloads["questions.json"]
            if item["part"] == 7
        ]
        self.assertEqual(len(part7), 12)
        self.assertEqual(len({item["question_zh"] for item in part7}), 1)
        self.assertEqual(
            [item["question_id"] for item in part7],
            [f"P7-{index:03d}" for index in range(1, 13)],
        )

    def test_answer_points_are_one_to_one_and_raw(self) -> None:
        questions = self.payloads["questions.json"]
        answer_points = self.payloads["answer-points.json"]
        question_ids = {item["question_id"] for item in questions}
        self.assertEqual(len(answer_points), 253)
        self.assertEqual(
            Counter(item["question_id"] for item in answer_points),
            Counter({question_id: 1 for question_id in question_ids}),
        )
        for item in answer_points:
            self.assertEqual(
                item["answer_point_id"],
                f"ap-{item['question_id']}-001",
            )
            self.assertEqual(item["point_type"], "unclassified")
            self.assertEqual(item["sequence"], 1)
            self.assertEqual(item["point_status"], "raw")
            self.assertNotEqual(item["content"], "")

    def test_question_and_answer_point_strings_match_workbook_cells(self) -> None:
        sys.path.insert(0, str(ROOT))
        try:
            from scripts import extract_extended_sample as xlsx
        finally:
            sys.path.pop(0)

        with ZipFile(WORKBOOK) as archive:
            members = xlsx._workbook_sheet_members(archive)
            shared_strings = xlsx._shared_strings(archive)
            _, rows = xlsx._read_sheet_rows(
                archive,
                members["문제은행"],
                shared_strings,
            )
            source_rows = xlsx._read_question_bank(rows)

        questions = {
            item["question_id"]: item
            for item in self.payloads["questions.json"]
        }
        answer_points = {
            item["question_id"]: item
            for item in self.payloads["answer-points.json"]
        }
        references = {
            item["source_reference_id"]: item
            for item in self.payloads["source-references.json"]
        }
        for source in source_rows:
            question_id = str(source["ID"])
            question = questions[question_id]
            self.assertEqual(question["question_type"], source["유형"])
            self.assertEqual(question["question_zh"], source["중국어 문제/상황"])
            self.assertEqual(question["question_pinyin"], source["병음"])
            self.assertEqual(question["question_ko"], source["한국어 뜻/상황"])
            self.assertEqual(
                answer_points[question_id]["content"],
                source["답변 포인트"],
            )
            reference = references[
                f"sr-question-{question_id}-extracted"
            ]
            self.assertEqual(
                reference["source_locator"],
                f"문제은행!A{source['__excel_row']}:N{source['__excel_row']}",
            )
            self.assertEqual(
                reference["claimed_source_name"],
                source["출처"],
            )
            self.assertEqual(
                reference["claimed_source_url"],
                source["출처 URL"],
            )
            self.assertEqual(reference["source_grade"], source["자료 등급"])
            self.assertEqual(reference["originality"], source["원문성"])
            answer_reference = references[
                "sr-answer-point-"
                f"ap-{question_id}-001-extracted"
            ]
            self.assertEqual(
                answer_reference["target_id"],
                f"ap-{question_id}-001",
            )
            self.assertEqual(
                answer_reference["source_locator"],
                reference["source_locator"],
            )
            for field in (
                "claimed_source_name",
                "claimed_source_url",
                "source_grade",
                "originality",
            ):
                self.assertEqual(
                    answer_reference[field],
                    reference[field],
                )

    def test_source_is_real_workbook_not_claimed_origin(self) -> None:
        sources = self.payloads["sources.json"]
        self.assertEqual(len(sources), 1)
        source = sources[0]
        self.assertEqual(source["source_id"], "src-001")
        self.assertEqual(source["source_type"], "excel")
        self.assertEqual(source["provenance_status"], "unverified_source")
        self.assertEqual(
            source["original_file_name"],
            "TSC_파트별_문제은행_그림포함.xlsx",
        )
        self.assertEqual(
            source["file_ref"],
            "data/raw/TSC_파트별_문제은행_그림포함.xlsx",
        )
        self.assertEqual(source["rights_status"], "review_needed")

    def test_source_references_separate_claimed_source_and_are_integral(self) -> None:
        references = self.payloads["source-references.json"]
        source_ids = {item["source_id"] for item in self.payloads["sources.json"]}
        registry = self._target_registry()
        self.assertGreaterEqual(len(references), 506)
        self.assertEqual(
            len(references),
            len({item["source_reference_id"] for item in references}),
        )
        for reference in references:
            self.assertIn(reference["source_id"], source_ids)
            self.assertIn(reference["target_type"], registry)
            self.assertIn(
                reference["target_id"],
                registry[reference["target_type"]],
            )
            self.assertEqual(reference["relationship_kind"] in {
                "extracted_from",
                "claimed_origin",
                "derived_from",
                "supports",
                "self_created",
            }, True)
            self.assertIn(
                reference["verification_status"],
                {"unverified", "review_needed"},
            )
        question_reference = next(
            item
            for item in references
            if item["source_reference_id"] == "sr-question-P4-006-extracted"
        )
        self.assertEqual(question_reference["source_id"], "src-001")
        self.assertEqual(
            question_reference["claimed_source_name"],
            "프로젝트 강의 분석",
        )
        self.assertEqual(question_reference["claimed_source_url"], "")

    def test_workbook_specific_part_guides_do_not_replace_course_guides(self) -> None:
        guides = self.payloads["part-guides.json"]
        self.assertEqual(len(guides), 7)
        self.assertEqual(
            [item["part_guide_id"] for item in guides],
            [f"part-guide-workbook-{part:02d}" for part in range(1, 8)],
        )
        self.assertTrue(all(item["guide_status"] == "review_needed" for item in guides))
        self.assertTrue(
            all(item["course_target_context"] == "not_specified" for item in guides)
        )
        self.assertTrue(all(item["response_structure"] == [] for item in guides))
        self.assertEqual(
            guides[0]["preparation_tips"],
            [
                "Part 1 자기소개는 한 문제 안에서 네 가지를 말하는 것이 아니라, 네 문항이 각각 따로 출제됩니다.",
            ],
        )
        self.assertEqual(
            [item["goal"] for item in guides],
            [
                "고정 4문항을 막힘없이",
                "6초 안에 그림 정보 1문장",
                "반응+이유+후속표현",
                "결론+이유+예시+정리",
                "입장+근거+반론+결론",
                "상황 설명+요청/설득",
                "4장 연결, 사건과 결말",
            ],
        )
        self.assertEqual(guides[1]["preparation_seconds"], 3)
        self.assertEqual(guides[1]["response_seconds"], 6)
        self.assertEqual(guides[6]["preparation_seconds"], 30)
        self.assertEqual(guides[6]["response_seconds"], 90)
        self.assertEqual(
            guides[6]["key_expressions"],
            [
                {
                    "zh": "一开始 / 后来 / 没想到 / 于是 / 最后",
                    "pinyin": "",
                    "ko": "",
                }
            ],
        )
        references = {
            item["source_reference_id"]: item
            for item in self.payloads["source-references.json"]
        }
        for part in range(1, 8):
            guide_id = f"part-guide-workbook-{part:02d}"
            self.assertEqual(
                references[
                    f"sr-{guide_id}-summary-extracted"
                ]["source_locator"],
                f"'요약'!A{part + 1}:C{part + 1}",
            )
        self.assertEqual(
            references[
                "sr-part-guide-workbook-01-structure-extracted"
            ]["source_locator"],
            "'시험 구조'!A2:B6",
        )
        self.assertEqual(
            references[
                "sr-part-guide-workbook-02-visual-guidance-extracted"
            ]["source_locator"],
            "'그림 활용 안내'!A5:B5",
        )
        self.assertEqual(
            references[
                "sr-part-guide-workbook-07-visual-guidance-extracted"
            ]["source_locator"],
            "'그림 활용 안내'!A6:B7",
        )

    def test_part2_visual_entities_and_strict_links(self) -> None:
        visual_sets = [
            item for item in self.payloads["visual-sets.json"] if item["part"] == 2
        ]
        visual_questions = self.payloads["visual-questions.json"]
        question_visual_sets = self.payloads["question-visual-sets.json"]
        self.assertEqual(len(visual_sets), 12)
        self.assertEqual(
            [item["visual_set_id"] for item in visual_sets],
            [f"vs-P2-V{index:02d}" for index in range(1, 13)],
        )
        self.assertEqual(len(visual_questions), 48)
        self.assertEqual(
            Counter(item["visual_set_id"] for item in visual_questions),
            Counter(
                {
                    f"vs-P2-V{index:02d}": 4
                    for index in range(1, 13)
                }
            ),
        )
        self.assertEqual(sum(bool(item["question_id"]) for item in visual_questions), 18)
        self.assertEqual(sum(not item["question_id"] for item in visual_questions), 30)
        self.assertTrue(
            all(
                not item["question_id"] or item["question_id"].startswith("P2-")
                for item in visual_questions
            )
        )
        self.assertEqual(
            len(
                [
                    item
                    for item in question_visual_sets
                    if item["visual_set_id"].startswith("vs-P2-")
                ]
            ),
            18,
        )

    def test_part2_model_answers_target_visual_questions_only(self) -> None:
        answers = self.payloads["model-answers.json"]
        visual_question_ids = {
            item["visual_question_id"]
            for item in self.payloads["visual-questions.json"]
        }
        self.assertEqual(len(answers), 48)
        for answer in answers:
            self.assertEqual(answer["answer_target_type"], "visual_question")
            self.assertIn(answer["answer_target_id"], visual_question_ids)
            self.assertEqual(answer["answer_variant"], "basic")
            self.assertEqual(answer["answer_status"], "review_needed")
            self.assertEqual(answer["provenance_kind"], "unverified_source")
            self.assertNotEqual(answer["answer_zh"], "")
            self.assertNotEqual(answer["answer_pinyin"], "")
            self.assertNotEqual(answer["answer_ko"], "")

    def test_visual_questions_answers_guides_and_links_match_workbook(self) -> None:
        sys.path.insert(0, str(ROOT))
        try:
            from scripts import extract_extended_sample as xlsx
        finally:
            sys.path.pop(0)

        with ZipFile(WORKBOOK) as archive:
            members = xlsx._workbook_sheet_members(archive)
            shared_strings = xlsx._shared_strings(archive)
            rows_by_sheet: dict[str, dict[int, dict[int, str]]] = {}
            for sheet_name in (
                "Part2 그림 연습",
                "Part2 정답",
                "Part7 정답 포인트",
            ):
                _, rows = xlsx._read_sheet_rows(
                    archive,
                    members[sheet_name],
                    shared_strings,
                )
                rows_by_sheet[sheet_name] = rows

        visual_questions = {
            item["visual_question_id"]: item
            for item in self.payloads["visual-questions.json"]
        }
        references = {
            item["source_reference_id"]: item
            for item in self.payloads["source-references.json"]
        }
        question_visual_sets = {
            (item["question_id"], item["visual_set_id"]): item
            for item in self.payloads["question-visual-sets.json"]
        }
        expected_question_links: set[tuple[str, str]] = set()
        canonical_by_zh: dict[str, list[dict[str, Any]]] = {}
        for question in self.payloads["questions.json"]:
            if question["part"] == 2:
                canonical_by_zh.setdefault(
                    question["question_zh"],
                    [],
                ).append(question)

        for row_number, values in rows_by_sheet[
            "Part2 그림 연습"
        ].items():
            label = values.get(8, "")
            match = xlsx.VISUAL_QUESTION_LABEL_RE.fullmatch(label)
            if match is None:
                continue
            figure_id = next(
                xlsx._figure_id_from_cell(
                    2,
                    rows_by_sheet["Part2 그림 연습"][candidate].get(
                        1, ""
                    ),
                )
                for candidate in range(row_number, 0, -1)
                if xlsx._figure_id_from_cell(
                    2,
                    rows_by_sheet["Part2 그림 연습"]
                    .get(candidate, {})
                    .get(1, ""),
                )
            )
            item_number = int(match.group(1))
            visual_question = visual_questions[
                f"vq-{figure_id}-Q{item_number}"
            ]
            expected_language = (
                values.get(9, ""),
                rows_by_sheet["Part2 그림 연습"]
                .get(row_number + 1, {})
                .get(9, ""),
                rows_by_sheet["Part2 그림 연습"]
                .get(row_number + 2, {})
                .get(9, ""),
            )
            self.assertEqual(
                (
                    visual_question["question_zh"],
                    visual_question["question_pinyin"],
                    visual_question["question_ko"],
                ),
                expected_language,
            )
            visual_reference = references[
                "sr-visual-question-"
                f"{visual_question['visual_question_id']}-extracted"
            ]
            expected_visual_locator = (
                f"'Part2 그림 연습'!H{row_number}:I{row_number + 2}"
            )
            self.assertEqual(
                visual_reference["source_locator"],
                expected_visual_locator,
            )
            self.assertEqual(
                visual_reference["target_id"],
                visual_question["visual_question_id"],
            )
            candidates = canonical_by_zh.get(expected_language[0], [])
            exact = [
                candidate
                for candidate in candidates
                if (
                    candidate["question_pinyin"],
                    candidate["question_ko"],
                )
                == expected_language[1:]
            ]
            expected_question_id = ""
            if len(exact) == 1:
                expected_question_id = exact[0]["question_id"]
            elif len(candidates) == 1 and all(
                not visual_value
                or not canonical_value
                or visual_value == canonical_value
                for visual_value, canonical_value in (
                    (
                        expected_language[1],
                        candidates[0]["question_pinyin"],
                    ),
                    (
                        expected_language[2],
                        candidates[0]["question_ko"],
                    ),
                )
            ):
                expected_question_id = candidates[0]["question_id"]
            self.assertEqual(
                visual_question["question_id"],
                expected_question_id,
            )
            if expected_question_id:
                expected_question_links.add(
                    (expected_question_id, f"vs-{figure_id}")
                )
                relation = question_visual_sets[
                    (expected_question_id, f"vs-{figure_id}")
                ]
                relation_reference = references[
                    relation["source_reference_ids"][0]
                ]
                self.assertEqual(
                    relation_reference["source_locator"],
                    (
                        f"{expected_visual_locator}; "
                        f"{references[f'sr-question-{expected_question_id}-extracted']['source_locator']}"
                    ),
                )
                self.assertEqual(
                    relation_reference["relationship_kind"],
                    "supports",
                )

        actual_question_links = {
            (item["question_id"], item["visual_set_id"])
            for item in self.payloads["question-visual-sets.json"]
        }
        self.assertEqual(actual_question_links, expected_question_links)

        answer_rows = xlsx._table_records(
            rows_by_sheet["Part2 정답"],
            xlsx.PART2_ANSWER_HEADERS,
            48,
            "Part2 정답",
        )
        answers = {
            item["answer_target_id"]: item
            for item in self.payloads["model-answers.json"]
        }
        for row_number, source in answer_rows:
            target_id = (
                f"vq-{source['그림 ID']}-Q{int(source['문항'])}"
            )
            answer = answers[target_id]
            self.assertEqual(answer["answer_zh"], source["추천 답변"])
            self.assertEqual(answer["answer_pinyin"], source["답변 병음"])
            self.assertEqual(answer["answer_ko"], source["한국어 뜻"])
            answer_reference = references[
                answer["source_reference_ids"][0]
            ]
            self.assertEqual(
                answer_reference["source_locator"],
                f"'Part2 정답'!A{row_number}:H{row_number}",
            )
            self.assertEqual(
                answer_reference["target_id"],
                answer["answer_id"],
            )

        guide_rows = xlsx._table_records(
            rows_by_sheet["Part7 정답 포인트"],
            xlsx.PART7_GUIDE_HEADERS,
            12,
            "Part7 정답 포인트",
        )
        guides = {
            item["story_guide_id"]: item
            for item in self.payloads["story-guides.json"]
        }
        for row_number, source in guide_rows:
            guide = guides[f"sg-{source['그림 ID']}-01"]
            self.assertEqual(guide["situation_ko"], source["한국어 상황"])
            self.assertEqual(
                guide["recommended_flow"],
                source["추천 이야기 흐름"],
            )
            self.assertEqual(
                guide["recommended_connectors_zh"],
                source["권장 중국어 연결어"],
            )
            self.assertEqual(
                guide["material_nature"],
                source["자료 성격"],
            )
            guide_reference = references[
                guide["source_reference_ids"][0]
            ]
            self.assertEqual(
                guide_reference["source_locator"],
                f"'Part7 정답 포인트'!A{row_number}:E{row_number}",
            )
            self.assertEqual(
                guide_reference["target_id"],
                guide["story_guide_id"],
            )

    def test_part7_story_guides_are_not_model_answers_or_question_links(self) -> None:
        visual_sets = [
            item
            for item in self.payloads["visual-sets.json"]
            if item["part"] == 7 and item["set_type"] == "story_image"
        ]
        guides = self.payloads["story-guides.json"]
        question_visual_sets = self.payloads["question-visual-sets.json"]
        self.assertEqual(len(visual_sets), 12)
        self.assertEqual(len(guides), 12)
        self.assertTrue(all(item["guide_status"] == "raw" for item in guides))
        self.assertTrue(all(item["question_id"] == "" for item in guides))
        self.assertEqual(
            [
                item
                for item in question_visual_sets
                if item["visual_set_id"].startswith("vs-P7-")
            ],
            [],
        )
        answer_targets = {
            item["answer_target_id"]
            for item in self.payloads["model-answers.json"]
        }
        self.assertTrue(
            all(item["story_guide_id"] not in answer_targets for item in guides)
        )

    def test_all_image_metadata_and_visual_set_assets_are_integral(self) -> None:
        assets = self.payloads["visual-assets.json"]
        sets = self.payloads["visual-sets.json"]
        links = self.payloads["visual-set-assets.json"]
        asset_ids = {item["visual_asset_id"] for item in assets}
        set_ids = {item["visual_set_id"] for item in sets}
        self.assertEqual(len(assets), 25)
        self.assertEqual(len({item["sha256"] for item in assets}), 25)
        self.assertEqual(len(links), 25)
        self.assertTrue(all(item["rights_status"] == "review_needed" for item in assets))
        self.assertFalse(any(item["rights_status"] == "public_allowed" for item in assets))
        for asset in assets:
            self.assertEqual(asset["media_type"], "image/png")
            self.assertGreater(asset["file_size"], 0)
            self.assertGreater(asset["width"], 0)
            self.assertGreater(asset["height"], 0)
            self.assertRegex(asset["sha256"], r"^[0-9a-f]{64}$")
        for link in links:
            self.assertIn(link["visual_asset_id"], asset_ids)
            self.assertIn(link["visual_set_id"], set_ids)

    def test_each_visual_asset_matches_its_ooxml_anchor_and_media(self) -> None:
        sys.path.insert(0, str(ROOT))
        try:
            from scripts import extract_extended_sample as xlsx
        finally:
            sys.path.pop(0)

        assets = {
            item["visual_asset_id"]: item
            for item in self.payloads["visual-assets.json"]
        }
        links = {
            item["visual_asset_id"]: item
            for item in self.payloads["visual-set-assets.json"]
        }
        visual_sets = {
            item["visual_set_id"]: item
            for item in self.payloads["visual-sets.json"]
        }
        references = {
            item["source_reference_id"]: item
            for item in self.payloads["source-references.json"]
        }
        with ZipFile(WORKBOOK) as archive:
            members = xlsx._workbook_sheet_members(archive)
            shared_strings = xlsx._shared_strings(archive)
            for part, sheet_name, last_column in (
                (2, "Part2 그림 연습", "I"),
                (7, "Part7 스토리 그림", "A"),
            ):
                worksheet, rows = xlsx._read_sheet_rows(
                    archive,
                    members[sheet_name],
                    shared_strings,
                )
                blocks = xlsx._find_set_blocks(
                    rows,
                    part,
                    last_column,
                )
                blocks[-1]["end_row"] = max(
                    row_number
                    for row_number, values in rows.items()
                    if any(values.values())
                )
                blocks[-1]["source_locator"] = (
                    f"'{sheet_name}'!A{blocks[-1]['start_row']}:"
                    f"{last_column}{blocks[-1]['end_row']}"
                )
                images = xlsx._drawing_images(
                    archive,
                    members[sheet_name],
                    worksheet,
                )
                mapped = xlsx._map_images_to_blocks(blocks, images)
                for source in mapped:
                    figure_id = source["figure_id"]
                    asset = assets[f"va-{figure_id}-01"]
                    self.assertEqual(
                        asset["sha256"],
                        source["media_sha256"],
                    )
                    self.assertEqual(
                        asset["file_size"],
                        len(source["media_bytes"]),
                    )
                    self.assertIn(
                        source["media_member"],
                        asset["source_locator"],
                    )
                    anchor_cell = (
                        f"{xlsx._column_name(source['anchor_column'])}"
                        f"{source['anchor_row_start']}"
                    )
                    self.assertTrue(
                        asset["source_locator"].startswith(
                            f"'{sheet_name}'!{anchor_cell}; "
                        )
                    )
                    width, height = struct.unpack(
                        ">II",
                        source["media_bytes"][16:24],
                    )
                    self.assertEqual(asset["width"], width)
                    self.assertEqual(asset["height"], height)
                    self.assertEqual(
                        links[asset["visual_asset_id"]]["visual_set_id"],
                        f"vs-{figure_id}",
                    )
                    set_reference = references[
                        visual_sets[f"vs-{figure_id}"][
                            "source_reference_ids"
                        ][0]
                    ]
                    self.assertEqual(
                        set_reference["source_locator"],
                        source["source_locator"],
                    )
                    self.assertEqual(
                        asset["repository_path"],
                        (
                            "data/working/generated-assets/full-import-v1/"
                            f"part{part}__{figure_id}.png"
                        ),
                    )

            official_worksheet, _ = xlsx._read_sheet_rows(
                archive,
                members["공식 샘플 이미지"],
                shared_strings,
            )
            official_images = xlsx._drawing_images(
                archive,
                members["공식 샘플 이미지"],
                official_worksheet,
            )
            self.assertEqual(len(official_images), 1)
            official_source = official_images[0]
            official_asset = assets["va-official-sample-workbook-01"]
            official_anchor = (
                f"{xlsx._column_name(official_source['anchor_column'])}"
                f"{official_source['anchor_row_start']}"
            )
            self.assertEqual(
                official_asset["sha256"],
                official_source["media_sha256"],
            )
            self.assertTrue(
                official_asset["source_locator"].startswith(
                    f"'공식 샘플 이미지'!{official_anchor}; "
                )
            )
            official_width, official_height = struct.unpack(
                ">II",
                official_source["media_bytes"][16:24],
            )
            self.assertEqual(official_asset["width"], official_width)
            self.assertEqual(official_asset["height"], official_height)

    def test_all_cross_entity_ids_are_referentially_integral(self) -> None:
        question_ids = {
            item["question_id"] for item in self.payloads["questions.json"]
        }
        visual_set_ids = {
            item["visual_set_id"] for item in self.payloads["visual-sets.json"]
        }
        visual_question_ids = {
            item["visual_question_id"]
            for item in self.payloads["visual-questions.json"]
        }
        for item in self.payloads["answer-points.json"]:
            self.assertIn(item["question_id"], question_ids)
        for item in self.payloads["visual-questions.json"]:
            self.assertIn(item["visual_set_id"], visual_set_ids)
            if item["question_id"]:
                self.assertIn(item["question_id"], question_ids)
        for item in self.payloads["question-visual-sets.json"]:
            self.assertIn(item["question_id"], question_ids)
            self.assertIn(item["visual_set_id"], visual_set_ids)
        for item in self.payloads["model-answers.json"]:
            self.assertIn(item["answer_target_id"], visual_question_ids)
            self.assertTrue(item["source_reference_ids"])
        for item in self.payloads["story-guides.json"]:
            self.assertIn(item["visual_set_id"], visual_set_ids)
            if item["question_id"]:
                self.assertIn(item["question_id"], question_ids)
        for item in self.payloads["workbook-link-candidates.json"]:
            self.assertIn(item["source_entity_id"], visual_set_ids)
            self.assertIn(item["candidate_question_id"], question_ids)
        for item in self.payloads["course-content-usage-candidates.json"]:
            self.assertIn(item["candidate_question_id"], question_ids)

    def test_official_sample_is_isolated_from_questions(self) -> None:
        official_assets = [
            item
            for item in self.payloads["visual-assets.json"]
            if "official" in item["visual_asset_id"]
        ]
        official_sets = [
            item
            for item in self.payloads["visual-sets.json"]
            if item["set_type"] == "official_sample"
        ]
        self.assertEqual(len(official_assets), 1)
        self.assertEqual(len(official_sets), 1)
        self.assertFalse(
            any(
                item["visual_set_id"] == official_sets[0]["visual_set_id"]
                for item in self.payloads["question-visual-sets.json"]
            )
        )

    def test_strict_cross_dataset_candidates_are_only_review_queues(self) -> None:
        course_links = self.payloads["course-question-link-candidates.json"]
        usage = self.payloads["course-content-usage-candidates.json"]
        workbook_links = self.payloads["workbook-link-candidates.json"]
        self.assertEqual(course_links, [])
        self.assertEqual(len(usage), 4)
        self.assertEqual(
            {
                (
                    item["course_content_type"],
                    item["course_content_id"],
                    item["candidate_question_id"],
                )
                for item in usage
            },
            {
                ("learning_expression", "le-course-016", "P3-047"),
                ("learning_expression", "le-course-016", "P3-048"),
                ("learning_expression", "le-course-016", "P3-049"),
                (
                    "pronunciation_item",
                    "pi-course-pangbian-erhua",
                    "P2-011",
                ),
            },
        )
        self.assertTrue(all(item["review_status"] == "review_needed" for item in usage))
        part7_candidates = [
            item for item in workbook_links if item["candidate_kind"] == "part7_suffix"
        ]
        self.assertEqual(len(part7_candidates), 12)
        self.assertEqual(
            [
                (
                    item["source_entity_id"],
                    item["candidate_question_id"],
                    item["match_basis"],
                    item["confidence"],
                )
                for item in part7_candidates
            ],
            [
                (
                    f"vs-P7-V{index:02d}",
                    f"P7-{index:03d}",
                    "numeric_suffix_only",
                    "low",
                )
                for index in range(1, 13)
            ],
        )
        self.assertTrue(
            all(item["review_status"] == "review_needed" for item in part7_candidates)
        )
        self.assertTrue(
            all(
                item["matched_fields"] == ["numeric_suffix"]
                and item["conflicting_fields"]
                == [
                    "explicit_foreign_key_missing",
                    "question_zh_common_to_12_questions",
                ]
                for item in part7_candidates
            )
        )

    def test_unmapped_and_review_queue_preserve_unresolved_work(self) -> None:
        unmapped = self.payloads["unmapped-content.json"]
        queue = self.payloads["review-queue.json"]
        self.assertGreater(len(unmapped), 0)
        self.assertGreater(len(queue), 0)
        self.assertTrue(
            {"공식·참고 링크", "시험 구조", "문제은행"}
            <= {item["sheet_name"] for item in unmapped}
        )
        self.assertTrue(
            all(item["review_status"] == "review_needed" for item in unmapped)
        )
        self.assertEqual(
            {
                item["unmapped_id"]
                for item in unmapped
                if item["content_kind"]
                == "excluded_personal_column_metadata"
            },
            {
                "um-personal-column-12",
                "um-personal-column-13",
                "um-personal-column-14",
            },
        )
        self.assertTrue(
            {
                "um-structure-a3",
                "um-structure-b3",
                "um-structure-a4",
                "um-structure-b4",
                "um-structure-a5",
                "um-structure-b5",
                "um-structure-a6",
                "um-structure-b6",
                "um-official-sample-a1",
                "um-official-sample-a40",
            }
            <= {item["unmapped_id"] for item in unmapped}
        )
        self.assertTrue(
            all(item["priority"] in {"blocking", "important", "later"} for item in queue)
        )
        self.assertEqual(
            {item["review_item_id"] for item in queue},
            {
                "rq-question-language-and-source-review",
                "rq-part2-unlinked-visual-questions",
                "rq-part2-question-visual-set-links",
                "rq-part7-suffix-link-candidates",
                "rq-workbook-course-part-guide-scope",
                "rq-visual-asset-rights",
                "rq-source-url-verification",
                "rq-part2-source-model-answer-review",
                "rq-course-content-usage-candidates",
            },
        )

    def test_manifest_hashes_counts_and_paths(self) -> None:
        manifest = self.payloads["manifest.json"]
        self.assertEqual(manifest["dataset_id"], "full-workbook-working-import-v1")
        self.assertEqual(manifest["dataset_status"], "working")
        self.assertEqual(manifest["schema_version"], "data-schema-v1.1-working")
        self.assertEqual(manifest["workbook"]["sha256"], EXPECTED_WORKBOOK_SHA256)
        self.assertEqual(manifest["workbook"]["size"], 623070)
        self.assertEqual(manifest["script_sha256"], sha256_file(SCRIPT))
        self.assertEqual(len(manifest["sheets"]), 10)
        self.assertEqual(
            manifest["course_import_manifest"]["sha256"],
            sha256_file(COURSE_IMPORT / "manifest.json"),
        )
        self.assertEqual(manifest["part_question_counts"], {
            str(part): count for part, count in EXPECTED_PART_COUNTS.items()
        })
        self.assertEqual(manifest["counts"]["questions"], 253)
        self.assertEqual(manifest["counts"]["answer_points"], 253)
        self.assertEqual(manifest["counts"]["visual_questions"], 48)
        self.assertEqual(manifest["counts"]["model_answers"], 48)
        self.assertEqual(manifest["counts"]["story_guides"], 12)
        self.assertEqual(manifest["counts"]["visual_assets"], 25)
        self.assertEqual(manifest["counts"]["sources"], 1)
        self.assertEqual(manifest["counts"]["source_references"], 667)
        self.assertEqual(manifest["counts"]["part_guides"], 7)
        self.assertEqual(manifest["counts"]["visual_sets"], 25)
        self.assertEqual(manifest["counts"]["visual_set_assets"], 25)
        self.assertEqual(manifest["counts"]["question_visual_sets"], 18)
        self.assertEqual(
            manifest["counts"]["course_question_link_candidates"],
            0,
        )
        self.assertEqual(
            manifest["counts"]["course_content_usage_candidates"],
            4,
        )
        self.assertEqual(
            manifest["counts"]["workbook_link_candidates"],
            12,
        )
        self.assertEqual(manifest["counts"]["unmapped_content"], 118)
        self.assertEqual(manifest["counts"]["review_queue"], 9)
        self.assertEqual(manifest["visual_question_links"]["linked"], 18)
        self.assertEqual(manifest["visual_question_links"]["unlinked"], 30)
        self.assertEqual(
            set(manifest["excluded_personal_columns"]),
            PERSONAL_FIELDS,
        )
        self.assertEqual(manifest["rights_review_needed_assets"], 25)
        self.assertEqual(manifest["duplicate_visual_asset_sha_groups"], 0)
        self.assertEqual(manifest["validation"]["status"], "passed")
        generated = manifest["generated_files"]
        self.assertEqual(
            set(generated),
            EXPECTED_OUTPUT_FILES - {"manifest.json"},
        )
        self.assertNotIn("manifest.json", generated)
        for relative_path, expected_hash in generated.items():
            self.assertEqual(
                sha256_file(self.output_dir / relative_path),
                expected_hash,
            )
        self.assertNotIn(str(ROOT), json.dumps(manifest, ensure_ascii=False))

    def test_json_format_is_utf8_lf_indented_and_deterministic(self) -> None:
        for path in sorted(self.output_dir.glob("*.json")):
            raw = path.read_bytes()
            self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
            self.assertNotIn(b"\r\n", raw)
            self.assertTrue(raw.endswith(b"\n"))
            self.assertEqual(
                raw,
                (
                    json.dumps(
                        json.loads(raw.decode("utf-8")),
                        ensure_ascii=False,
                        indent=2,
                    )
                    + "\n"
                ).encode("utf-8"),
            )

        before = file_hashes(self.output_dir)
        run_builder(self.output_dir)
        self.assertEqual(file_hashes(self.output_dir), before)

    def test_validate_only_does_not_change_output(self) -> None:
        before = {
            path.relative_to(self.output_dir).as_posix(): (
                sha256_file(path),
                path.stat().st_mtime_ns,
            )
            for path in self.output_dir.rglob("*")
            if path.is_file()
        }
        run_builder(self.output_dir, "--validate-only")
        after = {
            path.relative_to(self.output_dir).as_posix(): (
                sha256_file(path),
                path.stat().st_mtime_ns,
            )
            for path in self.output_dir.rglob("*")
            if path.is_file()
        }
        self.assertEqual(after, before)

    def test_validate_only_detects_tampered_output_without_rewriting_it(self) -> None:
        with tempfile.TemporaryDirectory(
            prefix="full-import-tamper-"
        ) as temporary:
            output = Path(temporary) / "dataset"
            run_builder(output)
            questions_path = output / "questions.json"
            original = questions_path.read_text(encoding="utf-8")
            tampered = original.replace(
                '"question_id": "P1-001"',
                '"question_id": "P1-999"',
                1,
            )
            self.assertNotEqual(tampered, original)
            questions_path.write_text(
                tampered,
                encoding="utf-8",
            )
            before = file_hashes(output)
            result = run_builder(
                output,
                "--validate-only",
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(file_hashes(output), before)

    def test_extract_assets_preserves_workbook_media_bytes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="full-import-assets-") as temporary:
            output = Path(temporary) / "dataset"
            run_builder(output, "--extract-assets")
            asset_output = output.parent / f"{output.name}-generated-assets"
            extracted = sorted(path for path in asset_output.iterdir() if path.is_file())
            self.assertEqual(len(extracted), 25)
            metadata = read_json(output, "visual-assets.json")
            expected_hashes = {item["sha256"] for item in metadata}
            self.assertEqual({sha256_file(path) for path in extracted}, expected_hashes)
            for asset in metadata:
                self.assertTrue(
                    asset["repository_path"].startswith(
                        "data/working/generated-assets/full-import-v1/"
                    )
                )
                mirror = asset_output / Path(
                    asset["repository_path"]
                ).name
                self.assertTrue(mirror.is_file())
                self.assertEqual(
                    sha256_file(mirror),
                    asset["sha256"],
                )
            with ZipFile(WORKBOOK) as archive:
                media_hashes = {
                    hashlib.sha256(archive.read(name)).hexdigest()
                    for name in archive.namelist()
                    if name.startswith("xl/media/") and not name.endswith("/")
                }
            self.assertEqual({sha256_file(path) for path in extracted}, media_hashes)

    def test_builder_failure_preserves_existing_output(self) -> None:
        sys.path.insert(0, str(ROOT))
        try:
            from scripts import build_full_workbook_import as builder
        finally:
            sys.path.pop(0)

        before = file_hashes(self.output_dir)
        with mock.patch.object(
            builder,
            "_assemble_payloads",
            side_effect=builder.FullImportError("forced test failure"),
        ):
            with self.assertRaises(builder.FullImportError):
                builder.build_import(self.output_dir)
        self.assertEqual(file_hashes(self.output_dir), before)

    def test_publication_fsync_failure_rolls_back_every_output(self) -> None:
        sys.path.insert(0, str(ROOT))
        try:
            from scripts import build_full_workbook_import as builder
        finally:
            sys.path.pop(0)

        with tempfile.TemporaryDirectory(
            prefix="full-import-rollback-"
        ) as temporary:
            root = Path(temporary)
            dataset = root / "dataset"
            assets = root / "assets"
            dataset_stage = root / "dataset-stage"
            assets_stage = root / "assets-stage"
            for directory, value in (
                (dataset, "old dataset"),
                (assets, "old asset"),
                (dataset_stage, "new dataset"),
                (assets_stage, "new asset"),
            ):
                directory.mkdir()
                (directory / "value.txt").write_text(
                    value,
                    encoding="utf-8",
                )

            with mock.patch.object(
                builder,
                "_fsync_directory",
                side_effect=OSError("forced publication fsync failure"),
            ):
                with self.assertRaises(OSError):
                    builder._publish_directories(
                        [
                            (dataset_stage, dataset, None),
                            (assets_stage, assets, None),
                        ]
                    )

            self.assertEqual(
                (dataset / "value.txt").read_text(encoding="utf-8"),
                "old dataset",
            )
            self.assertEqual(
                (assets / "value.txt").read_text(encoding="utf-8"),
                "old asset",
            )
            self.assertFalse(
                any(".backup-" in item.name for item in root.iterdir())
            )
            self.assertFalse(
                any(".failed-" in item.name for item in root.iterdir())
            )

    def test_repository_output_is_restricted_to_data_working(self) -> None:
        result = run_builder(
            ROOT / "src/full-import-should-not-exist",
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(
            (ROOT / "src/full-import-should-not-exist").exists()
        )

    def test_all_protected_inputs_are_unchanged(self) -> None:
        self.assertEqual(sha256_file(WORKBOOK), self.input_hashes_before["workbook"])
        self.assertEqual(
            directory_digest(QUESTION_SAMPLE),
            self.input_hashes_before["question_sample"],
        )
        self.assertEqual(
            directory_digest(PART4_FIXTURE),
            self.input_hashes_before["part4_fixture"],
        )
        self.assertEqual(
            directory_digest(COURSE_IMPORT),
            self.input_hashes_before["course_import"],
        )

    def _target_registry(self) -> dict[str, set[str]]:
        return {
            "question": {
                item["question_id"] for item in self.payloads["questions.json"]
            },
            "answer_point": {
                item["answer_point_id"]
                for item in self.payloads["answer-points.json"]
            },
            "part_guide": {
                item["part_guide_id"] for item in self.payloads["part-guides.json"]
            },
            "visual_set": {
                item["visual_set_id"] for item in self.payloads["visual-sets.json"]
            },
            "visual_question": {
                item["visual_question_id"]
                for item in self.payloads["visual-questions.json"]
            },
            "question_visual_set": {
                item["question_visual_set_id"]
                for item in self.payloads["question-visual-sets.json"]
            },
            "model_answer": {
                item["answer_id"] for item in self.payloads["model-answers.json"]
            },
            "story_guide": {
                item["story_guide_id"] for item in self.payloads["story-guides.json"]
            },
        }


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_course_working_import.py"
DEFAULT_OUTPUT = ROOT / "data" / "working" / "course-import-v1"

INPUT_PATHS = (
    "other-output/TSC_1-7강_전체통합분석.md",
    "other-output/lessons/01강_상세분석.md",
    "other-output/lessons/02강_상세분석.md",
    "other-output/lessons/03강_상세분석.md",
    "other-output/lessons/04강_상세분석.md",
    "other-output/lessons/05강_상세분석.md",
    "other-output/lessons/06강_상세분석.md",
    "other-output/lessons/07강_상세분석.md",
    "other-output/study/TSC_1-7강_핵심요약.md",
    "other-output/study/TSC_문제유형별_답변템플릿.md",
    "other-output/study/TSC_복습계획.md",
    "other-output/study/TSC_시험직전_체크리스트.md",
    "other-output/study/TSC_실수와_감점방지.md",
    "other-output/study/TSC_필수표현_암기장.md",
    "other-output/pdf_extracts/01강/2024.05 3급 TSC_5월 제1강.pdf.md",
    "other-output/pdf_extracts/02강/2024.05 3급 TSC_5월 제2강.pdf.md",
    "other-output/pdf_extracts/04강/2024.05 3급 TSC_5월.pdf.md",
    "other-output/pdf_extracts/05강_TSC기출문제.docx.md",
    "other-output/99_validation_report.md",
    "other-output/00_file_inventory.md",
)

OUTPUT_FILES = (
    "sources.json",
    "source-references.json",
    "part-guides.json",
    "corrections.json",
    "learning-expressions.json",
    "pronunciation-items.json",
    "practice-drills.json",
    "course-insights.json",
    "model-answer-candidates.json",
    "question-link-candidates.json",
    "conflicts.json",
    "manifest.json",
    "README.md",
)

JSON_FILES = tuple(name for name in OUTPUT_FILES if name.endswith(".json"))
ALLOWED_STATES = {"raw", "review_needed", "draft"}
ALLOWED_EVIDENCE_KINDS = {
    "document_text",
    "screen_text",
    "instructor_speech",
    "analyst_synthesis",
    "generated_study_material",
}
ALLOWED_SOURCE_TYPES = {
    "course_analysis",
    "excel",
    "pdf",
    "instructor_correction",
    "self_created",
    "other",
}
ALLOWED_SOURCE_REFERENCE_TARGETS = {
    "question",
    "model_answer",
    "correction",
    "part_guide",
    "visual_set",
    "visual_question",
    "question_visual_set",
    "story_guide",
    "answer_point",
    "learning_expression",
    "pronunciation_item",
    "practice_drill",
    "course_insight",
}
SOURCE_REFERENCE_FIELDS = {
    "source_reference_id",
    "target_type",
    "target_id",
    "source_id",
    "source_locator",
    "relationship_kind",
    "claimed_source_name",
    "claimed_source_url",
    "source_grade",
    "originality",
    "verification_status",
    "evidence_kind",
    "notes",
}
LEARNING_EXPRESSION_SCHEMA_FIELDS = {
    "expression_id",
    "language",
    "part_numbers",
    "expression_type",
    "usage_context",
    "pattern_or_slots",
    "cautions",
    "related_correction_ids",
    "status",
    "evidence_kind",
    "source_reference_ids",
    "notes",
}
PRONUNCIATION_ITEM_FIELDS = {
    "pronunciation_item_id",
    "target_text",
    "pinyin_or_sound",
    "pronunciation_focus",
    "explanation_ko",
    "example_expression_ids",
    "part_numbers",
    "status",
    "evidence_kind",
    "source_reference_ids",
    "notes",
}
PRACTICE_DRILL_FIELDS = {
    "drill_id",
    "part",
    "drill_type",
    "prompt_or_task",
    "preparation_seconds",
    "response_seconds",
    "completion_criteria",
    "required_content_ids",
    "status",
    "evidence_kind",
    "source_reference_ids",
    "notes",
}
COURSE_INSIGHT_FIELDS = {
    "insight_id",
    "part_numbers",
    "insight_type",
    "content_ko",
    "course_target_context",
    "evidence_kind",
    "confidence_or_status",
    "source_reference_ids",
    "notes",
}
EXPECTED_PRONUNCIATION_IDS = [
    "pi-course-priority",
    "pi-course-f-mouth",
    "pi-course-jqx",
    "pi-course-zcs-zhchsh",
    "pi-course-serial-room",
    "pi-course-bi-geng",
    "pi-course-season-money",
    "pi-course-pangbian-erhua",
]
EXPECTED_DRILL_IDS = [
    "drill-course-p1-pronunciation-warmup",
    "drill-course-p2-timed-accuracy",
    "drill-course-p3-timed-reaction",
    "drill-course-p4-timed-structure",
    "drill-course-p5-timed-opinion",
    "drill-course-correction-before-after",
    "drill-course-self-record-mark-errors",
    "drill-course-stop-after-certain-sentence",
    "drill-course-screen-hanzi-keyword",
    "drill-course-typical-vs-personal",
]
REQUIRED_INSIGHT_IDS = {
    "ci-course-pronunciation-priority",
    "ci-course-p2-accuracy",
    "ci-course-p3-utterance-function",
    "ci-course-p4-structure",
    "ci-course-error-accumulation",
    "ci-course-last-five-seconds",
    "ci-course-typical-vs-personal",
    "ci-course-type-and-review",
    "ci-course-old-set-limit",
    "ci-course-part6-7-gap",
}
REQUIRED_INSIGHT_CONTENT = {
    "ci-course-pronunciation-priority": (
        "고급 어휘보다 발음·딕션·성조와 쉬운 정확한 문장을 우선한다."
    ),
    "ci-course-p2-accuracy": (
        "Part 2는 답변 길이보다 그림 정보와 한 문장의 정확성을 우선한다."
    ),
    "ci-course-p3-utterance-function": (
        "Part 3의 모든 발화를 질문으로 가정하지 말고 진술에도 기능에 맞게 반응한다."
    ),
    "ci-course-p4-structure": (
        "Part 4는 직접 답변, 이유, 구체 사례, 정리 순서로 답한다."
    ),
    "ci-course-error-accumulation": (
        "긴 답변에서 전치사와 어순을 포함한 문법 오류가 누적될 수 있다."
    ),
    "ci-course-last-five-seconds": (
        "마지막 약 5초에는 문법과 발음이 확실한 문장만 추가하고 불확실하면 멈춘다."
    ),
    "ci-course-typical-vs-personal": (
        "전형 답은 외우고 비전형 질문은 자신의 가족·회사·취미 경험으로 준비한다."
    ),
    "ci-course-type-and-review": (
        "본인이 실제로 말한 답을 타이핑하고 수정 전후와 이유를 기록한 뒤 수정 문장을 복습한다."
    ),
    "ci-course-old-set-limit": (
        "오래된 기출 세트가 그대로 출제될 것이라고 믿고 통째로 외우는 방식에만 의존하지 않는다."
    ),
    "ci-course-part6-7-gap": (
        "Part 6과 Part 7은 현재 과정에서 상세 답변 훈련 근거가 부족하다."
    ),
}
PERSONAL_FIELDS = {
    "user_answer_id",
    "learner_ref",
    "learning_status",
    "review_state_id",
    "original_input",
    "corrected_zh",
}

PART4_PROTECTED_PATHS = (
    "data/working/app-fixtures/part4/questions.json",
    "data/working/app-fixtures/part4/answer-points.json",
    "data/working/app-fixtures/part4/sources.json",
    "data/working/app-fixtures/part4/source-references.json",
    "data/working/app-fixtures/part4/model-answers.json",
    "data/working/app-fixtures/part4/manifest.json",
    "data/working/question-sample/questions.csv",
    "data/working/question-sample/model_answers.csv",
    "scripts/build_part4_app_fixture.py",
)
PROTECTED_PATHS = PART4_PROTECTED_PATHS + INPUT_PATHS


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


PROTECTED_HASHES_AT_IMPORT = {
    path: sha256(ROOT / path) for path in PROTECTED_PATHS
}


def run_builder(
    *arguments: str,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def read_json(output_dir: Path, name: str):
    return json.loads((output_dir / name).read_text(encoding="utf-8"))


def load_importer_module():
    spec = importlib.util.spec_from_file_location(
        "build_course_working_import_under_test", SCRIPT
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot import {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def walk_values(value):
    if isinstance(value, dict):
        yield from value.items()
        for child in value.values():
            yield from walk_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_values(child)


class CourseWorkingImportCliTests(unittest.TestCase):
    def test_cli_builds_exact_output_set(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory) / "course-import"
            result = run_builder("--output-dir", str(output_dir))

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                sorted(path.name for path in output_dir.iterdir()),
                sorted(OUTPUT_FILES),
            )

    def test_rebuild_does_not_delete_a_predictable_sibling_backup_path(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            parent = Path(temporary_directory)
            output_dir = parent / "course-import"
            first = run_builder("--output-dir", str(output_dir))
            self.assertEqual(first.returncode, 0, first.stderr)

            unrelated_backup = parent / ".course-import-backup"
            unrelated_backup.mkdir()
            sentinel = unrelated_backup / "user-owned.txt"
            sentinel.write_text("preserve me\n", encoding="utf-8")

            second = run_builder("--output-dir", str(output_dir))
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(
                sentinel.read_text(encoding="utf-8"), "preserve me\n"
            )

    def test_build_refuses_to_replace_an_unowned_existing_directory(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory) / "course-import"
            output_dir.mkdir()
            sentinel = output_dir / "user-owned.txt"
            sentinel.write_text("preserve me\n", encoding="utf-8")

            result = run_builder("--output-dir", str(output_dir))

            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "owned",
                (result.stderr + result.stdout).lower(),
            )
            self.assertEqual(
                sentinel.read_text(encoding="utf-8"), "preserve me\n"
            )

    def test_build_refuses_a_symlink_output_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            parent = Path(temporary_directory)
            real_output = parent / "real-output"
            first = run_builder("--output-dir", str(real_output))
            self.assertEqual(first.returncode, 0, first.stderr)
            symlink_output = parent / "symlink-output"
            symlink_output.symlink_to(real_output, target_is_directory=True)

            result = run_builder("--output-dir", str(symlink_output))

            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "symlink",
                (result.stderr + result.stdout).lower(),
            )
            self.assertTrue(symlink_output.is_symlink())


class CourseWorkingImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._temporary_directory = tempfile.TemporaryDirectory()
        cls.temporary_root = Path(cls._temporary_directory.name)
        cls.output_dir = cls.temporary_root / "course-import"
        cls.protected_hashes_before = dict(PROTECTED_HASHES_AT_IMPORT)

        result = run_builder("--output-dir", str(cls.output_dir))
        if result.returncode != 0:
            raise unittest.SkipTest(
                "course importer is unavailable; the CLI test records the expected "
                f"failure: {result.stderr.strip() or result.stdout.strip()}"
            )

        cls.payloads = {
            name: read_json(cls.output_dir, name) for name in JSON_FILES
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls._temporary_directory.cleanup()

    def test_sources_are_exactly_the_twenty_present_markdown_inputs(self) -> None:
        sources = self.payloads["sources.json"]
        self.assertEqual(len(sources), 20)
        self.assertEqual(
            [source["file_ref"] for source in sources],
            list(INPUT_PATHS),
        )
        self.assertEqual(len({source["source_id"] for source in sources}), 20)
        for source in sources:
            source_path = ROOT / source["file_ref"]
            self.assertTrue(source_path.is_file())
            self.assertEqual(source_path.suffix, ".md")
            self.assertEqual(source["sha256"], sha256(source_path))
            self.assertIn(source["source_type"], ALLOWED_SOURCE_TYPES)
            expected_provenance = (
                "self_created"
                if source["evidence_kind"] == "generated_study_material"
                else "unverified_source"
            )
            self.assertEqual(
                source["provenance_status"], expected_provenance
            )
            self.assertEqual(source["source_status"], "review_needed")
            self.assertIn(source["evidence_kind"], ALLOWED_EVIDENCE_KINDS)
            self.assertNotRegex(source["file_ref"], r"\.(mp4|pdf|docx)$")
            self.assertIsInstance(source["claimed_original_names"], list)
            self.assertTrue(source["claimed_original_names"])

        notes = "\n".join(source["notes"] for source in sources)
        self.assertIn("원본", notes)
        self.assertIn("저장소에 없음", notes)
        self.assertIn("자동 전사", notes)

        study_sources = [
            source for source in sources if "/study/" in source["file_ref"]
        ]
        self.assertEqual(len(study_sources), 6)
        for source in study_sources:
            self.assertEqual(source["source_type"], "self_created")
            self.assertEqual(source["provenance_status"], "self_created")

        sources_by_id = {source["source_id"]: source for source in sources}
        self.assertIn(
            "2024.05 3급 TSC_5월 제1강.pdf",
            sources_by_id["src-course-extract-pdf-01"][
                "claimed_original_names"
            ],
        )
        self.assertIn(
            "TSC기출문제.docx",
            sources_by_id["src-course-extract-docx-05"][
                "claimed_original_names"
            ],
        )

    def test_source_references_use_only_review_needed_and_allowed_evidence(self) -> None:
        sources = self.payloads["sources.json"]
        source_ids = {source["source_id"] for source in sources}
        provenance_by_source_id = {
            source["source_id"]: source["provenance_status"]
            for source in sources
        }
        source_references = self.payloads["source-references.json"]
        self.assertGreater(len(source_references), 0)
        self.assertEqual(
            len({item["source_reference_id"] for item in source_references}),
            len(source_references),
        )
        for item in source_references:
            self.assertEqual(set(item), SOURCE_REFERENCE_FIELDS)
            self.assertIn(item["source_id"], source_ids)
            self.assertEqual(item["verification_status"], "review_needed")
            self.assertIn(item["evidence_kind"], ALLOWED_EVIDENCE_KINDS)
            self.assertIn(item["target_type"], ALLOWED_SOURCE_REFERENCE_TARGETS)
            self.assertNotEqual(item["target_type"], "conflict")
            self.assertTrue(item["target_id"])
            self.assertTrue(item["source_locator"])
            if provenance_by_source_id[item["source_id"]] == "self_created":
                self.assertIn(
                    item["relationship_kind"],
                    {"self_created", "derived_from"},
                )
            if (
                item["target_type"]
                in {"part_guide", "pronunciation_item", "course_insight"}
                and item["evidence_kind"]
                in {
                    "analyst_synthesis",
                    "generated_study_material",
                    "instructor_speech",
                }
            ):
                self.assertNotEqual(
                    item["relationship_kind"], "extracted_from"
                )

    def test_validator_rejects_a_stale_instructor_locator(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        reference = next(
            item
            for item in payloads["source-references.json"]
            if item["evidence_kind"] == "instructor_speech"
        )
        reference["source_locator"] = "[01강 / V01a / missing]"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_rejects_self_created_evidence_escalation(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        reference = next(
            item
            for item in payloads["source-references.json"]
            if item["source_id"] == "src-course-study-expressions"
        )
        reference["evidence_kind"] = "instructor_speech"
        reference["relationship_kind"] = "derived_from"
        reference["source_locator"] = "# TSC 필수표현 암기장"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_input_reader_rejects_a_symlinked_markdown_path(self) -> None:
        importer = load_importer_module()
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_root = Path(temporary_directory)
            input_root = temporary_root / "other-output"
            input_root.mkdir()
            external_file = temporary_root / "external.md"
            external_file.write_text("# external\n", encoding="utf-8")
            symlink_path = input_root / "input.md"
            symlink_path.symlink_to(external_file)
            relative_path = "other-output/input.md"

            with (
                mock.patch.object(importer, "ROOT", temporary_root),
                mock.patch.object(importer, "INPUT_PATHS", (relative_path,)),
            ):
                with self.assertRaises(importer.ImportError):
                    importer._safe_input_path(relative_path)

    def test_validator_binds_instructor_locator_to_evidence_anchor(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        reference = next(
            item
            for item in payloads["source-references.json"]
            if item["source_reference_id"] == "sr-ci-course-p2-accuracy-01"
        )
        sources_by_id = {
            item["source_id"]: item for item in payloads["sources.json"]
        }
        relative_path = sources_by_id[reference["source_id"]]["file_ref"]
        original_read_text = importer._read_text
        source_text = original_read_text(relative_path)
        evidence_line = next(
            line
            for line in source_text.splitlines()
            if reference["source_locator"] in line
            and "짧고 정확하게" in line
        )
        tampered_text = source_text.replace(
            evidence_line,
            reference["source_locator"],
        )

        def read_tampered_source(path: str) -> str:
            if path == relative_path:
                return tampered_text
            return original_read_text(path)

        with mock.patch.object(
            importer,
            "_read_text",
            side_effect=read_tampered_source,
        ):
            with self.assertRaises(importer.ImportError):
                importer._validate_payloads(payloads)

    def test_validator_rejects_an_unbound_non_instructor_locator(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        reference = next(
            item
            for item in payloads["source-references.json"]
            if item["source_reference_id"] == "sr-part-guide-01-01"
        )
        reference["source_locator"] = "존재하지 않는 문단과 행"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_requires_every_composite_locator_selector(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        reference = next(
            item
            for item in payloads["source-references.json"]
            if item["source_reference_id"] == "sr-part-guide-01-01"
        )
        reference["source_locator"] = (
            "## 3. 문제 유형별 완전 정리 / Part 999 DOES NOT EXIST"
        )

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_binds_conflict_locators_to_their_sources(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        payloads["conflicts.json"][0]["evidence_locations"][0][
            "source_locator"
        ] = "존재하지 않는 근거 위치"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_rejects_conflict_evidence_provenance_escalation(
        self,
    ) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        conflict = next(
            item
            for item in payloads["conflicts.json"]
            if item["conflict_id"] == "conf-p02-page-citation"
        )
        conflict["evidence_kind"] = "instructor_speech"
        conflict["evidence_locations"][0][
            "evidence_kind"
        ] = "instructor_speech"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_requires_conflict_evidence_kind_to_match_a_location(
        self,
    ) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        conflict = next(
            item
            for item in payloads["conflicts.json"]
            if item["conflict_id"] == "conf-correction-01"
        )
        conflict["evidence_kind"] = "instructor_speech"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_preserves_complete_learning_expression_source_rows(
        self,
    ) -> None:
        importer = load_importer_module()
        mutations = (
            (0, ("language", "zh"), "我"),
            (0, ("language", "ko"), "제"),
            (15, ("language", "pinyin"), "wrong pinyin"),
            (0, ("notes",), "원본 병음 셀: fabricated"),
        )
        for index, path, replacement in mutations:
            with self.subTest(index=index, path=path):
                payloads = copy.deepcopy(self.payloads)
                payloads.pop("manifest.json")
                target = payloads["learning-expressions.json"][index]
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = replacement

                with self.assertRaises(importer.ImportError):
                    importer._validate_payloads(payloads)

    def test_validator_binds_source_metadata_to_registered_markdown(
        self,
    ) -> None:
        importer = load_importer_module()
        mutations = (
            ("title", ""),
            ("original_file_name", "fabricated.md"),
            ("sha256", "0" * 64),
            ("claimed_original_names", ["fabricated.mp4"]),
            ("source_type", "pdf"),
            ("evidence_kind", "screen_text"),
        )
        for field, replacement in mutations:
            with self.subTest(field=field):
                payloads = copy.deepcopy(self.payloads)
                payloads.pop("manifest.json")
                payloads["sources.json"][0][field] = replacement
                with self.assertRaises(importer.ImportError):
                    importer._validate_payloads(payloads)

    def test_validator_uses_entity_specific_working_statuses(self) -> None:
        importer = load_importer_module()
        targets = (
            ("learning-expressions.json", "status"),
            ("pronunciation-items.json", "status"),
            ("practice-drills.json", "status"),
            ("course-insights.json", "confidence_or_status"),
        )
        for file_name, field in targets:
            with self.subTest(file_name=file_name):
                payloads = copy.deepcopy(self.payloads)
                payloads.pop("manifest.json")
                payloads[file_name][0][field] = "draft"
                with self.assertRaises(importer.ImportError):
                    importer._validate_payloads(payloads)

    def test_validator_rejects_empty_required_content_and_nonpositive_time(
        self,
    ) -> None:
        importer = load_importer_module()
        mutations = (
            ("pronunciation-items.json", 0, "target_text", ""),
            ("pronunciation-items.json", 0, "pronunciation_focus", ""),
            ("pronunciation-items.json", 0, "explanation_ko", ""),
            ("practice-drills.json", 0, "prompt_or_task", ""),
            ("practice-drills.json", 0, "completion_criteria", ""),
            ("course-insights.json", 0, "content_ko", ""),
            ("part-guides.json", 0, "response_seconds", -1),
            ("practice-drills.json", 1, "preparation_seconds", -5),
        )
        for file_name, index, field, replacement in mutations:
            with self.subTest(file_name=file_name, field=field):
                payloads = copy.deepcopy(self.payloads)
                payloads.pop("manifest.json")
                payloads[file_name][index][field] = replacement
                with self.assertRaises(importer.ImportError):
                    importer._validate_payloads(payloads)

    def test_validator_rejects_invented_pronunciation_and_correction_pinyin(
        self,
    ) -> None:
        importer = load_importer_module()
        pronunciation_payloads = copy.deepcopy(self.payloads)
        pronunciation_payloads.pop("manifest.json")
        pronunciation_payloads["pronunciation-items.json"][0][
            "pinyin_or_sound"
        ] = "fabricated"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(pronunciation_payloads)

        correction_payloads = copy.deepcopy(self.payloads)
        correction_payloads.pop("manifest.json")
        blocker = next(
            item
            for item in correction_payloads["conflicts.json"]
            if item["conflict_id"] == "conf-correction-01"
        )
        blocker["candidate"]["wrong_pinyin"] = "fabricated"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(correction_payloads)

    def test_validator_preserves_exact_correction_candidate_content(self) -> None:
        importer = load_importer_module()
        for field in ("wrong", "correct", "error_type"):
            with self.subTest(field=field):
                payloads = copy.deepcopy(self.payloads)
                payloads.pop("manifest.json")
                blocker = next(
                    item
                    for item in payloads["conflicts.json"]
                    if item["conflict_id"] == "conf-correction-01"
                )
                blocker["candidate"][field] = "fabricated"
                with self.assertRaises(importer.ImportError):
                    importer._validate_payloads(payloads)

    def test_validator_enforces_part_semantics_across_guides_and_drills(
        self,
    ) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        drill = next(
            item
            for item in payloads["practice-drills.json"]
            if item["drill_id"] == "drill-course-p1-pronunciation-warmup"
        )
        drill["part"] = 5

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_requires_nonempty_source_references(self) -> None:
        importer = load_importer_module()
        empty_owner_payloads = copy.deepcopy(self.payloads)
        empty_owner_payloads.pop("manifest.json")
        empty_owner_payloads["part-guides.json"][0][
            "source_reference_ids"
        ] = []
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(empty_owner_payloads)

        empty_id_payloads = copy.deepcopy(self.payloads)
        empty_id_payloads.pop("manifest.json")
        reference = empty_id_payloads["source-references.json"][0]
        previous_id = reference["source_reference_id"]
        reference["source_reference_id"] = ""
        owner = next(
            item
            for item in empty_id_payloads["part-guides.json"]
            if previous_id in item["source_reference_ids"]
        )
        owner["source_reference_ids"] = [""]
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(empty_id_payloads)

    def test_validator_rejects_incompatible_source_relationships(self) -> None:
        importer = load_importer_module()
        unverified_self_created = copy.deepcopy(self.payloads)
        unverified_self_created.pop("manifest.json")
        reference = next(
            item
            for item in unverified_self_created["source-references.json"]
            if item["source_id"] == "src-course-analysis-integrated"
        )
        reference["relationship_kind"] = "self_created"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(unverified_self_created)

        self_created_instructor = copy.deepcopy(self.payloads)
        self_created_instructor.pop("manifest.json")
        reference = next(
            item
            for item in self_created_instructor["source-references.json"]
            if item["source_id"] == "src-course-study-expressions"
        )
        reference["evidence_kind"] = "instructor_speech"
        reference["relationship_kind"] = "derived_from"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(self_created_instructor)

    def test_validator_rejects_incompatible_source_type_triads(self) -> None:
        importer = load_importer_module()
        self_created_as_pdf = copy.deepcopy(self.payloads)
        self_created_as_pdf.pop("manifest.json")
        source = next(
            item
            for item in self_created_as_pdf["sources.json"]
            if item["source_id"] == "src-course-study-expressions"
        )
        source["source_type"] = "pdf"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(self_created_as_pdf)

        analysis_as_self_created = copy.deepcopy(self.payloads)
        analysis_as_self_created.pop("manifest.json")
        source = next(
            item
            for item in analysis_as_self_created["sources.json"]
            if item["source_id"] == "src-course-analysis-integrated"
        )
        source["source_type"] = "self_created"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(analysis_as_self_created)

    def test_validator_requires_entity_evidence_to_match_a_reference(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        payloads["practice-drills.json"][0][
            "evidence_kind"
        ] = "instructor_speech"

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_restricts_drill_required_content_types(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        drill = payloads["practice-drills.json"][0]
        drill["required_content_ids"] = [drill["drill_id"]]

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_rejects_wrong_reference_ownership(self) -> None:
        importer = load_importer_module()
        payloads = copy.deepcopy(self.payloads)
        payloads.pop("manifest.json")
        expression_reference = next(
            item["source_reference_id"]
            for item in payloads["source-references.json"]
            if item["target_type"] == "learning_expression"
        )
        payloads["part-guides.json"][0]["source_reference_ids"] = [
            expression_reference
        ]

        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(payloads)

    def test_validator_rejects_duplicate_and_dangling_entity_ids(self) -> None:
        importer = load_importer_module()
        duplicate_payloads = copy.deepcopy(self.payloads)
        duplicate_payloads.pop("manifest.json")
        duplicate_payloads["part-guides.json"].append(
            copy.deepcopy(duplicate_payloads["part-guides.json"][0])
        )
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(duplicate_payloads)

        dangling_payloads = copy.deepcopy(self.payloads)
        dangling_payloads.pop("manifest.json")
        dangling_payloads["part-guides.json"][0][
            "representative_drill_ids"
        ] = ["drill-does-not-exist"]
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(dangling_payloads)

    def test_validator_rejects_unknown_fields_and_invalid_enums(self) -> None:
        importer = load_importer_module()
        unknown_payloads = copy.deepcopy(self.payloads)
        unknown_payloads.pop("manifest.json")
        unknown_payloads["part-guides.json"][0][
            "last_reviewed_at"
        ] = "2026-07-26"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(unknown_payloads)

        relationship_payloads = copy.deepcopy(self.payloads)
        relationship_payloads.pop("manifest.json")
        relationship_payloads["source-references.json"][0][
            "relationship_kind"
        ] = "invented"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(relationship_payloads)

        target_payloads = copy.deepcopy(self.payloads)
        target_payloads.pop("manifest.json")
        target_payloads["course-insights.json"][0][
            "course_target_context"
        ] = "level_8"
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(target_payloads)

    def test_validator_rejects_wrong_scalar_types(self) -> None:
        importer = load_importer_module()
        boolean_part_payloads = copy.deepcopy(self.payloads)
        boolean_part_payloads.pop("manifest.json")
        boolean_part_payloads["part-guides.json"][0]["part"] = True
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(boolean_part_payloads)

        numeric_title_payloads = copy.deepcopy(self.payloads)
        numeric_title_payloads.pop("manifest.json")
        numeric_title_payloads["sources.json"][0]["title"] = 7
        with self.assertRaises(importer.ImportError):
            importer._validate_payloads(numeric_title_payloads)

    def test_part_guides_cover_all_parts_and_keep_six_and_seven_sparse(self) -> None:
        guides = self.payloads["part-guides.json"]
        self.assertEqual([item["part"] for item in guides], list(range(1, 8)))
        self.assertTrue(all(item["guide_status"] == "draft" for item in guides))
        for part in (6, 7):
            guide = next(item for item in guides if item["part"] == part)
            self.assertEqual(guide["response_structure"], [])
            self.assertIn("근거 부족", guide["notes"])
        for guide in guides:
            self.assertNotIn("name", guide)
            self.assertEqual(guide["course_target_context"], "level_3")
            self.assertEqual(guide["evidence_kind"], "analyst_synthesis")

    def test_corrections_remain_empty_and_all_nine_pairs_are_blocked(self) -> None:
        self.assertEqual(self.payloads["corrections.json"], [])
        blockers = [
            item
            for item in self.payloads["conflicts.json"]
            if item["conflict_type"] == "correction_blocker"
        ]
        self.assertEqual(len(blockers), 9)
        self.assertEqual(
            [item["candidate"]["sequence"] for item in blockers],
            list(range(1, 10)),
        )
        self.assertEqual(
            [
                item["evidence_locations"][0]["source_locator"]
                for item in blockers
            ],
            [
                "## 9. 수강생 실수 데이터베이스 / 哥哥比弟弟很高。",
                "## 9. 수강생 실수 데이터베이스 / 我10年工作了。",
                "## 9. 수강생 실수 데이터베이스 / 他们在图书馆做读书。",
                "## 9. 수강생 실수 데이터베이스 / 每天每天努力学习了。",
                "## 9. 수강생 실수 데이터베이스 / 物价越来越很贵。",
                "## 9. 수강생 실수 데이터베이스 / 一个小时半",
                "## 9. 수강생 실수 데이터베이스 / 健身房对天气不影响。",
                "## 9. 수강생 실수 데이터베이스 / 香蕉很更重。",
                "## 9. 수강생 실수 데이터베이스 / 不是，她在跳舞。",
            ],
        )
        for item in blockers[:8]:
            self.assertTrue(item["candidate"]["wrong"])
        self.assertEqual(blockers[8]["candidate"]["wrong"], "")
        self.assertTrue(blockers[8]["candidate"]["wrong_description"])
        for item in blockers:
            self.assertTrue(item["candidate"]["correct"])
            self.assertIn("병음", item["detail"])
            self.assertEqual(item["conflict_status"], "review_needed")
            self.assertIn(item["evidence_kind"], ALLOWED_EVIDENCE_KINDS)
            self.assertTrue(
                item.get("source_reference_ids") or item.get("evidence_locations")
            )

    def test_learning_expressions_parse_all_rows_without_generating_pinyin(self) -> None:
        expressions = self.payloads["learning-expressions.json"]
        self.assertEqual(len(expressions), 37)
        self.assertEqual(
            [item["expression_id"] for item in expressions],
            [f"le-course-{index:03d}" for index in range(1, 38)],
        )
        self.assertEqual(
            [
                index
                for index, item in enumerate(expressions, start=1)
                if item["language"]["pinyin"]
            ],
            [16, 17, 18],
        )
        for index, item in enumerate(expressions, start=1):
            self.assertEqual(set(item), LEARNING_EXPRESSION_SCHEMA_FIELDS)
            self.assertNotIn("learning_expression_id", item)
            self.assertNotIn("expression_status", item)
            self.assertTrue(item["language"]["zh"])
            self.assertEqual(set(item["language"]), {"zh", "pinyin", "ko"})
            self.assertIn("원본 병음 셀:", item["notes"])
            self.assertIn(item["status"], {"raw", "review_needed"})
            self.assertEqual(item["evidence_kind"], "generated_study_material")
            if index not in (16, 17, 18):
                self.assertEqual(item["language"]["pinyin"], "")
        self.assertEqual(
            [item["expression_type"] for item in expressions[:3]],
            ["fixed_response", "fixed_response", "fixed_response"],
        )

    def test_conservative_learning_outputs_have_sources_and_no_schedule(self) -> None:
        pronunciation = self.payloads["pronunciation-items.json"]
        drills = self.payloads["practice-drills.json"]
        insights = self.payloads["course-insights.json"]
        self.assertGreater(len(pronunciation), 0)
        self.assertGreater(len(drills), 0)
        self.assertGreater(len(insights), 0)
        self.assertEqual(
            [item["pronunciation_item_id"] for item in pronunciation],
            EXPECTED_PRONUNCIATION_IDS,
        )
        self.assertEqual(
            [item["drill_id"] for item in drills],
            EXPECTED_DRILL_IDS,
        )
        self.assertTrue(
            REQUIRED_INSIGHT_IDS.issubset(
                {item["insight_id"] for item in insights}
            )
        )
        insight_by_id = {item["insight_id"]: item for item in insights}
        self.assertEqual(
            {
                insight_id: insight_by_id[insight_id]["content_ko"]
                for insight_id in REQUIRED_INSIGHT_CONTENT
            },
            REQUIRED_INSIGHT_CONTENT,
        )
        references_by_id = {
            item["source_reference_id"]: item
            for item in self.payloads["source-references.json"]
        }
        sources_by_id = {
            item["source_id"]: item for item in self.payloads["sources.json"]
        }
        for drill in drills[:5]:
            source_ids = {
                references_by_id[reference_id]["source_id"]
                for reference_id in drill["source_reference_ids"]
            }
            self.assertEqual(
                source_ids,
                {
                    "src-course-study-review-plan",
                    "src-course-analysis-integrated",
                },
            )
        for item in pronunciation:
            self.assertEqual(set(item), PRONUNCIATION_ITEM_FIELDS)
            self.assertIn(item["status"], ALLOWED_STATES)
            self.assertTrue(item["source_reference_ids"])
            self.assertEqual(item["evidence_kind"], "instructor_speech")
            item_references = [
                references_by_id[reference_id]
                for reference_id in item["source_reference_ids"]
            ]
            self.assertTrue(
                any(
                    reference["evidence_kind"] == "instructor_speech"
                    and reference["source_locator"]
                    in (
                        ROOT
                        / sources_by_id[reference["source_id"]]["file_ref"]
                    ).read_text(encoding="utf-8")
                    for reference in item_references
                )
            )
        for item in drills:
            self.assertTrue(set(item).issubset(PRACTICE_DRILL_FIELDS))
            self.assertTrue(
                {
                    "drill_id",
                    "drill_type",
                    "prompt_or_task",
                    "status",
                    "evidence_kind",
                    "source_reference_ids",
                    "notes",
                }.issubset(item.keys())
            )
            if "part" in item:
                self.assertIsInstance(item["part"], int)
            self.assertIn(item["status"], ALLOWED_STATES)
            self.assertTrue(item["source_reference_ids"])
        for item in insights:
            self.assertEqual(set(item), COURSE_INSIGHT_FIELDS)
            self.assertIn(item["confidence_or_status"], ALLOWED_STATES)
            self.assertTrue(item["source_reference_ids"])

        serialized = json.dumps(drills, ensure_ascii=False)
        for forbidden in ("repeat_count", "schedule_days", "next_review_at"):
            self.assertNotIn(forbidden, serialized)

        direct_insight_ids = REQUIRED_INSIGHT_IDS - {
            "ci-course-part6-7-gap"
        }
        for insight_id in direct_insight_ids:
            insight = insight_by_id[insight_id]
            self.assertEqual(insight["evidence_kind"], "instructor_speech")
            self.assertTrue(
                any(
                    references_by_id[reference_id]["evidence_kind"]
                    == "instructor_speech"
                    and references_by_id[reference_id]["source_locator"]
                    in (
                        ROOT
                        / sources_by_id[
                            references_by_id[reference_id]["source_id"]
                        ]["file_ref"]
                    ).read_text(encoding="utf-8")
                    for reference_id in insight["source_reference_ids"]
                )
            )
        self.assertEqual(
            insight_by_id["ci-course-part6-7-gap"]["evidence_kind"],
            "analyst_synthesis",
        )

    def test_strict_answer_and_question_link_candidates_stay_empty(self) -> None:
        self.assertEqual(self.payloads["model-answer-candidates.json"], [])
        self.assertEqual(self.payloads["question-link-candidates.json"], [])

    def test_conflicts_include_all_required_non_correction_issues(self) -> None:
        conflicts = self.payloads["conflicts.json"]
        issue_codes = {item["issue_code"] for item in conflicts}
        required = {
            "lesson04_grade_wording",
            "p02_internal_title",
            "p04_internal_title",
            "cumulative_pdf_overlap",
            "p02_page_citation_mismatch",
            "d05_eye_glasses_ambiguity",
            "d05_strikethrough_semantics",
            "d05_page_marker_not_physical",
            "duplicate_video_04",
            "duplicate_video_06_07",
            "originals_absent",
            "grade_level_ambiguity",
            "part6_insufficient_evidence",
            "part7_insufficient_evidence",
        }
        self.assertTrue(required.issubset(issue_codes), required - issue_codes)
        for item in conflicts:
            self.assertIn(item["evidence_kind"], ALLOWED_EVIDENCE_KINDS)
            self.assertTrue(
                item.get("source_reference_ids") or item.get("evidence_locations")
            )

        fourth_correction = next(
            item
            for item in conflicts
            if item["conflict_id"] == "conf-correction-04"
        )
        self.assertIn("document_text", fourth_correction["detail"])
        self.assertEqual(
            fourth_correction["candidate"]["document_text_variants"],
            {
                "wrong": "因为我每天都每天努力学习了。",
                "correct": "因为我每天都努力学了。",
            },
        )
        self.assertTrue(
            any(
                location["source_id"] == "src-course-extract-pdf-04"
                and location["evidence_kind"] == "document_text"
                for location in fourth_correction["evidence_locations"]
            )
        )

    def test_manifest_has_deterministic_hashes_counts_and_no_timestamp(self) -> None:
        manifest = self.payloads["manifest.json"]
        self.assertEqual(manifest["dataset_id"], "course-working-import-v1")
        self.assertEqual(manifest["dataset_status"], "working")
        self.assertNotIn("generated_at", manifest)
        self.assertEqual(
            [item["path"] for item in manifest["input_files"]],
            list(INPUT_PATHS),
        )
        self.assertEqual(len(manifest["input_files"]), 20)
        for item in manifest["input_files"]:
            self.assertEqual(item["sha256"], sha256(ROOT / item["path"]))

        generated = manifest["generated_files"]
        self.assertEqual(
            [item["path"] for item in generated],
            [name for name in OUTPUT_FILES if name != "manifest.json"],
        )
        for item in generated:
            self.assertEqual(item["sha256"], sha256(self.output_dir / item["path"]))

        self.assertEqual(manifest["counts"]["sources"], 20)
        self.assertEqual(manifest["counts"]["part_guides"], 7)
        self.assertEqual(manifest["counts"]["corrections"], 0)
        self.assertEqual(manifest["counts"]["learning_expressions"], 37)
        self.assertEqual(manifest["counts"]["model_answer_candidates"], 0)
        self.assertEqual(manifest["counts"]["question_link_candidates"], 0)

    def test_validate_only_detects_tampering(self) -> None:
        valid = run_builder(
            "--validate-only", "--output-dir", str(self.output_dir)
        )
        self.assertEqual(valid.returncode, 0, valid.stderr)

        target = self.output_dir / "course-insights.json"
        original = target.read_bytes()
        try:
            target.write_bytes(original + b" ")
            invalid = run_builder(
                "--validate-only", "--output-dir", str(self.output_dir)
            )
            self.assertNotEqual(invalid.returncode, 0)
            self.assertIn("hash", (invalid.stderr + invalid.stdout).lower())
        finally:
            target.write_bytes(original)

    def test_validate_only_recomputes_expected_payloads(self) -> None:
        target = self.output_dir / "course-insights.json"
        manifest_path = self.output_dir / "manifest.json"
        original_target = target.read_bytes()
        original_manifest = manifest_path.read_bytes()
        try:
            payload = json.loads(original_target)
            payload[0]["content_ko"] += " 변조"
            target.write_bytes(
                (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode(
                    "utf-8"
                )
            )
            manifest = json.loads(original_manifest)
            generated = {
                item["path"]: item for item in manifest["generated_files"]
            }
            generated["course-insights.json"]["sha256"] = sha256(target)
            manifest_path.write_bytes(
                (
                    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
                ).encode("utf-8")
            )

            invalid = run_builder(
                "--validate-only", "--output-dir", str(self.output_dir)
            )
            self.assertNotEqual(invalid.returncode, 0)
            self.assertIn(
                "expected",
                (invalid.stderr + invalid.stdout).lower(),
            )
        finally:
            target.write_bytes(original_target)
            manifest_path.write_bytes(original_manifest)

    def test_validate_only_requires_complete_manifest_file_list(self) -> None:
        manifest_path = self.output_dir / "manifest.json"
        original = manifest_path.read_bytes()
        try:
            manifest = json.loads(original)
            manifest["generated_files"] = [
                item
                for item in manifest["generated_files"]
                if item["path"] != "course-insights.json"
            ]
            manifest_path.write_bytes(
                (
                    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
                ).encode("utf-8")
            )
            invalid = run_builder(
                "--validate-only", "--output-dir", str(self.output_dir)
            )
            self.assertNotEqual(invalid.returncode, 0)
        finally:
            manifest_path.write_bytes(original)

    def test_validate_only_rejects_manifest_metadata_tampering(self) -> None:
        manifest_path = self.output_dir / "manifest.json"
        original = manifest_path.read_bytes()
        try:
            manifest = json.loads(original)
            manifest["dataset_status"] = "reviewed"
            manifest["unexpected"] = "not part of the deterministic contract"
            manifest_path.write_bytes(
                (
                    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
                ).encode("utf-8")
            )
            invalid = run_builder(
                "--validate-only", "--output-dir", str(self.output_dir)
            )
            self.assertNotEqual(invalid.returncode, 0)
            self.assertIn(
                "manifest",
                (invalid.stderr + invalid.stdout).lower(),
            )
        finally:
            manifest_path.write_bytes(original)

    def test_validate_only_rejects_an_internal_output_symlink(self) -> None:
        readme_path = self.output_dir / "README.md"
        external_path = self.temporary_root / "external-readme.md"
        external_path.write_bytes(readme_path.read_bytes())
        readme_path.unlink()
        readme_path.symlink_to(external_path)
        try:
            invalid = run_builder(
                "--validate-only", "--output-dir", str(self.output_dir)
            )
            self.assertNotEqual(invalid.returncode, 0)
            self.assertIn(
                "symlink",
                (invalid.stderr + invalid.stdout).lower(),
            )
        finally:
            readme_path.unlink()
            readme_path.write_bytes(external_path.read_bytes())

    def test_two_builds_are_byte_identical(self) -> None:
        first = self.temporary_root / "first"
        second = self.temporary_root / "second"
        first_result = run_builder("--output-dir", str(first))
        second_result = run_builder("--output-dir", str(second))
        self.assertEqual(first_result.returncode, 0, first_result.stderr)
        self.assertEqual(second_result.returncode, 0, second_result.stderr)
        self.assertEqual(
            {name: sha256(first / name) for name in OUTPUT_FILES},
            {name: sha256(second / name) for name in OUTPUT_FILES},
        )

    def test_failed_atomic_publish_preserves_the_previous_generation(
        self,
    ) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "atomic-output"
        importer._write_directory(output_dir)
        hashes_before = {
            name: sha256(output_dir / name) for name in OUTPUT_FILES
        }
        identity_before = importer._directory_identity(output_dir)

        with mock.patch.object(
            importer,
            "_atomic_exchange_directories",
            side_effect=OSError("injected exchange failure"),
        ):
            with self.assertRaises(OSError):
                importer._write_directory(output_dir)

        self.assertEqual(
            {name: sha256(output_dir / name) for name in OUTPUT_FILES},
            hashes_before,
        )
        self.assertEqual(
            importer._directory_identity(output_dir),
            identity_before,
        )

    def test_failed_publish_parent_fsync_rolls_back_previous_generation(
        self,
    ) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "fsync-output"
        importer._write_directory(output_dir)
        hashes_before = {
            name: sha256(output_dir / name) for name in OUTPUT_FILES
        }
        identity_before = importer._directory_identity(output_dir)
        original_fsync_directory = importer._fsync_directory

        def fail_parent_fsync(path: Path) -> None:
            if path == output_dir.parent:
                raise OSError("injected parent fsync failure")
            original_fsync_directory(path)

        with mock.patch.object(
            importer,
            "_fsync_directory",
            side_effect=fail_parent_fsync,
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertEqual(
            {name: sha256(output_dir / name) for name in OUTPUT_FILES},
            hashes_before,
        )
        self.assertEqual(
            importer._directory_identity(output_dir),
            identity_before,
        )

    def test_input_change_after_exchange_rolls_back_previous_generation(
        self,
    ) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "input-race-output"
        importer._write_directory(output_dir)
        identity_before = importer._directory_identity(output_dir)
        hashes_before = {
            name: sha256(output_dir / name) for name in OUTPUT_FILES
        }
        original_input_manifest = importer._input_manifest
        original_exchange = importer._atomic_exchange_directories
        exchange_completed = False

        def track_exchange(left: Path, right: Path) -> None:
            nonlocal exchange_completed
            original_exchange(left, right)
            exchange_completed = not exchange_completed

        def changed_input_manifest():
            manifest = copy.deepcopy(original_input_manifest())
            if exchange_completed:
                manifest[0]["sha256"] = "0" * 64
            return manifest

        with (
            mock.patch.object(
                importer,
                "_atomic_exchange_directories",
                side_effect=track_exchange,
            ),
            mock.patch.object(
                importer,
                "_input_manifest",
                side_effect=changed_input_manifest,
            ),
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertEqual(
            importer._directory_identity(output_dir),
            identity_before,
        )
        self.assertEqual(
            {name: sha256(output_dir / name) for name in OUTPUT_FILES},
            hashes_before,
        )

    def test_output_path_replaced_after_exchange_rolls_back_safely(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "post-exchange-race-output"
        displaced_new_output = (
            self.temporary_root / "post-exchange-new-generation"
        )
        importer._write_directory(output_dir)
        identity_before = importer._directory_identity(output_dir)
        original_exchange = importer._atomic_exchange_directories
        original_fsync_directory = importer._fsync_directory
        exchange_count = 0
        fsynced_directories: list[Path] = []

        def replace_output_after_first_exchange(left: Path, right: Path) -> None:
            nonlocal exchange_count
            original_exchange(left, right)
            exchange_count += 1
            if exchange_count == 1:
                left.rename(displaced_new_output)
                left.mkdir()
                (left / "user-owned.txt").write_text(
                    "preserve me\n",
                    encoding="utf-8",
                )

        def record_fsync(path: Path) -> None:
            fsynced_directories.append(path)
            original_fsync_directory(path)

        with (
            mock.patch.object(
                importer,
                "_atomic_exchange_directories",
                side_effect=replace_output_after_first_exchange,
            ),
            mock.patch.object(
                importer,
                "_fsync_directory",
                side_effect=record_fsync,
            ),
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertEqual(
            importer._directory_identity(output_dir),
            identity_before,
        )
        self.assertTrue((output_dir / "manifest.json").is_file())
        self.assertTrue((displaced_new_output / "manifest.json").is_file())
        preserved_sentinels = list(
            self.temporary_root.glob(
                ".post-exchange-race-output-*/user-owned.txt"
            )
        )
        self.assertEqual(len(preserved_sentinels), 1)
        self.assertEqual(
            preserved_sentinels[0].read_text(encoding="utf-8"),
            "preserve me\n",
        )
        self.assertIn(output_dir.parent, fsynced_directories)

    def test_output_path_replaced_during_commit_fsync_rolls_back(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "fsync-race-output"
        displaced_new_output = self.temporary_root / "fsync-new-generation"
        importer._write_directory(output_dir)
        identity_before = importer._directory_identity(output_dir)
        original_fsync_directory = importer._fsync_directory
        output_replaced = False

        def replace_output_during_parent_fsync(path: Path) -> None:
            nonlocal output_replaced
            original_fsync_directory(path)
            if path == output_dir.parent and not output_replaced:
                output_dir.rename(displaced_new_output)
                output_dir.mkdir()
                (output_dir / "user-owned.txt").write_text(
                    "preserve me\n",
                    encoding="utf-8",
                )
                output_replaced = True

        with mock.patch.object(
            importer,
            "_fsync_directory",
            side_effect=replace_output_during_parent_fsync,
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertEqual(
            importer._directory_identity(output_dir),
            identity_before,
        )
        self.assertTrue((displaced_new_output / "manifest.json").is_file())
        preserved_sentinels = list(
            self.temporary_root.glob(".fsync-race-output-*/user-owned.txt")
        )
        self.assertEqual(len(preserved_sentinels), 1)

    def test_file_added_before_old_generation_cleanup_is_preserved(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "cleanup-race-output"
        importer._write_directory(output_dir)
        original_fsync_directory = importer._fsync_directory
        sentinel_path: Path | None = None

        def add_file_before_cleanup(path: Path) -> None:
            nonlocal sentinel_path
            if path == output_dir.parent and sentinel_path is None:
                candidates = list(
                    self.temporary_root.glob(".cleanup-race-output-*")
                )
                self.assertEqual(len(candidates), 1)
                sentinel_path = candidates[0] / "user-owned.txt"
                sentinel_path.write_text("preserve me\n", encoding="utf-8")
            original_fsync_directory(path)

        with mock.patch.object(
            importer,
            "_fsync_directory",
            side_effect=add_file_before_cleanup,
        ):
            importer._write_directory(output_dir)

        self.assertIsNotNone(sentinel_path)
        assert sentinel_path is not None
        self.assertEqual(
            sentinel_path.read_text(encoding="utf-8"),
            "preserve me\n",
        )
        self.assertTrue((output_dir / "manifest.json").is_file())

    def test_known_file_substituted_before_cleanup_is_preserved(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "cleanup-substitution-output"
        importer._write_directory(output_dir)
        original_validate_owned = importer._validate_owned_output_generation
        calls_by_path: dict[Path, int] = {}
        substituted_path: Path | None = None

        def substitute_after_cleanup_validation(path: Path, *args, **kwargs):
            nonlocal substituted_path
            result = original_validate_owned(path, *args, **kwargs)
            calls_by_path[path] = calls_by_path.get(path, 0) + 1
            if (
                path.name.startswith(".cleanup-substitution-output-")
                and calls_by_path[path] == 2
            ):
                substituted_path = path / "README.md"
                substituted_path.unlink()
                substituted_path.write_text(
                    "preserve substituted file\n",
                    encoding="utf-8",
                )
            return result

        with mock.patch.object(
            importer,
            "_validate_owned_output_generation",
            side_effect=substitute_after_cleanup_validation,
        ):
            importer._write_directory(output_dir)

        self.assertIsNotNone(substituted_path)
        assert substituted_path is not None
        self.assertEqual(
            substituted_path.read_text(encoding="utf-8"),
            "preserve substituted file\n",
        )
        self.assertTrue((output_dir / "manifest.json").is_file())

    def test_cleanup_lock_failure_preserves_the_previous_generation(
        self,
    ) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "cleanup-lock-output"
        importer._write_directory(output_dir)
        identity_before = importer._directory_identity(output_dir)
        hashes_before = {
            name: sha256(output_dir / name) for name in OUTPUT_FILES
        }

        with mock.patch.object(
            importer.fcntl,
            "flock",
            side_effect=BlockingIOError("injected lock contention"),
        ):
            with self.assertRaises(importer.ImportError):
                importer._remove_owned_output_generation(
                    output_dir,
                    identity_before,
                )

        self.assertEqual(
            importer._directory_identity(output_dir),
            identity_before,
        )
        self.assertEqual(
            {name: sha256(output_dir / name) for name in OUTPUT_FILES},
            hashes_before,
        )

    def test_cleanup_file_identity_includes_ctime(self) -> None:
        importer = load_importer_module()
        target = self.temporary_root / "ctime-identity.txt"
        target.write_bytes(b"before")
        metadata_before = target.stat()
        identity_before = importer._regular_file_identity(target)

        target.write_bytes(b"after!")
        os.utime(
            target,
            ns=(metadata_before.st_atime_ns, metadata_before.st_mtime_ns),
        )
        identity_after = importer._regular_file_identity(target)

        self.assertEqual(identity_before[:4], identity_after[:4])
        self.assertNotEqual(identity_before, identity_after)

    def test_replaced_output_after_ownership_check_is_not_deleted(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "race-output"
        displaced_output = self.temporary_root / "race-output-displaced"
        importer._write_directory(output_dir)
        original_build_payloads = importer._build_payloads
        output_replaced = False

        def replace_output_during_build():
            nonlocal output_replaced
            if not output_replaced:
                output_dir.rename(displaced_output)
                output_dir.mkdir()
                (output_dir / "user-owned.txt").write_text(
                    "preserve me\n",
                    encoding="utf-8",
                )
                output_replaced = True
            return original_build_payloads()

        with mock.patch.object(
            importer,
            "_build_payloads",
            side_effect=replace_output_during_build,
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertEqual(
            (output_dir / "user-owned.txt").read_text(encoding="utf-8"),
            "preserve me\n",
        )
        self.assertTrue((displaced_output / "manifest.json").is_file())

    def test_same_output_inode_with_new_unowned_file_is_not_deleted(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "same-inode-race-output"
        importer._write_directory(output_dir)
        original_build_payloads = importer._build_payloads
        output_modified = False

        def add_unowned_file_during_build():
            nonlocal output_modified
            if not output_modified:
                (output_dir / "user-owned.txt").write_text(
                    "preserve me\n",
                    encoding="utf-8",
                )
                output_modified = True
            return original_build_payloads()

        with mock.patch.object(
            importer,
            "_build_payloads",
            side_effect=add_unowned_file_during_build,
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertEqual(
            (output_dir / "user-owned.txt").read_text(encoding="utf-8"),
            "preserve me\n",
        )
        self.assertTrue((output_dir / "manifest.json").is_file())

    def test_symlink_swapped_after_ownership_check_is_restored(self) -> None:
        importer = load_importer_module()
        output_dir = self.temporary_root / "symlink-race-output"
        displaced_output = self.temporary_root / "symlink-race-displaced"
        external_dir = self.temporary_root / "external-user-directory"
        external_dir.mkdir()
        sentinel = external_dir / "user-owned.txt"
        sentinel.write_text("preserve me\n", encoding="utf-8")
        importer._write_directory(output_dir)
        original_build_payloads = importer._build_payloads
        output_replaced = False

        def replace_output_with_symlink():
            nonlocal output_replaced
            if not output_replaced:
                output_dir.rename(displaced_output)
                output_dir.symlink_to(external_dir, target_is_directory=True)
                output_replaced = True
            return original_build_payloads()

        with mock.patch.object(
            importer,
            "_build_payloads",
            side_effect=replace_output_with_symlink,
        ):
            with self.assertRaises(importer.ImportError):
                importer._write_directory(output_dir)

        self.assertTrue(output_dir.is_symlink())
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "preserve me\n")
        self.assertTrue((displaced_output / "manifest.json").is_file())

    def test_no_personal_data_or_disallowed_states_are_emitted(self) -> None:
        for file_name, payload in self.payloads.items():
            if file_name == "manifest.json":
                continue
            for key, value in walk_values(payload):
                self.assertNotIn(key, PERSONAL_FIELDS)
                if key == "provenance_status":
                    self.assertIn(value, {"unverified_source", "self_created"})
                elif key == "rights_status":
                    self.assertEqual(value, "review_needed")
                elif key == "verification_status":
                    self.assertEqual(value, "review_needed")
                elif (
                    key.endswith("_status")
                    or key == "status"
                    or key == "confidence_or_status"
                ):
                    self.assertIn(value, ALLOWED_STATES)

    def test_part4_fixture_and_inputs_are_untouched(self) -> None:
        self.assertEqual(
            self.protected_hashes_before,
            {path: sha256(ROOT / path) for path in PROTECTED_PATHS},
        )


if __name__ == "__main__":
    unittest.main()

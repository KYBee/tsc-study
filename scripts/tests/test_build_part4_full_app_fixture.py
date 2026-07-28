from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_part4_full_app_fixture.py"
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
COURSE_IMPORT = ROOT / "data" / "working" / "course-import-v1"
LEGACY_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "part4"

TARGET_IDS = [f"P4-{number:03d}" for number in range(1, 51)]
JSON_FILES = [
    "sources.json",
    "source-references.json",
    "questions.json",
    "answer-points.json",
    "part-guides.json",
    "learning-expressions.json",
    "practice-drills.json",
    "course-insights.json",
    "model-answers.json",
    "manifest.json",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_hashes(path: Path) -> dict[str, str]:
    return {
        item.relative_to(path).as_posix(): sha256(item)
        for item in sorted(path.rglob("*"))
        if item.is_file()
    }


def run_builder(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class Part4FullAppFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary_directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary_directory.name)
        cls.output_dir = cls.root / "fixture"
        cls.protected_hashes = {
            "full": tree_hashes(FULL_IMPORT),
            "course": tree_hashes(COURSE_IMPORT),
            "legacy": tree_hashes(LEGACY_FIXTURE),
        }
        result = run_builder("--output-dir", str(cls.output_dir))
        if result.returncode != 0:
            raise AssertionError(result.stderr or result.stdout)

        cls.payloads = {
            filename: json.loads((cls.output_dir / filename).read_text(encoding="utf-8"))
            for filename in JSON_FILES
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary_directory.cleanup()

    def test_questions_are_all_fifty_raw_part4_records(self) -> None:
        questions = self.payloads["questions.json"]
        self.assertEqual(len(questions), 50)
        self.assertEqual([item["question_id"] for item in questions], TARGET_IDS)
        self.assertTrue(all(item["part"] == 4 for item in questions))
        self.assertTrue(all(item["question_status"] == "raw" for item in questions))
        self.assertEqual(len({item["question_id"] for item in questions}), 50)

    def test_questions_match_the_full_import_byte_for_value(self) -> None:
        full_questions = json.loads(
            (FULL_IMPORT / "questions.json").read_text(encoding="utf-8")
        )
        expected = [item for item in full_questions if item["part"] == 4]
        self.assertEqual(self.payloads["questions.json"], expected)

    def test_answer_points_are_one_raw_record_per_question(self) -> None:
        answer_points = self.payloads["answer-points.json"]
        self.assertEqual(len(answer_points), 50)
        self.assertEqual(
            [item["answer_point_id"] for item in answer_points],
            [f"ap-{question_id}-001" for question_id in TARGET_IDS],
        )
        self.assertEqual(
            {item["question_id"] for item in answer_points}, set(TARGET_IDS)
        )
        self.assertTrue(all(item["point_status"] == "raw" for item in answer_points))

    def test_common_part4_material_counts_and_context_are_preserved(self) -> None:
        guides = self.payloads["part-guides.json"]
        expressions = self.payloads["learning-expressions.json"]
        drills = self.payloads["practice-drills.json"]
        insights = self.payloads["course-insights.json"]

        self.assertEqual(len(guides), 2)
        self.assertEqual(
            {item["part_guide_id"] for item in guides},
            {"part-guide-workbook-04", "part-guide-04"},
        )
        self.assertEqual(len(expressions), 13)
        self.assertEqual(len(drills), 2)
        self.assertEqual(len(insights), 6)
        self.assertTrue(all(4 in item["part_numbers"] for item in expressions))
        self.assertTrue(all(item["part"] == 4 for item in drills))
        self.assertTrue(all(4 in item["part_numbers"] for item in insights))
        course_guide = next(item for item in guides if item["part_guide_id"] == "part-guide-04")
        self.assertEqual(course_guide["course_target_context"], "level_3")
        self.assertEqual(course_guide["guide_status"], "draft")
        self.assertTrue(all(item["status"] == "raw" for item in expressions))
        self.assertTrue(all(item["status"] == "review_needed" for item in drills))
        self.assertTrue(
            all(item["confidence_or_status"] == "review_needed" for item in insights)
        )

    def test_source_references_and_sources_are_integral(self) -> None:
        sources = self.payloads["sources.json"]
        references = self.payloads["source-references.json"]
        source_ids = {item["source_id"] for item in sources}
        target_ids = {
            "question": {item["question_id"] for item in self.payloads["questions.json"]},
            "answer_point": {
                item["answer_point_id"] for item in self.payloads["answer-points.json"]
            },
            "part_guide": {
                item["part_guide_id"] for item in self.payloads["part-guides.json"]
            },
            "learning_expression": {
                item["expression_id"] for item in self.payloads["learning-expressions.json"]
            },
            "practice_drill": {
                item["drill_id"] for item in self.payloads["practice-drills.json"]
            },
            "course_insight": {
                item["insight_id"] for item in self.payloads["course-insights.json"]
            },
        }

        self.assertEqual(len(sources), 7)
        self.assertEqual(len(references), 131)
        self.assertTrue(all(item["source_id"] in source_ids for item in references))
        self.assertTrue(
            all(item["target_id"] in target_ids[item["target_type"]] for item in references)
        )
        self.assertEqual(
            len([item for item in references if item["target_type"] == "question"]),
            50,
        )

    def test_model_answers_remain_empty(self) -> None:
        self.assertEqual(self.payloads["model-answers.json"], [])

    def test_manifest_records_the_full_working_fixture_contract(self) -> None:
        manifest = self.payloads["manifest.json"]
        self.assertEqual(
            manifest["dataset_id"], "part4-full-working-development-fixture-v2"
        )
        self.assertEqual(manifest["dataset_status"], "development_fixture")
        self.assertEqual(manifest["counts"]["question"], 50)
        self.assertEqual(manifest["counts"]["answer_point"], 50)
        self.assertEqual(manifest["counts"]["model_answer"], 0)
        self.assertEqual(manifest["ids"]["question"], TARGET_IDS)
        self.assertNotIn("generated_at", manifest)
        for filename, expected_hash in manifest["generated_files"].items():
            self.assertEqual(sha256(self.output_dir / filename), expected_hash)

    def test_two_builds_are_byte_identical(self) -> None:
        second = self.root / "fixture-second"
        result = run_builder("--output-dir", str(second))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(tree_hashes(self.output_dir), tree_hashes(second))

    def test_validate_only_does_not_change_files(self) -> None:
        before = tree_hashes(self.output_dir)
        result = run_builder("--validate-only", "--output-dir", str(self.output_dir))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(tree_hashes(self.output_dir), before)

    def test_protected_inputs_and_legacy_fixture_are_unchanged(self) -> None:
        self.assertEqual(tree_hashes(FULL_IMPORT), self.protected_hashes["full"])
        self.assertEqual(tree_hashes(COURSE_IMPORT), self.protected_hashes["course"])
        self.assertEqual(tree_hashes(LEGACY_FIXTURE), self.protected_hashes["legacy"])


if __name__ == "__main__":
    unittest.main()

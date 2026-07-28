from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "promote_part4_reviewed_data.py"
REVIEW_FIXTURE = ROOT / "data" / "working" / "review-fixtures" / "part4-v1"
PART4_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "part4-full"
REQUIRED_FIELDS = [
    "chinese_text",
    "pinyin",
    "korean_translation",
    "question_type",
    "answer_point",
    "source_locator",
    "claimed_source_metadata",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_hashes(path: Path) -> dict[str, str]:
    return {
        item.relative_to(path).as_posix(): sha256(item)
        for item in sorted(path.rglob("*"))
        if item.is_file()
    }


def run_promoter(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class Part4ReviewedPromotionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.output = self.root / "reviewed"
        self.items = json.loads(
            (REVIEW_FIXTURE / "review-items.json").read_text(encoding="utf-8")
        )
        self.protected_before = {
            "review": tree_hashes(REVIEW_FIXTURE),
            "part4": tree_hashes(PART4_FIXTURE),
        }

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def decision(
        self,
        question_id: str = "P4-001",
        *,
        field_status: str = "approved",
        overall_status: str = "approved",
        note: str = "",
    ) -> dict[str, object]:
        item = next(item for item in self.items if item["question_id"] == question_id)
        return {
            "review_decision_id": f"p4-review-decision-{question_id}",
            "dataset_id": "part4-review-fixture-v1",
            "question_id": question_id,
            "field_decisions": {
                field: field_status for field in REQUIRED_FIELDS
            },
            "overall_status": overall_status,
            "reviewer_note": note,
            "reviewed_by": "local-reviewer",
            "reviewed_at": "2026-07-28T03:00:00.000Z",
            "source_question_hash": item["source_question_hash"],
            "source_answer_point_hash": item["source_answer_point_hash"],
            "decision_version": 1,
        }

    def write_export(self, decisions: list[dict[str, object]]) -> Path:
        path = self.root / "part4-review-decisions-v1.json"
        path.write_text(
            json.dumps(
                {
                    "dataset_id": "part4-review-fixture-v1",
                    "review_schema_version": "part4-review-decision-v1",
                    "exported_at": "2026-07-28T03:01:00.000Z",
                    "reviewer": "local-reviewer",
                    "decisions": decisions,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return path

    def promote(self, path: Path, *extra: str) -> subprocess.CompletedProcess[str]:
        return run_promoter(
            "--decisions",
            str(path),
            "--output-dir",
            str(self.output),
            *extra,
        )

    def test_zero_approved_items_blocks_output(self) -> None:
        path = self.write_export([])
        result = self.promote(path)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("0", result.stderr)
        self.assertFalse(self.output.exists())

    def test_one_complete_approval_promotes_exact_source_content(self) -> None:
        path = self.write_export([self.decision()])
        result = self.promote(path)
        self.assertEqual(result.returncode, 0, result.stderr)
        questions = json.loads((self.output / "questions.json").read_text())
        points = json.loads((self.output / "answer-points.json").read_text())
        source_questions = json.loads(
            (PART4_FIXTURE / "questions.json").read_text(encoding="utf-8")
        )
        source_points = json.loads(
            (PART4_FIXTURE / "answer-points.json").read_text(encoding="utf-8")
        )
        expected_question = copy.deepcopy(source_questions[0])
        expected_question["question_status"] = "verified"
        expected_point = copy.deepcopy(source_points[0])
        expected_point["point_status"] = "reviewed"
        self.assertEqual(questions, [expected_question])
        self.assertEqual(points, [expected_point])

    def test_source_references_are_minimal_and_verification_is_not_escalated(self) -> None:
        path = self.write_export([self.decision()])
        self.assertEqual(self.promote(path).returncode, 0)
        references = json.loads(
            (self.output / "source-references.json").read_text(encoding="utf-8")
        )
        sources = json.loads((self.output / "sources.json").read_text(encoding="utf-8"))
        self.assertEqual(len(references), 2)
        self.assertEqual(len(sources), 1)
        self.assertTrue(
            all(reference["verification_status"] == "unverified" for reference in references)
        )

    def test_incomplete_needs_fix_and_deferred_are_excluded(self) -> None:
        approved = self.decision("P4-001")
        incomplete = self.decision("P4-002", field_status="not_checked", overall_status="deferred")
        needs_fix = self.decision(
            "P4-003",
            field_status="needs_fix",
            overall_status="needs_fix",
            note="원문 확인 필요",
        )
        deferred = self.decision("P4-004", field_status="approved", overall_status="deferred")
        # Deferred may preserve field decisions, but cannot be promoted.
        path = self.write_export([approved, incomplete, needs_fix, deferred])
        result = self.promote(path)
        self.assertEqual(result.returncode, 0, result.stderr)
        excluded = json.loads(
            (self.output / "excluded-items.json").read_text(encoding="utf-8")
        )
        reasons = {item["question_id"]: item["exclusion_reason"] for item in excluded}
        self.assertEqual(reasons["P4-002"], "incomplete_field_review")
        self.assertEqual(reasons["P4-003"], "needs_fix")
        self.assertEqual(reasons["P4-004"], "deferred")
        self.assertEqual(reasons["P4-005"], "no_decision")

    def test_stale_hash_is_excluded(self) -> None:
        approved = self.decision("P4-001")
        stale = self.decision("P4-002")
        stale["source_question_hash"] = "0" * 64
        path = self.write_export([approved, stale])
        result = self.promote(path)
        self.assertEqual(result.returncode, 0, result.stderr)
        excluded = json.loads(
            (self.output / "excluded-items.json").read_text(encoding="utf-8")
        )
        stale_item = next(item for item in excluded if item["question_id"] == "P4-002")
        self.assertEqual(stale_item["exclusion_reason"], "stale_source_hash")
        self.assertTrue(stale_item["stale"])

    def test_unknown_duplicate_and_invalid_enum_decisions_are_rejected(self) -> None:
        cases: list[list[dict[str, object]]] = []
        unknown = self.decision()
        unknown["question_id"] = "P4-999"
        cases.append([unknown])
        cases.append([self.decision(), self.decision()])
        invalid = self.decision()
        invalid["overall_status"] = "auto_approved"
        cases.append([invalid])
        for index, decisions in enumerate(cases):
            with self.subTest(index=index):
                path = self.root / f"invalid-{index}.json"
                path.write_text(
                    json.dumps(
                        {
                            "dataset_id": "part4-review-fixture-v1",
                            "review_schema_version": "part4-review-decision-v1",
                            "exported_at": "2026-07-28T03:01:00.000Z",
                            "reviewer": "local-reviewer",
                            "decisions": decisions,
                        }
                    ),
                    encoding="utf-8",
                )
                result = self.promote(path)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.output.exists())

    def test_question_and_answer_point_references_are_integral(self) -> None:
        path = self.write_export([self.decision("P4-006")])
        self.assertEqual(self.promote(path).returncode, 0)
        questions = json.loads((self.output / "questions.json").read_text())
        points = json.loads((self.output / "answer-points.json").read_text())
        refs = json.loads((self.output / "source-references.json").read_text())
        self.assertEqual(points[0]["question_id"], questions[0]["question_id"])
        self.assertEqual(
            {reference["target_id"] for reference in refs},
            {questions[0]["question_id"], points[0]["answer_point_id"]},
        )

    def test_same_decision_file_produces_deterministic_output(self) -> None:
        path = self.write_export([self.decision()])
        self.assertEqual(self.promote(path).returncode, 0)
        first = tree_hashes(self.output)
        second_output = self.root / "reviewed-second"
        result = run_promoter(
            "--decisions",
            str(path),
            "--output-dir",
            str(second_output),
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(first, tree_hashes(second_output))

    def test_validate_only_does_not_change_output(self) -> None:
        path = self.write_export([self.decision()])
        self.assertEqual(self.promote(path).returncode, 0)
        before = tree_hashes(self.output)
        result = self.promote(path, "--validate-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(tree_hashes(self.output), before)

    def test_failure_preserves_existing_output(self) -> None:
        path = self.write_export([self.decision()])
        self.assertEqual(self.promote(path).returncode, 0)
        before = tree_hashes(self.output)
        broken = self.write_export([])
        result = self.promote(broken)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(tree_hashes(self.output), before)

    def test_working_inputs_are_unchanged(self) -> None:
        path = self.write_export([self.decision()])
        self.assertEqual(self.promote(path).returncode, 0)
        self.assertEqual(tree_hashes(REVIEW_FIXTURE), self.protected_before["review"])
        self.assertEqual(tree_hashes(PART4_FIXTURE), self.protected_before["part4"])


if __name__ == "__main__":
    unittest.main()

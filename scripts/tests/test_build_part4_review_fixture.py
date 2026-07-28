from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_part4_review_fixture.py"
PART4_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "part4-full"
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
TARGET_IDS = [f"P4-{number:03d}" for number in range(1, 51)]
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


def run_builder(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class Part4ReviewFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary_directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary_directory.name)
        cls.output = cls.root / "review-fixture"
        cls.protected_before = {
            "part4": tree_hashes(PART4_FIXTURE),
            "full": tree_hashes(FULL_IMPORT),
        }
        result = run_builder("--output-dir", str(cls.output))
        if result.returncode:
            raise AssertionError(result.stderr or result.stdout)
        cls.items = json.loads(
            (cls.output / "review-items.json").read_text(encoding="utf-8")
        )
        cls.manifest = json.loads(
            (cls.output / "manifest.json").read_text(encoding="utf-8")
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary_directory.cleanup()

    def test_contains_exactly_fifty_unique_part4_items(self) -> None:
        self.assertEqual(len(self.items), 50)
        self.assertEqual([item["question_id"] for item in self.items], TARGET_IDS)
        self.assertEqual(len({item["review_item_id"] for item in self.items}), 50)

    def test_each_item_preserves_one_question_and_answer_point(self) -> None:
        for item in self.items:
            question_id = item["question_id"]
            self.assertEqual(item["question"]["question_id"], question_id)
            self.assertEqual(item["question"]["part"], 4)
            self.assertEqual(item["question"]["question_status"], "raw")
            self.assertEqual(item["answer_point"]["question_id"], question_id)
            self.assertEqual(
                item["answer_point"]["answer_point_id"],
                f"ap-{question_id}-001",
            )
            self.assertEqual(item["answer_point"]["point_status"], "raw")

    def test_required_review_fields_and_source_context_are_present(self) -> None:
        for item in self.items:
            self.assertEqual(item["required_review_fields"], REQUIRED_FIELDS)
            self.assertEqual(len(item["question_source_references"]), 1)
            self.assertEqual(len(item["answer_point_source_references"]), 1)
            for reference in (
                item["question_source_references"]
                + item["answer_point_source_references"]
            ):
                self.assertEqual(reference["source_id"], "src-001")
                self.assertEqual(reference["relationship_kind"], "extracted_from")
                self.assertIn("source_locator", reference)
            self.assertTrue(item["review_queue_items"])

    def test_source_hashes_are_canonical_content_hashes(self) -> None:
        def canonical_hash(value: object) -> str:
            encoded = json.dumps(
                value,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            return hashlib.sha256(encoded).hexdigest()

        for item in self.items:
            self.assertEqual(
                item["source_question_hash"], canonical_hash(item["question"])
            )
            self.assertEqual(
                item["source_answer_point_hash"],
                canonical_hash(item["answer_point"]),
            )

    def test_source_reference_targets_are_integral(self) -> None:
        for item in self.items:
            for reference in item["question_source_references"]:
                self.assertEqual(reference["target_type"], "question")
                self.assertEqual(reference["target_id"], item["question_id"])
            for reference in item["answer_point_source_references"]:
                self.assertEqual(reference["target_type"], "answer_point")
                self.assertEqual(
                    reference["target_id"],
                    item["answer_point"]["answer_point_id"],
                )

    def test_manifest_records_contract_and_input_hashes(self) -> None:
        self.assertEqual(self.manifest["dataset_id"], "part4-review-fixture-v1")
        self.assertEqual(self.manifest["dataset_status"], "review_fixture")
        self.assertEqual(self.manifest["counts"]["review_item"], 50)
        self.assertEqual(self.manifest["ids"]["question"], TARGET_IDS)
        self.assertEqual(self.manifest["required_review_fields"], REQUIRED_FIELDS)
        self.assertEqual(
            self.manifest["inputs"]["part4_fixture_manifest"]["sha256"],
            sha256(PART4_FIXTURE / "manifest.json"),
        )

    def test_two_builds_are_byte_identical(self) -> None:
        second = self.root / "second"
        result = run_builder("--output-dir", str(second))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(tree_hashes(self.output), tree_hashes(second))

    def test_validate_only_does_not_change_output(self) -> None:
        before = tree_hashes(self.output)
        result = run_builder(
            "--output-dir",
            str(self.output),
            "--validate-only",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(tree_hashes(self.output), before)

    def test_validate_only_detects_tampering_without_rewriting(self) -> None:
        tampered = self.root / "tampered"
        result = run_builder("--output-dir", str(tampered))
        self.assertEqual(result.returncode, 0, result.stderr)
        path = tampered / "review-items.json"
        path.write_text("[]\n", encoding="utf-8")
        before = path.read_bytes()
        result = run_builder("--output-dir", str(tampered), "--validate-only")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(path.read_bytes(), before)

    def test_working_inputs_are_unchanged(self) -> None:
        self.assertEqual(tree_hashes(PART4_FIXTURE), self.protected_before["part4"])
        self.assertEqual(tree_hashes(FULL_IMPORT), self.protected_before["full"])


if __name__ == "__main__":
    unittest.main()

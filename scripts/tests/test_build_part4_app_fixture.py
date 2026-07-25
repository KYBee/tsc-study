from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import warnings

import scripts.build_part4_app_fixture as fixture_builder


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_part4_app_fixture.py"
QUESTIONS_CSV = ROOT / "data" / "working" / "question-sample" / "questions.csv"
MODEL_ANSWERS_CSV = (
    ROOT / "data" / "working" / "question-sample" / "model_answers.csv"
)
SOURCE_METADATA = ROOT / "sources" / "src-001__tsc-question-bank-workbook.md"

TARGET_IDS = ["P4-001", "P4-002", "P4-003", "P4-006", "P4-036", "P4-039"]
JSON_FILES = [
    "questions.json",
    "answer-points.json",
    "sources.json",
    "source-references.json",
    "model-answers.json",
    "manifest.json",
]
GENERATED_FILES_EXCEPT_MANIFEST = [
    "questions.json",
    "answer-points.json",
    "sources.json",
    "source-references.json",
    "model-answers.json",
    "README.md",
]

QUESTION_FIELDS = {
    "question_id",
    "part",
    "question_type",
    "question_zh",
    "question_pinyin",
    "question_ko",
    "question_status",
    "normalization_notes",
    "tags",
}
ANSWER_POINT_FIELDS = {
    "answer_point_id",
    "question_id",
    "point_type",
    "content",
    "sequence",
    "point_status",
    "source_reference_ids",
    "notes",
}
SOURCE_FIELDS = {
    "source_id",
    "title",
    "source_type",
    "provenance_status",
    "creator_or_provider",
    "original_file_name",
    "file_ref",
    "acquired_date",
    "rights_status",
    "notes",
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
    "notes",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def run_builder(
    *arguments: str, root: Path = ROOT
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(root / "scripts" / "build_part4_app_fixture.py"), *arguments],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )


class BuildPart4AppFixtureCliTests(unittest.TestCase):
    def test_cli_builds_the_required_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory) / "fixture"

            result = run_builder("--output-dir", str(output_dir))

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((output_dir / "manifest.json").is_file())


class BuildPart4AppFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._temporary_directory = tempfile.TemporaryDirectory()
        cls.temporary_root = Path(cls._temporary_directory.name)
        cls.output_dir = cls.temporary_root / "fixture"
        cls.questions_sha_before = sha256(QUESTIONS_CSV)
        cls.model_answers_sha_before = sha256(MODEL_ANSWERS_CSV)
        cls.source_metadata_sha_before = sha256(SOURCE_METADATA)

        result = run_builder("--output-dir", str(cls.output_dir))
        if result.returncode != 0:
            raise unittest.SkipTest(
                "fixture builder is unavailable; the CLI build test records "
                f"the expected failure: {result.stderr.strip()}"
            )

        cls.csv_rows = {
            row["question_id"]: row
            for row in read_csv_rows(QUESTIONS_CSV)
            if row["question_id"] in TARGET_IDS
        }
        cls.questions = json.loads(
            (cls.output_dir / "questions.json").read_text(encoding="utf-8")
        )
        cls.answer_points = json.loads(
            (cls.output_dir / "answer-points.json").read_text(encoding="utf-8")
        )
        cls.sources = json.loads(
            (cls.output_dir / "sources.json").read_text(encoding="utf-8")
        )
        cls.source_references = json.loads(
            (cls.output_dir / "source-references.json").read_text(encoding="utf-8")
        )
        cls.model_answers = json.loads(
            (cls.output_dir / "model-answers.json").read_text(encoding="utf-8")
        )
        cls.manifest = json.loads(
            (cls.output_dir / "manifest.json").read_text(encoding="utf-8")
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls._temporary_directory.cleanup()

    def make_isolated_repository(
        self, rows: list[dict[str, str]] | None = None
    ) -> Path:
        isolated_root = Path(
            tempfile.mkdtemp(prefix="isolated-", dir=self.temporary_root)
        )
        (isolated_root / "scripts").mkdir(parents=True)
        (isolated_root / "data" / "working" / "question-sample").mkdir(
            parents=True
        )
        (isolated_root / "sources").mkdir(parents=True)
        shutil.copy2(SCRIPT, isolated_root / "scripts" / SCRIPT.name)
        shutil.copy2(
            MODEL_ANSWERS_CSV,
            isolated_root
            / "data"
            / "working"
            / "question-sample"
            / "model_answers.csv",
        )
        shutil.copy2(
            SOURCE_METADATA,
            isolated_root / "sources" / SOURCE_METADATA.name,
        )

        destination = (
            isolated_root
            / "data"
            / "working"
            / "question-sample"
            / "questions.csv"
        )
        if rows is None:
            shutil.copy2(QUESTIONS_CSV, destination)
        else:
            with destination.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=list(rows[0]),
                    lineterminator="\n",
                )
                writer.writeheader()
                writer.writerows(rows)
        return isolated_root

    def test_questions_preserve_selected_csv_rows_in_canonical_shape(self) -> None:
        self.assertIsInstance(self.questions, list)
        self.assertEqual(
            [question["question_id"] for question in self.questions], TARGET_IDS
        )
        self.assertEqual(len(self.questions), 6)

        for question in self.questions:
            row = self.csv_rows[question["question_id"]]
            self.assertEqual(set(question), QUESTION_FIELDS)
            self.assertEqual(question["part"], 4)
            self.assertIsInstance(question["part"], int)
            for field in (
                "question_type",
                "question_zh",
                "question_pinyin",
                "question_ko",
                "question_status",
                "normalization_notes",
            ):
                self.assertEqual(question[field], row[field])
            self.assertEqual(question["question_status"], "raw")
            self.assertEqual(question["tags"], [])

        self.assertEqual(
            next(
                question
                for question in self.questions
                if question["question_id"] == "P4-039"
            )["question_status"],
            "raw",
        )

    def test_questions_exclude_source_answer_and_private_fields(self) -> None:
        forbidden_fields = {
            "source_id",
            "source_locator",
            "source_grade",
            "source_name",
            "source_url",
            "originality",
            "answer_point",
            "learning_status",
            "recent_reviewed_at",
            "user_answer_note",
        }
        for question in self.questions:
            self.assertTrue(forbidden_fields.isdisjoint(question))

    def test_answer_points_preserve_raw_csv_content_and_deterministic_ids(self) -> None:
        expected_ids = [f"ap-{question_id}-001" for question_id in TARGET_IDS]
        self.assertEqual(
            [point["answer_point_id"] for point in self.answer_points],
            expected_ids,
        )
        self.assertEqual(len(self.answer_points), 6)

        for point in self.answer_points:
            question_id = point["question_id"]
            expected_reference_id = (
                f"sr-answer-point-ap-{question_id}-001-extracted"
            )
            self.assertEqual(set(point), ANSWER_POINT_FIELDS)
            self.assertEqual(point["answer_point_id"], f"ap-{question_id}-001")
            self.assertEqual(
                point["content"], self.csv_rows[question_id]["answer_point"]
            )
            self.assertEqual(point["point_type"], "unclassified")
            self.assertEqual(point["sequence"], 1)
            self.assertEqual(point["point_status"], "raw")
            self.assertEqual(
                point["source_reference_ids"], [expected_reference_id]
            )
            self.assertEqual(point["notes"], "")

    def test_source_is_parsed_from_markdown_without_invented_provenance(self) -> None:
        self.assertEqual(len(self.sources), 1)
        source = self.sources[0]
        self.assertEqual(set(source), SOURCE_FIELDS)
        self.assertEqual(source["source_id"], "src-001")
        self.assertEqual(source["title"], "TSC 파트별 문제은행 그림 포함")
        self.assertEqual(source["source_type"], "excel")
        self.assertEqual(source["provenance_status"], "unverified_source")
        self.assertEqual(source["creator_or_provider"], "")
        self.assertEqual(
            source["original_file_name"],
            "TSC_파트별_문제은행_그림포함.xlsx",
        )
        self.assertEqual(
            source["file_ref"],
            "data/raw/TSC_파트별_문제은행_그림포함.xlsx",
        )
        self.assertEqual(source["acquired_date"], "")
        self.assertEqual(source["rights_status"], "review_needed")
        self.assertIn("별도 확인이 필요", source["notes"])
        self.assertIn("review_needed", source["notes"])

    def test_source_references_preserve_every_mapped_csv_string(self) -> None:
        self.assertEqual(len(self.source_references), 12)
        self.assertEqual(
            [reference["source_reference_id"] for reference in self.source_references],
            sorted(
                reference["source_reference_id"]
                for reference in self.source_references
            ),
        )

        references_by_id = {
            reference["source_reference_id"]: reference
            for reference in self.source_references
        }
        for question_id in TARGET_IDS:
            row = self.csv_rows[question_id]
            expected_common = {
                "source_id": "src-001",
                "source_locator": row["source_locator"],
                "relationship_kind": "extracted_from",
                "claimed_source_name": row["source_name"],
                "claimed_source_url": row["source_url"],
                "source_grade": row["source_grade"],
                "originality": row["originality"],
                "verification_status": "unverified",
                "notes": "",
            }

            question_reference = references_by_id[
                f"sr-question-{question_id}-extracted"
            ]
            self.assertEqual(set(question_reference), SOURCE_REFERENCE_FIELDS)
            self.assertEqual(question_reference["target_type"], "question")
            self.assertEqual(question_reference["target_id"], question_id)
            for field, expected in expected_common.items():
                self.assertEqual(question_reference[field], expected)

            answer_point_id = f"ap-{question_id}-001"
            answer_reference = references_by_id[
                f"sr-answer-point-{answer_point_id}-extracted"
            ]
            self.assertEqual(set(answer_reference), SOURCE_REFERENCE_FIELDS)
            self.assertEqual(answer_reference["target_type"], "answer_point")
            self.assertEqual(answer_reference["target_id"], answer_point_id)
            for field, expected in expected_common.items():
                self.assertEqual(answer_reference[field], expected)

        self.assertEqual(
            references_by_id["sr-question-P4-006-extracted"][
                "claimed_source_url"
            ],
            "",
        )
        self.assertEqual(
            references_by_id[
                "sr-answer-point-ap-P4-006-001-extracted"
            ]["claimed_source_url"],
            "",
        )
        self.assertEqual(
            references_by_id["sr-question-P4-039-extracted"]["originality"],
            "정규화",
        )

    def test_model_answers_are_empty_without_placeholder_records(self) -> None:
        self.assertEqual(self.model_answers, [])

    def test_manifest_has_counts_ids_and_verified_artifact_hashes(self) -> None:
        self.assertEqual(
            self.manifest["dataset_id"], "part4-raw-development-fixture-v1"
        )
        self.assertEqual(
            self.manifest["dataset_status"], "development_fixture"
        )
        self.assertNotIn("generated_at", self.manifest)
        self.assertEqual(
            self.manifest["source_file"],
            {
                "path": "data/working/question-sample/questions.csv",
                "sha256": sha256(QUESTIONS_CSV),
            },
        )
        self.assertEqual(
            self.manifest["model_answer_source_file"],
            {
                "path": "data/working/question-sample/model_answers.csv",
                "sha256": sha256(MODEL_ANSWERS_CSV),
                "record_count": 0,
            },
        )
        self.assertEqual(
            self.manifest["counts"],
            {
                "question": 6,
                "answer_point": 6,
                "source": 1,
                "source_reference": 12,
                "model_answer": 0,
            },
        )
        self.assertEqual(self.manifest["ids"]["question"], TARGET_IDS)
        self.assertEqual(
            self.manifest["ids"]["answer_point"],
            [f"ap-{question_id}-001" for question_id in TARGET_IDS],
        )
        self.assertEqual(self.manifest["ids"]["source"], ["src-001"])
        self.assertEqual(self.manifest["ids"]["model_answer"], [])
        self.assertEqual(
            set(self.manifest["generated_files"]),
            set(GENERATED_FILES_EXCEPT_MANIFEST),
        )
        for file_name in GENERATED_FILES_EXCEPT_MANIFEST:
            self.assertEqual(
                self.manifest["generated_files"][file_name],
                sha256(self.output_dir / file_name),
            )
        self.assertIn("manifest.json", self.manifest["manifest_hash_policy"])
        self.assertIn("self-hash", self.manifest["manifest_hash_policy"])

    def test_json_is_utf8_lf_indented_and_has_trailing_newline(self) -> None:
        for file_name in JSON_FILES:
            contents = (self.output_dir / file_name).read_bytes()
            contents.decode("utf-8")
            self.assertTrue(contents.endswith(b"\n"), file_name)
            self.assertNotIn(b"\r", contents, file_name)
            if json.loads(contents) not in ([], {}):
                self.assertIn(b"\n  ", contents, file_name)

    def test_output_contains_only_declared_fixture_artifacts(self) -> None:
        self.assertEqual(
            {path.name for path in self.output_dir.iterdir()},
            set(JSON_FILES) | {"README.md"},
        )
        readme = (self.output_dir / "README.md").read_text(encoding="utf-8")
        self.assertIn("raw six-question development fixture", readme)
        self.assertIn("not reviewed", readme)
        self.assertIn("not production", readme)
        self.assertIn("not public", readme)
        self.assertIn("source CSV is unchanged", readme)
        self.assertIn("python3 scripts/build_part4_app_fixture.py", readme)
        self.assertIn("--validate-only", readme)
        self.assertIn("not a full extraction", readme)

    def test_two_builds_are_byte_identical_for_every_json(self) -> None:
        second_output = self.temporary_root / "second-fixture"
        result = run_builder("--output-dir", str(second_output))
        self.assertEqual(result.returncode, 0, result.stderr)
        for file_name in JSON_FILES:
            self.assertEqual(
                sha256(self.output_dir / file_name),
                sha256(second_output / file_name),
                file_name,
            )

    def test_validate_only_passes_and_does_not_rewrite_files(self) -> None:
        before = {
            path.name: path.read_bytes() for path in self.output_dir.iterdir()
        }
        result = run_builder(
            "--validate-only", "--output-dir", str(self.output_dir)
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        after = {
            path.name: path.read_bytes() for path in self.output_dir.iterdir()
        }
        self.assertEqual(after, before)

    def test_validate_only_failure_does_not_change_tampered_output(self) -> None:
        output_dir = self.temporary_root / "tampered-fixture"
        build_result = run_builder("--output-dir", str(output_dir))
        self.assertEqual(build_result.returncode, 0, build_result.stderr)
        with (output_dir / "questions.json").open(
            "w", encoding="utf-8", newline="\n"
        ) as handle:
            handle.write("[]\n")
        before = {path.name: path.read_bytes() for path in output_dir.iterdir()}

        result = run_builder(
            "--validate-only", "--output-dir", str(output_dir)
        )

        self.assertNotEqual(result.returncode, 0)
        after = {path.name: path.read_bytes() for path in output_dir.iterdir()}
        self.assertEqual(after, before)

    def test_invalid_input_does_not_replace_existing_fixture(self) -> None:
        rows = read_csv_rows(QUESTIONS_CSV)
        rows = [row for row in rows if row["question_id"] != "P4-039"]
        isolated_root = self.make_isolated_repository(rows)
        output_dir = (
            isolated_root / "data" / "working" / "app-fixtures" / "part4"
        )
        output_dir.mkdir(parents=True)
        sentinel = output_dir / "existing.txt"
        with sentinel.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write("keep this fixture\n")

        result = run_builder(root=isolated_root)

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(
            {path.name for path in output_dir.iterdir()}, {"existing.txt"}
        )
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep this fixture\n")
        self.assertEqual(
            list(output_dir.parent.glob(".part4.build-*")),
            [],
        )

    def test_existing_unknown_output_directory_is_rejected_unchanged(
        self,
    ) -> None:
        output_dir = self.temporary_root / "unknown-output"
        output_dir.mkdir()
        sentinel = output_dir / "keep.txt"
        sentinel.write_bytes(b"unrelated directory\n")
        before = {path.name: path.read_bytes() for path in output_dir.iterdir()}

        result = run_builder("--output-dir", str(output_dir))

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(
            {path.name: path.read_bytes() for path in output_dir.iterdir()},
            before,
        )

    def test_existing_builder_fixture_can_be_rebuilt(self) -> None:
        output_dir = self.temporary_root / "owned-output"
        first = run_builder("--output-dir", str(output_dir))
        self.assertEqual(first.returncode, 0, first.stderr)

        second = run_builder("--output-dir", str(output_dir))

        self.assertEqual(second.returncode, 0, second.stderr)
        validate = run_builder(
            "--validate-only", "--output-dir", str(output_dir)
        )
        self.assertEqual(validate.returncode, 0, validate.stderr)

    def test_existing_fixture_with_extra_file_is_rejected_unchanged(
        self,
    ) -> None:
        output_dir = self.temporary_root / "modified-output"
        first = run_builder("--output-dir", str(output_dir))
        self.assertEqual(first.returncode, 0, first.stderr)
        (output_dir / "unrelated.txt").write_bytes(b"do not delete\n")
        before = {path.name: path.read_bytes() for path in output_dir.iterdir()}

        result = run_builder("--output-dir", str(output_dir))

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(
            {path.name: path.read_bytes() for path in output_dir.iterdir()},
            before,
        )

    def test_output_directory_containing_protected_inputs_is_rejected(
        self,
    ) -> None:
        isolated_root = self.make_isolated_repository()
        protected_dir = (
            isolated_root / "data" / "working" / "question-sample"
        )
        protected_files = {
            path.name: path.read_bytes() for path in protected_dir.iterdir()
        }

        result = run_builder(
            "--output-dir", str(protected_dir), root=isolated_root
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(
            {path.name: path.read_bytes() for path in protected_dir.iterdir()},
            protected_files,
        )

    def test_output_nested_inside_protected_input_directory_is_rejected(
        self,
    ) -> None:
        isolated_root = self.make_isolated_repository()
        protected_dir = (
            isolated_root / "data" / "working" / "question-sample"
        )
        output_dir = protected_dir / "fixture"

        result = run_builder(
            "--output-dir", str(output_dir), root=isolated_root
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output_dir.exists())

    def test_output_path_through_symlink_parent_is_rejected(self) -> None:
        real_parent = self.temporary_root / "real-parent"
        real_parent.mkdir()
        symlink_parent = self.temporary_root / "linked-parent"
        symlink_parent.symlink_to(real_parent, target_is_directory=True)
        output_dir = symlink_parent / "fixture"

        result = run_builder("--output-dir", str(output_dir))

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((real_parent / "fixture").exists())

    def test_output_path_through_nested_symlink_ancestor_is_rejected(
        self,
    ) -> None:
        real_parent = self.temporary_root / "nested-real-parent"
        (real_parent / "sub").mkdir(parents=True)
        symlink_parent = self.temporary_root / "nested-linked-parent"
        symlink_parent.symlink_to(real_parent, target_is_directory=True)
        output_dir = symlink_parent / "sub" / "fixture"

        result = run_builder("--output-dir", str(output_dir))

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((real_parent / "sub" / "fixture").exists())

    def test_backup_cleanup_failure_warns_after_successful_commit(self) -> None:
        output_dir = self.temporary_root / "backup-cleanup"
        initial = run_builder("--output-dir", str(output_dir))
        self.assertEqual(initial.returncode, 0, initial.stderr)
        real_rmtree = shutil.rmtree

        def fail_backup_cleanup(path: object, *args: object, **kwargs: object) -> None:
            if Path(path).name.startswith(f".{output_dir.name}.backup-"):
                raise OSError("forced backup cleanup failure")
            real_rmtree(path, *args, **kwargs)

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            with mock.patch.object(
                fixture_builder.shutil,
                "rmtree",
                side_effect=fail_backup_cleanup,
            ):
                counts = fixture_builder.build_fixture(output_dir)

        self.assertEqual(counts["question"], 6)
        fixture_builder.validate_fixture(output_dir)
        self.assertTrue(
            any("backup cleanup failed" in str(item.message) for item in caught)
        )
        backups = list(
            output_dir.parent.glob(f".{output_dir.name}.backup-*")
        )
        self.assertEqual(len(backups), 1)
        real_rmtree(backups[0])

    def test_staging_cleanup_failure_preserves_original_build_error(
        self,
    ) -> None:
        output_dir = self.temporary_root / "staging-cleanup"
        initial = run_builder("--output-dir", str(output_dir))
        self.assertEqual(initial.returncode, 0, initial.stderr)
        before = {path.name: path.read_bytes() for path in output_dir.iterdir()}
        real_rmtree = shutil.rmtree

        def fail_staging_cleanup(
            path: object, *args: object, **kwargs: object
        ) -> None:
            if Path(path).name.startswith(f".{output_dir.name}.build-"):
                raise OSError("forced staging cleanup failure")
            real_rmtree(path, *args, **kwargs)

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            with mock.patch.object(
                fixture_builder,
                "_validate_output",
                side_effect=fixture_builder.FixtureError(
                    "forced validation failure"
                ),
            ), mock.patch.object(
                fixture_builder.shutil,
                "rmtree",
                side_effect=fail_staging_cleanup,
            ):
                with self.assertRaisesRegex(
                    fixture_builder.FixtureError,
                    "forced validation failure",
                ):
                    fixture_builder.build_fixture(output_dir)

        self.assertEqual(
            {path.name: path.read_bytes() for path in output_dir.iterdir()},
            before,
        )
        self.assertTrue(
            any("staging cleanup failed" in str(item.message) for item in caught)
        )
        staging_dirs = list(
            output_dir.parent.glob(f".{output_dir.name}.build-*")
        )
        self.assertEqual(len(staging_dirs), 1)
        real_rmtree(staging_dirs[0])

    def test_duplicate_question_text_does_not_replace_question_id_identity(
        self,
    ) -> None:
        rows = read_csv_rows(QUESTIONS_CSV)
        duplicate_text = next(
            row["question_zh"] for row in rows if row["question_id"] == "P4-001"
        )
        for row in rows:
            if row["question_id"] == "P4-002":
                row["question_zh"] = duplicate_text
        isolated_root = self.make_isolated_repository(rows)

        result = run_builder(root=isolated_root)

        self.assertEqual(result.returncode, 0, result.stderr)
        output_dir = (
            isolated_root / "data" / "working" / "app-fixtures" / "part4"
        )
        questions = json.loads(
            (output_dir / "questions.json").read_text(encoding="utf-8")
        )
        self.assertIsInstance(questions, list)
        self.assertEqual(
            [question["question_id"] for question in questions], TARGET_IDS
        )
        self.assertEqual(
            sum(
                question["question_zh"] == duplicate_text
                for question in questions
            ),
            2,
        )

    def test_source_inputs_remain_byte_identical(self) -> None:
        self.assertEqual(sha256(QUESTIONS_CSV), self.questions_sha_before)
        self.assertEqual(
            sha256(MODEL_ANSWERS_CSV), self.model_answers_sha_before
        )
        self.assertEqual(
            sha256(SOURCE_METADATA), self.source_metadata_sha_before
        )


if __name__ == "__main__":
    unittest.main()

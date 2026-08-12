from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_part2_visual_app_fixture.py"
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
COURSE_IMPORT = ROOT / "data" / "working" / "course-import-v1"
TEXT_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "text-parts-v1"
JSON_FILES = [
    "visual-sets.json",
    "visual-assets.json",
    "visual-set-assets.json",
    "visual-questions.json",
    "model-answers.json",
    "sources.json",
    "source-references.json",
    "part-guides.json",
    "learning-expressions.json",
    "practice-drills.json",
    "course-insights.json",
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


class Part2VisualAppFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary_directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary_directory.name)
        cls.output_dir = cls.root / "fixture"
        cls.protected_hashes = {
            "full": tree_hashes(FULL_IMPORT),
            "course": tree_hashes(COURSE_IMPORT),
            "text": tree_hashes(TEXT_FIXTURE),
        }
        result = run_builder("--output-dir", str(cls.output_dir))
        if result.returncode != 0:
            raise AssertionError(result.stderr or result.stdout)
        cls.payloads = {
            filename: json.loads(
                (cls.output_dir / filename).read_text(encoding="utf-8")
            )
            for filename in JSON_FILES
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary_directory.cleanup()

    def test_exact_part2_visual_entities_are_selected(self) -> None:
        self.assertEqual(len(self.payloads["visual-sets.json"]), 12)
        self.assertEqual(len(self.payloads["visual-assets.json"]), 12)
        self.assertEqual(len(self.payloads["visual-set-assets.json"]), 12)
        self.assertEqual(len(self.payloads["visual-questions.json"]), 48)
        self.assertEqual(len(self.payloads["model-answers.json"]), 48)

        self.assertEqual(
            [item["visual_set_id"] for item in self.payloads["visual-sets.json"]],
            [f"vs-P2-V{number:02d}" for number in range(1, 13)],
        )
        self.assertTrue(
            all(
                item["set_type"] == "four_question_image"
                and item["part"] == 2
                for item in self.payloads["visual-sets.json"]
            )
        )
        self.assertFalse(
            any(
                item["set_type"] == "official_sample"
                for item in self.payloads["visual-sets.json"]
            )
        )

    def test_named_image_source_points_to_a_tracked_repository_file(self) -> None:
        source = next(
            item
            for item in self.payloads["sources.json"]
            if item["source_id"] == "src-user-named-visuals-001"
        )
        self.assertTrue((ROOT / source["file_ref"]).is_file())
        self.assertEqual(
            source["file_ref"],
            "data/working/app-assets/tsc-individual-images-v1/manifest.json",
        )

    def test_all_visual_questions_work_without_forcing_canonical_links(self) -> None:
        questions = self.payloads["visual-questions.json"]
        self.assertEqual(sum(bool(item.get("question_id")) for item in questions), 18)
        self.assertEqual(sum(not item.get("question_id") for item in questions), 30)
        for set_number in range(1, 13):
            visual_set_id = f"vs-P2-V{set_number:02d}"
            selected = [
                item for item in questions if item["visual_set_id"] == visual_set_id
            ]
            self.assertEqual(len(selected), 4)
            self.assertEqual(
                [item["item_number"] for item in selected], [1, 2, 3, 4]
            )

    def test_model_answers_keep_unverified_visual_question_contract(self) -> None:
        questions = {
            item["visual_question_id"]
            for item in self.payloads["visual-questions.json"]
        }
        answers = self.payloads["model-answers.json"]
        self.assertTrue(
            all(
                item["answer_target_type"] == "visual_question"
                and item["answer_target_id"] in questions
                and item["answer_status"] == "review_needed"
                and item["provenance_kind"] == "unverified_source"
                for item in answers
            )
        )

    def test_assets_keep_rights_and_registered_local_paths(self) -> None:
        assets = self.payloads["visual-assets.json"]
        self.assertTrue(
            all(item["rights_status"] == "review_needed" for item in assets)
        )
        self.assertFalse(
            any(item["rights_status"] == "public_allowed" for item in assets)
        )
        self.assertEqual(len({item["sha256"] for item in assets}), 12)
        for item in assets:
            relative = Path(item["repository_path"])
            self.assertFalse(relative.is_absolute())
            self.assertNotIn("..", relative.parts)
            self.assertIn(relative.suffix.lower(), {".png", ".jpg", ".jpeg", ".gif"})

    def test_asset_and_answer_references_are_integral(self) -> None:
        sets = {
            item["visual_set_id"] for item in self.payloads["visual-sets.json"]
        }
        assets = {
            item["visual_asset_id"] for item in self.payloads["visual-assets.json"]
        }
        links = self.payloads["visual-set-assets.json"]
        self.assertEqual(len({item["visual_set_asset_id"] for item in links}), 12)
        self.assertTrue(
            all(
                item["visual_set_id"] in sets and item["visual_asset_id"] in assets
                for item in links
            )
        )

        sources = {
            item["source_id"] for item in self.payloads["sources.json"]
        }
        target_ids = {
            "visual_set": sets,
            "visual_question": {
                item["visual_question_id"]
                for item in self.payloads["visual-questions.json"]
            },
            "model_answer": {
                item["answer_id"] for item in self.payloads["model-answers.json"]
            },
            "part_guide": {
                item["part_guide_id"] for item in self.payloads["part-guides.json"]
            },
            "learning_expression": {
                item["expression_id"]
                for item in self.payloads["learning-expressions.json"]
            },
            "practice_drill": {
                item["drill_id"] for item in self.payloads["practice-drills.json"]
            },
            "course_insight": {
                item["insight_id"] for item in self.payloads["course-insights.json"]
            },
        }
        self.assertTrue(
            all(
                item["source_id"] in sources
                and item["target_type"] in target_ids
                and item["target_id"] in target_ids[item["target_type"]]
                for item in self.payloads["source-references.json"]
            )
        )

    def test_part2_common_material_preserves_course_context(self) -> None:
        guides = self.payloads["part-guides.json"]
        self.assertEqual(
            {item["part_guide_id"] for item in guides},
            {"part-guide-02", "part-guide-workbook-02"},
        )
        course_guide = next(
            item for item in guides if item["part_guide_id"] == "part-guide-02"
        )
        self.assertEqual(course_guide["course_target_context"], "level_3")
        self.assertEqual(len(self.payloads["learning-expressions.json"]), 6)
        self.assertEqual(len(self.payloads["practice-drills.json"]), 1)
        self.assertEqual(len(self.payloads["course-insights.json"]), 4)

    def test_local_asset_bytes_match_metadata_and_are_git_ready(self) -> None:
        for item in self.payloads["visual-assets.json"]:
            relative = Path(item["repository_path"])
            local_path = ROOT / item["repository_path"]
            self.assertTrue(local_path.is_file(), local_path)
            self.assertEqual(sha256(local_path), item["sha256"])
            ignored = subprocess.run(
                ["git", "check-ignore", "-q", str(local_path)],
                cwd=ROOT,
                check=False,
            )
            self.assertNotEqual(ignored.returncode, 0)
            self.assertEqual(relative.parent.as_posix(), "data/working/app-assets/tsc-individual-images-v1")

    def test_manifest_is_deterministic_and_complete(self) -> None:
        manifest = self.payloads["manifest.json"]
        self.assertEqual(
            manifest["dataset_id"],
            "part2-visual-working-development-fixture-v1",
        )
        self.assertEqual(manifest["counts"]["visual_set"], 12)
        self.assertEqual(manifest["counts"]["visual_question"], 48)
        self.assertEqual(manifest["counts"]["model_answer"], 48)
        self.assertEqual(manifest["visual_question_links"], {
            "linked": 18,
            "unlinked": 30,
        })
        self.assertTrue(manifest["validation"]["official_sample_excluded"])
        self.assertTrue(manifest["validation"]["rights_status_preserved"])
        self.assertFalse(manifest["validation"]["public_allowed"])
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
        result = run_builder(
            "--validate-only", "--output-dir", str(self.output_dir)
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(tree_hashes(self.output_dir), before)

    def test_source_working_data_and_text_fixture_are_unchanged(self) -> None:
        self.assertEqual(tree_hashes(FULL_IMPORT), self.protected_hashes["full"])
        self.assertEqual(tree_hashes(COURSE_IMPORT), self.protected_hashes["course"])
        self.assertEqual(tree_hashes(TEXT_FIXTURE), self.protected_hashes["text"])


if __name__ == "__main__":
    unittest.main()

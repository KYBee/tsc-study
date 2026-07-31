from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_part7_visual_app_fixture.py"
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
COURSE_IMPORT = ROOT / "data" / "working" / "course-import-v1"
PART2_FIXTURE = (
    ROOT / "data" / "working" / "app-fixtures" / "part2-visual-v1"
)
TEXT_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "text-parts-v1"
JSON_FILES = [
    "visual-sets.json",
    "visual-assets.json",
    "visual-set-assets.json",
    "story-guides.json",
    "questions.json",
    "question-visual-link-candidates.json",
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


class Part7VisualAppFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary_directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary_directory.name)
        cls.output_dir = cls.root / "fixture"
        cls.protected_hashes = {
            "full": tree_hashes(FULL_IMPORT),
            "course": tree_hashes(COURSE_IMPORT),
            "part2": tree_hashes(PART2_FIXTURE),
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

    def test_exact_part7_story_entities_are_selected(self) -> None:
        self.assertEqual(len(self.payloads["visual-sets.json"]), 12)
        self.assertEqual(len(self.payloads["visual-assets.json"]), 12)
        self.assertEqual(len(self.payloads["visual-set-assets.json"]), 12)
        self.assertEqual(len(self.payloads["story-guides.json"]), 12)
        self.assertEqual(len(self.payloads["questions.json"]), 12)
        self.assertEqual(self.payloads["model-answers.json"], [])
        self.assertEqual(
            [item["visual_set_id"] for item in self.payloads["visual-sets.json"]],
            [f"vs-P7-V{number:02d}" for number in range(1, 13)],
        )
        self.assertEqual(
            [item["question_id"] for item in self.payloads["questions.json"]],
            [f"P7-{number:03d}" for number in range(1, 13)],
        )
        self.assertTrue(
            all(
                item["part"] == 7
                and item["set_type"] == "story_image"
                and item["set_status"] == "raw"
                for item in self.payloads["visual-sets.json"]
            )
        )
        self.assertFalse(
            any(
                item["set_type"] == "official_sample"
                for item in self.payloads["visual-sets.json"]
            )
        )

    def test_story_guides_have_only_the_explicit_visual_set_relationship(self) -> None:
        sets = {
            item["visual_set_id"] for item in self.payloads["visual-sets.json"]
        }
        guides = self.payloads["story-guides.json"]
        self.assertEqual(
            {item["visual_set_id"] for item in guides},
            sets,
        )
        self.assertTrue(all(item["guide_status"] == "raw" for item in guides))
        self.assertTrue(all(item.get("question_id", "") == "" for item in guides))
        self.assertTrue(
            all(item["recommended_flow"].strip() for item in guides)
        )

    def test_candidates_remain_non_canonical_review_items(self) -> None:
        candidates = self.payloads["question-visual-link-candidates.json"]
        self.assertEqual(len(candidates), 12)
        self.assertEqual(
            [item["candidate_id"] for item in candidates],
            [
                f"wlc-part7-P7-V{number:02d}-P7-{number:03d}"
                for number in range(1, 13)
            ],
        )
        self.assertTrue(
            all(
                item["candidate_status"] == "candidate"
                and item["review_status"] == "review_needed"
                and item["canonical_status"] == "not_canonical"
                and item["match_basis"] == "numeric_suffix_only"
                for item in candidates
            )
        )
        self.assertEqual(
            self.payloads["manifest.json"]["question_visual_set_links"],
            {"confirmed": 0, "candidates": 12},
        )

    def test_asset_and_story_references_are_integral(self) -> None:
        sets = {
            item["visual_set_id"] for item in self.payloads["visual-sets.json"]
        }
        assets = {
            item["visual_asset_id"] for item in self.payloads["visual-assets.json"]
        }
        guides = {
            item["story_guide_id"] for item in self.payloads["story-guides.json"]
        }
        links = self.payloads["visual-set-assets.json"]
        self.assertEqual(len({item["visual_set_asset_id"] for item in links}), 12)
        self.assertTrue(
            all(
                item["visual_set_id"] in sets
                and item["visual_asset_id"] in assets
                for item in links
            )
        )
        source_ids = {
            item["source_id"] for item in self.payloads["sources.json"]
        }
        targets = {
            "visual_set": sets,
            "story_guide": guides,
            "question": {
                item["question_id"] for item in self.payloads["questions.json"]
            },
            "part_guide": {
                item["part_guide_id"] for item in self.payloads["part-guides.json"]
            },
            "learning_expression": set(),
            "practice_drill": set(),
            "course_insight": {
                item["insight_id"] for item in self.payloads["course-insights.json"]
            },
        }
        self.assertTrue(
            all(
                reference["source_id"] in source_ids
                and reference["target_type"] in targets
                and reference["target_id"] in targets[reference["target_type"]]
                for reference in self.payloads["source-references.json"]
            )
        )

    def test_assets_keep_local_only_rights_and_bytes(self) -> None:
        assets = self.payloads["visual-assets.json"]
        self.assertEqual(len({item["sha256"] for item in assets}), 12)
        for item in assets:
            self.assertEqual(item["rights_status"], "review_needed")
            self.assertNotEqual(item["rights_status"], "public_allowed")
            self.assertEqual(item["asset_status"], "raw")
            relative = Path(item["repository_path"])
            self.assertFalse(relative.is_absolute())
            self.assertNotIn("..", relative.parts)
            local_path = ROOT / relative
            self.assertTrue(local_path.is_file(), local_path)
            self.assertEqual(sha256(local_path), item["sha256"])
            self.assertEqual(local_path.stat().st_size, item["file_size"])
            self.assertEqual(
                subprocess.run(
                    ["git", "check-ignore", "-q", str(local_path)],
                    cwd=ROOT,
                    check=False,
                ).returncode,
                0,
            )
            self.assertNotEqual(
                subprocess.run(
                    ["git", "ls-files", "--error-unmatch", str(local_path)],
                    cwd=ROOT,
                    capture_output=True,
                    check=False,
                ).returncode,
                0,
            )

    def test_part7_common_material_preserves_course_limits(self) -> None:
        guides = self.payloads["part-guides.json"]
        self.assertEqual(
            {item["part_guide_id"] for item in guides},
            {"part-guide-07", "part-guide-workbook-07"},
        )
        course_guide = next(
            item for item in guides if item["part_guide_id"] == "part-guide-07"
        )
        self.assertEqual(course_guide["course_target_context"], "level_3")
        self.assertEqual(self.payloads["learning-expressions.json"], [])
        self.assertEqual(self.payloads["practice-drills.json"], [])
        self.assertEqual(
            [item["insight_id"] for item in self.payloads["course-insights.json"]],
            ["ci-course-part6-7-gap"],
        )

    def test_manifest_is_deterministic_and_complete(self) -> None:
        manifest = self.payloads["manifest.json"]
        self.assertEqual(
            manifest["dataset_id"],
            "part7-visual-working-development-fixture-v1",
        )
        self.assertEqual(manifest["counts"]["visual_set"], 12)
        self.assertEqual(manifest["counts"]["story_guide"], 12)
        self.assertEqual(manifest["counts"]["question"], 12)
        self.assertEqual(manifest["counts"]["model_answer"], 0)
        self.assertTrue(manifest["validation"]["official_sample_excluded"])
        self.assertTrue(manifest["validation"]["rights_status_preserved"])
        self.assertFalse(manifest["validation"]["public_allowed"])
        self.assertFalse(manifest["validation"]["canonical_links_created"])
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

    def test_source_working_data_and_existing_fixtures_are_unchanged(self) -> None:
        self.assertEqual(tree_hashes(FULL_IMPORT), self.protected_hashes["full"])
        self.assertEqual(tree_hashes(COURSE_IMPORT), self.protected_hashes["course"])
        self.assertEqual(tree_hashes(PART2_FIXTURE), self.protected_hashes["part2"])
        self.assertEqual(tree_hashes(TEXT_FIXTURE), self.protected_hashes["text"])


if __name__ == "__main__":
    unittest.main()

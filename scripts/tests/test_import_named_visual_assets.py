from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "import_named_visual_assets.py"
ARCHIVE = ROOT / "data" / "raw" / "TSC_individual_images_named.zip"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_hashes(path: Path) -> dict[str, str]:
    return {
        item.relative_to(path).as_posix(): sha256(item)
        for item in sorted(path.rglob("*"))
        if item.is_file()
    }


def run_importer(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class NamedVisualAssetImportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.output = Path(self.temporary_directory.name) / "assets"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_imports_exact_named_image_contract_without_reencoding(self) -> None:
        archive_hash = sha256(ARCHIVE)
        result = run_importer("--output-dir", str(self.output))
        self.assertEqual(result.returncode, 0, result.stderr)

        manifest = json.loads((self.output / "manifest.json").read_text())
        assets = manifest["assets"]
        self.assertEqual(manifest["dataset_id"], "tsc-individual-images-v1")
        self.assertEqual(manifest["source_archive_sha256"], archive_hash)
        self.assertEqual(manifest["counts"], {"total": 60, "part2": 12, "part7": 48})
        self.assertEqual(len(assets), 60)
        self.assertNotIn(b"\r", (self.output / "image_name_list.csv").read_bytes())
        self.assertEqual(
            [item["filename"] for item in assets if item["part"] == 2],
            [
                "part2-1_park_running_bench_cat_clock.png",
                "part2-2_weather_rainy_8c_vs_sunny.png",
                "part2-3_fruit_market_scale_2kg_grapes_5yuan.png",
                "part2-4_bakery_bread_magazine_watch_prices.png",
                "part2-5_city_bus_subway_hospital_school_home.png",
                "part2-6_room_window_cat_apple_book_flower_slippers.png",
                "part2-7_copy_machine_papers_room503_clock.png",
                "part2-8_library_reading_scale_swim_ring.png",
                "part2-9_bus5211_room103_hospital503_clock.png",
                "part2-10_height_180_162_laptop_3kg_suitcase_15kg.png",
                "part2-11_clothes_rack_pants_shoes_scarf.png",
                "part2-12_cafe_menu_balloons_umbrella_rain.png",
            ],
        )
        for item in assets:
            image = self.output / item["filename"]
            self.assertEqual((item["width"], item["height"]), (538, 444))
            self.assertEqual(item["media_type"], "image/png")
            self.assertEqual(sha256(image), item["sha256"])
            self.assertEqual(image.stat().st_size, item["file_size"])

    def test_part7_frames_are_ordered_one_to_four_for_every_set(self) -> None:
        result = run_importer("--output-dir", str(self.output))
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.output / "manifest.json").read_text())
        assets = manifest["assets"]
        for set_number in range(1, 13):
            selected = [
                item
                for item in assets
                if item["part"] == 7 and item["set_number"] == set_number
            ]
            self.assertEqual([item["frame_number"] for item in selected], [1, 2, 3, 4])
            self.assertTrue(
                all(item["filename"].startswith(f"part7-{set_number}-") for item in selected)
            )

    def test_validate_only_and_repeated_import_are_deterministic(self) -> None:
        first = run_importer("--output-dir", str(self.output))
        self.assertEqual(first.returncode, 0, first.stderr)
        before = tree_hashes(self.output)
        second = run_importer("--output-dir", str(self.output))
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(tree_hashes(self.output), before)
        validated = run_importer(
            "--validate-only", "--output-dir", str(self.output)
        )
        self.assertEqual(validated.returncode, 0, validated.stderr)
        self.assertEqual(tree_hashes(self.output), before)


if __name__ == "__main__":
    unittest.main()

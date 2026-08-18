from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "import_named_visual_assets.py"
TRACKED_ASSETS = (
    ROOT / "data" / "working" / "app-assets" / "tsc-individual-images-v1"
)


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
        self.archive = Path(self.temporary_directory.name) / "named-assets.zip"
        with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_STORED) as archive:
            for path in sorted(TRACKED_ASSETS.glob("*.png")):
                archive.write(path, arcname=path.name)
            for name in ("README.txt", "image_name_list.csv"):
                archive.write(TRACKED_ASSETS / name, arcname=name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_imports_exact_named_image_contract_without_reencoding(self) -> None:
        archive_hash = sha256(self.archive)
        result = run_importer(
            "--archive", str(self.archive), "--output-dir", str(self.output)
        )
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
            expected_dimensions = (
                (1448, 1086) if item["part"] == 2 else (item["width"], item["height"])
            )
            self.assertEqual((item["width"], item["height"]), expected_dimensions)
            self.assertEqual(item["media_type"], "image/png")
            self.assertEqual(sha256(image), item["sha256"])
            self.assertEqual(image.stat().st_size, item["file_size"])

        self.assertEqual(
            manifest["generated_replacement_assets"],
            [
                "part2-2_weather_rainy_8c_vs_sunny.png",
                "part2-3_fruit_market_scale_2kg_grapes_5yuan.png",
                "part2-4_bakery_bread_magazine_watch_prices.png",
                "part2-5_city_bus_subway_hospital_school_home.png",
                "part2-6_room_window_cat_apple_book_flower_slippers.png",
                "part2-7_copy_machine_papers_room503_clock.png",
                "part2-9_bus5211_room103_hospital503_clock.png",
                "part2-10_height_180_162_laptop_3kg_suitcase_15kg.png",
                "part7-2-3_car_accident_on_road.png",
                "part7-2-4_pay_expensive_repair_fee.png",
                "part7-3-1_neighbor_brings_oranges.png",
                "part7-4-3_boy_gets_distracted_by_game.png",
                "part7-7-1_prepare_surprise_birthday_party.png",
                "part7-7-4_enjoy_birthday_party_together.png",
                "part7-8-2_run_out_of_home_in_hurry.png",
            ],
        )
        replacement_names = set(manifest["generated_replacement_assets"])
        for item in assets:
            expected_origin = (
                "generated_replacement"
                if item["filename"] in replacement_names
                else "named_bundle_asset"
            )
            self.assertEqual(item["asset_provenance_kind"], expected_origin)

    def test_part7_frames_are_ordered_one_to_four_for_every_set(self) -> None:
        result = run_importer(
            "--archive", str(self.archive), "--output-dir", str(self.output)
        )
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
        import_arguments = (
            "--archive",
            str(self.archive),
            "--output-dir",
            str(self.output),
        )
        first = run_importer(*import_arguments)
        self.assertEqual(first.returncode, 0, first.stderr)
        before = tree_hashes(self.output)
        second = run_importer(*import_arguments)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(tree_hashes(self.output), before)
        validated = run_importer(
            "--validate-only", "--output-dir", str(self.output)
        )
        self.assertEqual(validated.returncode, 0, validated.stderr)
        self.assertEqual(tree_hashes(self.output), before)

    def test_validate_only_uses_the_tracked_asset_bundle_without_the_source_zip(self) -> None:
        missing_archive = Path(self.temporary_directory.name) / "removed-source.zip"

        result = run_importer(
            "--validate-only",
            "--archive",
            str(missing_archive),
            "--output-dir",
            str(TRACKED_ASSETS),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Validated named visual assets", result.stdout)

    def test_import_requires_an_explicit_external_archive(self) -> None:
        result = run_importer("--output-dir", str(self.output))

        self.assertEqual(result.returncode, 1)
        self.assertIn("--archive is required when importing", result.stderr)

    def test_replaced_part2_images_have_current_descriptions(self) -> None:
        manifest = json.loads((TRACKED_ASSETS / "manifest.json").read_text())
        descriptions = {
            item["filename"]: item["korean_description"]
            for item in manifest["assets"]
        }

        self.assertEqual(
            descriptions["part2-1_park_running_bench_cat_clock.png"],
            "공원에서 달리는 남자, 벤치에 앉은 여자, 벤치 아래 고양이, 7시 30분 시계",
        )
        self.assertEqual(
            descriptions["part2-8_library_reading_scale_swim_ring.png"],
            "도서관에서 책과 신문 읽기, 주방에서 요리와 설거지",
        )
        self.assertEqual(
            descriptions["part2-11_clothes_rack_pants_shoes_scarf.png"],
            "모자를 쓴 남자, 우산을 든 여자, 바지 두 벌, 신발 한 켤레",
        )
        self.assertEqual(
            descriptions["part2-12_cafe_menu_balloons_umbrella_rain.png"],
            "커피 4위안과 케이크 8위안, 사과 두 개, 젖은 우산",
        )


if __name__ == "__main__":
    unittest.main()

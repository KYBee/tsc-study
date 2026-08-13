#!/usr/bin/env python3
"""Safely import the user-provided named Part 2 and Part 7 image bundle."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import struct
import sys
import tempfile
from typing import Any
import zipfile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = (
    ROOT / "data" / "working" / "app-assets" / "tsc-individual-images-v1"
)
DATASET_ID = "tsc-individual-images-v1"
ARCHIVE_METADATA = {"README.txt", "image_name_list.csv"}
PART2_NAME = re.compile(r"^part2-(?P<set>[1-9]|1[0-2])_[a-z0-9_]+\.png$")
PART7_NAME = re.compile(
    r"^part7-(?P<set>[1-9]|1[0-2])-(?P<frame>[1-4])_[a-z0-9_]+\.png$"
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_MEMBER_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
GENERATED_REPLACEMENT_ASSETS = (
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
)


class ImportError(RuntimeError):
    """Raised when the named asset archive violates its import contract."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def repository_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.name


def png_dimensions(value: bytes, filename: str) -> tuple[int, int]:
    if len(value) < 24 or not value.startswith(PNG_SIGNATURE) or value[12:16] != b"IHDR":
        raise ImportError(f"invalid PNG header: {filename}")
    width, height = struct.unpack(">II", value[16:24])
    if width <= 0 or height <= 0:
        raise ImportError(f"invalid PNG dimensions: {filename}")
    return width, height


def parse_asset_name(filename: str) -> tuple[int, int, int]:
    part2 = PART2_NAME.fullmatch(filename)
    if part2:
        return 2, int(part2.group("set")), 1
    part7 = PART7_NAME.fullmatch(filename)
    if part7:
        return 7, int(part7.group("set")), int(part7.group("frame"))
    raise ImportError(f"unexpected image filename: {filename}")


def read_archive(archive: Path) -> tuple[dict[str, bytes], list[dict[str, Any]]]:
    if not archive.is_file():
        raise ImportError(f"source archive is missing: {repository_path(archive)}")
    try:
        handle = zipfile.ZipFile(archive)
    except zipfile.BadZipFile as cause:
        raise ImportError("source archive is not a valid ZIP file") from cause

    with handle:
        infos = handle.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            raise ImportError("source archive contains duplicate member names")
        if len(infos) != 62:
            raise ImportError(f"source archive must contain exactly 62 files, found {len(infos)}")
        total_size = 0
        files: dict[str, bytes] = {}
        for info in infos:
            path = PurePosixPath(info.filename)
            mode = info.external_attr >> 16
            if (
                info.is_dir()
                or path.is_absolute()
                or len(path.parts) != 1
                or ".." in path.parts
                or (mode and stat.S_ISLNK(mode))
            ):
                raise ImportError(f"unsafe archive member: {info.filename}")
            if info.file_size > MAX_MEMBER_BYTES:
                raise ImportError(f"archive member is too large: {info.filename}")
            total_size += info.file_size
            if total_size > MAX_TOTAL_BYTES:
                raise ImportError("source archive expands beyond the allowed size")
            files[info.filename] = handle.read(info)

    if not ARCHIVE_METADATA.issubset(files):
        raise ImportError("source archive metadata files are missing")
    image_names = sorted(name for name in files if name.endswith(".png"))
    if len(image_names) != 60 or set(files) != ARCHIVE_METADATA | set(image_names):
        raise ImportError("source archive must contain only 60 PNGs and two metadata files")

    csv_text = files["image_name_list.csv"].decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(csv_text, newline=""))
    if reader.fieldnames != ["filename", "korean_description"]:
        raise ImportError("image_name_list.csv header is invalid")
    descriptions: dict[str, str] = {}
    for row in reader:
        filename = row["filename"]
        description = row["korean_description"]
        if filename in descriptions or not description or len(description) > 1000:
            raise ImportError(f"invalid CSV row for {filename!r}")
        descriptions[filename] = description
    if set(descriptions) != set(image_names):
        raise ImportError("CSV filenames and archive PNG filenames differ")

    assets: list[dict[str, Any]] = []
    coverage: set[tuple[int, int, int]] = set()
    for filename in image_names:
        part, set_number, frame_number = parse_asset_name(filename)
        key = (part, set_number, frame_number)
        if key in coverage:
            raise ImportError(f"duplicate semantic image position: {key}")
        coverage.add(key)
        value = files[filename]
        width, height = png_dimensions(value, filename)
        assets.append(
            {
                "filename": filename,
                "part": part,
                "set_number": set_number,
                "frame_number": frame_number,
                "korean_description": descriptions[filename],
                "media_type": "image/png",
                "file_size": len(value),
                "sha256": sha256_bytes(value),
                "width": width,
                "height": height,
                "asset_provenance_kind": (
                    "generated_replacement"
                    if filename in GENERATED_REPLACEMENT_ASSETS
                    else "named_bundle_asset"
                ),
            }
        )
    expected = {
        *((2, set_number, 1) for set_number in range(1, 13)),
        *(
            (7, set_number, frame_number)
            for set_number in range(1, 13)
            for frame_number in range(1, 5)
        ),
    }
    if coverage != expected:
        raise ImportError("image set/frame coverage is incomplete")
    assets.sort(key=lambda item: (item["part"], item["set_number"], item["frame_number"]))
    return files, assets


def build_readme() -> bytes:
    return """# TSC named visual assets v1

이름 지정 이미지 묶음과 학습 정합성 검수에서 생성한 교체본을 합친
working 앱 자산이다. 현재 audited archive의 이미지 60장은 재인코딩 없이
안전하게 반입한다.

- Part 2: 세트별 대표 그림 1장, 총 12장
- Part 7: 세트별 이야기 그림 4장, 총 48장
- 파일명과 `image_name_list.csv`가 제공하는 명시적 세트·순서를 사용한다.
- `generated_replacement_assets`와 각 asset의 `asset_provenance_kind`로
  생성 교체본과 기존 묶음 자산을 구분한다.
- 압축 원본은 추출 검증 후 저장소에서 제거했다. working 사본의 텍스트
  메타데이터만 UTF-8/LF로 결정적으로 정규화했으며 PNG 바이트는 변경하지
  않았다.
- 이미지의 출처와 공개 권리는 별도로 검증되지 않았으므로 모두
  `review_needed`, `public_allowed = false`로 취급한다.
- Git에는 학습용 바이트를 보존한다. 기본 production build에서는 제외하며,
  운영자가 별도 환경변수로 명시적으로 opt-in한 build에만 포함한다.

```sh
python3 scripts/import_named_visual_assets.py --archive /path/to/named-assets.zip
python3 scripts/import_named_visual_assets.py --validate-only
```
""".encode("utf-8")


def build_files(archive: Path) -> dict[str, bytes]:
    archive_files, assets = read_archive(archive)
    output: dict[str, bytes] = {
        name: value
        for name, value in archive_files.items()
        if name.endswith(".png")
    }
    source_readme = archive_files["README.txt"].decode("utf-8-sig")
    output["README.txt"] = (
        "\n".join(source_readme.splitlines()).rstrip("\n") + "\n"
    ).encode("utf-8")
    csv_output = io.StringIO(newline="")
    writer = csv.writer(csv_output, lineterminator="\n")
    writer.writerow(["filename", "korean_description"])
    writer.writerows(
        (item["filename"], item["korean_description"]) for item in assets
    )
    output["image_name_list.csv"] = csv_output.getvalue().encode("utf-8")
    output["README.md"] = build_readme()
    generated_hashes = {
        name: sha256_bytes(value) for name, value in sorted(output.items())
    }
    output["manifest.json"] = json_bytes(
        {
            "dataset_id": DATASET_ID,
            "dataset_status": "working",
            "source_archive_original_name": archive.name,
            "source_archive_sha256": sha256_file(archive),
            "source_archive_size": archive.stat().st_size,
            "source_metadata_sha256": {
                name: sha256_bytes(archive_files[name]) for name in sorted(ARCHIVE_METADATA)
            },
            "counts": {"total": 60, "part2": 12, "part7": 48},
            "generated_replacement_assets": list(GENERATED_REPLACEMENT_ASSETS),
            "assets": assets,
            "generated_files": generated_hashes,
            "validation": {
                "archive_paths_safe": True,
                "png_bytes_preserved": True,
                "metadata_text_normalized_to_utf8_lf": True,
                "explicit_filename_order_used": True,
                "rights_status": "review_needed",
                "public_allowed": False,
                "production_enabled": False,
            },
        }
    )
    return output


def validate_output(output_dir: Path) -> dict[str, int]:
    if not output_dir.is_dir():
        raise ImportError(f"asset output is missing: {output_dir}")
    try:
        manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as cause:
        raise ImportError("asset manifest is missing or invalid") from cause

    counts = manifest.get("counts")
    assets = manifest.get("assets")
    generated_files = manifest.get("generated_files")
    if manifest.get("dataset_id") != DATASET_ID:
        raise ImportError("asset manifest dataset_id is invalid")
    if counts != {"total": 60, "part2": 12, "part7": 48}:
        raise ImportError("asset manifest counts are invalid")
    if not isinstance(assets, list) or len(assets) != 60:
        raise ImportError("asset manifest must contain exactly 60 assets")
    if manifest.get("generated_replacement_assets") != list(GENERATED_REPLACEMENT_ASSETS):
        raise ImportError("asset manifest replacement provenance is invalid")
    if not isinstance(generated_files, dict):
        raise ImportError("asset manifest generated_files is invalid")

    filenames: list[str] = []
    coverage: set[tuple[int, int, int]] = set()
    for item in assets:
        if not isinstance(item, dict) or not isinstance(item.get("filename"), str):
            raise ImportError("asset manifest contains an invalid asset")
        filename = item["filename"]
        part, set_number, frame_number = parse_asset_name(filename)
        if (part, set_number, frame_number) != (
            item.get("part"),
            item.get("set_number"),
            item.get("frame_number"),
        ):
            raise ImportError(f"asset position metadata differs from filename: {filename}")
        key = (part, set_number, frame_number)
        if key in coverage:
            raise ImportError(f"duplicate semantic image position: {key}")
        coverage.add(key)
        filenames.append(filename)

        image = output_dir / filename
        if not image.is_file():
            raise ImportError(f"asset image is missing: {filename}")
        value = image.read_bytes()
        width, height = png_dimensions(value, filename)
        if item.get("media_type") != "image/png":
            raise ImportError(f"asset MIME is invalid: {filename}")
        expected_provenance = (
            "generated_replacement"
            if filename in GENERATED_REPLACEMENT_ASSETS
            else "named_bundle_asset"
        )
        if item.get("asset_provenance_kind") != expected_provenance:
            raise ImportError(f"asset provenance differs from contract: {filename}")
        if item.get("file_size") != len(value):
            raise ImportError(f"asset size differs from manifest: {filename}")
        if item.get("sha256") != sha256_bytes(value):
            raise ImportError(f"asset SHA-256 differs from manifest: {filename}")
        if (item.get("width"), item.get("height")) != (width, height):
            raise ImportError(f"asset dimensions differ from manifest: {filename}")

    expected_coverage = {
        *((2, set_number, 1) for set_number in range(1, 13)),
        *(
            (7, set_number, frame_number)
            for set_number in range(1, 13)
            for frame_number in range(1, 5)
        ),
    }
    if coverage != expected_coverage:
        raise ImportError("asset set/frame coverage is incomplete")
    expected_order = sorted(
        assets,
        key=lambda item: (item["part"], item["set_number"], item["frame_number"]),
    )
    if assets != expected_order:
        raise ImportError("asset manifest order is not deterministic")

    expected_names = {
        *filenames,
        "README.txt",
        "image_name_list.csv",
        "README.md",
        "manifest.json",
    }
    actual = {item.name for item in output_dir.iterdir() if item.is_file()}
    if actual != expected_names:
        raise ImportError("asset output contains missing or unexpected files")
    if set(generated_files) != expected_names - {"manifest.json"}:
        raise ImportError("asset manifest generated_files coverage is invalid")
    for name, expected_hash in generated_files.items():
        if not isinstance(expected_hash, str) or sha256_file(output_dir / name) != expected_hash:
            raise ImportError(f"asset output hash differs from manifest: {name}")

    csv_text = (output_dir / "image_name_list.csv").read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(csv_text, newline=""))
    rows = list(reader)
    if reader.fieldnames != ["filename", "korean_description"]:
        raise ImportError("image_name_list.csv header is invalid")
    descriptions = {
        row["filename"]: row["korean_description"]
        for row in rows
        if row.get("filename") and row.get("korean_description")
    }
    if len(rows) != 60 or set(descriptions) != set(filenames):
        raise ImportError("image_name_list.csv does not cover all assets")
    for item in assets:
        if descriptions[item["filename"]] != item.get("korean_description"):
            raise ImportError(
                f"asset description differs from CSV: {item['filename']}"
            )
    return counts


def publish(output_dir: Path, archive: Path) -> dict[str, int]:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.build-", dir=output_dir.parent))
    backup: Path | None = None
    try:
        for name, value in build_files(archive).items():
            (staging / name).write_bytes(value)
        validate_output(staging)
        if output_dir.exists():
            backup = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.backup-", dir=output_dir.parent))
            backup.rmdir()
            output_dir.replace(backup)
        staging.replace(output_dir)
        if backup is not None:
            shutil.rmtree(backup)
        return validate_output(output_dir)
    except Exception:
        if backup is not None and backup.exists():
            if output_dir.exists():
                shutil.rmtree(output_dir)
            backup.replace(output_dir)
        raise
    finally:
        if staging.exists() and staging != output_dir:
            shutil.rmtree(staging, ignore_errors=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if args.validate_only:
            counts = validate_output(args.output_dir)
        else:
            if args.archive is None:
                raise ImportError("--archive is required when importing")
            counts = publish(args.output_dir, args.archive)
    except (ImportError, OSError, UnicodeError, zipfile.BadZipFile) as cause:
        print(f"error: {cause}", file=sys.stderr)
        return 1
    action = "Validated" if args.validate_only else "Imported"
    print(
        f"{action} named visual assets at {args.output_dir} "
        f"(total={counts['total']}, part2={counts['part2']}, part7={counts['part7']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

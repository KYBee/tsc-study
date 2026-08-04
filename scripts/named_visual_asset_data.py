"""Shared deterministic mapping from the named visual bundle to app entities."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = Path("data/working/app-assets/tsc-individual-images-v1")
MANIFEST_PATH = ROOT / ASSET_ROOT / "manifest.json"
SOURCE_ID = "src-user-named-visuals-001"
DATASET_ID = "tsc-individual-images-v1"


class NamedAssetDataError(RuntimeError):
    """Raised when the imported named asset manifest is unavailable or invalid."""


def load_manifest() -> dict[str, Any]:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as cause:
        raise NamedAssetDataError(
            "named visual assets are not prepared; run "
            "python3 scripts/import_named_visual_assets.py"
        ) from cause
    if (
        manifest.get("dataset_id") != DATASET_ID
        or manifest.get("counts") != {"total": 60, "part2": 12, "part7": 48}
        or len(manifest.get("assets", [])) != 60
    ):
        raise NamedAssetDataError("named visual asset manifest contract changed")
    return manifest


def source_record(manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": SOURCE_ID,
        "title": "TSC individual image set",
        "source_type": "other",
        "provenance_status": "unverified_source",
        "creator_or_provider": "",
        "original_file_name": "TSC_individual_images_named.zip",
        "file_ref": "data/raw/TSC_individual_images_named.zip",
        "claimed_original_names": [],
        "sha256": manifest["source_archive_sha256"],
        "acquired_date": "",
        "rights_status": "review_needed",
        "source_status": "raw",
        "notes": (
            "사용자가 제공한 이름 지정 이미지 묶음. 파일명과 동봉 CSV의 "
            "세트·장면 순서는 보존했으나 원출처와 공개 권리는 검증되지 않았다."
        ),
    }


def visual_entities(part: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if part not in {2, 7}:
        raise NamedAssetDataError(f"unsupported visual part: {part}")
    manifest = load_manifest()
    selected = [item for item in manifest["assets"] if item["part"] == part]
    expected_count = 12 if part == 2 else 48
    if len(selected) != expected_count:
        raise NamedAssetDataError(f"Part {part} named image count changed")

    assets: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []
    for item in selected:
        set_number = item["set_number"]
        frame_number = item["frame_number"]
        suffix = f"P{part}-V{set_number:02d}-{frame_number:02d}"
        visual_asset_id = f"va-{suffix}"
        visual_set_id = f"vs-P{part}-V{set_number:02d}"
        assets.append(
            {
                "visual_asset_id": visual_asset_id,
                "source_id": SOURCE_ID,
                "source_locator": (
                    "TSC_individual_images_named.zip!/" + item["filename"]
                ),
                "repository_path": (ASSET_ROOT / item["filename"]).as_posix(),
                "media_type": item["media_type"],
                "file_size": item["file_size"],
                "sha256": item["sha256"],
                "width": item["width"],
                "height": item["height"],
                "rights_status": "review_needed",
                "asset_status": "raw",
                "notes": (
                    f"동봉 CSV 설명: {item['korean_description']}; "
                    "파일명에 명시된 세트·장면 순서 사용; 원본 PNG 바이트 미변경; "
                    "원출처·공개 권리 미검수"
                ),
            }
        )
        links.append(
            {
                "visual_set_asset_id": f"vsa-{suffix}",
                "visual_set_id": visual_set_id,
                "visual_asset_id": visual_asset_id,
                "sequence": frame_number,
                "role": "primary" if part == 2 else "story_frame",
                "mapping_status": "review_needed",
                "notes": (
                    "사용자 제공 파일명과 동봉 CSV의 명시적 세트·장면 번호로 연결함. "
                    "이미지 원출처와 공개 권리는 별도 검수 필요."
                ),
            }
        )
    return assets, links

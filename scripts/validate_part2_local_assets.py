#!/usr/bin/env python3
"""Validate the local-only Part 2 image boundary and production output."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "data/working/app-fixtures/part2-visual-v1"
ASSET_ROOT = ROOT / "data/working/generated-assets/full-import-v1"
DIST_DIR = ROOT / "dist"

MAGIC = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/gif": (b"GIF87a", b"GIF89a"),
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def fail(message: str) -> None:
    raise SystemExit(message)


def main() -> None:
    records = json.loads((FIXTURE_DIR / "visual-assets.json").read_text("utf-8"))
    if len(records) != 12:
        fail(f"Expected 12 Part 2 VisualAssets, found {len(records)}")

    root = ASSET_ROOT.resolve()
    asset_bytes: list[tuple[str, bytes]] = []
    seen_hashes: set[str] = set()
    for record in records:
        path_text = record["repository_path"]
        if Path(path_text).is_absolute() or ".." in Path(path_text).parts:
            fail(f"Unsafe repository_path: {path_text}")
        path = (ROOT / path_text).resolve()
        if path.parent != root:
            fail(f"Asset escaped the generated root: {path_text}")
        if not path.is_file():
            fail(f"Missing local Part 2 asset: {path_text}")
        content = path.read_bytes()
        actual_hash = sha256_bytes(content)
        if actual_hash != record["sha256"]:
            fail(f"SHA-256 mismatch: {path_text}")
        if actual_hash in seen_hashes:
            fail(f"Duplicate Part 2 image SHA-256: {actual_hash}")
        seen_hashes.add(actual_hash)
        signatures = MAGIC.get(record["media_type"])
        if not signatures or not any(content.startswith(value) for value in signatures):
            fail(f"Unsupported or mismatched image format: {path_text}")
        if len(content) != record["file_size"]:
            fail(f"File size mismatch: {path_text}")
        ignored = subprocess.run(
            ["git", "check-ignore", "--quiet", path_text],
            cwd=ROOT,
            check=False,
        )
        if ignored.returncode != 0:
            fail(f"Local asset is not ignored by Git: {path_text}")
        tracked = subprocess.run(
            ["git", "ls-files", "--error-unmatch", path_text],
            cwd=ROOT,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if tracked.returncode == 0:
            fail(f"Local asset is tracked by Git: {path_text}")
        asset_bytes.append((path_text, content))

    if not DIST_DIR.is_dir():
        fail("dist/ does not exist; run npm run build before validating production")
    dist_files = [path for path in DIST_DIR.rglob("*") if path.is_file()]
    for dist_path in dist_files:
        content = dist_path.read_bytes()
        for source_path, raw_image in asset_bytes:
            if raw_image in content:
                fail(
                    f"Production output embeds local image bytes from {source_path}: "
                    f"{dist_path.relative_to(ROOT)}"
                )

    print(
        "Part 2 local assets valid: "
        f"{len(records)} files, {len(seen_hashes)} unique SHA-256 values, "
        "Git ignored, production bytes absent"
    )


if __name__ == "__main__":
    main()

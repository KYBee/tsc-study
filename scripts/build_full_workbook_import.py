#!/usr/bin/env python3
"""Build the deterministic, unreviewed full workbook working import.

The source XLSX and every existing working dataset are opened read-only.  This
builder deliberately keeps workbook claims separate from the actual workbook
Source and never promotes records to reviewed/verified application data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Mapping, Sequence
from zipfile import ZipFile

try:
    from scripts import extract_extended_sample as xlsx
except ModuleNotFoundError:  # direct `python3 scripts/...` execution
    import extract_extended_sample as xlsx


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK_RELATIVE_PATH = Path(
    "data/raw/TSC_파트별_문제은행_그림포함.xlsx"
)
WORKBOOK_PATH = ROOT / WORKBOOK_RELATIVE_PATH
COURSE_IMPORT_RELATIVE_DIR = Path("data/working/course-import-v1")
COURSE_IMPORT_DIR = ROOT / COURSE_IMPORT_RELATIVE_DIR
COURSE_MANIFEST_PATH = COURSE_IMPORT_DIR / "manifest.json"
DEFAULT_OUTPUT_DIR = ROOT / "data/working/full-import-v1"
DEFAULT_ASSET_DIR = ROOT / "data/working/generated-assets/full-import-v1"

DATASET_ID = "full-workbook-working-import-v1"
SCHEMA_VERSION = "data-schema-v1.1-working"
SOURCE_ID = "src-001"
EXPECTED_WORKBOOK_SHA256 = (
    "a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f"
)
EXPECTED_WORKBOOK_SIZE = 623_070
EXPECTED_SHEETS = (
    "시험 구조",
    "문제은행",
    "요약",
    "공식·참고 링크",
    "그림 활용 안내",
    "Part2 그림 연습",
    "Part2 정답",
    "Part7 스토리 그림",
    "Part7 정답 포인트",
    "공식 샘플 이미지",
)
EXPECTED_PART_COUNTS = {1: 4, 2: 48, 3: 84, 4: 50, 5: 36, 6: 19, 7: 12}
PERSONAL_COLUMNS = ("연습 상태", "최근 연습일", "내 답변 메모")

DATA_FILES = (
    "sources.json",
    "source-references.json",
    "questions.json",
    "answer-points.json",
    "part-guides.json",
    "visual-assets.json",
    "visual-sets.json",
    "visual-set-assets.json",
    "visual-questions.json",
    "question-visual-sets.json",
    "model-answers.json",
    "story-guides.json",
    "course-question-link-candidates.json",
    "course-content-usage-candidates.json",
    "workbook-link-candidates.json",
    "unmapped-content.json",
    "review-queue.json",
)
HASHED_FILES = DATA_FILES + ("README.md",)
OUTPUT_FILES = HASHED_FILES + ("manifest.json",)

QUESTION_FIELDS = (
    "question_id",
    "part",
    "question_type",
    "question_zh",
    "question_pinyin",
    "question_ko",
    "question_status",
    "normalization_notes",
    "tags",
)
ANSWER_POINT_FIELDS = (
    "answer_point_id",
    "question_id",
    "point_type",
    "content",
    "sequence",
    "point_status",
    "source_reference_ids",
    "notes",
)
SOURCE_REFERENCE_FIELDS = (
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
)


class FullImportError(RuntimeError):
    """Raised when the source, conversion, validation, or publication fails."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise FullImportError(message)


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")


def _repo_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(ROOT.resolve()).as_posix()
    except ValueError as error:
        raise FullImportError(
            f"manifest에 저장할 경로가 저장소 밖입니다: {path}"
        ) from error


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FullImportError(f"JSON을 읽을 수 없습니다: {path}") from error


def _safe_regular_input(path: Path, label: str) -> Path:
    if not path.exists() or not path.is_file() or path.is_symlink():
        raise FullImportError(f"{label}이 일반 파일이 아닙니다: {path}")
    return path


def _validate_course_import() -> dict[str, Any]:
    manifest_path = _safe_regular_input(
        COURSE_MANIFEST_PATH, "course-import manifest"
    )
    manifest = _load_json(manifest_path)
    _require(
        manifest.get("dataset_id") == "course-working-import-v1"
        and manifest.get("dataset_status") == "working",
        "course-import manifest의 dataset 식별자가 잘못됐습니다.",
    )
    generated = manifest.get("generated_files")
    _require(
        isinstance(generated, list),
        "course-import manifest.generated_files가 목록이 아닙니다.",
    )
    for item in generated:
        _require(
            isinstance(item, dict)
            and isinstance(item.get("path"), str)
            and isinstance(item.get("sha256"), str),
            "course-import generated_files 항목이 잘못됐습니다.",
        )
        relative = Path(item["path"])
        _require(
            not relative.is_absolute() and ".." not in relative.parts,
            "course-import generated file 경로가 안전하지 않습니다.",
        )
        path = _safe_regular_input(
            COURSE_IMPORT_DIR / relative,
            f"course-import {relative.as_posix()}",
        )
        _require(
            _sha256_file(path) == item["sha256"],
            f"course-import 파일 SHA-256이 manifest와 다릅니다: {relative}",
        )
    return manifest


def _logical_last_row(rows: Mapping[int, Mapping[int, str]]) -> int:
    populated = [
        row_number
        for row_number, values in rows.items()
        if any(value != "" for value in values.values())
    ]
    _require(bool(populated), "값이 있는 worksheet 행을 찾을 수 없습니다.")
    return max(populated)


def _cell(
    rows: Mapping[int, Mapping[int, str]], row: int, column: int
) -> str:
    return rows.get(row, {}).get(column, "")


def _sheet_locator(sheet_name: str, cell_range: str) -> str:
    return f"'{sheet_name}'!{cell_range}"


def _png_dimensions(value: bytes) -> tuple[int, int]:
    _require(
        value.startswith(b"\x89PNG\r\n\x1a\n")
        and len(value) >= 24
        and value[12:16] == b"IHDR",
        "PNG IHDR을 확인할 수 없습니다.",
    )
    width, height = struct.unpack(">II", value[16:24])
    _require(width > 0 and height > 0, "PNG 크기가 잘못됐습니다.")
    return width, height


def _source_reference(
    reference_id: str,
    target_type: str,
    target_id: str,
    source_locator: str,
    *,
    relationship_kind: str = "extracted_from",
    claimed_source_name: str = "",
    claimed_source_url: str = "",
    source_grade: str = "",
    originality: str = "",
    verification_status: str = "unverified",
    notes: str = "",
) -> dict[str, str]:
    return {
        "source_reference_id": reference_id,
        "target_type": target_type,
        "target_id": target_id,
        "source_id": SOURCE_ID,
        "source_locator": source_locator,
        "relationship_kind": relationship_kind,
        "claimed_source_name": claimed_source_name,
        "claimed_source_url": claimed_source_url,
        "source_grade": source_grade,
        "originality": originality,
        "verification_status": verification_status,
        "notes": notes,
    }


def _question_locator(row_number: int) -> str:
    return f"문제은행!A{row_number}:N{row_number}"


def _read_workbook() -> dict[str, Any]:
    _safe_regular_input(WORKBOOK_PATH, "원본 workbook")
    before_sha = _sha256_file(WORKBOOK_PATH)
    _require(
        before_sha == EXPECTED_WORKBOOK_SHA256,
        f"원본 workbook SHA-256이 예상과 다릅니다: {before_sha}",
    )
    _require(
        WORKBOOK_PATH.stat().st_size == EXPECTED_WORKBOOK_SIZE,
        "원본 workbook 파일 크기가 예상과 다릅니다.",
    )

    try:
        with ZipFile(WORKBOOK_PATH) as archive:
            bad_member = archive.testzip()
            _require(
                bad_member is None,
                f"XLSX ZIP 무결성 오류가 있습니다: {bad_member}",
            )
            members = xlsx._workbook_sheet_members(archive)
            _require(
                tuple(members) == EXPECTED_SHEETS,
                f"workbook 시트 목록이 예상과 다릅니다: {tuple(members)}",
            )
            shared_strings = xlsx._shared_strings(archive)
            worksheets: dict[str, Any] = {}
            rows_by_sheet: dict[str, dict[int, dict[int, str]]] = {}
            for sheet_name in EXPECTED_SHEETS:
                worksheet, rows = xlsx._read_sheet_rows(
                    archive, members[sheet_name], shared_strings
                )
                worksheets[sheet_name] = worksheet
                rows_by_sheet[sheet_name] = rows

            question_rows = xlsx._read_question_bank(
                rows_by_sheet["문제은행"]
            )
            p2_blocks = xlsx._find_set_blocks(
                rows_by_sheet["Part2 그림 연습"], 2, "I"
            )
            p7_blocks = xlsx._find_set_blocks(
                rows_by_sheet["Part7 스토리 그림"], 7, "A"
            )
            p2_blocks[-1]["end_row"] = _logical_last_row(
                rows_by_sheet["Part2 그림 연습"]
            )
            p2_blocks[-1]["source_locator"] = _sheet_locator(
                "Part2 그림 연습",
                f"A{p2_blocks[-1]['start_row']}:I{p2_blocks[-1]['end_row']}",
            )
            p7_blocks[-1]["end_row"] = _logical_last_row(
                rows_by_sheet["Part7 스토리 그림"]
            )
            p7_blocks[-1]["source_locator"] = _sheet_locator(
                "Part7 스토리 그림",
                f"A{p7_blocks[-1]['start_row']}:A{p7_blocks[-1]['end_row']}",
            )

            p2_images = xlsx._drawing_images(
                archive,
                members["Part2 그림 연습"],
                worksheets["Part2 그림 연습"],
            )
            p7_images = xlsx._drawing_images(
                archive,
                members["Part7 스토리 그림"],
                worksheets["Part7 스토리 그림"],
            )
            official_images = xlsx._drawing_images(
                archive,
                members["공식 샘플 이미지"],
                worksheets["공식 샘플 이미지"],
            )
            p2_sets = xlsx._map_images_to_blocks(p2_blocks, p2_images)
            p7_sets = xlsx._map_images_to_blocks(p7_blocks, p7_images)
            _require(
                len(official_images) == 1,
                "공식 샘플 이미지 시트에는 이미지가 1개여야 합니다.",
            )

            all_images = [*p2_images, *p7_images, *official_images]
            archive_media = sorted(
                name
                for name in archive.namelist()
                if name.startswith("xl/media/") and not name.endswith("/")
            )
            _require(
                len(all_images) == 25
                and len({item["media_member"] for item in all_images}) == 25,
                "worksheet drawing 관계로 확인한 이미지가 25개가 아닙니다.",
            )
            _require(
                sorted(str(item["media_member"]) for item in all_images)
                == archive_media,
                "worksheet drawing 관계와 XLSX media 파일 집합이 다릅니다.",
            )
            answer_rows = xlsx._table_records(
                rows_by_sheet["Part2 정답"],
                xlsx.PART2_ANSWER_HEADERS,
                48,
                "Part2 정답",
            )
            guide_rows = xlsx._table_records(
                rows_by_sheet["Part7 정답 포인트"],
                xlsx.PART7_GUIDE_HEADERS,
                12,
                "Part7 정답 포인트",
            )
    except (OSError, KeyError, ValueError, xlsx.ExtendedSampleExtractionError) as error:
        if isinstance(error, FullImportError):
            raise
        raise FullImportError(f"원본 workbook 조사에 실패했습니다: {error}") from error

    _require(
        _sha256_file(WORKBOOK_PATH) == before_sha,
        "읽기 전용 조사 중 원본 workbook SHA-256이 변경됐습니다.",
    )
    return {
        "workbook_sha256": before_sha,
        "rows": rows_by_sheet,
        "question_rows": question_rows,
        "p2_sets": p2_sets,
        "p7_sets": p7_sets,
        "official_image": official_images[0],
        "part2_answer_rows": answer_rows,
        "part7_guide_rows": guide_rows,
    }


def _build_sources(workbook_sha256: str) -> list[dict[str, Any]]:
    return [
        {
            "source_id": SOURCE_ID,
            "title": "TSC 파트별 문제은행 그림 포함",
            "source_type": "excel",
            "provenance_status": "unverified_source",
            "creator_or_provider": "",
            "original_file_name": "TSC_파트별_문제은행_그림포함.xlsx",
            "file_ref": WORKBOOK_RELATIVE_PATH.as_posix(),
            "claimed_original_names": [],
            "sha256": workbook_sha256,
            "acquired_date": "",
            "rights_status": "review_needed",
            "source_status": "raw",
            "notes": (
                "공식·강의·응시후기·자체 연습 자료가 혼합된 원본 workbook. "
                "내부 출처 이름·URL과 이미지 공개 가능 여부는 검수되지 않았다."
            ),
        }
    ]


def _build_questions_and_answer_points(
    source_rows: Sequence[dict[str, object]],
    references: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    questions: list[dict[str, Any]] = []
    answer_points: list[dict[str, Any]] = []
    for row in source_rows:
        row_number = int(row["__excel_row"])
        question_id = str(row["ID"])
        locator = _question_locator(row_number)
        claim = {
            "claimed_source_name": str(row["출처"]),
            "claimed_source_url": str(row["출처 URL"]),
            "source_grade": str(row["자료 등급"]),
            "originality": str(row["원문성"]),
        }
        question_reference_id = f"sr-question-{question_id}-extracted"
        references.append(
            _source_reference(
                question_reference_id,
                "question",
                question_id,
                locator,
                **claim,
            )
        )
        questions.append(
            {
                "question_id": question_id,
                "part": int(str(row["Part"])),
                "question_type": str(row["유형"]),
                "question_zh": str(row["중국어 문제/상황"]),
                "question_pinyin": str(row["병음"]),
                "question_ko": str(row["한국어 뜻/상황"]),
                "question_status": "raw",
                "normalization_notes": "",
                "tags": [],
            }
        )

        answer_point_id = f"ap-{question_id}-001"
        answer_reference_id = (
            f"sr-answer-point-{answer_point_id}-extracted"
        )
        references.append(
            _source_reference(
                answer_reference_id,
                "answer_point",
                answer_point_id,
                locator,
                **claim,
            )
        )
        answer_points.append(
            {
                "answer_point_id": answer_point_id,
                "question_id": question_id,
                "point_type": "unclassified",
                "content": str(row["답변 포인트"]),
                "sequence": 1,
                "point_status": "raw",
                "source_reference_ids": [answer_reference_id],
                "notes": "workbook 원문을 분해하거나 구조 분석하지 않음.",
            }
        )
    return questions, answer_points


def _build_part_guides(
    rows_by_sheet: Mapping[str, Mapping[int, Mapping[int, str]]],
    references: list[dict[str, str]],
) -> list[dict[str, Any]]:
    summary_rows = rows_by_sheet["요약"]
    guides: list[dict[str, Any]] = []
    for part in range(1, 8):
        row_number = part + 1
        _require(
            _cell(summary_rows, row_number, 1) == f"Part {part}",
            f"요약 시트 Part {part} 행을 확인할 수 없습니다.",
        )
        goal = _cell(summary_rows, row_number, 3)
        guide_id = f"part-guide-workbook-{part:02d}"
        reference_ids: list[str] = []
        summary_reference_id = f"sr-{guide_id}-summary-extracted"
        references.append(
            _source_reference(
                summary_reference_id,
                "part_guide",
                guide_id,
                _sheet_locator("요약", f"A{row_number}:C{row_number}"),
            )
        )
        reference_ids.append(summary_reference_id)

        tips: list[str] = []
        preparation_seconds: int | None = None
        response_seconds: int | None = None
        key_expressions: list[dict[str, str]] = []
        if part == 1:
            tips = [_cell(rows_by_sheet["시험 구조"], 2, 2)]
            response_seconds = 10
            reference_id = f"sr-{guide_id}-structure-extracted"
            references.append(
                _source_reference(
                    reference_id,
                    "part_guide",
                    guide_id,
                    _sheet_locator("시험 구조", "A2:B6"),
                )
            )
            reference_ids.append(reference_id)
        elif part == 2:
            tips = [_cell(rows_by_sheet["그림 활용 안내"], 5, 2)]
            preparation_seconds = 3
            response_seconds = 6
            reference_id = f"sr-{guide_id}-visual-guidance-extracted"
            references.append(
                _source_reference(
                    reference_id,
                    "part_guide",
                    guide_id,
                    _sheet_locator("그림 활용 안내", "A5:B5"),
                )
            )
            reference_ids.append(reference_id)
        elif part == 7:
            tips = [_cell(rows_by_sheet["그림 활용 안내"], 6, 2)]
            preparation_seconds = 30
            response_seconds = 90
            connectors = _cell(rows_by_sheet["그림 활용 안내"], 7, 2)
            key_expressions = [{"zh": connectors, "pinyin": "", "ko": ""}]
            reference_id = f"sr-{guide_id}-visual-guidance-extracted"
            references.append(
                _source_reference(
                    reference_id,
                    "part_guide",
                    guide_id,
                    _sheet_locator("그림 활용 안내", "A6:B7"),
                )
            )
            reference_ids.append(reference_id)

        guide: dict[str, Any] = {
            "part_guide_id": guide_id,
            "part": part,
            "goal": goal,
            "preparation_tips": tips,
            "response_structure": [],
            "key_expressions": key_expressions,
            "key_expression_ids": [],
            "representative_question_ids": [],
            "frequent_correction_ids": [],
            "representative_drill_ids": [],
            "course_target_context": "not_specified",
            "source_reference_ids": reference_ids,
            "guide_status": "review_needed",
            "notes": (
                "workbook 원문 기반 source-specific 가이드이며 course-import "
                "PartGuide와 병합하지 않음."
            ),
        }
        if preparation_seconds is not None:
            guide["preparation_seconds"] = preparation_seconds
        if response_seconds is not None:
            guide["response_seconds"] = response_seconds
        guides.append(guide)
    return guides


def _asset_record(
    *,
    asset_id: str,
    source_locator: str,
    repository_path: str,
    image: Mapping[str, object],
    notes: str,
) -> tuple[dict[str, Any], bytes]:
    value = bytes(image["media_bytes"])
    width, height = _png_dimensions(value)
    return (
        {
            "visual_asset_id": asset_id,
            "source_id": SOURCE_ID,
            "source_locator": source_locator,
            "repository_path": repository_path,
            "media_type": str(image["media_type"]),
            "file_size": len(value),
            "sha256": _sha256_bytes(value),
            "width": width,
            "height": height,
            "rights_status": "review_needed",
            "asset_status": "raw",
            "notes": notes,
        },
        value,
    )


def _visual_filename(part: int, figure_id: str, extension: str) -> str:
    return f"part{part}__{figure_id}.{extension}"


def _build_visual_core(
    workbook: Mapping[str, Any],
    references: list[dict[str, str]],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    dict[str, bytes],
]:
    visual_assets: list[dict[str, Any]] = []
    visual_sets: list[dict[str, Any]] = []
    visual_set_assets: list[dict[str, Any]] = []
    asset_bytes: dict[str, bytes] = {}

    for part, set_type, source_sets in (
        (2, "four_question_image", workbook["p2_sets"]),
        (7, "story_image", workbook["p7_sets"]),
    ):
        sheet_name = (
            "Part2 그림 연습" if part == 2 else "Part7 스토리 그림"
        )
        final_column = "I" if part == 2 else "A"
        for source_set in source_sets:
            figure_id = str(source_set["figure_id"])
            visual_set_id = f"vs-{figure_id}"
            visual_asset_id = f"va-{figure_id}-01"
            filename = _visual_filename(
                part, figure_id, str(source_set["extension"])
            )
            repository_path = (
                Path("data/working/generated-assets/full-import-v1")
                / filename
            ).as_posix()
            block_locator = _sheet_locator(
                sheet_name,
                f"A{source_set['start_row']}:{final_column}{source_set['end_row']}",
            )
            set_reference_id = (
                f"sr-visual-set-{visual_set_id}-extracted"
            )
            references.append(
                _source_reference(
                    set_reference_id,
                    "visual_set",
                    visual_set_id,
                    block_locator,
                    notes=f"원본 그림 ID {figure_id}",
                )
            )
            visual_sets.append(
                {
                    "visual_set_id": visual_set_id,
                    "part": part,
                    "set_type": set_type,
                    "set_status": "raw",
                    "source_reference_ids": [set_reference_id],
                    "notes": f"원본 그림 ID {figure_id}",
                }
            )
            anchor_cell = (
                f"{xlsx._column_name(int(source_set['anchor_column']))}"
                f"{source_set['anchor_row_start']}"
            )
            asset_locator = (
                f"{_sheet_locator(sheet_name, anchor_cell)}; "
                f"{source_set['media_member']}"
            )
            asset, value = _asset_record(
                asset_id=visual_asset_id,
                source_locator=asset_locator,
                repository_path=repository_path,
                image=source_set,
                notes=(
                    f"{source_set['anchor_type']} {anchor_cell}; "
                    f"원본 그림 ID {figure_id}; 원본 바이트 미가공"
                ),
            )
            visual_assets.append(asset)
            asset_bytes[filename] = value
            visual_set_assets.append(
                {
                    "visual_set_asset_id": f"vsa-{figure_id}-01",
                    "visual_set_id": visual_set_id,
                    "visual_asset_id": visual_asset_id,
                    "sequence": 1,
                    "role": "primary",
                    "mapping_status": "review_needed",
                    "notes": (
                        "worksheet 그림 ID 블록과 바로 다음 행의 OOXML "
                        "drawing anchor 관계로 연결함."
                    ),
                }
            )

    official = workbook["official_image"]
    official_set_id = "vs-official-sample-workbook-01"
    official_asset_id = "va-official-sample-workbook-01"
    official_filename = (
        f"official-sample__workbook.{official['extension']}"
    )
    official_reference_id = (
        f"sr-visual-set-{official_set_id}-extracted"
    )
    references.append(
        _source_reference(
            official_reference_id,
            "visual_set",
            official_set_id,
            _sheet_locator("공식 샘플 이미지", "A1:A40"),
            claimed_source_name="YBM 공식 공개 Part 7 샘플 이미지",
            claimed_source_url=(
                "https://www.ybmtsc.co.kr/content/TSC/sample/sample7.php"
            ),
            verification_status="review_needed",
            notes="공식 주장과 공개 권리는 별도 검수 필요.",
        )
    )
    visual_sets.append(
        {
            "visual_set_id": official_set_id,
            "part": 7,
            "set_type": "official_sample",
            "set_status": "raw",
            "source_reference_ids": [official_reference_id],
            "notes": "공식 샘플 이미지 시트의 단일 이미지; Question 미연결.",
        }
    )
    official_anchor = (
        f"{xlsx._column_name(int(official['anchor_column']))}"
        f"{official['anchor_row_start']}"
    )
    official_asset, official_bytes = _asset_record(
        asset_id=official_asset_id,
        source_locator=(
            f"{_sheet_locator('공식 샘플 이미지', official_anchor)}; "
            f"{official['media_member']}"
        ),
        repository_path=(
            Path("data/working/generated-assets/full-import-v1")
            / official_filename
        ).as_posix(),
        image=official,
        notes=(
            f"{official['anchor_type']} {official_anchor}; "
            "원본 바이트 미가공; 공개 권리 검수 필요"
        ),
    )
    visual_assets.append(official_asset)
    asset_bytes[official_filename] = official_bytes
    visual_set_assets.append(
        {
            "visual_set_asset_id": "vsa-official-sample-workbook-01",
            "visual_set_id": official_set_id,
            "visual_asset_id": official_asset_id,
            "sequence": 1,
            "role": "primary",
            "mapping_status": "review_needed",
            "notes": "공식 샘플 이미지 worksheet의 단일 drawing 관계.",
        }
    )

    return visual_assets, visual_sets, visual_set_assets, asset_bytes


def _build_visual_questions_and_links(
    workbook: Mapping[str, Any],
    questions: Sequence[dict[str, Any]],
    references: list[dict[str, str]],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    dict[tuple[str, int], dict[str, Any]],
]:
    question_by_zh: dict[str, list[dict[str, Any]]] = defaultdict(list)
    question_row_by_id = {
        str(row["ID"]): int(row["__excel_row"])
        for row in workbook["question_rows"]
    }
    for question in questions:
        if question["part"] == 2:
            question_by_zh[question["question_zh"]].append(question)

    rows = workbook["rows"]["Part2 그림 연습"]
    visual_questions: list[dict[str, Any]] = []
    question_visual_sets: list[dict[str, Any]] = []
    by_key: dict[tuple[str, int], dict[str, Any]] = {}
    seen_question_set_pairs: set[tuple[str, str]] = set()
    for block in workbook["p2_sets"]:
        figure_id = str(block["figure_id"])
        labels: list[tuple[int, int, str]] = []
        for row_number in range(
            int(block["start_row"]), int(block["end_row"]) + 1
        ):
            label = _cell(rows, row_number, 8)
            match = xlsx.VISUAL_QUESTION_LABEL_RE.fullmatch(label)
            if match is not None:
                labels.append((int(match.group(1)), row_number, label))
        labels.sort()
        _require(
            [number for number, _, _ in labels] == [1, 2, 3, 4],
            f"{figure_id} Q1~Q4 구조가 예상과 다릅니다.",
        )
        for item_number, row_number, original_label in labels:
            question_zh = _cell(rows, row_number, 9)
            question_pinyin = _cell(rows, row_number + 1, 9)
            question_ko = _cell(rows, row_number + 2, 9)
            _require(
                question_zh != "",
                f"{figure_id} Q{item_number} 중국어가 비었습니다.",
            )
            candidates = question_by_zh.get(question_zh, [])
            linked_question_id = ""
            mapping_note = "문제은행 중국어 원문 완전 일치 없음"
            exact_language_candidates = [
                candidate
                for candidate in candidates
                if candidate["question_pinyin"] == question_pinyin
                and candidate["question_ko"] == question_ko
            ]
            if len(exact_language_candidates) == 1:
                linked_question_id = exact_language_candidates[0][
                    "question_id"
                ]
                mapping_note = (
                    "중국어·병음·한국어 완전 일치 단일 후보"
                )
            elif len(candidates) == 1:
                candidate = candidates[0]
                conflicts = [
                    field
                    for field, visual_value, canonical_value in (
                        (
                            "question_pinyin",
                            question_pinyin,
                            candidate["question_pinyin"],
                        ),
                        ("question_ko", question_ko, candidate["question_ko"]),
                    )
                    if visual_value
                    and canonical_value
                    and visual_value != canonical_value
                ]
                if not conflicts:
                    linked_question_id = candidate["question_id"]
                    mapping_note = (
                        "중국어 원문 완전 일치 단일 후보이며 병음·한국어 "
                        "충돌 없음"
                    )
                else:
                    mapping_note = (
                        "중국어 단일 후보이나 언어 충돌: "
                        + ", ".join(conflicts)
                    )
            elif len(exact_language_candidates) > 1:
                mapping_note = (
                    "중국어·병음·한국어 완전 일치 후보 "
                    f"{len(exact_language_candidates)}개로 모호함"
                )
            elif len(candidates) > 1:
                mapping_note = (
                    f"중국어 원문 완전 일치 후보 {len(candidates)}개로 모호함"
                )

            visual_question_id = f"vq-{figure_id}-Q{item_number}"
            reference_id = (
                f"sr-visual-question-{visual_question_id}-extracted"
            )
            locator = _sheet_locator(
                "Part2 그림 연습",
                f"H{row_number}:I{row_number + 2}",
            )
            references.append(
                _source_reference(
                    reference_id,
                    "visual_question",
                    visual_question_id,
                    locator,
                    notes=f"원본 문항 표기 {original_label}",
                )
            )
            visual_question = {
                "visual_question_id": visual_question_id,
                "visual_set_id": f"vs-{figure_id}",
                "item_number": item_number,
                "question_id": linked_question_id,
                "question_zh": question_zh,
                "question_pinyin": question_pinyin,
                "question_ko": question_ko,
                "visual_question_status": "raw",
                "source_reference_ids": [reference_id],
                "notes": f"원본 문항 표기 {original_label}; {mapping_note}",
            }
            visual_questions.append(visual_question)
            by_key[(figure_id, item_number)] = visual_question

            if linked_question_id:
                pair = (linked_question_id, f"vs-{figure_id}")
                _require(
                    pair not in seen_question_set_pairs,
                    f"QuestionVisualSet 관계가 중복됩니다: {pair}",
                )
                seen_question_set_pairs.add(pair)
                relationship_id = (
                    f"qvs-{figure_id}-{linked_question_id}"
                )
                relation_reference_id = (
                    f"sr-question-visual-set-{relationship_id}-supports"
                )
                question_row = question_row_by_id[linked_question_id]
                references.append(
                    _source_reference(
                        relation_reference_id,
                        "question_visual_set",
                        relationship_id,
                        (
                            f"{locator}; "
                            f"{_question_locator(question_row)}"
                        ),
                        relationship_kind="supports",
                        verification_status="review_needed",
                        notes=mapping_note,
                    )
                )
                question_visual_sets.append(
                    {
                        "question_visual_set_id": relationship_id,
                        "question_id": linked_question_id,
                        "visual_set_id": f"vs-{figure_id}",
                        "relationship_kind": "primary",
                        "mapping_status": "review_needed",
                        "source_reference_ids": [relation_reference_id],
                        "notes": mapping_note,
                    }
                )
    return visual_questions, question_visual_sets, by_key


def _build_model_answers(
    workbook: Mapping[str, Any],
    visual_questions_by_key: Mapping[
        tuple[str, int], dict[str, Any]
    ],
    references: list[dict[str, str]],
) -> list[dict[str, Any]]:
    answer_by_key: dict[tuple[str, int], tuple[int, dict[str, str]]] = {}
    for row_number, source in workbook["part2_answer_rows"]:
        try:
            item_number = int(source["문항"])
        except ValueError as error:
            raise FullImportError(
                f"Part2 정답 문항이 정수가 아닙니다: {source['문항']}"
            ) from error
        key = (source["그림 ID"], item_number)
        _require(key not in answer_by_key, f"Part2 정답 키가 중복됩니다: {key}")
        answer_by_key[key] = (row_number, source)

    answers: list[dict[str, Any]] = []
    for key in sorted(visual_questions_by_key):
        visual_question = visual_questions_by_key[key]
        _require(key in answer_by_key, f"Part2 정답이 없습니다: {key}")
        row_number, source = answer_by_key[key]
        for visual_field, source_field in (
            ("question_zh", "중국어 질문"),
            ("question_pinyin", "병음"),
            ("question_ko", "한국어 질문"),
        ):
            _require(
                visual_question[visual_field] == source[source_field],
                f"Part2 그림 질문과 정답 시트 질문이 다릅니다: {key}",
            )
        figure_id, item_number = key
        answer_id = f"ma-{figure_id}-Q{item_number}-basic-01"
        reference_id = f"sr-model-answer-{answer_id}-extracted"
        references.append(
            _source_reference(
                reference_id,
                "model_answer",
                answer_id,
                _sheet_locator(
                    "Part2 정답", f"A{row_number}:H{row_number}"
                ),
                verification_status="review_needed",
                notes="workbook 원본 추천 답변; 언어·내용 검수 필요.",
            )
        )
        answers.append(
            {
                "answer_id": answer_id,
                "answer_target_type": "visual_question",
                "answer_target_id": visual_question["visual_question_id"],
                "answer_variant": "basic",
                "target_level": "",
                "answer_zh": source["추천 답변"],
                "answer_pinyin": source["답변 병음"],
                "answer_ko": source["한국어 뜻"],
                "structure_segments": [],
                "answer_status": "review_needed",
                "provenance_kind": "unverified_source",
                "source_reference_ids": [reference_id],
                "review_notes": (
                    "Excel 원본 추천 답변이며 승인된 공식 정답이 아님."
                ),
            }
        )
    return answers


def _build_story_guides_and_workbook_candidates(
    workbook: Mapping[str, Any],
    references: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    guide_by_figure = {
        row["그림 ID"]: (row_number, row)
        for row_number, row in workbook["part7_guide_rows"]
    }
    _require(
        len(guide_by_figure) == 12,
        "Part7 정답 포인트 그림 ID가 중복되거나 누락됐습니다.",
    )
    story_guides: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    for index, source_set in enumerate(workbook["p7_sets"], start=1):
        figure_id = str(source_set["figure_id"])
        _require(
            figure_id in guide_by_figure,
            f"Part7 StoryGuide 원본 행이 없습니다: {figure_id}",
        )
        row_number, source = guide_by_figure[figure_id]
        guide_id = f"sg-{figure_id}-01"
        reference_id = f"sr-story-guide-{guide_id}-extracted"
        references.append(
            _source_reference(
                reference_id,
                "story_guide",
                guide_id,
                _sheet_locator(
                    "Part7 정답 포인트", f"A{row_number}:E{row_number}"
                ),
            )
        )
        story_guides.append(
            {
                "story_guide_id": guide_id,
                "visual_set_id": f"vs-{figure_id}",
                "question_id": "",
                "situation_ko": source["한국어 상황"],
                "recommended_flow": source["추천 이야기 흐름"],
                "recommended_connectors_zh": source[
                    "권장 중국어 연결어"
                ],
                "material_nature": source["자료 성격"],
                "guide_status": "raw",
                "source_reference_ids": [reference_id],
                "notes": (
                    "그림 ID로 VisualSet에만 연결함. canonical Question은 "
                    "명시적 원본 외래키가 없어 비움."
                ),
            }
        )
        candidates.append(
            {
                "candidate_id": f"wlc-part7-{figure_id}-P7-{index:03d}",
                "candidate_kind": "part7_suffix",
                "source_entity_type": "visual_set",
                "source_entity_id": f"vs-{figure_id}",
                "candidate_question_id": f"P7-{index:03d}",
                "match_basis": "numeric_suffix_only",
                "matched_fields": ["numeric_suffix"],
                "conflicting_fields": [
                    "explicit_foreign_key_missing",
                    "question_zh_common_to_12_questions",
                ],
                "confidence": "low",
                "review_status": "review_needed",
                "notes": (
                    "접미사 대응은 실제 관계가 아니며 사람 검수 전 "
                    "QuestionVisualSet을 만들지 않는다."
                ),
            }
        )
    return story_guides, candidates


def _build_course_candidates(
    questions: Sequence[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    course_files = {
        filename: _load_json(COURSE_IMPORT_DIR / filename)
        for filename in (
            "part-guides.json",
            "learning-expressions.json",
            "pronunciation-items.json",
            "practice-drills.json",
            "course-insights.json",
            "conflicts.json",
            "source-references.json",
            "question-link-candidates.json",
        )
    }
    _require(
        all(isinstance(value, list) for value in course_files.values()),
        "course-import 후보 입력 파일은 모두 JSON 배열이어야 합니다.",
    )
    existing_course_candidates = course_files[
        "question-link-candidates.json"
    ]
    _require(
        existing_course_candidates == [],
        "기존 course question-link 후보의 자동 승격 규칙은 정의되지 않았습니다.",
    )

    question_by_id = {
        item["question_id"]: item for item in questions
    }
    question_by_zh: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for question in questions:
        question_by_zh[question["question_zh"]].append(question)

    content_specs = (
        ("part-guides.json", "part_guide", "part_guide_id"),
        ("learning-expressions.json", "learning_expression", "expression_id"),
        (
            "pronunciation-items.json",
            "pronunciation_item",
            "pronunciation_item_id",
        ),
        ("practice-drills.json", "practice_drill", "drill_id"),
        ("course-insights.json", "course_insight", "insight_id"),
        ("conflicts.json", "conflict", "conflict_id"),
    )
    explicit_candidates: dict[
        tuple[str, str, str], dict[str, Any]
    ] = {}

    def add_explicit_candidate(
        course_type: str,
        course_id: str,
        question_id: str,
        match_basis: str,
        matched_fields: list[str],
    ) -> None:
        if question_id not in question_by_id:
            return
        key = (course_type, course_id, question_id)
        if key in explicit_candidates:
            return
        explicit_candidates[key] = {
            "candidate_id": (
                f"cql-{course_type}-{course_id}-{question_id}"
            ),
            "course_content_type": course_type,
            "course_content_id": course_id,
            "candidate_question_id": question_id,
            "match_basis": match_basis,
            "matched_fields": matched_fields,
            "conflicting_fields": [],
            "confidence": "strict_candidate",
            "review_status": "review_needed",
            "notes": (
                "canonical 관계가 아니며 원본 상세 위치를 사람이 재확인해야 함."
            ),
        }

    for filename, course_type, id_field in content_specs:
        for record in course_files[filename]:
            _require(
                isinstance(record, dict)
                and isinstance(record.get(id_field), str),
                f"course-import {filename} ID 필드가 잘못됐습니다.",
            )
            course_id = record[id_field]
            explicit_ids: list[str] = []
            if isinstance(record.get("question_id"), str):
                explicit_ids.append(record["question_id"])
            if isinstance(record.get("representative_question_ids"), list):
                explicit_ids.extend(
                    value
                    for value in record["representative_question_ids"]
                    if isinstance(value, str)
                )
            for question_id in explicit_ids:
                add_explicit_candidate(
                    course_type,
                    course_id,
                    question_id,
                    "explicit_canonical_question_id",
                    ["question_id"],
                )

            question_zh = record.get("question_zh")
            if isinstance(question_zh, str) and question_zh:
                candidates = question_by_zh.get(question_zh, [])
                question_pinyin = record.get("question_pinyin")
                question_ko = record.get("question_ko")
                exact = [
                    candidate
                    for candidate in candidates
                    if (
                        not isinstance(question_pinyin, str)
                        or candidate["question_pinyin"] == question_pinyin
                    )
                    and (
                        not isinstance(question_ko, str)
                        or candidate["question_ko"] == question_ko
                    )
                ]
                if len(exact) == 1:
                    matched_fields = ["question_zh"]
                    if isinstance(question_pinyin, str):
                        matched_fields.append("question_pinyin")
                    if isinstance(question_ko, str):
                        matched_fields.append("question_ko")
                    add_explicit_candidate(
                        course_type,
                        course_id,
                        exact[0]["question_id"],
                        "exact_question_language_match",
                        matched_fields,
                    )

    course_content_ids = {
        (course_type, record[id_field])
        for filename, course_type, id_field in content_specs
        for record in course_files[filename]
    }
    for reference in course_files["source-references.json"]:
        _require(
            isinstance(reference, dict),
            "course-import SourceReference 항목이 객체가 아닙니다.",
        )
        target = (
            str(reference.get("target_type", "")),
            str(reference.get("target_id", "")),
        )
        if target not in course_content_ids:
            continue
        locator = reference.get("source_locator", "")
        if not isinstance(locator, str):
            continue
        for question_id in sorted(
            set(re.findall(r"\bP[1-7]-\d{3}\b", locator))
        ):
            add_explicit_candidate(
                target[0],
                target[1],
                question_id,
                "explicit_question_id_in_source_locator",
                ["source_locator"],
            )

    usage_candidates: list[dict[str, Any]] = []
    for expression in course_files["learning-expressions.json"]:
        language = expression.get("language", {})
        zh = language.get("zh", "") if isinstance(language, dict) else ""
        parts = expression.get("part_numbers", [])
        if (
            not isinstance(zh, str)
            or not zh
            or "XX" in zh
            or not isinstance(parts, list)
        ):
            continue
        for question in questions:
            if question["part"] in parts and zh in question["question_zh"]:
                usage_candidates.append(
                    {
                        "candidate_id": (
                            f"cuc-{expression['expression_id']}-"
                            f"{question['question_id']}"
                        ),
                        "course_content_type": "learning_expression",
                        "course_content_id": expression["expression_id"],
                        "candidate_question_id": question["question_id"],
                        "match_basis": (
                            "part_match_and_literal_zh_inclusion"
                        ),
                        "matched_fields": [
                            "part",
                            "question_zh_contains_language.zh",
                        ],
                        "conflicting_fields": [],
                        "confidence": "literal_match_only",
                        "review_status": "review_needed",
                        "notes": (
                            "추천 검수 큐이며 SourceReference나 canonical "
                            "Question 관계가 아님."
                        ),
                    }
                )

    for item in course_files["pronunciation-items.json"]:
        target_text = item.get("target_text", "")
        parts = item.get("part_numbers", [])
        if (
            not isinstance(target_text, str)
            or re.fullmatch(r"[\u3400-\u9fff]+", target_text) is None
            or not isinstance(parts, list)
        ):
            continue
        for question in questions:
            if (
                question["part"] in parts
                and target_text in question["question_zh"]
            ):
                usage_candidates.append(
                    {
                        "candidate_id": (
                            f"cuc-{item['pronunciation_item_id']}-"
                            f"{question['question_id']}"
                        ),
                        "course_content_type": "pronunciation_item",
                        "course_content_id": item[
                            "pronunciation_item_id"
                        ],
                        "candidate_question_id": question["question_id"],
                        "match_basis": (
                            "part_match_and_literal_target_text_inclusion"
                        ),
                        "matched_fields": [
                            "part",
                            "question_zh_contains_target_text",
                        ],
                        "conflicting_fields": [],
                        "confidence": "literal_match_only",
                        "review_status": "review_needed",
                        "notes": (
                            "발음 항목 사용 추천 검수 큐이며 canonical "
                            "Question 관계가 아님."
                        ),
                    }
                )
    usage_candidates.sort(key=lambda item: item["candidate_id"])
    return sorted(
        explicit_candidates.values(),
        key=lambda item: item["candidate_id"],
    ), usage_candidates


def _unmapped_record(
    unmapped_id: str,
    sheet_name: str,
    cell_or_range: str,
    original_value: str,
    content_kind: str,
    reason_not_mapped: str,
    possible_target_entity: str,
) -> dict[str, str]:
    return {
        "unmapped_id": unmapped_id,
        "sheet_name": sheet_name,
        "cell_or_range": cell_or_range,
        "original_value": original_value,
        "content_kind": content_kind,
        "reason_not_mapped": reason_not_mapped,
        "possible_target_entity": possible_target_entity,
        "review_status": "review_needed",
    }


def _build_unmapped_content(
    workbook: Mapping[str, Any],
) -> list[dict[str, str]]:
    rows = workbook["rows"]
    records: list[dict[str, str]] = []

    # Global workbook notes and grading descriptions are not Question data.
    mapped_structure_cells = {
        "B2",
    }
    for row_number, values in sorted(rows["시험 구조"].items()):
        for column, value in sorted(values.items()):
            if not value:
                continue
            cell_ref = f"{xlsx._column_name(column)}{row_number}"
            if cell_ref in mapped_structure_cells:
                continue
            records.append(
                _unmapped_record(
                    f"um-structure-{cell_ref.lower()}",
                    "시험 구조",
                    cell_ref,
                    value,
                    "global_instruction",
                    "PartGuide의 특정 Part 필드로 확정하기 어려운 전역 설명",
                    "PartGuide 또는 SourceReference",
                )
            )

    # Links are workbook claims, not verified Sources.
    for row_number, values in sorted(rows["공식·참고 링크"].items()):
        for column, value in sorted(values.items()):
            if not value:
                continue
            cell_ref = f"{xlsx._column_name(column)}{row_number}"
            records.append(
                _unmapped_record(
                    f"um-links-{cell_ref.lower()}",
                    "공식·참고 링크",
                    cell_ref,
                    value,
                    "claimed_reference_link",
                    "URL을 방문하거나 검증된 Source로 승격하지 않음",
                    "Source 또는 SourceReference",
                )
            )

    for row_number in (1, 2, 3, 4):
        for column, value in sorted(
            rows["그림 활용 안내"].get(row_number, {}).items()
        ):
            if not value:
                continue
            cell_ref = f"{xlsx._column_name(column)}{row_number}"
            records.append(
                _unmapped_record(
                    f"um-visual-guidance-{cell_ref.lower()}",
                    "그림 활용 안내",
                    cell_ref,
                    value,
                    "visual_global_guidance",
                    "특정 PartGuide 필드 하나로 확정하지 않은 안내·권리 문구",
                    "PartGuide 또는 VisualAsset",
                )
            )

    # Preserve only the existence/statistics of excluded personal columns.
    personal_statistics = {
        "연습 상태": "253행 모두 미연습",
        "최근 연습일": "253행 모두 빈 값",
        "내 답변 메모": "253행 모두 빈 값",
    }
    for index, column_name in enumerate(PERSONAL_COLUMNS, start=12):
        column_letter = xlsx._column_name(index)
        records.append(
            _unmapped_record(
                f"um-personal-column-{index}",
                "문제은행",
                f"{column_letter}1:{column_letter}254",
                f"{column_name}: {personal_statistics[column_name]}",
                "excluded_personal_column_metadata",
                "공용 Question import에서 개인 학습 컬럼을 제외함",
                "ReviewState 또는 UserAnswer",
            )
        )

    # Part 7 prompt/help text is retained without creating a Question link.
    part7_rows = rows["Part7 스토리 그림"]
    for source_set in workbook["p7_sets"]:
        figure_id = str(source_set["figure_id"])
        start = int(source_set["start_row"])
        end = int(source_set["end_row"])
        for row_number in range(start + 1, end + 1):
            value = _cell(part7_rows, row_number, 1)
            if not value:
                continue
            records.append(
                _unmapped_record(
                    f"um-{figure_id.lower()}-a{row_number}",
                    "Part7 스토리 그림",
                    f"A{row_number}",
                    value,
                    "visual_prompt_or_instruction",
                    (
                        "공통 지시문 또는 안내만으로 canonical Question과 "
                        "VisualSet을 연결할 수 없음"
                    ),
                    "QuestionVisualSet 또는 PartGuide",
                )
            )

    for row_number in (1, 40):
        value = _cell(rows["공식 샘플 이미지"], row_number, 1)
        records.append(
            _unmapped_record(
                f"um-official-sample-a{row_number}",
                "공식 샘플 이미지",
                f"A{row_number}",
                value,
                "official_sample_context",
                "표시 문구와 URL이 공개 권리나 Question 연결을 확정하지 않음",
                "SourceReference 또는 VisualSet",
            )
        )
    records.sort(key=lambda item: item["unmapped_id"])
    return records


def _review_item(
    item_id: str,
    target_type: str,
    target_ids: list[str],
    issue_type: str,
    priority: str,
    reason: str,
    source_locator: str,
    notes: str,
) -> dict[str, Any]:
    return {
        "review_item_id": item_id,
        "target_type": target_type,
        "target_ids": target_ids,
        "issue_type": issue_type,
        "priority": priority,
        "reason": reason,
        "source_locator": source_locator,
        "review_status": "review_needed",
        "notes": notes,
    }


def _build_review_queue(
    questions: Sequence[dict[str, Any]],
    visual_questions: Sequence[dict[str, Any]],
    question_visual_sets: Sequence[dict[str, Any]],
    model_answers: Sequence[dict[str, Any]],
    visual_assets: Sequence[dict[str, Any]],
    workbook_candidates: Sequence[dict[str, Any]],
    usage_candidates: Sequence[dict[str, Any]],
    source_references: Sequence[dict[str, str]],
) -> list[dict[str, Any]]:
    unlinked = [
        item["visual_question_id"]
        for item in visual_questions
        if not item["question_id"]
    ]
    missing_answer_language = [
        item["answer_id"]
        for item in model_answers
        if not item["answer_zh"]
        or not item["answer_pinyin"]
        or not item["answer_ko"]
    ]
    claimed_url_reference_ids = [
        item["source_reference_id"]
        for item in source_references
        if item["claimed_source_url"]
    ]
    queue = [
        _review_item(
            "rq-question-language-and-source-review",
            "question",
            [item["question_id"] for item in questions],
            "language_and_source_verification",
            "important",
            "253개 raw 질문의 중국어·병음·한국어·유형·출처를 사람 검수해야 함.",
            "문제은행!A2:N254",
            "자동 정규화나 교정을 수행하지 않았다.",
        ),
        _review_item(
            "rq-part2-unlinked-visual-questions",
            "visual_question",
            unlinked,
            "question_link_missing",
            "important",
            "완전 일치 근거가 없는 Part 2 시각 질문은 canonical 연결을 만들지 않음.",
            "'Part2 그림 연습'!A1:I226",
            "행 순서·ID 접미사·의미 유사성으로 연결하지 않는다.",
        ),
        _review_item(
            "rq-part2-question-visual-set-links",
            "question_visual_set",
            [
                item["question_visual_set_id"]
                for item in question_visual_sets
            ],
            "strict_link_review",
            "important",
            "엄격 문자열 근거로 만든 Part 2 working 연결도 reviewed 승격 전 사람 확인이 필요함.",
            "'Part2 그림 연습'과 문제은행의 연결된 원본 행",
            "mapping_status는 review_needed이며 앱 관계로 아직 사용하지 않는다.",
        ),
        _review_item(
            "rq-part7-suffix-link-candidates",
            "workbook_link_candidate",
            [item["candidate_id"] for item in workbook_candidates],
            "part7_suffix_link_review",
            "important",
            "Part 7 숫자 접미사 대응은 명시적 외래키가 아니므로 사람 확인 필요.",
            "'Part7 스토리 그림'!A1:A214; 문제은행!A243:N254",
            "승인 전 QuestionVisualSet은 0개다.",
        ),
        _review_item(
            "rq-workbook-course-part-guide-scope",
            "part_guide",
            [f"part-guide-workbook-{part:02d}" for part in range(1, 8)],
            "cross_source_part_guide_review",
            "important",
            "workbook 가이드와 course-import 가이드는 출처·목표 맥락이 달라 자동 병합하지 않음.",
            "'요약'!A2:C8",
            "충돌·보완 관계를 Part별로 사람 검수한다.",
        ),
        _review_item(
            "rq-visual-asset-rights",
            "visual_asset",
            [item["visual_asset_id"] for item in visual_assets],
            "rights_review",
            "blocking",
            "이미지를 공개 reviewed/runtime 자산으로 승격하기 전에 권리 확인이 필요함.",
            "workbook drawing relationships",
            "모든 rights_status는 review_needed다.",
        ),
        _review_item(
            "rq-source-url-verification",
            "source_reference",
            claimed_url_reference_ids,
            "claimed_url_verification",
            "later",
            "workbook 내부 URL은 접근·진위·권리를 검증하지 않은 주장임.",
            "문제은행!I2:I254; '공식·참고 링크'!C2:C18",
            "빈 URL은 오류가 아니다.",
        ),
        _review_item(
            "rq-part2-source-model-answer-review",
            "model_answer",
            [item["answer_id"] for item in model_answers],
            "source_answer_review",
            "important",
            "Part 2 원본 추천 답변의 언어·내용·출처를 검수해야 함.",
            "'Part2 정답'!A2:H49",
            "approved 또는 공식 정답으로 표시하지 않는다.",
        ),
        _review_item(
            "rq-course-content-usage-candidates",
            "course_content_usage_candidate",
            [item["candidate_id"] for item in usage_candidates],
            "course_usage_review",
            "later",
            "literal 포함 후보는 canonical 관계가 아니라 화면 사용 추천 검수 큐다.",
            "course-import-v1/learning-expressions.json; pronunciation-items.json",
            "Part나 주제 유사성만으로 후보를 만들지 않았다.",
        ),
    ]
    if missing_answer_language:
        queue.append(
            _review_item(
                "rq-model-answer-language-missing",
                "model_answer",
                missing_answer_language,
                "language_missing",
                "blocking",
                "출처 추천 답변의 중국어·병음·한국어 중 빈 값이 있음.",
                "'Part2 정답'!A2:H49",
                "누락 값을 생성하지 않는다.",
            )
        )
    return queue


def _entity_registry(payloads: Mapping[str, Any]) -> dict[str, set[str]]:
    return {
        "question": {
            item["question_id"] for item in payloads["questions.json"]
        },
        "answer_point": {
            item["answer_point_id"]
            for item in payloads["answer-points.json"]
        },
        "part_guide": {
            item["part_guide_id"] for item in payloads["part-guides.json"]
        },
        "visual_set": {
            item["visual_set_id"] for item in payloads["visual-sets.json"]
        },
        "visual_question": {
            item["visual_question_id"]
            for item in payloads["visual-questions.json"]
        },
        "question_visual_set": {
            item["question_visual_set_id"]
            for item in payloads["question-visual-sets.json"]
        },
        "model_answer": {
            item["answer_id"] for item in payloads["model-answers.json"]
        },
        "story_guide": {
            item["story_guide_id"] for item in payloads["story-guides.json"]
        },
    }


def _validate_payloads(
    payloads: Mapping[str, Any],
    asset_bytes: Mapping[str, bytes],
) -> None:
    _require(
        tuple(payloads) == DATA_FILES,
        "payload 파일 순서·집합이 예상과 다릅니다.",
    )
    questions = payloads["questions.json"]
    answer_points = payloads["answer-points.json"]
    sources = payloads["sources.json"]
    references = payloads["source-references.json"]
    part_guides = payloads["part-guides.json"]
    visual_assets = payloads["visual-assets.json"]
    visual_sets = payloads["visual-sets.json"]
    visual_set_assets = payloads["visual-set-assets.json"]
    visual_questions = payloads["visual-questions.json"]
    question_visual_sets = payloads["question-visual-sets.json"]
    model_answers = payloads["model-answers.json"]
    story_guides = payloads["story-guides.json"]

    _require(
        len(questions) == 253
        and Counter(item["part"] for item in questions)
        == Counter(EXPECTED_PART_COUNTS),
        "Question 수 또는 Part별 수가 잘못됐습니다.",
    )
    question_ids = [item["question_id"] for item in questions]
    _require(
        len(question_ids) == len(set(question_ids)),
        "Question ID가 중복됩니다.",
    )
    for item in questions:
        _require(
            tuple(item) == QUESTION_FIELDS,
            f"Question canonical 필드가 잘못됐습니다: {item.get('question_id')}",
        )
        _require(
            re.fullmatch(rf"P{item['part']}-\d{{3}}", item["question_id"])
            is not None,
            f"Question ID와 Part가 일치하지 않습니다: {item['question_id']}",
        )
        _require(
            item["question_zh"] != "" and item["question_status"] == "raw",
            "필수 질문 원문 또는 working 상태가 잘못됐습니다.",
        )
        _require(
            not set(PERSONAL_COLUMNS) & set(item),
            "공용 Question에 개인 학습 컬럼이 포함됐습니다.",
        )
    part7 = [item for item in questions if item["part"] == 7]
    _require(
        len(part7) == 12
        and len({item["question_zh"] for item in part7}) == 1,
        "Part 7 공통 지시문 12개가 유지되지 않았습니다.",
    )

    _require(len(answer_points) == 253, "AnswerPoint는 253개여야 합니다.")
    _require(
        Counter(item["question_id"] for item in answer_points)
        == Counter({question_id: 1 for question_id in question_ids}),
        "Question당 AnswerPoint가 정확히 하나가 아닙니다.",
    )
    for item in answer_points:
        _require(
            tuple(item) == ANSWER_POINT_FIELDS
            and item["answer_point_id"]
            == f"ap-{item['question_id']}-001"
            and item["point_type"] == "unclassified"
            and item["point_status"] == "raw"
            and item["content"] != "",
            f"AnswerPoint 계약이 잘못됐습니다: {item.get('answer_point_id')}",
        )

    _require(
        len(sources) == 1
        and sources[0]["source_id"] == SOURCE_ID
        and sources[0]["source_status"] == "raw"
        and sources[0]["provenance_status"] == "unverified_source"
        and sources[0]["rights_status"] == "review_needed",
        "동일 workbook Source는 src-001 하나여야 합니다.",
    )
    _require(
        len(part_guides) == 7
        and all(item["guide_status"] == "review_needed" for item in part_guides),
        "workbook PartGuide 수 또는 상태가 잘못됐습니다.",
    )
    _require(
        {item["part"] for item in part_guides} == set(range(1, 8)),
        "workbook PartGuide의 Part 범위가 잘못됐습니다.",
    )
    _require(len(visual_assets) == 25, "VisualAsset은 25개여야 합니다.")
    _require(
        len({item["visual_asset_id"] for item in visual_assets}) == 25
        and all(item["source_id"] == SOURCE_ID for item in visual_assets),
        "VisualAsset ID 또는 Source 참조가 잘못됐습니다.",
    )
    _require(
        all(
            item["rights_status"] == "review_needed"
            and item["asset_status"] == "raw"
            for item in visual_assets
        ),
        "VisualAsset 상태가 working 원칙과 다릅니다.",
    )
    _require(
        {item["sha256"] for item in visual_assets}
        == {_sha256_bytes(value) for value in asset_bytes.values()},
        "VisualAsset 메타데이터와 workbook 이미지 바이트 SHA가 다릅니다.",
    )
    _require(
        len(visual_sets) == 25
        and all(item["set_status"] == "raw" for item in visual_sets)
        and sum(item["part"] == 2 for item in visual_sets) == 12
        and sum(
            item["part"] == 7 and item["set_type"] == "story_image"
            for item in visual_sets
        )
        == 12
        and sum(item["set_type"] == "official_sample" for item in visual_sets)
        == 1,
        "VisualSet 25개 구조가 잘못됐습니다.",
    )
    _require(
        len(visual_set_assets) == 25,
        "VisualSetAsset은 25개여야 합니다.",
    )
    _require(
        len(visual_questions) == 48
        and all(
            item["visual_question_status"] == "raw"
            for item in visual_questions
        )
        and sum(bool(item["question_id"]) for item in visual_questions) == 18,
        "Part 2 VisualQuestion 수 또는 엄격 연결 수가 잘못됐습니다.",
    )
    _require(
        len(question_visual_sets) == 18
        and not any(
            item["visual_set_id"].startswith("vs-P7-")
            for item in question_visual_sets
        ),
        "QuestionVisualSet은 Part 2 엄격 연결 18개만 있어야 합니다.",
    )
    _require(
        len(model_answers) == 48
        and all(
            item["answer_target_type"] == "visual_question"
            and item["answer_status"] == "review_needed"
            and item["provenance_kind"] == "unverified_source"
            for item in model_answers
        ),
        "Part 2 ModelAnswer 계약이 잘못됐습니다.",
    )
    _require(
        len(story_guides) == 12
        and all(
            item["guide_status"] == "raw" and item["question_id"] == ""
            for item in story_guides
        ),
        "Part 7 StoryGuide 계약이 잘못됐습니다.",
    )
    _require(
        len(payloads["workbook-link-candidates.json"]) == 12,
        "Part 7 접미사 후보는 12개여야 합니다.",
    )
    _require(
        payloads["course-question-link-candidates.json"] == [],
        "근거 없는 course Question 연결 후보가 생성됐습니다.",
    )
    _require(
        len(payloads["course-content-usage-candidates.json"]) == 4,
        "엄격한 course content 사용 후보 수가 예상과 다릅니다.",
    )

    registry = _entity_registry(payloads)
    source_ids = {item["source_id"] for item in sources}
    reference_ids: set[str] = set()
    for reference in references:
        _require(
            tuple(reference) == SOURCE_REFERENCE_FIELDS,
            "SourceReference 필드 집합이 canonical 계약과 다릅니다.",
        )
        reference_id = reference["source_reference_id"]
        _require(
            reference_id not in reference_ids,
            f"SourceReference ID가 중복됩니다: {reference_id}",
        )
        reference_ids.add(reference_id)
        _require(
            reference["source_id"] in source_ids,
            f"SourceReference Source가 없습니다: {reference_id}",
        )
        _require(
            reference["target_type"] in registry
            and reference["target_id"]
            in registry[reference["target_type"]],
            f"SourceReference 대상이 없습니다: {reference_id}",
        )
        _require(
            reference["relationship_kind"]
            in {
                "extracted_from",
                "claimed_origin",
                "derived_from",
                "supports",
                "self_created",
            },
            f"SourceReference 관계 enum이 잘못됐습니다: {reference_id}",
        )
        _require(
            reference["verification_status"]
            in {"unverified", "review_needed"},
            f"SourceReference 검수 상태가 잘못됐습니다: {reference_id}",
        )

    for filename, id_field in (
        ("answer-points.json", "answer_point_id"),
        ("part-guides.json", "part_guide_id"),
        ("visual-sets.json", "visual_set_id"),
        ("visual-questions.json", "visual_question_id"),
        ("question-visual-sets.json", "question_visual_set_id"),
        ("model-answers.json", "answer_id"),
        ("story-guides.json", "story_guide_id"),
    ):
        for item in payloads[filename]:
            for reference_id in item.get("source_reference_ids", []):
                _require(
                    reference_id in reference_ids,
                    f"{filename}의 SourceReference가 없습니다: {reference_id}",
                )
            _require(
                len(
                    [
                        record
                        for record in payloads[filename]
                        if record[id_field] == item[id_field]
                    ]
                )
                == 1,
                f"{filename} ID가 중복됩니다: {item[id_field]}",
            )

    visual_asset_ids = {
        item["visual_asset_id"] for item in visual_assets
    }
    visual_set_ids = {item["visual_set_id"] for item in visual_sets}
    _require(
        len(visual_set_ids) == len(visual_sets),
        "VisualSet ID가 중복됩니다.",
    )
    visual_set_asset_ids: set[str] = set()
    for relation in visual_set_assets:
        _require(
            relation["visual_set_asset_id"] not in visual_set_asset_ids,
            f"VisualSetAsset ID가 중복됩니다: {relation['visual_set_asset_id']}",
        )
        visual_set_asset_ids.add(relation["visual_set_asset_id"])
        _require(
            relation["visual_asset_id"] in visual_asset_ids
            and relation["visual_set_id"] in visual_set_ids
            and relation["mapping_status"] == "review_needed",
            "VisualSetAsset 참조 또는 상태가 잘못됐습니다.",
        )
    visual_question_ids = {
        item["visual_question_id"] for item in visual_questions
    }
    _require(
        len(visual_question_ids) == len(visual_questions),
        "VisualQuestion ID가 중복됩니다.",
    )
    for visual_question in visual_questions:
        _require(
            visual_question["visual_set_id"] in visual_set_ids
            and (
                not visual_question["question_id"]
                or visual_question["question_id"] in question_ids
            ),
            "VisualQuestion의 VisualSet 또는 Question 참조가 잘못됐습니다.",
        )
    question_visual_set_ids: set[str] = set()
    question_visual_set_pairs: set[tuple[str, str]] = set()
    for relation in question_visual_sets:
        relation_id = relation["question_visual_set_id"]
        pair = (relation["question_id"], relation["visual_set_id"])
        _require(
            relation_id not in question_visual_set_ids
            and pair not in question_visual_set_pairs
            and relation["question_id"] in question_ids
            and relation["visual_set_id"] in visual_set_ids
            and relation["mapping_status"] == "review_needed",
            f"QuestionVisualSet 참조 또는 ID가 잘못됐습니다: {relation_id}",
        )
        question_visual_set_ids.add(relation_id)
        question_visual_set_pairs.add(pair)
    answer_ids: set[str] = set()
    for answer in model_answers:
        _require(
            answer["answer_id"] not in answer_ids
            and answer["answer_target_id"] in visual_question_ids,
            f"ModelAnswer 대상 VisualQuestion이 없습니다: {answer['answer_id']}",
        )
        _require(
            answer["answer_status"] == "review_needed"
            and answer["provenance_kind"] == "unverified_source",
            f"ModelAnswer working 상태가 잘못됐습니다: {answer['answer_id']}",
        )
        answer_ids.add(answer["answer_id"])
    story_guide_ids: set[str] = set()
    for guide in story_guides:
        _require(
            guide["story_guide_id"] not in story_guide_ids
            and guide["visual_set_id"] in visual_set_ids
            and (not guide["question_id"] or guide["question_id"] in question_ids),
            f"StoryGuide 참조 또는 ID가 잘못됐습니다: {guide['story_guide_id']}",
        )
        story_guide_ids.add(guide["story_guide_id"])

    course_usage_ids: set[str] = set()
    course_content_registry = {
        "learning_expression": {
            item["expression_id"]
            for item in _load_json(
                COURSE_IMPORT_DIR / "learning-expressions.json"
            )
        },
        "pronunciation_item": {
            item["pronunciation_item_id"]
            for item in _load_json(
                COURSE_IMPORT_DIR / "pronunciation-items.json"
            )
        },
    }
    for candidate in payloads["course-content-usage-candidates.json"]:
        _require(
            candidate["candidate_id"] not in course_usage_ids
            and candidate["candidate_question_id"] in question_ids
            and candidate["course_content_type"]
            in course_content_registry
            and candidate["course_content_id"]
            in course_content_registry[candidate["course_content_type"]],
            f"course 사용 후보 참조가 잘못됐습니다: {candidate['candidate_id']}",
        )
        course_usage_ids.add(candidate["candidate_id"])

    workbook_candidate_ids: set[str] = set()
    for index, candidate in enumerate(
        payloads["workbook-link-candidates.json"],
        start=1,
    ):
        _require(
            candidate["candidate_id"] not in workbook_candidate_ids
            and candidate["source_entity_id"]
            == f"vs-P7-V{index:02d}"
            and candidate["candidate_question_id"] == f"P7-{index:03d}"
            and candidate["match_basis"] == "numeric_suffix_only"
            and candidate["matched_fields"] == ["numeric_suffix"]
            and candidate["confidence"] == "low"
            and candidate["review_status"] == "review_needed"
            and candidate["source_entity_id"] in visual_set_ids
            and candidate["candidate_question_id"] in question_ids,
            f"workbook 연결 후보 참조가 잘못됐습니다: {candidate['candidate_id']}",
        )
        workbook_candidate_ids.add(candidate["candidate_id"])

    _require(
        all(
            item["review_status"] == "review_needed"
            for item in payloads["unmapped-content.json"]
        ),
        "unmapped content가 review_needed가 아닙니다.",
    )
    _require(
        all(
            item["priority"] in {"blocking", "important", "later"}
            for item in payloads["review-queue.json"]
        ),
        "review queue priority enum이 잘못됐습니다.",
    )
    review_target_registry = {
        "question": set(question_ids),
        "visual_question": visual_question_ids,
        "question_visual_set": question_visual_set_ids,
        "workbook_link_candidate": workbook_candidate_ids,
        "part_guide": {
            item["part_guide_id"] for item in part_guides
        },
        "visual_asset": visual_asset_ids,
        "source_reference": reference_ids,
        "model_answer": answer_ids,
        "course_content_usage_candidate": course_usage_ids,
    }
    for review_item in payloads["review-queue.json"]:
        _require(
            review_item["review_status"] == "review_needed"
            and review_item["target_type"] in review_target_registry
            and set(review_item["target_ids"]).issubset(
                review_target_registry[review_item["target_type"]]
            ),
            f"review queue 대상 참조가 잘못됐습니다: {review_item['review_item_id']}",
        )


def _assemble_payloads() -> tuple[
    dict[str, Any], dict[str, bytes], dict[str, Any]
]:
    course_manifest = _validate_course_import()
    course_manifest_sha = _sha256_file(COURSE_MANIFEST_PATH)
    workbook = _read_workbook()
    references: list[dict[str, str]] = []

    sources = _build_sources(workbook["workbook_sha256"])
    questions, answer_points = _build_questions_and_answer_points(
        workbook["question_rows"], references
    )
    part_guides = _build_part_guides(workbook["rows"], references)
    (
        visual_assets,
        visual_sets,
        visual_set_assets,
        asset_bytes,
    ) = _build_visual_core(workbook, references)
    (
        visual_questions,
        question_visual_sets,
        visual_questions_by_key,
    ) = _build_visual_questions_and_links(
        workbook, questions, references
    )
    model_answers = _build_model_answers(
        workbook, visual_questions_by_key, references
    )
    story_guides, workbook_candidates = (
        _build_story_guides_and_workbook_candidates(workbook, references)
    )
    course_question_candidates, usage_candidates = (
        _build_course_candidates(questions)
    )
    unmapped = _build_unmapped_content(workbook)
    review_queue = _build_review_queue(
        questions,
        visual_questions,
        question_visual_sets,
        model_answers,
        visual_assets,
        workbook_candidates,
        usage_candidates,
        references,
    )

    references.sort(key=lambda item: item["source_reference_id"])
    payloads: dict[str, Any] = {
        "sources.json": sources,
        "source-references.json": references,
        "questions.json": questions,
        "answer-points.json": answer_points,
        "part-guides.json": part_guides,
        "visual-assets.json": visual_assets,
        "visual-sets.json": visual_sets,
        "visual-set-assets.json": visual_set_assets,
        "visual-questions.json": visual_questions,
        "question-visual-sets.json": question_visual_sets,
        "model-answers.json": model_answers,
        "story-guides.json": story_guides,
        "course-question-link-candidates.json": course_question_candidates,
        "course-content-usage-candidates.json": usage_candidates,
        "workbook-link-candidates.json": workbook_candidates,
        "unmapped-content.json": unmapped,
        "review-queue.json": review_queue,
    }
    _validate_payloads(payloads, asset_bytes)
    metadata = {
        "workbook_sha256": workbook["workbook_sha256"],
        "course_manifest_sha256": course_manifest_sha,
        "course_manifest": course_manifest,
    }
    return payloads, asset_bytes, metadata


README_TEXT = """# Full workbook working import v1

이 디렉터리는 `data/raw/TSC_파트별_문제은행_그림포함.xlsx` 전체 구조를 스키마 v1.1 형태로 보존한 검수 전 working 데이터다.

- reviewed 또는 production 데이터가 아니다.
- 원본 Excel, 기존 sample CSV, Part 4 fixture와 course-import-v1을 수정하지 않는다.
- Question 253개와 AnswerPoint 253개를 원문 그대로 분리한다.
- Part 2 원본 추천 답변은 `review_needed` 출처 답변이며 승인된 공식 정답이 아니다.
- Part 7 StoryGuide는 ModelAnswer가 아니다.
- Part 2의 엄격한 언어 일치 관계만 working 연결로 만들고, Part 7 접미사 대응은 후보로만 둔다.
- workbook 내부 출처 이름·URL은 검증된 Source가 아니라 `SourceReference`의 주장이다.
- 이미지 권리는 모두 `review_needed`다.
- 이 데이터셋은 현재 Part 4 앱 런타임에 연결되지 않는다.

## 실행

```sh
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py --validate-only
python3 scripts/build_full_workbook_import.py --extract-assets
```

`--extract-assets`는 원본 이미지 바이트 25개를 `data/working/generated-assets/full-import-v1/`에 미가공 상태로 생성한다. 이 경로는 Git에서 제외되며 공개 배포 자산이 아니다. `--output-dir`을 사용한 테스트 추출은 출력 디렉터리와 같은 부모의 `<name>-generated-assets/`에 검증용 미러를 만든다. JSON의 `repository_path`는 머신별 임시 경로를 기록하지 않고 canonical 저장소 생성 경로를 유지하며, 테스트 미러의 참조 무결성은 파일명과 SHA-256으로 확인한다.

## 파일 역할

- `questions.json`, `answer-points.json`: 전체 공용 문제와 원본 답변 포인트
- `sources.json`, `source-references.json`: 실제 workbook과 workbook 내부 출처 주장
- `part-guides.json`: workbook 시트에 직접 대응하는 source-specific 가이드
- `visual-*.json`, `question-visual-sets.json`: 이미지, 세트, Part 2 하위 질문과 엄격 연결
- `model-answers.json`: Part 2 시각 질문 대상 원본 추천 답변
- `story-guides.json`: Part 7 이야기 구성 도움
- `*-candidates.json`: 승인 전 연결·화면 사용 검수 후보
- `unmapped-content.json`: canonical 엔터티에 안전하게 넣지 않은 원문
- `review-queue.json`: 다음 사람 검수 항목
- `manifest.json`: 입력·출력 해시, 수와 검증 결과

전체 문제를 앱에서 사용하거나 reviewed로 승격하려면 언어·출처·시각 연결·권리와 후보 관계를 사람이 검수해야 한다.
"""


def _counts(payloads: Mapping[str, Any]) -> dict[str, int]:
    return {
        "sources": len(payloads["sources.json"]),
        "source_references": len(payloads["source-references.json"]),
        "questions": len(payloads["questions.json"]),
        "answer_points": len(payloads["answer-points.json"]),
        "part_guides": len(payloads["part-guides.json"]),
        "visual_assets": len(payloads["visual-assets.json"]),
        "visual_sets": len(payloads["visual-sets.json"]),
        "visual_set_assets": len(payloads["visual-set-assets.json"]),
        "visual_questions": len(payloads["visual-questions.json"]),
        "question_visual_sets": len(payloads["question-visual-sets.json"]),
        "model_answers": len(payloads["model-answers.json"]),
        "story_guides": len(payloads["story-guides.json"]),
        "course_question_link_candidates": len(
            payloads["course-question-link-candidates.json"]
        ),
        "course_content_usage_candidates": len(
            payloads["course-content-usage-candidates.json"]
        ),
        "workbook_link_candidates": len(
            payloads["workbook-link-candidates.json"]
        ),
        "unmapped_content": len(payloads["unmapped-content.json"]),
        "review_queue": len(payloads["review-queue.json"]),
    }


def _build_bundle() -> tuple[
    dict[str, bytes], dict[str, bytes], dict[str, Any]
]:
    payloads, asset_bytes, metadata = _assemble_payloads()
    bundle = {
        filename: _json_bytes(payloads[filename]) for filename in DATA_FILES
    }
    bundle["README.md"] = README_TEXT.encode("utf-8")
    generated_files = {
        filename: _sha256_bytes(bundle[filename])
        for filename in HASHED_FILES
    }
    linked = sum(
        bool(item["question_id"])
        for item in payloads["visual-questions.json"]
    )
    asset_sha_counts = Counter(
        item["sha256"] for item in payloads["visual-assets.json"]
    )
    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_status": "working",
        "schema_version": SCHEMA_VERSION,
        "workbook": {
            "path": WORKBOOK_RELATIVE_PATH.as_posix(),
            "sha256": metadata["workbook_sha256"],
            "size": EXPECTED_WORKBOOK_SIZE,
        },
        "script_sha256": _sha256_file(Path(__file__).resolve()),
        "sheets": list(EXPECTED_SHEETS),
        "course_import_manifest": {
            "path": (
                COURSE_IMPORT_RELATIVE_DIR / "manifest.json"
            ).as_posix(),
            "sha256": metadata["course_manifest_sha256"],
        },
        "generated_files": generated_files,
        "manifest_hash_policy": (
            "manifest.json은 자기참조 해시를 만들 수 없어 generated_files에서 "
            "제외하며 외부 검증에서 별도로 SHA-256을 계산한다."
        ),
        "counts": _counts(payloads),
        "part_question_counts": {
            str(part): count for part, count in EXPECTED_PART_COUNTS.items()
        },
        "visual_question_links": {
            "linked": linked,
            "unlinked": len(payloads["visual-questions.json"]) - linked,
        },
        "rights_review_needed_assets": sum(
            item["rights_status"] == "review_needed"
            for item in payloads["visual-assets.json"]
        ),
        "duplicate_visual_asset_sha_groups": sum(
            count > 1 for count in asset_sha_counts.values()
        ),
        "excluded_personal_columns": list(PERSONAL_COLUMNS),
        "validation": {
            "status": "passed",
            "checks": [
                "workbook_sha256_and_size",
                "sheet_structure",
                "entity_counts",
                "canonical_id_uniqueness",
                "source_reference_integrity",
                "visual_reference_integrity",
                "strict_question_links",
                "image_media_sha256",
                "working_status_boundaries",
                "personal_columns_excluded",
            ],
        },
    }
    bundle["manifest.json"] = _json_bytes(manifest)
    _require(
        tuple(bundle) == OUTPUT_FILES,
        "최종 bundle 파일 순서·집합이 잘못됐습니다.",
    )
    return bundle, asset_bytes, manifest


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _safe_output_dir(path: Path) -> Path:
    unresolved = path if path.is_absolute() else ROOT / path
    _require(
        not unresolved.is_symlink(),
        f"출력 디렉터리 자체를 symlink로 사용할 수 없습니다: {unresolved}",
    )
    resolved = unresolved.resolve(strict=False)
    _require(
        resolved not in {Path("/"), ROOT.resolve()},
        "filesystem 또는 저장소 root를 출력으로 사용할 수 없습니다.",
    )
    repository_root = ROOT.resolve()
    working_root = (ROOT / "data/working").resolve()
    if repository_root in resolved.parents:
        _require(
            working_root in resolved.parents,
            "저장소 내부 출력은 data/working 아래에서만 허용합니다.",
        )
    protected = [
        WORKBOOK_PATH.resolve(),
        COURSE_IMPORT_DIR.resolve(),
        (ROOT / "data/working/question-sample").resolve(),
        (ROOT / "data/working/app-fixtures/part4").resolve(),
        (ROOT / "data/working/extended-sample").resolve(),
        (ROOT / "other-output").resolve(),
    ]
    for protected_path in protected:
        _require(
            resolved != protected_path
            and protected_path not in resolved.parents
            and resolved not in protected_path.parents,
            f"보호 입력과 겹치는 출력 경로입니다: {resolved}",
        )
    return resolved


def _validate_bytes_directory(
    directory: Path,
    expected: Mapping[str, bytes],
) -> None:
    _require(
        directory.is_dir() and not directory.is_symlink(),
        f"출력이 일반 디렉터리가 아닙니다: {directory}",
    )
    actual_names = {
        item.name for item in directory.iterdir() if item.is_file()
    }
    _require(
        actual_names == set(expected)
        and all(item.is_file() and not item.is_symlink() for item in directory.iterdir()),
        f"출력 파일 집합이 예상과 다릅니다: {directory}",
    )
    for filename, value in expected.items():
        path = directory / filename
        _require(
            path.read_bytes() == value,
            f"출력 바이트가 예상과 다릅니다: {path}",
        )


def _assert_owned_dataset(output_dir: Path) -> None:
    _require(
        output_dir.is_dir() and not output_dir.is_symlink(),
        f"기존 출력이 일반 디렉터리가 아닙니다: {output_dir}",
    )
    names = {item.name for item in output_dir.iterdir()}
    _require(
        names == set(OUTPUT_FILES),
        "기존 출력에 예상 밖 파일이 있어 교체하지 않습니다.",
    )
    manifest = _load_json(output_dir / "manifest.json")
    _require(
        manifest.get("dataset_id") == DATASET_ID
        and manifest.get("dataset_status") == "working",
        "기존 출력이 이 builder 소유 데이터셋이 아닙니다.",
    )
    generated = manifest.get("generated_files")
    _require(
        isinstance(generated, dict)
        and set(generated) == set(HASHED_FILES),
        "기존 manifest generated_files가 잘못됐습니다.",
    )
    for filename, expected_hash in generated.items():
        _require(
            _sha256_file(output_dir / filename) == expected_hash,
            f"기존 출력 파일이 manifest와 다릅니다: {filename}",
        )


def _write_stage(parent: Path, prefix: str, values: Mapping[str, bytes]) -> Path:
    parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=prefix, dir=parent))
    try:
        for filename, value in values.items():
            path = stage / filename
            with path.open("wb") as handle:
                handle.write(value)
                handle.flush()
                os.fsync(handle.fileno())
        _fsync_directory(stage)
        _validate_bytes_directory(stage, values)
        return stage
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def _empty_sibling_path(target: Path, suffix: str) -> Path:
    path = Path(
        tempfile.mkdtemp(
            prefix=f".{target.name}.{suffix}-",
            dir=target.parent,
        )
    )
    path.rmdir()
    return path


def _move_failed_publication_aside(target: Path) -> Path | None:
    if not target.exists() and not target.is_symlink():
        return None
    failed = _empty_sibling_path(target, "failed")
    os.replace(target, failed)
    return failed


def _publish_directories(
    replacements: Sequence[tuple[Path, Path, Any | None]],
) -> None:
    """Publish one or more staged directories as a single rollback unit."""

    prepared: list[dict[str, Any]] = []
    try:
        for stage, target, assert_owned in replacements:
            _require(
                stage.is_dir() and not stage.is_symlink(),
                f"게시 stage가 일반 디렉터리가 아닙니다: {stage}",
            )
            target.parent.mkdir(parents=True, exist_ok=True)
            backup: Path | None = None
            if target.exists() or target.is_symlink():
                if assert_owned is not None:
                    assert_owned(target)
                else:
                    _require(
                        target.is_dir() and not target.is_symlink(),
                        f"기존 출력이 일반 디렉터리가 아닙니다: {target}",
                    )
                backup = _empty_sibling_path(target, "backup")
                os.replace(target, backup)
            prepared.append(
                {
                    "stage": stage,
                    "target": target,
                    "backup": backup,
                    "published": False,
                }
            )

        for item in prepared:
            os.replace(item["stage"], item["target"])
            item["published"] = True
        for parent in sorted(
            {item["target"].parent for item in prepared},
            key=lambda path: path.as_posix(),
        ):
            _fsync_directory(parent)
    except Exception:
        failed_outputs: list[Path] = []
        for item in reversed(prepared):
            target = item["target"]
            backup = item["backup"]
            if item["published"]:
                failed = _move_failed_publication_aside(target)
                if failed is not None:
                    failed_outputs.append(failed)
            if backup is not None and backup.exists():
                os.replace(backup, target)
        for failed in failed_outputs:
            shutil.rmtree(failed, ignore_errors=True)
        for parent in {
            item["target"].parent for item in prepared
        }:
            try:
                _fsync_directory(parent)
            except OSError:
                pass
        raise

    for item in prepared:
        backup = item["backup"]
        if backup is not None:
            shutil.rmtree(backup, ignore_errors=True)
    for parent in {
        item["target"].parent for item in prepared
    }:
        try:
            _fsync_directory(parent)
        except OSError:
            # The replacement itself was already durably fsynced above.
            pass


def _asset_output_dir(output_dir: Path) -> Path:
    if output_dir.resolve(strict=False) == DEFAULT_OUTPUT_DIR.resolve(strict=False):
        return DEFAULT_ASSET_DIR
    return output_dir.parent / f"{output_dir.name}-generated-assets"


def _asset_file_map(
    asset_bytes: Mapping[str, bytes],
) -> dict[str, bytes]:
    return {filename: asset_bytes[filename] for filename in sorted(asset_bytes)}


def build_import(
    output_dir: Path | None = None,
    extract_assets: bool = False,
) -> dict[str, Any]:
    actual_output = _safe_output_dir(
        DEFAULT_OUTPUT_DIR if output_dir is None else Path(output_dir)
    )
    workbook_before = _sha256_file(WORKBOOK_PATH)
    course_before = _sha256_file(COURSE_MANIFEST_PATH)
    bundle, asset_bytes, manifest = _build_bundle()
    _require(
        _sha256_file(WORKBOOK_PATH) == workbook_before,
        "출력 작성 전 workbook SHA-256이 변경됐습니다.",
    )
    _require(
        _sha256_file(COURSE_MANIFEST_PATH) == course_before,
        "출력 작성 전 course manifest SHA-256이 변경됐습니다.",
    )

    stage = _write_stage(
        actual_output.parent,
        f".{actual_output.name}.build-",
        bundle,
    )
    asset_stage: Path | None = None
    actual_asset_output: Path | None = None
    try:
        replacements: list[tuple[Path, Path, Any | None]] = [
            (stage, actual_output, _assert_owned_dataset)
        ]
        if extract_assets:
            actual_asset_output = _safe_output_dir(
                _asset_output_dir(actual_output)
            )
            asset_values = _asset_file_map(asset_bytes)
            asset_stage = _write_stage(
                actual_asset_output.parent,
                f".{actual_asset_output.name}.build-",
                asset_values,
            )
            if actual_asset_output.exists():
                _validate_bytes_directory(actual_asset_output, asset_values)
            replacements.append(
                (
                    asset_stage,
                    actual_asset_output,
                    lambda path: _validate_bytes_directory(
                        path, asset_values
                    ),
                )
            )

        _require(
            _sha256_file(WORKBOOK_PATH) == workbook_before
            and _sha256_file(COURSE_MANIFEST_PATH) == course_before,
            "원자 교체 직전 보호 입력이 변경됐습니다.",
        )
        _publish_directories(replacements)
        stage = None  # type: ignore[assignment]
        asset_stage = None
        _validate_bytes_directory(actual_output, bundle)
        if extract_assets and actual_asset_output is not None:
            _validate_bytes_directory(
                actual_asset_output,
                _asset_file_map(asset_bytes),
            )
    finally:
        if isinstance(stage, Path):
            shutil.rmtree(stage, ignore_errors=True)
        if asset_stage is not None:
            shutil.rmtree(asset_stage, ignore_errors=True)

    _require(
        _sha256_file(WORKBOOK_PATH) == workbook_before
        and _sha256_file(COURSE_MANIFEST_PATH) == course_before,
        "빌드 후 보호 입력 SHA-256이 변경됐습니다.",
    )
    return manifest


def validate_import(output_dir: Path | None = None) -> dict[str, Any]:
    actual_output = _safe_output_dir(
        DEFAULT_OUTPUT_DIR if output_dir is None else Path(output_dir)
    )
    _require(actual_output.exists(), f"검증할 출력이 없습니다: {actual_output}")
    bundle, _, manifest = _build_bundle()
    _validate_bytes_directory(actual_output, bundle)
    return manifest


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build or validate full workbook working import v1."
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="기존 결과를 읽고 재계산 결과와 검증만 합니다.",
    )
    parser.add_argument(
        "--extract-assets",
        action="store_true",
        help="workbook 이미지 원본 바이트 25개를 별도 로컬 경로에 생성합니다.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="working JSON 출력 디렉터리",
    )
    args = parser.parse_args(argv)
    if args.validate_only and args.extract_assets:
        parser.error("--validate-only와 --extract-assets는 함께 사용할 수 없습니다.")
    return args


def _print_summary(
    manifest: Mapping[str, Any],
    output_dir: Path,
    action: str,
) -> None:
    counts = manifest["counts"]
    links = manifest["visual_question_links"]
    print(
        f"{action} full workbook import at {output_dir} "
        f"(questions={counts['questions']}, "
        f"answer_points={counts['answer_points']}, "
        f"visual_questions={counts['visual_questions']}, "
        f"linked={links['linked']}, unlinked={links['unlinked']}, "
        f"model_answers={counts['model_answers']}, "
        f"story_guides={counts['story_guides']}, "
        f"visual_assets={counts['visual_assets']})"
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        if args.validate_only:
            manifest = validate_import(args.output_dir)
            action = "Validated"
        else:
            manifest = build_import(
                args.output_dir,
                extract_assets=args.extract_assets,
            )
            action = "Built"
        _print_summary(manifest, args.output_dir, action)
        if args.extract_assets:
            print(f"Extracted assets at {_asset_output_dir(args.output_dir)}")
        return 0
    except (FullImportError, OSError) as error:
        print(f"full workbook import failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

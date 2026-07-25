#!/usr/bin/env python3
"""원본 TSC workbook에서 확장 표본을 추출한다."""

from __future__ import annotations

from collections import Counter
import csv
import hashlib
import os
from pathlib import Path
import posixpath
import re
import shutil
import sys
import tempfile
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile


ROOT_DIR = Path(__file__).resolve().parents[1]
SOURCE_RELATIVE_PATH = Path(
    "data/raw/TSC_파트별_문제은행_그림포함.xlsx"
)
SOURCE_PATH = ROOT_DIR / SOURCE_RELATIVE_PATH
OUTPUT_RELATIVE_DIR = Path("data/working/extended-sample")
OUTPUT_DIR = ROOT_DIR / OUTPUT_RELATIVE_DIR
EXPECTED_SOURCE_SHA256 = (
    "a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f"
)

PART_QUOTAS = {5: 6, 6: 4, 7: 4}
EXPECTED_PART_COUNTS = {
    1: 4,
    2: 48,
    3: 84,
    4: 50,
    5: 36,
    6: 19,
    7: 12,
}

QUESTION_BANK_SHEET = "문제은행"
PART2_VISUAL_SHEET = "Part2 그림 연습"
PART2_ANSWER_SHEET = "Part2 정답"
PART7_VISUAL_SHEET = "Part7 스토리 그림"
PART7_GUIDE_SHEET = "Part7 정답 포인트"
VISUAL_GUIDANCE_SHEET = "그림 활용 안내"
REQUIRED_SHEETS = {
    QUESTION_BANK_SHEET,
    PART2_VISUAL_SHEET,
    PART2_ANSWER_SHEET,
    PART7_VISUAL_SHEET,
    PART7_GUIDE_SHEET,
    VISUAL_GUIDANCE_SHEET,
}

EXPECTED_EXCEL_HEADERS = [
    "ID",
    "Part",
    "유형",
    "중국어 문제/상황",
    "병음",
    "한국어 뜻/상황",
    "자료 등급",
    "출처",
    "출처 URL",
    "원문성",
    "답변 포인트",
    "연습 상태",
    "최근 연습일",
    "내 답변 메모",
]
PERSONAL_EXCEL_HEADERS = {"연습 상태", "최근 연습일", "내 답변 메모"}

QUESTION_HEADERS = [
    "question_id",
    "source_id",
    "source_locator",
    "part",
    "question_type",
    "question_zh",
    "question_pinyin",
    "question_ko",
    "source_grade",
    "source_name",
    "source_url",
    "originality",
    "answer_point",
    "question_status",
    "normalization_notes",
]
VISUAL_SET_HEADERS = [
    "visual_set_id",
    "original_figure_id",
    "part",
    "set_type",
    "source_id",
    "source_locator",
    "asset_path",
    "asset_media_type",
    "asset_sha256",
    "anchor_row_start",
    "anchor_row_end",
    "rights_status",
    "mapping_status",
    "notes",
]
VISUAL_QUESTION_HEADERS = [
    "visual_question_id",
    "visual_set_id",
    "item_number",
    "linked_question_id",
    "question_zh",
    "question_pinyin",
    "question_ko",
    "source_id",
    "source_locator",
    "mapping_status",
    "notes",
]
VISUAL_MODEL_ANSWER_HEADERS = [
    "answer_id",
    "visual_question_id",
    "linked_question_id",
    "answer_variant",
    "target_level",
    "answer_zh",
    "answer_pinyin",
    "answer_ko",
    "answer_status",
    "provenance_kind",
    "source_id",
    "source_locator",
    "review_notes",
]
STORY_GUIDE_HEADERS = [
    "story_guide_id",
    "visual_set_id",
    "original_figure_id",
    "linked_question_id",
    "situation_ko",
    "recommended_flow",
    "recommended_connectors_zh",
    "material_nature",
    "source_id",
    "source_locator",
    "guide_status",
    "notes",
]

PART2_ANSWER_HEADERS = [
    "그림 ID",
    "문항",
    "중국어 질문",
    "병음",
    "한국어 질문",
    "추천 답변",
    "답변 병음",
    "한국어 뜻",
]
PART7_GUIDE_HEADERS = [
    "그림 ID",
    "한국어 상황",
    "추천 이야기 흐름",
    "권장 중국어 연결어",
    "자료 성격",
]

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOCUMENT_REL_NS = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)
PACKAGE_REL_NS = (
    "http://schemas.openxmlformats.org/package/2006/relationships"
)
DRAWING_NS = (
    "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
)
DRAWING_MAIN_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
CONTENT_TYPE_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

MAIN = f"{{{MAIN_NS}}}"
PACKAGE_RELATIONSHIP = f"{{{PACKAGE_REL_NS}}}Relationship"
RELATIONSHIP_ID = f"{{{DOCUMENT_REL_NS}}}id"
RELATIONSHIP_EMBED = f"{{{DOCUMENT_REL_NS}}}embed"
XDR = f"{{{DRAWING_NS}}}"
DRAWING_MAIN = f"{{{DRAWING_MAIN_NS}}}"
CONTENT_TYPE = f"{{{CONTENT_TYPE_NS}}}"

CELL_REFERENCE_RE = re.compile(r"^([A-Z]+)([1-9][0-9]*)$")
FIGURE_ID_RE = {
    2: re.compile(r"^(P2-V[0-9]{2})(?:\s+\|\s+.*)?$"),
    7: re.compile(r"^(P7-V[0-9]{2})(?:\s+\|\s+.*)?$"),
}
VISUAL_QUESTION_LABEL_RE = re.compile(r"^Q([1-4])$")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class ExtendedSampleExtractionError(RuntimeError):
    """확장 표본 입력 또는 결과 검증 실패."""


def sha256_file(path: Path) -> str:
    """파일의 SHA-256을 계산한다."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _column_index(cell_reference: str) -> int:
    match = CELL_REFERENCE_RE.fullmatch(cell_reference)
    if match is None:
        raise ExtendedSampleExtractionError(
            f"잘못된 Excel 셀 참조입니다: {cell_reference}"
        )
    index = 0
    for character in match.group(1):
        index = index * 26 + ord(character) - ord("A") + 1
    return index


def _column_name(index: int) -> str:
    if index < 1:
        raise ExtendedSampleExtractionError(
            f"잘못된 Excel 열 번호입니다: {index}"
        )
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(ord("A") + remainder) + name
    return name


def _shared_strings(archive: ZipFile) -> List[str]:
    member = "xl/sharedStrings.xml"
    if member not in archive.namelist():
        return []
    root = ET.fromstring(archive.read(member))
    return [
        "".join(text.text or "" for text in item.iter(f"{MAIN}t"))
        for item in root.findall(f"{MAIN}si")
    ]


def _cell_value(cell: ET.Element, shared_strings: Sequence[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_element = cell.find(f"{MAIN}v")

    if cell_type == "s":
        if value_element is None or value_element.text is None:
            raise ExtendedSampleExtractionError(
                f"shared string 인덱스가 없는 셀입니다: "
                f"{cell.attrib.get('r', '')}"
            )
        try:
            return shared_strings[int(value_element.text)]
        except (ValueError, IndexError) as error:
            raise ExtendedSampleExtractionError(
                f"잘못된 shared string 인덱스입니다: "
                f"{cell.attrib.get('r', '')}"
            ) from error

    if cell_type == "inlineStr":
        return "".join(text.text or "" for text in cell.iter(f"{MAIN}t"))

    if value_element is None:
        return ""
    return value_element.text or ""


def _relationship_member(source_member: str) -> str:
    directory = posixpath.dirname(source_member)
    filename = posixpath.basename(source_member)
    return posixpath.join(directory, "_rels", f"{filename}.rels")


def _resolve_archive_target(source_member: str, target: str) -> str:
    if target.startswith("/"):
        normalized = posixpath.normpath(target.lstrip("/"))
    else:
        normalized = posixpath.normpath(
            posixpath.join(posixpath.dirname(source_member), target)
        )
    if (
        normalized.startswith("../")
        or normalized == ".."
        or normalized.startswith("/")
        or not normalized.startswith("xl/")
    ):
        raise ExtendedSampleExtractionError(
            f"XLSX 외부를 가리키는 관계 경로입니다: {target}"
        )
    return normalized


def _relationships(
    archive: ZipFile, source_member: str
) -> Dict[str, Dict[str, str]]:
    relationships_member = _relationship_member(source_member)
    if relationships_member not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(relationships_member))
    relationships: Dict[str, Dict[str, str]] = {}
    for item in root.findall(PACKAGE_RELATIONSHIP):
        relationship_id = item.attrib.get("Id", "")
        if not relationship_id or relationship_id in relationships:
            raise ExtendedSampleExtractionError(
                f"중복되거나 빈 relationship ID입니다: {source_member}"
            )
        relationships[relationship_id] = dict(item.attrib)
    return relationships


def _relationship_target(
    archive: ZipFile,
    source_member: str,
    relationship_id: str,
    expected_type_suffix: str,
) -> str:
    relationship = _relationships(archive, source_member).get(relationship_id)
    if relationship is None:
        raise ExtendedSampleExtractionError(
            f"relationship을 찾을 수 없습니다: "
            f"{source_member} {relationship_id}"
        )
    if relationship.get("TargetMode") == "External":
        raise ExtendedSampleExtractionError(
            f"외부 relationship은 사용할 수 없습니다: {relationship_id}"
        )
    relationship_type = relationship.get("Type", "")
    if not relationship_type.endswith(expected_type_suffix):
        raise ExtendedSampleExtractionError(
            f"relationship 유형이 예상과 다릅니다: {relationship_type}"
        )
    target = relationship.get("Target", "")
    if not target:
        raise ExtendedSampleExtractionError(
            f"relationship 대상이 비어 있습니다: {relationship_id}"
        )
    member = _resolve_archive_target(source_member, target)
    if member not in archive.namelist():
        raise ExtendedSampleExtractionError(
            f"relationship 대상 파일이 없습니다: {member}"
        )
    return member


def _workbook_sheet_members(archive: ZipFile) -> Dict[str, str]:
    workbook_member = "xl/workbook.xml"
    workbook = ET.fromstring(archive.read(workbook_member))
    sheets = workbook.find(f"{MAIN}sheets")
    if sheets is None:
        raise ExtendedSampleExtractionError(
            "Workbook에 시트 목록이 없습니다."
        )

    members: Dict[str, str] = {}
    for sheet in sheets:
        name = sheet.attrib.get("name", "")
        relationship_id = sheet.attrib.get(RELATIONSHIP_ID, "")
        if not name or not relationship_id or name in members:
            raise ExtendedSampleExtractionError(
                "시트 이름 또는 relationship ID가 잘못됐습니다."
            )
        members[name] = _relationship_target(
            archive, workbook_member, relationship_id, "/worksheet"
        )

    missing = sorted(REQUIRED_SHEETS - set(members))
    if missing:
        raise ExtendedSampleExtractionError(
            "필수 시트를 찾을 수 없습니다: " + ", ".join(missing)
        )
    return members


def _read_sheet_rows(
    archive: ZipFile,
    sheet_member: str,
    shared_strings: Sequence[str],
) -> Tuple[ET.Element, Dict[int, Dict[int, str]]]:
    worksheet = ET.fromstring(archive.read(sheet_member))
    sheet_data = worksheet.find(f"{MAIN}sheetData")
    if sheet_data is None:
        raise ExtendedSampleExtractionError(
            f"시트에 행 데이터가 없습니다: {sheet_member}"
        )

    rows: Dict[int, Dict[int, str]] = {}
    for row_element in sheet_data.findall(f"{MAIN}row"):
        row_number_text = row_element.attrib.get("r")
        if not row_number_text:
            raise ExtendedSampleExtractionError(
                f"행 번호가 없는 Excel 행입니다: {sheet_member}"
            )
        row_number = int(row_number_text)
        if row_number in rows:
            raise ExtendedSampleExtractionError(
                f"중복 Excel 행입니다: {sheet_member} {row_number}"
            )
        values: Dict[int, str] = {}
        for cell in row_element.findall(f"{MAIN}c"):
            reference = cell.attrib.get("r", "")
            column = _column_index(reference)
            if column in values:
                raise ExtendedSampleExtractionError(
                    f"중복 셀 참조입니다: {reference}"
                )
            values[column] = _cell_value(cell, shared_strings)
        rows[row_number] = values
    return worksheet, rows


def _read_question_bank(
    rows: Mapping[int, Mapping[int, str]]
) -> List[Dict[str, object]]:
    if 1 not in rows:
        raise ExtendedSampleExtractionError(
            "문제은행 첫 번째 헤더 행이 없습니다."
        )
    headers = [
        rows[1].get(index, "")
        for index in range(1, len(EXPECTED_EXCEL_HEADERS) + 1)
    ]
    extra_headers = [
        value
        for index, value in rows[1].items()
        if index > len(EXPECTED_EXCEL_HEADERS) and value
    ]
    if headers != EXPECTED_EXCEL_HEADERS or extra_headers:
        raise ExtendedSampleExtractionError(
            "문제은행 헤더가 예상한 14개 컬럼과 일치하지 않습니다."
        )

    source_rows: List[Dict[str, object]] = []
    for row_number in sorted(rows):
        if row_number == 1:
            continue
        values = [
            rows[row_number].get(index, "")
            for index in range(1, len(EXPECTED_EXCEL_HEADERS) + 1)
        ]
        if not any(value != "" for value in values):
            continue
        record: Dict[str, object] = dict(zip(headers, values))
        record["__excel_row"] = row_number
        source_rows.append(record)

    if len(source_rows) != 253:
        raise ExtendedSampleExtractionError(
            f"문제은행 데이터는 253행이어야 합니다: "
            f"{len(source_rows)}행"
        )
    if [int(row["__excel_row"]) for row in source_rows] != list(
        range(2, 255)
    ):
        raise ExtendedSampleExtractionError(
            "문제은행 Excel 행 번호가 2~254 연속 범위와 다릅니다."
        )

    try:
        part_counts = Counter(int(str(row["Part"])) for row in source_rows)
    except ValueError as error:
        raise ExtendedSampleExtractionError(
            "문제은행에 정수가 아닌 Part 값이 있습니다."
        ) from error
    if dict(part_counts) != EXPECTED_PART_COUNTS:
        raise ExtendedSampleExtractionError(
            f"문제은행 Part별 수가 예상과 다릅니다: {dict(part_counts)}"
        )

    question_ids = [str(row["ID"]) for row in source_rows]
    if any(not question_id for question_id in question_ids):
        raise ExtendedSampleExtractionError(
            "문제은행에 빈 question_id가 있습니다."
        )
    if len(question_ids) != len(set(question_ids)):
        raise ExtendedSampleExtractionError(
            "문제은행에 중복 question_id가 있습니다."
        )
    return source_rows


def _standard_sample(
    part_rows: Sequence[Dict[str, object]],
    limit: int,
) -> List[Dict[str, object]]:
    selected: List[Dict[str, object]] = []
    remaining = list(part_rows)
    selected_questions = set()
    selected_types = set()
    selected_combinations = set()

    while len(selected) < limit:
        candidates = [
            row
            for row in remaining
            if row["중국어 문제/상황"] not in selected_questions
        ]
        if not candidates:
            raise ExtendedSampleExtractionError(
                f"중복되지 않는 문제를 {limit}개 선택할 수 없습니다."
            )

        def score(row: Dict[str, object]) -> Tuple[int, int, int]:
            combination = (row["자료 등급"], row["원문성"])
            return (
                int(row["유형"] not in selected_types),
                int(combination not in selected_combinations),
                -int(row["__excel_row"]),
            )

        chosen = max(candidates, key=score)
        selected.append(chosen)
        remaining.remove(chosen)
        selected_questions.add(chosen["중국어 문제/상황"])
        selected_types.add(chosen["유형"])
        selected_combinations.add(
            (chosen["자료 등급"], chosen["원문성"])
        )
    return sorted(selected, key=lambda row: int(row["__excel_row"]))


def _part7_sample(
    part_rows: Sequence[Dict[str, object]],
    limit: int,
) -> List[Dict[str, object]]:
    selected: List[Dict[str, object]] = []
    remaining = list(part_rows)
    selected_ids = set()
    selected_answer_points = set()
    selected_locators = set()
    selected_types = set()
    selected_combinations = set()

    while len(selected) < limit:
        candidates = []
        for row in remaining:
            locator = (
                f"{QUESTION_BANK_SHEET}!A{row['__excel_row']}:"
                f"N{row['__excel_row']}"
            )
            if (
                row["ID"] not in selected_ids
                and row["답변 포인트"] not in selected_answer_points
                and locator not in selected_locators
            ):
                candidates.append(row)
        if not candidates:
            raise ExtendedSampleExtractionError(
                "서로 다른 question_id, answer_point, source_locator를 "
                f"가진 Part 7 문제를 {limit}개 선택할 수 없습니다."
            )

        def score(row: Dict[str, object]) -> Tuple[int, int, int]:
            combination = (row["자료 등급"], row["원문성"])
            return (
                int(row["유형"] not in selected_types),
                int(combination not in selected_combinations),
                -int(row["__excel_row"]),
            )

        chosen = max(candidates, key=score)
        locator = (
            f"{QUESTION_BANK_SHEET}!A{chosen['__excel_row']}:"
            f"N{chosen['__excel_row']}"
        )
        selected.append(chosen)
        remaining.remove(chosen)
        selected_ids.add(chosen["ID"])
        selected_answer_points.add(chosen["답변 포인트"])
        selected_locators.add(locator)
        selected_types.add(chosen["유형"])
        selected_combinations.add(
            (chosen["자료 등급"], chosen["원문성"])
        )
    return sorted(selected, key=lambda row: int(row["__excel_row"]))


def _select_question_sample(
    source_rows: Sequence[Dict[str, object]]
) -> List[Dict[str, object]]:
    rows_by_part: Dict[int, List[Dict[str, object]]] = {
        part: [] for part in PART_QUOTAS
    }
    for row in source_rows:
        part = int(str(row["Part"]))
        if part in rows_by_part:
            rows_by_part[part].append(row)

    selected: List[Dict[str, object]] = []
    selected.extend(_standard_sample(rows_by_part[5], PART_QUOTAS[5]))
    selected.extend(_standard_sample(rows_by_part[6], PART_QUOTAS[6]))
    selected.extend(_part7_sample(rows_by_part[7], PART_QUOTAS[7]))
    selected.sort(
        key=lambda row: (
            int(str(row["Part"])),
            int(row["__excel_row"]),
        )
    )
    _validate_selected_questions(selected)
    return selected


def _validate_selected_questions(
    selected: Sequence[Dict[str, object]]
) -> None:
    if len(selected) != 14:
        raise ExtendedSampleExtractionError(
            f"Part 5~7 표본은 14행이어야 합니다: {len(selected)}행"
        )
    part_counts = Counter(int(str(row["Part"])) for row in selected)
    if dict(part_counts) != PART_QUOTAS:
        raise ExtendedSampleExtractionError(
            f"Part별 표본 수가 6·4·4와 다릅니다: {dict(part_counts)}"
        )

    question_ids = [str(row["ID"]) for row in selected]
    if len(question_ids) != len(set(question_ids)):
        raise ExtendedSampleExtractionError(
            "Part 5~7 표본에 중복 question_id가 있습니다."
        )

    for part in (5, 6):
        questions = [
            str(row["중국어 문제/상황"])
            for row in selected
            if int(str(row["Part"])) == part
        ]
        if len(questions) != len(set(questions)):
            raise ExtendedSampleExtractionError(
                f"Part {part} 표본에 완전 중복 중국어 문제가 있습니다."
            )

    part7_rows = [
        row for row in selected if int(str(row["Part"])) == 7
    ]
    for field in ("ID", "답변 포인트", "__excel_row"):
        values = [str(row[field]) for row in part7_rows]
        if len(values) != len(set(values)):
            raise ExtendedSampleExtractionError(
                f"Part 7 표본의 {field} 값이 서로 다르지 않습니다."
            )
    # Part 7은 서로 다른 그림·답변 포인트를 가진 공통 지시문의 반복을
    # 허용하므로 question_zh 자체에는 unique 검증을 적용하지 않는다.


def _build_question_records(
    selected: Sequence[Dict[str, object]]
) -> List[Dict[str, str]]:
    records: List[Dict[str, str]] = []
    for row in selected:
        excel_row = int(row["__excel_row"])
        records.append(
            {
                "question_id": str(row["ID"]),
                "source_id": "src-001",
                "source_locator": (
                    f"{QUESTION_BANK_SHEET}!A{excel_row}:N{excel_row}"
                ),
                "part": str(row["Part"]),
                "question_type": str(row["유형"]),
                "question_zh": str(row["중국어 문제/상황"]),
                "question_pinyin": str(row["병음"]),
                "question_ko": str(row["한국어 뜻/상황"]),
                "source_grade": str(row["자료 등급"]),
                "source_name": str(row["출처"]),
                "source_url": str(row["출처 URL"]),
                "originality": str(row["원문성"]),
                "answer_point": str(row["답변 포인트"]),
                "question_status": "raw",
                "normalization_notes": "",
            }
        )
    _validate_question_records(records)
    return records


def _validate_question_records(
    records: Sequence[Dict[str, str]]
) -> None:
    if len(records) != 14:
        raise ExtendedSampleExtractionError(
            f"questions_part5_7.csv는 14행이어야 합니다: "
            f"{len(records)}행"
        )
    if any(list(record) != QUESTION_HEADERS for record in records):
        raise ExtendedSampleExtractionError(
            "questions_part5_7.csv 컬럼 또는 순서가 잘못됐습니다."
        )
    if any(set(record) & PERSONAL_EXCEL_HEADERS for record in records):
        raise ExtendedSampleExtractionError(
            "개인 학습 컬럼이 Question 표본에 포함됐습니다."
        )
    part_counts = Counter(int(record["part"]) for record in records)
    if dict(part_counts) != PART_QUOTAS:
        raise ExtendedSampleExtractionError(
            f"Question CSV Part별 수가 잘못됐습니다: {dict(part_counts)}"
        )
    if len({record["question_id"] for record in records}) != len(records):
        raise ExtendedSampleExtractionError(
            "Question CSV에 중복 question_id가 있습니다."
        )
    for part in ("5", "6"):
        questions = [
            record["question_zh"]
            for record in records
            if record["part"] == part
        ]
        if len(questions) != len(set(questions)):
            raise ExtendedSampleExtractionError(
                f"Part {part} CSV에 완전 중복 중국어 문제가 있습니다."
            )
    part7 = [record for record in records if record["part"] == "7"]
    for field in ("question_id", "answer_point", "source_locator"):
        if len({record[field] for record in part7}) != len(part7):
            raise ExtendedSampleExtractionError(
                f"Part 7 CSV의 {field} 값이 서로 다르지 않습니다."
            )


def _sheet_locator(sheet_name: str, cell_range: str) -> str:
    return f"'{sheet_name}'!{cell_range}"


def _figure_id_from_cell(part: int, value: str) -> str:
    match = FIGURE_ID_RE[part].fullmatch(value)
    return "" if match is None else match.group(1)


def _find_set_blocks(
    rows: Mapping[int, Mapping[int, str]],
    part: int,
    final_column: str,
) -> List[Dict[str, object]]:
    id_rows = []
    for row_number, values in rows.items():
        figure_id = _figure_id_from_cell(part, values.get(1, ""))
        if figure_id:
            id_rows.append((row_number, figure_id))
    id_rows.sort(key=lambda item: item[1])
    expected_ids = [f"P{part}-V{index:02d}" for index in range(1, 13)]
    if [figure_id for _, figure_id in id_rows] != expected_ids:
        raise ExtendedSampleExtractionError(
            f"Part {part} 그림 ID 12개가 예상과 다릅니다."
        )
    if [row for row, _ in id_rows] != sorted(row for row, _ in id_rows):
        raise ExtendedSampleExtractionError(
            f"Part {part} 그림 ID 순서와 Excel 행 순서가 다릅니다."
        )

    blocks: List[Dict[str, object]] = []
    maximum_row = max(rows)
    sheet_name = PART2_VISUAL_SHEET if part == 2 else PART7_VISUAL_SHEET
    for index, (start_row, figure_id) in enumerate(id_rows):
        end_row = (
            id_rows[index + 1][0] - 1
            if index + 1 < len(id_rows)
            else maximum_row
        )
        blocks.append(
            {
                "figure_id": figure_id,
                "start_row": start_row,
                "end_row": end_row,
                "source_locator": _sheet_locator(
                    sheet_name,
                    f"A{start_row}:{final_column}{end_row}",
                ),
            }
        )
    return blocks


def _content_types(archive: ZipFile) -> Tuple[Dict[str, str], Dict[str, str]]:
    root = ET.fromstring(archive.read("[Content_Types].xml"))
    defaults = {
        item.attrib["Extension"].lower(): item.attrib["ContentType"]
        for item in root.findall(f"{CONTENT_TYPE}Default")
        if item.attrib.get("Extension") and item.attrib.get("ContentType")
    }
    overrides = {
        item.attrib["PartName"].lstrip("/"): item.attrib["ContentType"]
        for item in root.findall(f"{CONTENT_TYPE}Override")
        if item.attrib.get("PartName") and item.attrib.get("ContentType")
    }
    return defaults, overrides


def _drawing_images(
    archive: ZipFile,
    sheet_member: str,
    worksheet: ET.Element,
) -> List[Dict[str, object]]:
    drawing_elements = worksheet.findall(f"{MAIN}drawing")
    if len(drawing_elements) != 1:
        raise ExtendedSampleExtractionError(
            f"시트 drawing 관계는 정확히 하나여야 합니다: {sheet_member}"
        )
    relationship_id = drawing_elements[0].attrib.get(RELATIONSHIP_ID, "")
    if not relationship_id:
        raise ExtendedSampleExtractionError(
            f"drawing relationship ID가 없습니다: {sheet_member}"
        )
    drawing_member = _relationship_target(
        archive, sheet_member, relationship_id, "/drawing"
    )
    drawing = ET.fromstring(archive.read(drawing_member))
    defaults, overrides = _content_types(archive)

    images: List[Dict[str, object]] = []
    for anchor in list(drawing):
        anchor_type = anchor.tag.rsplit("}", 1)[-1]
        if anchor_type not in {"oneCellAnchor", "twoCellAnchor"}:
            continue
        from_element = anchor.find(f"{XDR}from")
        if from_element is None:
            raise ExtendedSampleExtractionError(
                f"그림 anchor 시작점이 없습니다: {drawing_member}"
            )
        row_element = from_element.find(f"{XDR}row")
        column_element = from_element.find(f"{XDR}col")
        if (
            row_element is None
            or row_element.text is None
            or column_element is None
            or column_element.text is None
        ):
            raise ExtendedSampleExtractionError(
                f"그림 anchor 행·열이 없습니다: {drawing_member}"
            )
        anchor_row_start = int(row_element.text) + 1
        anchor_column = int(column_element.text) + 1

        anchor_row_end = ""
        if anchor_type == "twoCellAnchor":
            to_element = anchor.find(f"{XDR}to")
            to_row = (
                None
                if to_element is None
                else to_element.find(f"{XDR}row")
            )
            if to_row is None or to_row.text is None:
                raise ExtendedSampleExtractionError(
                    f"twoCellAnchor 종료 행이 없습니다: {drawing_member}"
                )
            anchor_row_end = str(int(to_row.text) + 1)

        ext = anchor.find(f"{XDR}ext")
        ext_cx = "" if ext is None else ext.attrib.get("cx", "")
        ext_cy = "" if ext is None else ext.attrib.get("cy", "")

        blips = anchor.findall(f".//{DRAWING_MAIN}blip")
        if len(blips) != 1:
            raise ExtendedSampleExtractionError(
                f"그림 anchor의 image 참조는 하나여야 합니다: "
                f"{drawing_member}"
            )
        image_relationship_id = blips[0].attrib.get(
            RELATIONSHIP_EMBED, ""
        )
        if not image_relationship_id:
            raise ExtendedSampleExtractionError(
                f"그림 image relationship ID가 없습니다: {drawing_member}"
            )
        media_member = _relationship_target(
            archive, drawing_member, image_relationship_id, "/image"
        )
        extension = Path(media_member).suffix.lower().lstrip(".")
        media_type = overrides.get(media_member, defaults.get(extension, ""))
        if not extension or not media_type.startswith("image/"):
            raise ExtendedSampleExtractionError(
                f"그림 미디어 유형을 확인할 수 없습니다: {media_member}"
            )
        media_bytes = archive.read(media_member)
        if extension == "png" and not media_bytes.startswith(PNG_SIGNATURE):
            raise ExtendedSampleExtractionError(
                f"PNG signature가 일치하지 않습니다: {media_member}"
            )
        images.append(
            {
                "anchor_type": anchor_type,
                "anchor_row_start": anchor_row_start,
                "anchor_row_end": anchor_row_end,
                "anchor_column": anchor_column,
                "ext_cx": ext_cx,
                "ext_cy": ext_cy,
                "media_member": media_member,
                "extension": extension,
                "media_type": media_type,
                "media_bytes": media_bytes,
                "media_sha256": sha256_bytes(media_bytes),
            }
        )
    return images


def _map_images_to_blocks(
    blocks: Sequence[Dict[str, object]],
    images: Sequence[Dict[str, object]],
) -> List[Dict[str, object]]:
    if len(images) != 12:
        raise ExtendedSampleExtractionError(
            f"대상 시트 그림은 12개여야 합니다: {len(images)}개"
        )
    mapped: List[Dict[str, object]] = []
    used_media = set()
    for block in blocks:
        start_row = int(block["start_row"])
        end_row = int(block["end_row"])
        matches = [
            image
            for image in images
            if start_row
            < int(image["anchor_row_start"])
            <= end_row
        ]
        if len(matches) != 1:
            raise ExtendedSampleExtractionError(
                f"{block['figure_id']} 블록의 그림은 하나여야 합니다: "
                f"{len(matches)}개"
            )
        image = matches[0]
        if int(image["anchor_row_start"]) != start_row + 1:
            raise ExtendedSampleExtractionError(
                f"{block['figure_id']} ID 행과 그림 anchor가 인접하지 않습니다."
            )
        if image["media_member"] in used_media:
            raise ExtendedSampleExtractionError(
                f"그림 미디어가 여러 세트에 중복 연결됐습니다: "
                f"{image['media_member']}"
            )
        used_media.add(image["media_member"])
        mapped.append({**block, **image})
    return mapped


def _visual_set_id(figure_id: str) -> str:
    return f"vs-{figure_id.lower()}"


def _build_visual_set_records(
    part2_sets: Sequence[Dict[str, object]],
    part7_sets: Sequence[Dict[str, object]],
) -> Tuple[List[Dict[str, str]], Dict[str, bytes]]:
    records: List[Dict[str, str]] = []
    assets: Dict[str, bytes] = {}
    for part, set_type, selected_sets in (
        (2, "four_question_image", part2_sets[:2]),
        (7, "story_image", part7_sets[:2]),
    ):
        for source_set in selected_sets:
            figure_id = str(source_set["figure_id"])
            extension = str(source_set["extension"])
            prefix = "part2" if part == 2 else "part7"
            filename = f"{prefix}__{figure_id}.{extension}"
            relative_asset_path = (
                OUTPUT_RELATIVE_DIR / "assets" / filename
            ).as_posix()
            media_member = str(source_set["media_member"])
            if media_member == "xl/media/image25.png":
                raise ExtendedSampleExtractionError(
                    "공식 샘플 이미지가 확장 표본에 포함됐습니다."
                )
            column_name = _column_name(
                int(source_set["anchor_column"])
            )
            notes = (
                f"{source_set['anchor_type']} "
                f"{column_name}{source_set['anchor_row_start']}; "
                "OOXML에 명시적 종료 행 없음; "
                f"ext_cx={source_set['ext_cx']}, "
                f"ext_cy={source_set['ext_cy']}; "
                f"media={media_member}"
            )
            records.append(
                {
                    "visual_set_id": _visual_set_id(figure_id),
                    "original_figure_id": figure_id,
                    "part": str(part),
                    "set_type": set_type,
                    "source_id": "src-001",
                    "source_locator": str(
                        source_set["source_locator"]
                    ),
                    "asset_path": relative_asset_path,
                    "asset_media_type": str(
                        source_set["media_type"]
                    ),
                    "asset_sha256": str(
                        source_set["media_sha256"]
                    ),
                    "anchor_row_start": str(
                        source_set["anchor_row_start"]
                    ),
                    "anchor_row_end": str(
                        source_set["anchor_row_end"]
                    ),
                    "rights_status": "review_needed",
                    "mapping_status": "verified",
                    "notes": notes,
                }
            )
            assets[filename] = bytes(source_set["media_bytes"])
    return records, assets


def _build_visual_questions(
    rows: Mapping[int, Mapping[int, str]],
    selected_blocks: Sequence[Dict[str, object]],
    question_bank_rows: Sequence[Dict[str, object]],
) -> Tuple[List[Dict[str, str]], Dict[Tuple[str, int], Dict[str, str]]]:
    matches_by_zh: Dict[str, List[str]] = {}
    for source_row in question_bank_rows:
        question_zh = str(source_row["중국어 문제/상황"])
        matches_by_zh.setdefault(question_zh, []).append(
            str(source_row["ID"])
        )

    records: List[Dict[str, str]] = []
    by_key: Dict[Tuple[str, int], Dict[str, str]] = {}
    for block in selected_blocks[:2]:
        figure_id = str(block["figure_id"])
        start_row = int(block["start_row"])
        end_row = int(block["end_row"])
        labels = []
        for row_number in range(start_row, end_row + 1):
            label = rows.get(row_number, {}).get(8, "")
            match = VISUAL_QUESTION_LABEL_RE.fullmatch(label)
            if match is not None:
                labels.append((int(match.group(1)), row_number, label))
        labels.sort()
        if [item for item, _, _ in labels] != [1, 2, 3, 4]:
            raise ExtendedSampleExtractionError(
                f"{figure_id}의 Q1~Q4 구조가 예상과 다릅니다."
            )

        for item_number, row_number, original_label in labels:
            question_zh = rows.get(row_number, {}).get(9, "")
            question_pinyin = rows.get(row_number + 1, {}).get(9, "")
            question_ko = rows.get(row_number + 2, {}).get(9, "")
            if not question_zh:
                raise ExtendedSampleExtractionError(
                    f"{figure_id} Q{item_number} 중국어 질문이 비었습니다."
                )
            matches = matches_by_zh.get(question_zh, [])
            if len(matches) == 1:
                linked_question_id = matches[0]
                mapping_status = "matched_exact_zh"
                match_note = "문제은행 중국어 원문 완전 일치(단일)"
            elif not matches:
                linked_question_id = ""
                mapping_status = "unmatched"
                match_note = "문제은행 중국어 원문 완전 일치 없음"
            else:
                linked_question_id = ""
                mapping_status = "ambiguous_multiple_exact_matches"
                match_note = (
                    f"문제은행 중국어 원문 완전 일치 {len(matches)}건"
                )
            visual_question_id = (
                f"vq-{figure_id.lower()}-q{item_number}"
            )
            record = {
                "visual_question_id": visual_question_id,
                "visual_set_id": _visual_set_id(figure_id),
                "item_number": str(item_number),
                "linked_question_id": linked_question_id,
                "question_zh": question_zh,
                "question_pinyin": question_pinyin,
                "question_ko": question_ko,
                "source_id": "src-001",
                "source_locator": _sheet_locator(
                    PART2_VISUAL_SHEET,
                    f"H{row_number}:K{row_number + 2}",
                ),
                "mapping_status": mapping_status,
                "notes": f"원본 문항 표기 {original_label}; {match_note}",
            }
            records.append(record)
            by_key[(figure_id, item_number)] = record
    return records, by_key


def _table_records(
    rows: Mapping[int, Mapping[int, str]],
    headers: Sequence[str],
    expected_count: int,
    sheet_name: str,
) -> List[Tuple[int, Dict[str, str]]]:
    actual_headers = [
        rows.get(1, {}).get(index, "")
        for index in range(1, len(headers) + 1)
    ]
    if actual_headers != list(headers):
        raise ExtendedSampleExtractionError(
            f"`{sheet_name}` 헤더가 예상과 다릅니다."
        )
    records: List[Tuple[int, Dict[str, str]]] = []
    for row_number in sorted(rows):
        if row_number == 1:
            continue
        values = [
            rows[row_number].get(index, "")
            for index in range(1, len(headers) + 1)
        ]
        if not any(values):
            continue
        records.append((row_number, dict(zip(headers, values))))
    if len(records) != expected_count:
        raise ExtendedSampleExtractionError(
            f"`{sheet_name}` 데이터는 {expected_count}행이어야 합니다: "
            f"{len(records)}행"
        )
    return records


def _build_visual_answers(
    answer_rows: Mapping[int, Mapping[int, str]],
    visual_questions_by_key: Mapping[
        Tuple[str, int], Dict[str, str]
    ],
) -> List[Dict[str, str]]:
    source_records = _table_records(
        answer_rows,
        PART2_ANSWER_HEADERS,
        48,
        PART2_ANSWER_SHEET,
    )
    by_key: Dict[Tuple[str, int], Tuple[int, Dict[str, str]]] = {}
    for row_number, source in source_records:
        try:
            item_number = int(source["문항"])
        except ValueError as error:
            raise ExtendedSampleExtractionError(
                f"Part2 정답 문항 번호가 정수가 아닙니다: "
                f"{source['문항']}"
            ) from error
        key = (source["그림 ID"], item_number)
        if key in by_key:
            raise ExtendedSampleExtractionError(
                f"Part2 정답 복합 키가 중복됩니다: {key}"
            )
        by_key[key] = (row_number, source)

    records: List[Dict[str, str]] = []
    for key, visual_question in visual_questions_by_key.items():
        source_item = by_key.get(key)
        if source_item is None:
            raise ExtendedSampleExtractionError(
                f"Part2 정답을 찾을 수 없습니다: {key}"
            )
        row_number, source = source_item
        question_mapping = {
            "question_zh": "중국어 질문",
            "question_pinyin": "병음",
            "question_ko": "한국어 질문",
        }
        for visual_field, source_field in question_mapping.items():
            if visual_question[visual_field] != source[source_field]:
                raise ExtendedSampleExtractionError(
                    f"Part2 그림 질문과 정답 질문이 다릅니다: {key}"
                )
        figure_id, item_number = key
        records.append(
            {
                "answer_id": (
                    f"ma-{figure_id.lower()}-q{item_number}-basic"
                ),
                "visual_question_id": visual_question[
                    "visual_question_id"
                ],
                "linked_question_id": visual_question[
                    "linked_question_id"
                ],
                "answer_variant": "basic",
                "target_level": "",
                "answer_zh": source["추천 답변"],
                "answer_pinyin": source["답변 병음"],
                "answer_ko": source["한국어 뜻"],
                "answer_status": "review_needed",
                "provenance_kind": "unverified_source",
                "source_id": "src-001",
                "source_locator": _sheet_locator(
                    PART2_ANSWER_SHEET,
                    f"A{row_number}:H{row_number}",
                ),
                "review_notes": (
                    "Excel 원본 추천 답변이며 언어·내용 검수가 필요함."
                ),
            }
        )
    return records


def _build_story_guides(
    guide_rows: Mapping[int, Mapping[int, str]],
    selected_blocks: Sequence[Dict[str, object]],
    question_bank_rows: Sequence[Dict[str, object]],
) -> List[Dict[str, str]]:
    source_records = _table_records(
        guide_rows,
        PART7_GUIDE_HEADERS,
        12,
        PART7_GUIDE_SHEET,
    )
    by_figure_id = {
        source["그림 ID"]: (row_number, source)
        for row_number, source in source_records
    }
    if len(by_figure_id) != 12:
        raise ExtendedSampleExtractionError(
            "Part7 정답 포인트 그림 ID가 중복됩니다."
        )
    common_question_counts = Counter(
        str(row["중국어 문제/상황"])
        for row in question_bank_rows
        if int(str(row["Part"])) == 7
    )
    maximum_exact_matches = max(common_question_counts.values())

    records: List[Dict[str, str]] = []
    for block in selected_blocks[:2]:
        figure_id = str(block["figure_id"])
        source_item = by_figure_id.get(figure_id)
        if source_item is None:
            raise ExtendedSampleExtractionError(
                f"Part7 정답 포인트를 찾을 수 없습니다: {figure_id}"
            )
        row_number, source = source_item
        records.append(
            {
                "story_guide_id": f"sg-{figure_id.lower()}",
                "visual_set_id": _visual_set_id(figure_id),
                "original_figure_id": figure_id,
                "linked_question_id": "",
                "situation_ko": source["한국어 상황"],
                "recommended_flow": source["추천 이야기 흐름"],
                "recommended_connectors_zh": source[
                    "권장 중국어 연결어"
                ],
                "material_nature": source["자료 성격"],
                "source_id": "src-001",
                "source_locator": _sheet_locator(
                    PART7_GUIDE_SHEET,
                    f"A{row_number}:E{row_number}",
                ),
                "guide_status": "raw",
                "notes": (
                    "그림 ID로 VisualSet과 연결함; 문제은행에는 명시적 "
                    f"그림 ID 연결이 없고 공통 지시문이 "
                    f"{maximum_exact_matches}개 Question과 일치하여 "
                    "linked_question_id를 비움."
                ),
            }
        )
    return records


def _validate_visual_records(
    visual_sets: Sequence[Dict[str, str]],
    visual_questions: Sequence[Dict[str, str]],
    visual_answers: Sequence[Dict[str, str]],
    story_guides: Sequence[Dict[str, str]],
    assets: Mapping[str, bytes],
) -> None:
    expected_figure_ids = ["P2-V01", "P2-V02", "P7-V01", "P7-V02"]
    if len(visual_sets) != 4 or [
        record["original_figure_id"] for record in visual_sets
    ] != expected_figure_ids:
        raise ExtendedSampleExtractionError(
            "시각 세트는 Part 2·7의 앞 2세트씩이어야 합니다."
        )
    if any(list(record) != VISUAL_SET_HEADERS for record in visual_sets):
        raise ExtendedSampleExtractionError(
            "visual_sets.csv 컬럼 또는 순서가 잘못됐습니다."
        )
    if any(record["rights_status"] != "review_needed" for record in visual_sets):
        raise ExtendedSampleExtractionError(
            "시각 자료 권리 상태는 review_needed여야 합니다."
        )
    if any(record["anchor_row_end"] for record in visual_sets):
        raise ExtendedSampleExtractionError(
            "oneCellAnchor에 존재하지 않는 종료 행을 만들었습니다."
        )

    expected_asset_names = {
        "part2__P2-V01.png",
        "part2__P2-V02.png",
        "part7__P7-V01.png",
        "part7__P7-V02.png",
    }
    if set(assets) != expected_asset_names or len(assets) != 4:
        raise ExtendedSampleExtractionError(
            "추출 이미지가 요구된 4개와 다릅니다."
        )
    expected_hashes = {
        record["asset_sha256"] for record in visual_sets
    }
    actual_hashes = {sha256_bytes(value) for value in assets.values()}
    if expected_hashes != actual_hashes:
        raise ExtendedSampleExtractionError(
            "시각 세트의 이미지 SHA-256이 실제 바이트와 다릅니다."
        )

    if len(visual_questions) != 8 or any(
        list(record) != VISUAL_QUESTION_HEADERS
        for record in visual_questions
    ):
        raise ExtendedSampleExtractionError(
            "Part 2 시각 질문은 요구된 컬럼의 8행이어야 합니다."
        )
    if sum(bool(record["linked_question_id"]) for record in visual_questions) != 5:
        raise ExtendedSampleExtractionError(
            "첫 Part 2 시각 질문의 정확 일치 연결은 5개여야 합니다."
        )

    if len(visual_answers) != 8 or any(
        list(record) != VISUAL_MODEL_ANSWER_HEADERS
        for record in visual_answers
    ):
        raise ExtendedSampleExtractionError(
            "Part 2 원본 추천 답변은 요구된 컬럼의 8행이어야 합니다."
        )
    for record in visual_answers:
        if (
            record["answer_variant"] != "basic"
            or record["answer_status"] != "review_needed"
            or record["provenance_kind"] != "unverified_source"
            or record["source_id"] != "src-001"
        ):
            raise ExtendedSampleExtractionError(
                "Part 2 원본 추천 답변의 상태·출처가 잘못됐습니다."
            )

    if len(story_guides) != 2 or any(
        list(record) != STORY_GUIDE_HEADERS for record in story_guides
    ):
        raise ExtendedSampleExtractionError(
            "Part 7 StoryGuide는 요구된 컬럼의 2행이어야 합니다."
        )
    if any(record["linked_question_id"] for record in story_guides):
        raise ExtendedSampleExtractionError(
            "Part 7 Question 연결을 근거 없이 강제했습니다."
        )
    if any(record["guide_status"] != "raw" for record in story_guides):
        raise ExtendedSampleExtractionError(
            "Part 7 StoryGuide 상태는 raw여야 합니다."
        )


def _write_csv(
    path: Path,
    headers: Sequence[str],
    records: Sequence[Dict[str, str]],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(headers),
            extrasaction="raise",
            lineterminator="\n",
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        writer.writerows(records)
        handle.flush()
        os.fsync(handle.fileno())


def _validate_csv(
    path: Path,
    headers: Sequence[str],
    expected_records: Sequence[Dict[str, str]],
) -> None:
    raw_bytes = path.read_bytes()
    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        raise ExtendedSampleExtractionError(
            f"UTF-8 BOM이 포함됐습니다: {path.name}"
        )
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != list(headers):
            raise ExtendedSampleExtractionError(
                f"CSV 헤더 검증에 실패했습니다: {path.name}"
            )
        actual_records = list(reader)
    if actual_records != list(expected_records):
        raise ExtendedSampleExtractionError(
            f"CSV 데이터 재검증에 실패했습니다: {path.name}"
        )


def _write_binary(path: Path, value: bytes) -> None:
    with path.open("wb") as handle:
        handle.write(value)
        handle.flush()
        os.fsync(handle.fileno())


def _publish_stage_directory(stage_dir: Path, output_dir: Path) -> None:
    """검증된 전체 bundle을 디렉터리 단위로 교체하고 실패 시 복원한다."""
    if not output_dir.exists():
        os.replace(stage_dir, output_dir)
        return
    if not output_dir.is_dir() or output_dir.is_symlink():
        raise ExtendedSampleExtractionError(
            f"출력 대상이 일반 디렉터리가 아닙니다: {output_dir}"
        )

    backup_dir = Path(
        tempfile.mkdtemp(
            prefix=".extended-sample-backup-",
            dir=output_dir.parent,
        )
    )
    backup_dir.rmdir()
    previous_moved = False
    try:
        os.replace(output_dir, backup_dir)
        previous_moved = True
        try:
            os.replace(stage_dir, output_dir)
        except Exception:
            os.replace(backup_dir, output_dir)
            previous_moved = False
            raise
        shutil.rmtree(backup_dir)
        previous_moved = False
    finally:
        if previous_moved and backup_dir.exists() and not output_dir.exists():
            os.replace(backup_dir, output_dir)


def _write_outputs(
    output_dir: Path,
    csv_payloads: Sequence[
        Tuple[str, Sequence[str], Sequence[Dict[str, str]]]
    ],
    assets: Mapping[str, bytes],
    source_path: Path,
    source_sha_before: str,
) -> List[Path]:
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    preserved_readme: bytes | None = None
    if output_dir.exists():
        if not output_dir.is_dir() or output_dir.is_symlink():
            raise ExtendedSampleExtractionError(
                f"출력 대상이 일반 디렉터리가 아닙니다: {output_dir}"
            )
        readme_path = output_dir / "README.md"
        if readme_path.exists():
            if not readme_path.is_file() or readme_path.is_symlink():
                raise ExtendedSampleExtractionError(
                    f"보존할 README가 일반 파일이 아닙니다: {readme_path}"
                )
            preserved_readme = readme_path.read_bytes()

    stage_dir = Path(
        tempfile.mkdtemp(
            prefix=".extended-sample-stage-",
            dir=output_dir.parent,
        )
    )
    csv_filenames = [filename for filename, _, _ in csv_payloads]
    try:
        for filename, headers, records in csv_payloads:
            staged_path = stage_dir / filename
            _write_csv(staged_path, headers, records)
            _validate_csv(staged_path, headers, records)

        staged_assets_dir = stage_dir / "assets"
        staged_assets_dir.mkdir()
        for filename, media_bytes in sorted(assets.items()):
            staged_path = staged_assets_dir / filename
            _write_binary(staged_path, media_bytes)
            if staged_path.read_bytes() != media_bytes:
                raise ExtendedSampleExtractionError(
                    f"이미지 바이트 재검증에 실패했습니다: {filename}"
                )

        if preserved_readme is not None:
            _write_binary(stage_dir / "README.md", preserved_readme)

        expected_root_entries = set(csv_filenames) | {"assets"}
        if preserved_readme is not None:
            expected_root_entries.add("README.md")
        if {path.name for path in stage_dir.iterdir()} != expected_root_entries:
            raise ExtendedSampleExtractionError(
                "staged output bundle에 예상 밖 항목이 있습니다."
            )
        if {
            path.name for path in staged_assets_dir.iterdir()
        } != set(assets):
            raise ExtendedSampleExtractionError(
                "staged assets bundle이 요구된 이미지와 다릅니다."
            )

        if sha256_file(source_path) != source_sha_before:
            raise ExtendedSampleExtractionError(
                "출력 교체 전 원본 Excel SHA-256이 변경됐습니다."
            )
        _publish_stage_directory(stage_dir, output_dir)
    finally:
        shutil.rmtree(stage_dir, ignore_errors=True)

    output_paths = [output_dir / filename for filename in csv_filenames]
    output_paths.extend(
        output_dir / "assets" / filename for filename in sorted(assets)
    )
    for path in output_paths:
        if not path.is_file():
            raise ExtendedSampleExtractionError(
                f"최종 출력 파일이 없습니다: {path}"
            )
    final_root_entries = {path.name for path in output_dir.iterdir()}
    expected_final_entries = set(csv_filenames) | {"assets"}
    if preserved_readme is not None:
        expected_final_entries.add("README.md")
    if final_root_entries != expected_final_entries:
        raise ExtendedSampleExtractionError(
            "최종 output bundle에 예상 밖 항목이 있습니다."
        )
    if {
        path.name for path in (output_dir / "assets").iterdir()
    } != set(assets):
        raise ExtendedSampleExtractionError(
            "최종 assets bundle이 요구된 이미지와 다릅니다."
        )
    return output_paths


def _count_blank_fields(
    records: Sequence[Dict[str, str]]
) -> Dict[str, int]:
    fields = [
        "question_zh",
        "question_pinyin",
        "question_ko",
        "question_type",
        "source_grade",
        "source_name",
        "source_url",
        "originality",
        "answer_point",
    ]
    return {
        field: sum(record[field] == "" for record in records)
        for field in fields
    }


def run(
    source_path: Path | None = None,
    output_dir: Path | None = None,
) -> Dict[str, object]:
    """확장 표본을 읽기 전용으로 추출·검증하고 원자적으로 교체한다."""
    actual_source_path = SOURCE_PATH if source_path is None else source_path
    actual_output_dir = OUTPUT_DIR if output_dir is None else output_dir
    if not actual_source_path.is_file():
        raise ExtendedSampleExtractionError(
            f"원본 Excel이 없습니다: {actual_source_path}"
        )

    source_sha_before = sha256_file(actual_source_path)
    if source_sha_before != EXPECTED_SOURCE_SHA256:
        raise ExtendedSampleExtractionError(
            "원본 Excel SHA-256이 문서에 기록된 값과 다릅니다: "
            f"{source_sha_before}"
        )

    with ZipFile(actual_source_path) as archive:
        bad_member = archive.testzip()
        if bad_member is not None:
            raise ExtendedSampleExtractionError(
                f"손상된 XLSX 내부 파일입니다: {bad_member}"
            )
        shared_strings = _shared_strings(archive)
        sheet_members = _workbook_sheet_members(archive)

        worksheets: Dict[str, ET.Element] = {}
        sheet_rows: Dict[str, Dict[int, Dict[int, str]]] = {}
        for sheet_name in REQUIRED_SHEETS:
            worksheet, rows = _read_sheet_rows(
                archive, sheet_members[sheet_name], shared_strings
            )
            worksheets[sheet_name] = worksheet
            sheet_rows[sheet_name] = rows

        guidance_values = [
            value
            for row in sheet_rows[VISUAL_GUIDANCE_SHEET].values()
            for value in row.values()
            if value
        ]
        if not guidance_values:
            raise ExtendedSampleExtractionError(
                "그림 활용 안내 시트가 비어 있습니다."
            )

        question_bank_rows = _read_question_bank(
            sheet_rows[QUESTION_BANK_SHEET]
        )
        selected_questions = _select_question_sample(question_bank_rows)
        question_records = _build_question_records(selected_questions)

        part2_blocks = _find_set_blocks(
            sheet_rows[PART2_VISUAL_SHEET], 2, "K"
        )
        part7_blocks = _find_set_blocks(
            sheet_rows[PART7_VISUAL_SHEET], 7, "N"
        )
        part2_images = _drawing_images(
            archive,
            sheet_members[PART2_VISUAL_SHEET],
            worksheets[PART2_VISUAL_SHEET],
        )
        part7_images = _drawing_images(
            archive,
            sheet_members[PART7_VISUAL_SHEET],
            worksheets[PART7_VISUAL_SHEET],
        )
        mapped_part2_sets = _map_images_to_blocks(
            part2_blocks, part2_images
        )
        mapped_part7_sets = _map_images_to_blocks(
            part7_blocks, part7_images
        )
        visual_set_records, assets = _build_visual_set_records(
            mapped_part2_sets, mapped_part7_sets
        )
        visual_question_records, visual_questions_by_key = (
            _build_visual_questions(
                sheet_rows[PART2_VISUAL_SHEET],
                part2_blocks,
                question_bank_rows,
            )
        )
        visual_answer_records = _build_visual_answers(
            sheet_rows[PART2_ANSWER_SHEET],
            visual_questions_by_key,
        )
        story_guide_records = _build_story_guides(
            sheet_rows[PART7_GUIDE_SHEET],
            part7_blocks,
            question_bank_rows,
        )

    _validate_visual_records(
        visual_set_records,
        visual_question_records,
        visual_answer_records,
        story_guide_records,
        assets,
    )
    csv_payloads = [
        (
            "questions_part5_7.csv",
            QUESTION_HEADERS,
            question_records,
        ),
        ("visual_sets.csv", VISUAL_SET_HEADERS, visual_set_records),
        (
            "visual_questions.csv",
            VISUAL_QUESTION_HEADERS,
            visual_question_records,
        ),
        (
            "visual_model_answers.csv",
            VISUAL_MODEL_ANSWER_HEADERS,
            visual_answer_records,
        ),
        (
            "story_guides.csv",
            STORY_GUIDE_HEADERS,
            story_guide_records,
        ),
    ]
    output_paths = _write_outputs(
        actual_output_dir,
        csv_payloads,
        assets,
        actual_source_path,
        source_sha_before,
    )

    source_sha_after = sha256_file(actual_source_path)
    if source_sha_after != source_sha_before:
        raise ExtendedSampleExtractionError(
            "작업 전후 원본 Excel SHA-256이 다릅니다."
        )

    result: Dict[str, object] = {
        "source_path": actual_source_path,
        "source_sha256": source_sha_after,
        "question_records": question_records,
        "blank_counts": _count_blank_fields(question_records),
        "visual_set_records": visual_set_records,
        "visual_question_records": visual_question_records,
        "visual_answer_records": visual_answer_records,
        "story_guide_records": story_guide_records,
        "assets": assets,
        "output_paths": output_paths,
    }
    return result


def _display_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT_DIR).as_posix()
    except ValueError:
        return path.as_posix()


def main() -> int:
    try:
        result = run()
    except (
        ExtendedSampleExtractionError,
        BadZipFile,
        ET.ParseError,
        OSError,
        ValueError,
    ) as error:
        print(f"오류: {error}", file=sys.stderr)
        return 1

    question_records = result["question_records"]
    assert isinstance(question_records, list)
    part_counts = Counter(record["part"] for record in question_records)
    visual_questions = result["visual_question_records"]
    assert isinstance(visual_questions, list)
    visual_sets = result["visual_set_records"]
    assert isinstance(visual_sets, list)
    blank_counts = result["blank_counts"]
    assert isinstance(blank_counts, dict)
    output_paths = result["output_paths"]
    assert isinstance(output_paths, list)

    print(f"원본 파일 경로: {_display_path(result['source_path'])}")
    print(f"원본 SHA-256: {result['source_sha256']}")
    print(f"Part 5~7 추출 문제 수: {len(question_records)}")
    print(
        "Part별 문제 수: "
        + ", ".join(
            f"Part {part}={part_counts[str(part)]}"
            for part in PART_QUOTAS
        )
    )
    print(
        "선택된 문제 ID: "
        + ", ".join(
            record["question_id"] for record in question_records
        )
    )
    print(
        "선택된 그림 ID: "
        + ", ".join(
            record["original_figure_id"] for record in visual_sets
        )
    )
    print(
        "시각 표본 수: "
        f"세트={len(visual_sets)}, "
        f"Part 2 질문={len(visual_questions)}, "
        f"Part 2 원본 답변={len(result['visual_answer_records'])}, "
        f"StoryGuide={len(result['story_guide_records'])}, "
        f"이미지={len(result['assets'])}"
    )
    print(
        "기존 Question 연결: "
        f"연결={sum(bool(row['linked_question_id']) for row in visual_questions)}, "
        f"미연결={sum(not row['linked_question_id'] for row in visual_questions)}"
    )
    print("빈 필드 수:")
    for field, count in blank_counts.items():
        print(f"  {field}: {count}")
    print("이미지 SHA-256:")
    for record in visual_sets:
        print(f"  {record['asset_path']}: {record['asset_sha256']}")
    print("출력 파일 경로:")
    for path in output_paths:
        print(f"  {_display_path(path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

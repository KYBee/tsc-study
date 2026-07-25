#!/usr/bin/env python3
"""원본 TSC 문제은행 Excel에서 결정적인 Question 표본을 추출한다."""

from __future__ import annotations

from collections import Counter
import csv
import hashlib
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import sys
import tempfile
from typing import Dict, List, Sequence, Tuple
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile


ROOT_DIR = Path(__file__).resolve().parents[1]
SOURCE_RELATIVE_PATH = Path(
    "data/raw/TSC_파트별_문제은행_그림포함.xlsx"
)
SOURCE_PATH = ROOT_DIR / SOURCE_RELATIVE_PATH
OUTPUT_RELATIVE_DIR = Path("data/working/question-sample")
OUTPUT_DIR = ROOT_DIR / OUTPUT_RELATIVE_DIR
SHEET_NAME = "문제은행"
EXPECTED_SOURCE_SHA256 = (
    "a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f"
)

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

MODEL_ANSWER_HEADERS = [
    "answer_id",
    "question_id",
    "answer_variant",
    "target_level",
    "answer_zh",
    "answer_pinyin",
    "answer_ko",
    "answer_status",
    "provenance_kind",
    "source_id",
    "review_notes",
]

PART_QUOTAS = {1: 4, 2: 4, 3: 6, 4: 6}
PERSONAL_EXCEL_HEADERS = {"연습 상태", "최근 연습일", "내 답변 메모"}
QUALITY_FIELDS = [
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

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOCUMENT_REL_NS = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)
PACKAGE_REL_NS = (
    "http://schemas.openxmlformats.org/package/2006/relationships"
)
NS = {"main": MAIN_NS, "rel": DOCUMENT_REL_NS}
MAIN = f"{{{MAIN_NS}}}"
RELATIONSHIP_ID = f"{{{DOCUMENT_REL_NS}}}id"
PACKAGE_RELATIONSHIP = f"{{{PACKAGE_REL_NS}}}Relationship"
CELL_REFERENCE_RE = re.compile(r"^([A-Z]+)([1-9][0-9]*)$")
LOCATOR_RE = re.compile(r"^문제은행!A([1-9][0-9]*):N\1$")


class SampleExtractionError(RuntimeError):
    """표본 추출 입력 또는 결과 검증 실패."""


def normalize_archive_target(target: str) -> str:
    """Workbook relationship target을 XLSX ZIP 내부 경로로 정규화한다."""
    normalized = target.lstrip("/")
    if not normalized.startswith("xl/"):
        normalized = str(PurePosixPath("xl") / normalized)
    normalized = posixpath.normpath(normalized)
    if not normalized.startswith("xl/"):
        raise SampleExtractionError(
            f"XLSX 외부를 가리키는 관계 경로입니다: {target}"
        )
    return normalized


def select_diverse_rows(
    part_rows: List[Dict[str, object]],
    limit: int,
) -> List[Dict[str, object]]:
    """유형을 우선하고 자료 등급·원문성 다양성을 보조 기준으로 선택한다."""
    selected: List[Dict[str, object]] = []
    remaining = list(part_rows)
    selected_types = set()
    selected_grades = set()
    selected_originalities = set()
    selected_questions = set()

    while len(selected) < limit:
        candidates = [
            row
            for row in remaining
            if row["중국어 문제/상황"] not in selected_questions
        ]
        if not candidates:
            raise ValueError(f"중복되지 않는 문제를 {limit}개 선택할 수 없습니다.")

        def score(row: Dict[str, object]):
            new_type = row["유형"] not in selected_types
            new_grade = row["자료 등급"] not in selected_grades
            new_originality = row["원문성"] not in selected_originalities
            return (
                int(new_type),
                int(new_grade) + int(new_originality),
                -int(row["__excel_row"]),
            )

        chosen = max(candidates, key=score)
        selected.append(chosen)
        remaining.remove(chosen)
        selected_types.add(chosen["유형"])
        selected_grades.add(chosen["자료 등급"])
        selected_originalities.add(chosen["원문성"])
        selected_questions.add(chosen["중국어 문제/상황"])

    return sorted(selected, key=lambda row: int(row["__excel_row"]))


def sha256_file(path: Path) -> str:
    """파일의 SHA-256을 계산한다."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _column_index(cell_reference: str) -> int:
    match = CELL_REFERENCE_RE.fullmatch(cell_reference)
    if match is None:
        raise SampleExtractionError(
            f"잘못된 Excel 셀 참조입니다: {cell_reference}"
        )
    index = 0
    for character in match.group(1):
        index = index * 26 + ord(character) - ord("A") + 1
    return index


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
            raise SampleExtractionError(
                f"shared string 인덱스가 없는 셀입니다: {cell.attrib.get('r', '')}"
            )
        try:
            return shared_strings[int(value_element.text)]
        except (ValueError, IndexError) as error:
            raise SampleExtractionError(
                f"잘못된 shared string 인덱스입니다: {cell.attrib.get('r', '')}"
            ) from error

    if cell_type == "inlineStr":
        return "".join(
            text.text or "" for text in cell.iter(f"{MAIN}t")
        )

    if value_element is None:
        return ""
    return value_element.text or ""


def _question_sheet_member(archive: ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.find(f"{MAIN}sheets")
    if sheets is None:
        raise SampleExtractionError("Workbook에 시트 목록이 없습니다.")

    sheet = next(
        (item for item in sheets if item.attrib.get("name") == SHEET_NAME),
        None,
    )
    if sheet is None:
        raise SampleExtractionError(f"`{SHEET_NAME}` 시트를 찾을 수 없습니다.")

    relationship_id = sheet.attrib.get(RELATIONSHIP_ID)
    if not relationship_id:
        raise SampleExtractionError(
            f"`{SHEET_NAME}` 시트의 relationship ID가 없습니다."
        )

    relationships = ET.fromstring(
        archive.read("xl/_rels/workbook.xml.rels")
    )
    relationship = next(
        (
            item
            for item in relationships.findall(PACKAGE_RELATIONSHIP)
            if item.attrib.get("Id") == relationship_id
        ),
        None,
    )
    if relationship is None or not relationship.attrib.get("Target"):
        raise SampleExtractionError(
            f"`{SHEET_NAME}` 시트의 관계 대상을 찾을 수 없습니다."
        )

    member = normalize_archive_target(relationship.attrib["Target"])
    if member not in archive.namelist():
        raise SampleExtractionError(
            f"`{SHEET_NAME}` 시트 파일이 XLSX에 없습니다: {member}"
        )
    return member


def read_question_bank(
    workbook_path: Path,
) -> Tuple[List[str], List[Dict[str, object]]]:
    """문제은행 헤더와 253개 원본 행을 읽고 구조를 검증한다."""
    if not workbook_path.is_file():
        raise SampleExtractionError(
            f"원본 Excel이 없습니다: {workbook_path}"
        )

    with ZipFile(workbook_path) as archive:
        bad_member = archive.testzip()
        if bad_member is not None:
            raise SampleExtractionError(
                f"손상된 XLSX 내부 파일입니다: {bad_member}"
            )
        shared_strings = _shared_strings(archive)
        sheet_member = _question_sheet_member(archive)
        worksheet = ET.fromstring(archive.read(sheet_member))
        sheet_data = worksheet.find(f"{MAIN}sheetData")
        if sheet_data is None:
            raise SampleExtractionError(
                f"`{SHEET_NAME}` 시트에 행 데이터가 없습니다."
            )

        parsed_rows: List[Tuple[int, Dict[int, str]]] = []
        for row_element in sheet_data.findall(f"{MAIN}row"):
            row_number_text = row_element.attrib.get("r")
            if not row_number_text:
                raise SampleExtractionError("행 번호가 없는 Excel 행입니다.")
            row_number = int(row_number_text)
            values_by_column: Dict[int, str] = {}
            for cell in row_element.findall(f"{MAIN}c"):
                reference = cell.attrib.get("r", "")
                column_index = _column_index(reference)
                if column_index in values_by_column:
                    raise SampleExtractionError(
                        f"중복 셀 참조입니다: {reference}"
                    )
                values_by_column[column_index] = _cell_value(
                    cell, shared_strings
                )
            parsed_rows.append((row_number, values_by_column))

    if not parsed_rows or parsed_rows[0][0] != 1:
        raise SampleExtractionError("첫 번째 헤더 행을 찾을 수 없습니다.")

    header_values = parsed_rows[0][1]
    headers = [
        header_values.get(index, "")
        for index in range(1, len(EXPECTED_EXCEL_HEADERS) + 1)
    ]
    extra_headers = [
        value
        for index, value in header_values.items()
        if index > len(EXPECTED_EXCEL_HEADERS) and value != ""
    ]
    if headers != EXPECTED_EXCEL_HEADERS or extra_headers:
        raise SampleExtractionError(
            "문제은행 헤더가 예상한 14개 컬럼과 일치하지 않습니다."
        )

    source_rows: List[Dict[str, object]] = []
    for row_number, values in parsed_rows[1:]:
        row_values = [
            values.get(index, "")
            for index in range(1, len(EXPECTED_EXCEL_HEADERS) + 1)
        ]
        if not any(value != "" for value in row_values):
            continue
        source_row: Dict[str, object] = dict(zip(headers, row_values))
        source_row["__excel_row"] = row_number
        source_rows.append(source_row)

    if len(source_rows) != 253:
        raise SampleExtractionError(
            f"문제 데이터는 253행이어야 합니다: {len(source_rows)}행"
        )
    expected_row_numbers = list(range(2, 255))
    actual_row_numbers = [
        int(row["__excel_row"]) for row in source_rows
    ]
    if actual_row_numbers != expected_row_numbers:
        raise SampleExtractionError(
            "문제 데이터의 Excel 행 번호가 2~254 연속 범위와 다릅니다."
        )

    return headers, source_rows


def select_question_sample(
    source_rows: Sequence[Dict[str, object]],
) -> List[Dict[str, object]]:
    """Part 1~4에서 4·4·6·6개의 결정적 표본을 선택한다."""
    rows_by_part: Dict[int, List[Dict[str, object]]] = {
        part: [] for part in PART_QUOTAS
    }
    for row in source_rows:
        try:
            part = int(str(row["Part"]))
        except (KeyError, ValueError) as error:
            raise SampleExtractionError(
                f"잘못된 Part 값입니다: {row.get('Part', '')}"
            ) from error
        if part in rows_by_part:
            rows_by_part[part].append(row)

    if len(rows_by_part[1]) != 4:
        raise SampleExtractionError(
            f"Part 1 원본은 4행이어야 합니다: {len(rows_by_part[1])}행"
        )

    selected = list(rows_by_part[1])
    for part in (2, 3, 4):
        try:
            selected.extend(
                select_diverse_rows(rows_by_part[part], PART_QUOTAS[part])
            )
        except ValueError as error:
            raise SampleExtractionError(
                f"Part {part} 표본 선택 실패: {error}"
            ) from error

    selected.sort(
        key=lambda row: (int(str(row["Part"])), int(row["__excel_row"]))
    )
    _validate_selected_rows(selected)
    return selected


def _validate_selected_rows(
    selected: Sequence[Dict[str, object]],
) -> None:
    if len(selected) != 20:
        raise SampleExtractionError(
            f"추출 결과는 20행이어야 합니다: {len(selected)}행"
        )

    part_counts = Counter(int(str(row["Part"])) for row in selected)
    if dict(part_counts) != PART_QUOTAS:
        raise SampleExtractionError(
            f"Part별 표본 수가 4·4·6·6과 다릅니다: {dict(part_counts)}"
        )

    question_ids = [str(row["ID"]) for row in selected]
    if any(question_id == "" for question_id in question_ids):
        raise SampleExtractionError("빈 question_id가 있습니다.")
    if len(set(question_ids)) != len(question_ids):
        raise SampleExtractionError("중복 question_id가 있습니다.")

    questions = [str(row["중국어 문제/상황"]) for row in selected]
    if any(question == "" for question in questions):
        raise SampleExtractionError("빈 중국어 문제가 있습니다.")
    if len(set(questions)) != len(questions):
        raise SampleExtractionError("선택된 중국어 문제에 완전 중복이 있습니다.")

    if any(int(str(row["Part"])) not in PART_QUOTAS for row in selected):
        raise SampleExtractionError("Part 1~4 범위를 벗어난 표본이 있습니다.")


def build_question_records(
    selected: Sequence[Dict[str, object]],
) -> List[Dict[str, str]]:
    """원본 행을 요구된 questions.csv 필드에 그대로 매핑한다."""
    records: List[Dict[str, str]] = []
    for source_row in selected:
        excel_row = int(source_row["__excel_row"])
        record = {
            "question_id": str(source_row["ID"]),
            "source_id": "src-001",
            "source_locator": (
                f"{SHEET_NAME}!A{excel_row}:N{excel_row}"
            ),
            "part": str(source_row["Part"]),
            "question_type": str(source_row["유형"]),
            "question_zh": str(source_row["중국어 문제/상황"]),
            "question_pinyin": str(source_row["병음"]),
            "question_ko": str(source_row["한국어 뜻/상황"]),
            "source_grade": str(source_row["자료 등급"]),
            "source_name": str(source_row["출처"]),
            "source_url": str(source_row["출처 URL"]),
            "originality": str(source_row["원문성"]),
            "answer_point": str(source_row["답변 포인트"]),
            "question_status": "raw",
            "normalization_notes": "",
        }
        records.append(record)

    _validate_records_against_source(selected, records)
    return records


def _validate_records_against_source(
    selected: Sequence[Dict[str, object]],
    records: Sequence[Dict[str, str]],
) -> None:
    if len(selected) != len(records):
        raise SampleExtractionError("원본 표본과 CSV 레코드 수가 다릅니다.")

    field_mapping = {
        "question_id": "ID",
        "part": "Part",
        "question_type": "유형",
        "question_zh": "중국어 문제/상황",
        "question_pinyin": "병음",
        "question_ko": "한국어 뜻/상황",
        "source_grade": "자료 등급",
        "source_name": "출처",
        "source_url": "출처 URL",
        "originality": "원문성",
        "answer_point": "답변 포인트",
    }
    for source_row, record in zip(selected, records):
        if list(record) != QUESTION_HEADERS:
            raise SampleExtractionError(
                "questions.csv 컬럼 순서가 요구사항과 다릅니다."
            )
        if set(record) & PERSONAL_EXCEL_HEADERS:
            raise SampleExtractionError(
                "개인 학습 컬럼이 questions.csv에 포함됐습니다."
            )
        for output_field, source_field in field_mapping.items():
            if record[output_field] != str(source_row[source_field]):
                raise SampleExtractionError(
                    f"원본과 다른 값입니다: {record['question_id']} "
                    f"{output_field}"
                )
        expected_locator = (
            f"{SHEET_NAME}!A{source_row['__excel_row']}:"
            f"N{source_row['__excel_row']}"
        )
        if record["source_locator"] != expected_locator:
            raise SampleExtractionError(
                f"source_locator가 실제 행과 다릅니다: "
                f"{record['question_id']}"
            )

    _validate_question_records(records)


def _validate_question_records(
    records: Sequence[Dict[str, str]],
) -> None:
    if len(records) != 20:
        raise SampleExtractionError(
            f"questions.csv 데이터는 20행이어야 합니다: {len(records)}행"
        )
    for record in records:
        if list(record) != QUESTION_HEADERS:
            raise SampleExtractionError(
                "questions.csv 레코드의 컬럼 또는 순서가 잘못됐습니다."
            )
        if not LOCATOR_RE.fullmatch(record["source_locator"]):
            raise SampleExtractionError(
                f"잘못된 source_locator입니다: {record['source_locator']}"
            )

    ids = [record["question_id"] for record in records]
    questions = [record["question_zh"] for record in records]
    if any(not question_id for question_id in ids):
        raise SampleExtractionError("questions.csv에 빈 question_id가 있습니다.")
    if len(set(ids)) != len(ids):
        raise SampleExtractionError("questions.csv에 중복 question_id가 있습니다.")
    if len(set(questions)) != len(questions):
        raise SampleExtractionError("questions.csv에 완전 중복 문제가 있습니다.")

    try:
        part_counts = Counter(int(record["part"]) for record in records)
    except ValueError as error:
        raise SampleExtractionError(
            "questions.csv에 정수가 아닌 Part가 있습니다."
        ) from error
    if dict(part_counts) != PART_QUOTAS:
        raise SampleExtractionError(
            f"questions.csv Part별 수가 다릅니다: {dict(part_counts)}"
        )


def count_blank_fields(
    records: Sequence[Dict[str, str]],
) -> Dict[str, int]:
    """보고 대상 필드의 빈 문자열 수를 센다."""
    return {
        field: sum(record[field] == "" for record in records)
        for field in QUALITY_FIELDS
    }


def _stage_csv(
    destination: Path,
    headers: Sequence[str],
    records: Sequence[Dict[str, str]],
) -> Path:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.",
        suffix=".tmp",
        dir=destination.parent,
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(
            descriptor, "w", encoding="utf-8", newline=""
        ) as handle:
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
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    return temporary_path


def _validate_staged_csv(
    path: Path,
    headers: Sequence[str],
    expected_records: Sequence[Dict[str, str]],
) -> None:
    if path.read_bytes().startswith(b"\xef\xbb\xbf"):
        raise SampleExtractionError(f"UTF-8 BOM이 포함됐습니다: {path}")
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != list(headers):
            raise SampleExtractionError(
                f"CSV 헤더 검증에 실패했습니다: {path}"
            )
        actual_records = list(reader)
    if actual_records != list(expected_records):
        raise SampleExtractionError(
            f"CSV 데이터 재검증에 실패했습니다: {path}"
        )


def write_outputs(
    output_dir: Path,
    question_records: Sequence[Dict[str, str]],
    source_path: Path | None = None,
    expected_source_sha: str | None = None,
) -> Tuple[Path, Path]:
    """두 CSV를 임시 파일에서 검증한 뒤 정상 결과로 교체한다."""
    _validate_question_records(question_records)
    output_dir.mkdir(parents=True, exist_ok=True)
    questions_path = output_dir / "questions.csv"
    model_answers_path = output_dir / "model_answers.csv"
    staged_paths: List[Path] = []

    try:
        staged_questions = _stage_csv(
            questions_path, QUESTION_HEADERS, question_records
        )
        staged_paths.append(staged_questions)
        staged_answers = _stage_csv(
            model_answers_path, MODEL_ANSWER_HEADERS, []
        )
        staged_paths.append(staged_answers)

        _validate_staged_csv(
            staged_questions, QUESTION_HEADERS, question_records
        )
        _validate_staged_csv(
            staged_answers, MODEL_ANSWER_HEADERS, []
        )
        if source_path is not None and expected_source_sha is not None:
            actual_source_sha = sha256_file(source_path)
            if actual_source_sha != expected_source_sha:
                raise SampleExtractionError(
                    "CSV 교체 전 원본 Excel SHA-256이 변경됐습니다."
                )

        os.replace(staged_questions, questions_path)
        staged_paths.remove(staged_questions)
        os.replace(staged_answers, model_answers_path)
        staged_paths.remove(staged_answers)
    finally:
        for path in staged_paths:
            path.unlink(missing_ok=True)

    return questions_path, model_answers_path


def run() -> Tuple[List[Dict[str, str]], Dict[str, int]]:
    """표본을 추출·검증하고 CSV 두 개를 생성한다."""
    if not SOURCE_PATH.is_file():
        raise SampleExtractionError(f"원본 Excel이 없습니다: {SOURCE_PATH}")
    source_sha_before = sha256_file(SOURCE_PATH)
    if source_sha_before != EXPECTED_SOURCE_SHA256:
        raise SampleExtractionError(
            "원본 Excel SHA-256이 문서에 기록된 값과 다릅니다: "
            f"{source_sha_before}"
        )

    _, source_rows = read_question_bank(SOURCE_PATH)
    selected = select_question_sample(source_rows)
    records = build_question_records(selected)
    blank_counts = count_blank_fields(records)
    questions_path, model_answers_path = write_outputs(
        OUTPUT_DIR,
        records,
        source_path=SOURCE_PATH,
        expected_source_sha=source_sha_before,
    )

    source_sha_after = sha256_file(SOURCE_PATH)
    if source_sha_after != source_sha_before:
        raise SampleExtractionError(
            "작업 전후 원본 Excel SHA-256이 다릅니다."
        )

    part_counts = Counter(record["part"] for record in records)
    print(f"원본 파일 경로: {SOURCE_RELATIVE_PATH.as_posix()}")
    print(f"원본 SHA-256: {source_sha_after}")
    print(f"추출 문제 수: {len(records)}")
    print(
        "Part별 문제 수: "
        + ", ".join(
            f"Part {part}={part_counts[str(part)]}"
            for part in PART_QUOTAS
        )
    )
    print(
        "선택된 문제 ID: "
        + ", ".join(record["question_id"] for record in records)
    )
    print("빈 필드 수:")
    for field, count in blank_counts.items():
        print(f"  {field}: {count}")
    print(
        "출력 파일 경로: "
        f"{questions_path.relative_to(ROOT_DIR).as_posix()}"
    )
    print(
        "출력 파일 경로: "
        f"{model_answers_path.relative_to(ROOT_DIR).as_posix()}"
    )

    return records, blank_counts


def main() -> int:
    try:
        run()
    except (
        SampleExtractionError,
        BadZipFile,
        ET.ParseError,
        OSError,
        ValueError,
    ) as error:
        print(f"오류: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

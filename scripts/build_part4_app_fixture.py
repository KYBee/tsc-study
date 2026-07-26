#!/usr/bin/env python3
"""Build and validate the deterministic Part 4 raw development fixture."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from typing import Any, Sequence
import warnings


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data/working/question-sample/questions.csv"
MODEL_ANSWERS_PATH = (
    ROOT / "data/working/question-sample/model_answers.csv"
)
SOURCE_METADATA_PATH = (
    ROOT / "sources/src-001__tsc-question-bank-workbook.md"
)
DEFAULT_OUTPUT_DIR = ROOT / "data/working/app-fixtures/part4"

TARGET_IDS = (
    "P4-001",
    "P4-002",
    "P4-003",
    "P4-006",
    "P4-036",
    "P4-039",
)
DATASET_ID = "part4-raw-development-fixture-v1"
SOURCE_ID = "src-001"

QUESTION_CSV_FIELDS = (
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
)
MODEL_ANSWER_CSV_FIELDS = (
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
)
ENTITY_FIELDS = {
    "questions": {
        "question_id",
        "part",
        "question_type",
        "question_zh",
        "question_pinyin",
        "question_ko",
        "question_status",
        "normalization_notes",
        "tags",
    },
    "answer_points": {
        "answer_point_id",
        "question_id",
        "point_type",
        "content",
        "sequence",
        "point_status",
        "source_reference_ids",
        "notes",
    },
    "sources": {
        "source_id",
        "title",
        "source_type",
        "provenance_status",
        "creator_or_provider",
        "original_file_name",
        "file_ref",
        "acquired_date",
        "rights_status",
        "notes",
    },
    "source_references": {
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
    },
}
ENTITY_FILES = {
    "questions": "questions.json",
    "answer_points": "answer-points.json",
    "sources": "sources.json",
    "source_references": "source-references.json",
    "model_answers": "model-answers.json",
}
HASHED_FILES = tuple(ENTITY_FILES.values()) + ("README.md",)
OUTPUT_FILES = HASHED_FILES + ("manifest.json",)


class FixtureError(Exception):
    """The fixture input or output does not satisfy its contract."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise FixtureError(message)


def _sha256_bytes(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def _sha256_file(path: Path) -> str:
    try:
        return _sha256_bytes(path.read_bytes())
    except OSError as error:
        raise FixtureError(f"cannot read {path}: {error}") from error


def _json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")


def _manifest_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return resolved.as_posix()


def _read_questions(path: Path) -> list[dict[str, str]]:
    try:
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames or []
            _require(
                len(fieldnames) == len(set(fieldnames)),
                f"{path} has duplicate header fields",
            )
            missing = [
                field for field in QUESTION_CSV_FIELDS if field not in fieldnames
            ]
            _require(
                not missing,
                f"{path} is missing fields: {', '.join(missing)}",
            )
            rows = list(reader)
    except (OSError, UnicodeError, csv.Error) as error:
        raise FixtureError(f"cannot read {path}: {error}") from error

    selected: dict[str, dict[str, str]] = {}
    for line_number, row in enumerate(rows, start=2):
        _require(
            None not in row,
            f"{path}:{line_number} has more values than its header",
        )
        _require(
            all(isinstance(row.get(field), str) for field in QUESTION_CSV_FIELDS),
            f"{path}:{line_number} has a missing value",
        )
        question_id = row["question_id"]
        if question_id in TARGET_IDS:
            _require(
                question_id not in selected,
                f"{path} has duplicate target ID {question_id}",
            )
            selected[question_id] = row

    missing_ids = [item for item in TARGET_IDS if item not in selected]
    _require(
        not missing_ids,
        f"{path} is missing target IDs: {', '.join(missing_ids)}",
    )
    result = [selected[question_id] for question_id in TARGET_IDS]
    for row in result:
        question_id = row["question_id"]
        _require(row["part"] == "4", f"{question_id} must remain Part 4")
        _require(
            row["question_status"] == "raw",
            f"{question_id} must remain raw",
        )
        _require(
            row["source_id"] == SOURCE_ID,
            f"{question_id} must reference {SOURCE_ID}",
        )
        _require(
            row["answer_point"] != "",
            f"{question_id} must retain its answer point",
        )
    return result


def _read_model_answer_count(path: Path) -> int:
    try:
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            _require(
                tuple(reader.fieldnames or ()) == MODEL_ANSWER_CSV_FIELDS,
                f"{path} does not have the expected header",
            )
            rows = list(reader)
    except (OSError, UnicodeError, csv.Error) as error:
        raise FixtureError(f"cannot read {path}: {error}") from error
    _require(not rows, f"{path} must contain zero answer records")
    return 0


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) > 1 and value.startswith("`") and value.endswith("`"):
        return value[1:-1]
    return value


def _read_source(path: Path) -> dict[str, str]:
    try:
        markdown = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise FixtureError(f"cannot read {path}: {error}") from error

    values: dict[str, str] = {}
    for line in markdown.splitlines():
        stripped = line.strip()
        if not (stripped.startswith("|") and stripped.endswith("|")):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) == 2:
            values[_unquote(cells[0])] = _unquote(cells[1])

    required = (
        "source_id",
        "title",
        "source_type",
        "provenance_status",
        "original_file_name",
        "file_ref",
        "rights_status",
    )
    missing = [field for field in required if not values.get(field)]
    _require(
        not missing,
        f"{path} is missing metadata: {', '.join(missing)}",
    )
    _require(values["source_id"] == SOURCE_ID, f"{path} must describe src-001")
    _require(
        values["source_type"]
        in {
            "course_analysis",
            "excel",
            "pdf",
            "instructor_correction",
            "self_created",
            "other",
        },
        f"{path} has an undocumented source_type",
    )
    _require(
        values["provenance_status"]
        in {"verified_source", "unverified_source", "self_created"},
        f"{path} has an undocumented provenance_status",
    )
    _require(
        values["rights_status"]
        in {"review_needed", "private_use", "public_allowed", "restricted"},
        f"{path} has an undocumented rights_status",
    )

    notes = [
        line.strip()[2:].replace("`", "")
        for line in markdown.splitlines()
        if line.strip().startswith("- ")
        and (
            "별도 확인이 필요" in line
            or "rights_status: review_needed" in line
        )
    ]
    _require(
        notes and any("review_needed" in note for note in notes),
        f"{path} has no clear review-needed statement",
    )
    return {
        "source_id": values["source_id"],
        "title": values["title"],
        "source_type": values["source_type"],
        "provenance_status": values["provenance_status"],
        "creator_or_provider": values.get("creator_or_provider", ""),
        "original_file_name": values["original_file_name"],
        "file_ref": values["file_ref"],
        "acquired_date": values.get("acquired_date", ""),
        "rights_status": values["rights_status"],
        "notes": " ".join(notes),
    }


def _answer_point_id(question_id: str) -> str:
    return f"ap-{question_id}-001"


def _question_reference_id(question_id: str) -> str:
    return f"sr-question-{question_id}-extracted"


def _answer_reference_id(question_id: str) -> str:
    return f"sr-answer-point-{_answer_point_id(question_id)}-extracted"


def _reference(
    row: dict[str, str], target_type: str
) -> dict[str, str]:
    question_id = row["question_id"]
    is_question = target_type == "question"
    return {
        "source_reference_id": (
            _question_reference_id(question_id)
            if is_question
            else _answer_reference_id(question_id)
        ),
        "target_type": target_type,
        "target_id": (
            question_id if is_question else _answer_point_id(question_id)
        ),
        "source_id": row["source_id"],
        "source_locator": row["source_locator"],
        "relationship_kind": "extracted_from",
        "claimed_source_name": row["source_name"],
        "claimed_source_url": row["source_url"],
        "source_grade": row["source_grade"],
        "originality": row["originality"],
        "verification_status": "unverified",
        "notes": "",
    }


def _records(
    rows: list[dict[str, str]], source: dict[str, str]
) -> dict[str, list[dict[str, Any]]]:
    questions = [
        {
            "question_id": row["question_id"],
            "part": 4,
            "question_type": row["question_type"],
            "question_zh": row["question_zh"],
            "question_pinyin": row["question_pinyin"],
            "question_ko": row["question_ko"],
            "question_status": row["question_status"],
            "normalization_notes": row["normalization_notes"],
            "tags": [],
        }
        for row in rows
    ]
    answer_points = [
        {
            "answer_point_id": _answer_point_id(row["question_id"]),
            "question_id": row["question_id"],
            "point_type": "unclassified",
            "content": row["answer_point"],
            "sequence": 1,
            "point_status": "raw",
            "source_reference_ids": [
                _answer_reference_id(row["question_id"])
            ],
            "notes": "",
        }
        for row in rows
    ]
    references = [
        _reference(row, target_type)
        for row in rows
        for target_type in ("question", "answer_point")
    ]
    references.sort(key=lambda item: item["source_reference_id"])
    return {
        "questions": questions,
        "answer_points": answer_points,
        "sources": [source],
        "source_references": references,
        "model_answers": [],
    }


def _validate_records(
    records: dict[str, list[dict[str, Any]]],
    rows: list[dict[str, str]],
    source: dict[str, str],
) -> None:
    expected = _records(rows, source)
    _require(records == expected, "fixture entities changed from their inputs")
    expected_counts = {
        "questions": 6,
        "answer_points": 6,
        "sources": 1,
        "source_references": 12,
        "model_answers": 0,
    }
    for entity, count in expected_counts.items():
        _require(
            isinstance(records.get(entity), list)
            and len(records[entity]) == count,
            f"{entity} count must be {count}",
        )
    for entity, fields in ENTITY_FIELDS.items():
        _require(
            all(set(record) == fields for record in records[entity]),
            f"{entity} has non-canonical fields",
        )

    question_ids = [item["question_id"] for item in records["questions"]]
    answer_point_ids = {
        item["answer_point_id"] for item in records["answer_points"]
    }
    source_ids = {item["source_id"] for item in records["sources"]}
    reference_ids = {
        item["source_reference_id"]
        for item in records["source_references"]
    }
    _require(
        question_ids == list(TARGET_IDS)
        and len(question_ids) == len(set(question_ids)),
        "Question identity/order must use the six canonical IDs",
    )
    for point in records["answer_points"]:
        _require(
            point["question_id"] in question_ids
            and point["source_reference_ids"][0] in reference_ids,
            f"{point['answer_point_id']} has a broken reference",
        )
    for reference in records["source_references"]:
        target_ids = (
            set(question_ids)
            if reference["target_type"] == "question"
            else answer_point_ids
        )
        _require(
            reference["target_type"] in {"question", "answer_point"}
            and reference["target_id"] in target_ids
            and reference["source_id"] in source_ids
            and reference["relationship_kind"] == "extracted_from"
            and reference["verification_status"] == "unverified",
            f"{reference['source_reference_id']} has a broken relationship",
        )


README = """# Part 4 raw development fixture

This directory contains a raw six-question development fixture for the first
Part 4 vertical slice. It is not reviewed, not production, and not public or
publication-ready data.

The source CSV is unchanged. These files are deterministic derivatives for
development only, and this fixture is not a full extraction of the workbook.

## Commands

Build or replace the default fixture:

```sh
python3 scripts/build_part4_app_fixture.py
```

Validate the existing default fixture without rewriting it:

```sh
python3 scripts/build_part4_app_fixture.py --validate-only
```

## File roles

- `questions.json`: six raw canonical-shaped Question records.
- `answer-points.json`: one raw, unclassified AnswerPoint per Question.
- `sources.json`: the actual `src-001` workbook metadata record.
- `source-references.json`: extracted-from relationships for Questions and
  AnswerPoints; workbook source claims remain unverified.
- `model-answers.json`: an empty array because the source CSV has zero answers.
- `manifest.json`: stable IDs, counts, input hashes, and generated artifact
  hashes. It excludes its own hash because an embedded self-hash is impossible.

Review the language, provenance, claimed URLs, and rights before any production
or public use.
"""


def _manifest(
    records: dict[str, list[dict[str, Any]]],
    generated_hashes: dict[str, str],
    questions_path: Path,
    model_answers_path: Path,
    source_metadata_path: Path,
    model_answer_count: int,
) -> dict[str, Any]:
    return {
        "dataset_id": DATASET_ID,
        "dataset_status": "development_fixture",
        "source_file": {
            "path": _manifest_path(questions_path),
            "sha256": _sha256_file(questions_path),
        },
        "model_answer_source_file": {
            "path": _manifest_path(model_answers_path),
            "sha256": _sha256_file(model_answers_path),
            "record_count": model_answer_count,
        },
        "source_metadata_file": {
            "path": _manifest_path(source_metadata_path),
            "sha256": _sha256_file(source_metadata_path),
        },
        "generated_files": generated_hashes,
        "manifest_hash_policy": (
            "manifest.json is excluded because an embedded self-hash would "
            "change the manifest and cannot be stable."
        ),
        "counts": {
            "question": len(records["questions"]),
            "answer_point": len(records["answer_points"]),
            "source": len(records["sources"]),
            "source_reference": len(records["source_references"]),
            "model_answer": len(records["model_answers"]),
        },
        "ids": {
            "question": [item["question_id"] for item in records["questions"]],
            "answer_point": [
                item["answer_point_id"] for item in records["answer_points"]
            ],
            "source": [item["source_id"] for item in records["sources"]],
            "source_reference": [
                item["source_reference_id"]
                for item in records["source_references"]
            ],
            "model_answer": [],
        },
    }


def _bundle(
    questions_path: Path,
    model_answers_path: Path,
    source_metadata_path: Path,
) -> tuple[
    dict[str, bytes],
    dict[str, list[dict[str, Any]]],
    list[dict[str, str]],
    dict[str, str],
]:
    rows = _read_questions(questions_path)
    model_answer_count = _read_model_answer_count(model_answers_path)
    source = _read_source(source_metadata_path)
    records = _records(rows, source)
    _validate_records(records, rows, source)

    contents = {
        file_name: _json_bytes(records[entity])
        for entity, file_name in ENTITY_FILES.items()
    }
    contents["README.md"] = README.encode("utf-8")
    generated_hashes = {
        file_name: _sha256_bytes(contents[file_name])
        for file_name in HASHED_FILES
    }
    contents["manifest.json"] = _json_bytes(
        _manifest(
            records,
            generated_hashes,
            questions_path,
            model_answers_path,
            source_metadata_path,
            model_answer_count,
        )
    )
    return contents, records, rows, source


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise FixtureError(f"cannot load {path}: {error}") from error


def _validate_output(
    output_dir: Path,
    expected_contents: dict[str, bytes],
    expected_records: dict[str, list[dict[str, Any]]],
    rows: list[dict[str, str]],
    source: dict[str, str],
) -> None:
    _require(output_dir.is_dir(), f"fixture does not exist: {output_dir}")
    _require(
        {path.name for path in output_dir.iterdir()} == set(OUTPUT_FILES),
        f"{output_dir} has missing or unexpected files",
    )
    for file_name, expected in expected_contents.items():
        try:
            actual = (output_dir / file_name).read_bytes()
        except OSError as error:
            raise FixtureError(f"cannot read {file_name}: {error}") from error
        _require(
            actual == expected,
            f"{file_name} is not the deterministic canonical output",
        )
        _require(
            actual.endswith(b"\n") and b"\r" not in actual,
            f"{file_name} must use LF and a trailing newline",
        )

    actual_records = {
        entity: _load_json(output_dir / file_name)
        for entity, file_name in ENTITY_FILES.items()
    }
    _validate_records(actual_records, rows, source)
    _require(
        actual_records == expected_records,
        "generated entities do not match their validated build",
    )

    manifest = _load_json(output_dir / "manifest.json")
    _require(
        isinstance(manifest, dict)
        and manifest.get("dataset_id") == DATASET_ID
        and manifest.get("dataset_status") == "development_fixture"
        and "generated_at" not in manifest,
        "manifest identity/status is invalid",
    )
    _require(
        manifest.get("counts")
        == {
            "question": 6,
            "answer_point": 6,
            "source": 1,
            "source_reference": 12,
            "model_answer": 0,
        },
        "manifest counts are invalid",
    )
    generated_files = manifest.get("generated_files")
    _require(
        isinstance(generated_files, dict)
        and list(generated_files) == list(HASHED_FILES)
        and "manifest.json" not in generated_files,
        "manifest generated_files contract is invalid",
    )
    for file_name in HASHED_FILES:
        _require(
            generated_files[file_name]
            == _sha256_file(output_dir / file_name),
            f"manifest hash mismatch for {file_name}",
        )
    _require(
        "manifest.json" in str(manifest.get("manifest_hash_policy", ""))
        and "self-hash" in str(manifest.get("manifest_hash_policy", "")),
        "manifest does not explain its self-hash exclusion",
    )


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _path_for_symlink_check(unresolved: Path) -> Path:
    for trusted_base in (Path(tempfile.gettempdir()), ROOT):
        absolute_base = Path(os.path.abspath(str(trusted_base)))
        if _is_within(unresolved, absolute_base):
            return absolute_base.resolve() / unresolved.relative_to(absolute_base)
    return unresolved


def _output_path(path: Path, protected_inputs: Sequence[Path]) -> Path:
    requested = Path(path).expanduser()
    unresolved = Path(os.path.abspath(str(requested)))
    symlink_check_path = _path_for_symlink_check(unresolved)
    _require(
        not any(
            component.is_symlink()
            for component in (symlink_check_path, *symlink_check_path.parents)
        ),
        f"refusing to use a symlinked output path: {requested}",
    )
    resolved = requested.resolve()
    _require(
        resolved not in {ROOT.resolve(), Path(resolved.anchor)},
        "refusing to replace a repository or filesystem root",
    )
    _require(
        not resolved.exists() or resolved.is_dir(),
        f"output is not a directory: {resolved}",
    )
    for protected_input in protected_inputs:
        protected = Path(protected_input).resolve()
        _require(
            resolved not in {protected, protected.parent}
            and not _is_within(protected, resolved)
            and not _is_within(resolved, protected.parent),
            f"output contains or replaces protected input: {protected}",
        )
    return resolved


def _assert_builder_owned(output_dir: Path) -> None:
    _require(
        {path.name for path in output_dir.iterdir()} == set(OUTPUT_FILES),
        f"refusing to replace unknown directory: {output_dir}",
    )
    manifest = _load_json(output_dir / "manifest.json")
    expected_reference_ids = sorted(
        [
            reference_id
            for question_id in TARGET_IDS
            for reference_id in (
                _question_reference_id(question_id),
                _answer_reference_id(question_id),
            )
        ]
    )
    _require(
        isinstance(manifest, dict)
        and manifest.get("dataset_id") == DATASET_ID
        and manifest.get("dataset_status") == "development_fixture"
        and manifest.get("counts")
        == {
            "question": 6,
            "answer_point": 6,
            "source": 1,
            "source_reference": 12,
            "model_answer": 0,
        }
        and manifest.get("ids")
        == {
            "question": list(TARGET_IDS),
            "answer_point": [
                _answer_point_id(question_id) for question_id in TARGET_IDS
            ],
            "source": [SOURCE_ID],
            "source_reference": expected_reference_ids,
            "model_answer": [],
        },
        f"refusing to replace unrecognized fixture: {output_dir}",
    )
    generated_files = manifest.get("generated_files")
    _require(
        isinstance(generated_files, dict)
        and list(generated_files) == list(HASHED_FILES)
        and all(
            generated_files[file_name]
            == _sha256_file(output_dir / file_name)
            for file_name in HASHED_FILES
        ),
        f"refusing to replace modified fixture: {output_dir}",
    )
    _require(
        all(
            isinstance(_load_json(output_dir / file_name), list)
            for file_name in ENTITY_FILES.values()
        ),
        f"refusing to replace malformed fixture: {output_dir}",
    )


def _cleanup_temporary_path(
    path: Path, output_dir: Path, kind: str
) -> None:
    prefix_kind = "build" if kind == "staging" else kind
    expected_prefix = f".{output_dir.name}.{prefix_kind}-"
    if (
        path.parent != output_dir.parent
        or not path.name.startswith(expected_prefix)
        or path == output_dir
        or path.is_symlink()
    ):
        warnings.warn(
            f"refusing uncontrolled {kind} cleanup path: {path}",
            RuntimeWarning,
        )
        return
    try:
        shutil.rmtree(path)
    except OSError as error:
        warnings.warn(
            f"{kind} cleanup failed for {path}: {error}",
            RuntimeWarning,
        )


def _swap(staging: Path, output_dir: Path) -> None:
    backup: Path | None = None
    if output_dir.exists():
        backup = Path(
            tempfile.mkdtemp(
                prefix=f".{output_dir.name}.backup-",
                dir=str(output_dir.parent),
            )
        )
        backup.rmdir()
        os.replace(output_dir, backup)
    try:
        os.replace(staging, output_dir)
    except OSError as error:
        if backup is not None and backup.exists() and not output_dir.exists():
            try:
                os.replace(backup, output_dir)
            except OSError as rollback_error:
                raise FixtureError(
                    f"fixture swap and rollback failed: {rollback_error}"
                ) from error
        raise FixtureError(f"fixture swap failed: {error}") from error
    if backup is not None:
        _cleanup_temporary_path(backup, output_dir, "backup")


def _counts(
    records: dict[str, list[dict[str, Any]]]
) -> dict[str, int]:
    return {
        "question": len(records["questions"]),
        "answer_point": len(records["answer_points"]),
        "source": len(records["sources"]),
        "source_reference": len(records["source_references"]),
        "model_answer": len(records["model_answers"]),
    }


def build_fixture(
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    *,
    questions_path: Path = QUESTIONS_PATH,
    model_answers_path: Path = MODEL_ANSWERS_PATH,
    source_metadata_path: Path = SOURCE_METADATA_PATH,
) -> dict[str, int]:
    questions_path = Path(questions_path)
    model_answers_path = Path(model_answers_path)
    source_metadata_path = Path(source_metadata_path)
    output_dir = _output_path(
        output_dir,
        (questions_path, model_answers_path, source_metadata_path),
    )
    if output_dir.exists():
        _assert_builder_owned(output_dir)
    contents, records, rows, source = _bundle(
        questions_path,
        model_answers_path,
        source_metadata_path,
    )
    try:
        output_dir.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(
            tempfile.mkdtemp(
                prefix=f".{output_dir.name}.build-",
                dir=str(output_dir.parent),
            )
        )
    except OSError as error:
        raise FixtureError(f"cannot create staging directory: {error}") from error

    try:
        for file_name in OUTPUT_FILES:
            (staging / file_name).write_bytes(contents[file_name])
        _validate_output(staging, contents, records, rows, source)
        _swap(staging, output_dir)
    except Exception:
        if staging.exists():
            _cleanup_temporary_path(staging, output_dir, "staging")
        raise
    return _counts(records)


def validate_fixture(
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    *,
    questions_path: Path = QUESTIONS_PATH,
    model_answers_path: Path = MODEL_ANSWERS_PATH,
    source_metadata_path: Path = SOURCE_METADATA_PATH,
) -> dict[str, int]:
    questions_path = Path(questions_path)
    model_answers_path = Path(model_answers_path)
    source_metadata_path = Path(source_metadata_path)
    output_dir = _output_path(
        output_dir,
        (questions_path, model_answers_path, source_metadata_path),
    )
    contents, records, rows, source = _bundle(
        questions_path,
        model_answers_path,
        source_metadata_path,
    )
    _validate_output(output_dir, contents, records, rows, source)
    return _counts(records)


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build or validate the Part 4 raw development fixture."
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="validate existing output without rewriting it",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="fixture output directory",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        if args.validate_only:
            counts = validate_fixture(args.output_dir)
            action = "Validated"
        else:
            counts = build_fixture(args.output_dir)
            action = "Built"
    except (FixtureError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(
        f"{action} Part 4 fixture at {Path(args.output_dir).resolve()} "
        f"(questions={counts['question']}, "
        f"answer_points={counts['answer_point']}, "
        f"sources={counts['source']}, "
        f"source_references={counts['source_reference']}, "
        f"model_answers={counts['model_answer']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

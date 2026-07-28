#!/usr/bin/env python3
"""Promote explicitly approved, non-stale Part 4 records to reviewed JSON."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PART4_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "part4-full"
REVIEW_FIXTURE = ROOT / "data" / "working" / "review-fixtures" / "part4-v1"
DEFAULT_OUTPUT = ROOT / "data" / "reviewed" / "part4-v1"

REVIEW_DATASET_ID = "part4-review-fixture-v1"
REVIEW_SCHEMA_VERSION = "part4-review-decision-v1"
REVIEWED_DATASET_ID = "part4-reviewed-v1"
TARGET_IDS = [f"P4-{number:03d}" for number in range(1, 51)]
REQUIRED_FIELDS = [
    "chinese_text",
    "pinyin",
    "korean_translation",
    "question_type",
    "answer_point",
    "source_locator",
    "claimed_source_metadata",
]
FIELD_STATUSES = {"approved", "needs_fix", "not_checked"}
OVERALL_STATUSES = {"approved", "needs_fix", "deferred"}
DECISION_KEYS = {
    "review_decision_id",
    "dataset_id",
    "question_id",
    "field_decisions",
    "overall_status",
    "reviewer_note",
    "reviewed_by",
    "reviewed_at",
    "source_question_hash",
    "source_answer_point_hash",
    "decision_version",
}
OUTPUT_FILES = [
    "questions.json",
    "answer-points.json",
    "sources.json",
    "source-references.json",
    "review-decisions.json",
    "excluded-items.json",
    "README.md",
    "manifest.json",
]


class PromotionError(RuntimeError):
    """Raised when a decision export or promoted dataset is invalid."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def relative_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.name


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as cause:
        raise PromotionError(f"required file is missing: {relative_path(path)}") from cause
    except json.JSONDecodeError as cause:
        raise PromotionError(f"invalid JSON: {relative_path(path)}: {cause}") from cause


def valid_datetime(value: Any) -> bool:
    if not isinstance(value, str) or len(value) > 64:
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def valid_hash(value: Any) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 64
        and all(character in "0123456789abcdef" for character in value)
    )


def validate_text(value: Any, label: str, maximum: int) -> str:
    if not isinstance(value, str) or len(value) > maximum:
        raise PromotionError(f"{label} must be a string no longer than {maximum}")
    return value


def validate_decision_export(path: Path) -> dict[str, Any]:
    export = read_json(path)
    if not isinstance(export, dict) or set(export) != {
        "dataset_id",
        "review_schema_version",
        "exported_at",
        "reviewer",
        "decisions",
    }:
        raise PromotionError("decision export has an invalid top-level structure")
    if export["dataset_id"] != REVIEW_DATASET_ID:
        raise PromotionError("decision export dataset_id does not match")
    if export["review_schema_version"] != REVIEW_SCHEMA_VERSION:
        raise PromotionError("decision export schema version does not match")
    if not valid_datetime(export["exported_at"]):
        raise PromotionError("decision export exported_at is invalid")
    validate_text(export["reviewer"], "reviewer", 200)
    decisions = export["decisions"]
    if not isinstance(decisions, list) or len(decisions) > 50:
        raise PromotionError("decisions must be an array of at most 50 records")

    seen: set[str] = set()
    for index, decision in enumerate(decisions):
        label = f"decisions[{index}]"
        if not isinstance(decision, dict) or set(decision) != DECISION_KEYS:
            raise PromotionError(f"{label} has an invalid structure")
        question_id = decision["question_id"]
        if question_id not in TARGET_IDS:
            raise PromotionError(f"{label}.question_id is unknown")
        if question_id in seen:
            raise PromotionError(f"duplicate decision for {question_id}")
        seen.add(question_id)
        if decision["review_decision_id"] != f"p4-review-decision-{question_id}":
            raise PromotionError(f"{label}.review_decision_id is invalid")
        if decision["dataset_id"] != REVIEW_DATASET_ID:
            raise PromotionError(f"{label}.dataset_id is invalid")
        fields = decision["field_decisions"]
        if not isinstance(fields, dict) or set(fields) != set(REQUIRED_FIELDS):
            raise PromotionError(f"{label}.field_decisions has invalid fields")
        if any(value not in FIELD_STATUSES for value in fields.values()):
            raise PromotionError(f"{label}.field_decisions contains an invalid enum")
        overall = decision["overall_status"]
        if overall not in OVERALL_STATUSES:
            raise PromotionError(f"{label}.overall_status is invalid")
        note = validate_text(decision["reviewer_note"], f"{label}.reviewer_note", 10000)
        validate_text(decision["reviewed_by"], f"{label}.reviewed_by", 200)
        if not valid_datetime(decision["reviewed_at"]):
            raise PromotionError(f"{label}.reviewed_at is invalid")
        if not valid_hash(decision["source_question_hash"]) or not valid_hash(
            decision["source_answer_point_hash"]
        ):
            raise PromotionError(f"{label} source hash is invalid")
        if decision["decision_version"] != 1:
            raise PromotionError(f"{label}.decision_version is invalid")
        if overall == "approved" and any(
            value != "approved" for value in fields.values()
        ):
            raise PromotionError(f"{label}: approved requires every field approved")
        if overall == "needs_fix":
            if "needs_fix" not in fields.values():
                raise PromotionError(f"{label}: needs_fix requires a needs_fix field")
            if not note.strip():
                raise PromotionError(f"{label}: needs_fix requires reviewer_note")
        if overall == "deferred" and "needs_fix" in fields.values():
            raise PromotionError(
                f"{label}: deferred cannot contain a needs_fix field"
            )
    return export


def classify(
    item: dict[str, Any], decision: dict[str, Any] | None
) -> tuple[bool, str, bool, list[str]]:
    if decision is None:
        return False, "no_decision", False, REQUIRED_FIELDS
    stale = (
        decision["source_question_hash"] != item["source_question_hash"]
        or decision["source_answer_point_hash"]
        != item["source_answer_point_hash"]
    )
    failed_fields = [
        field
        for field, value in decision["field_decisions"].items()
        if value != "approved"
    ]
    if stale:
        return False, "stale_source_hash", True, failed_fields
    if decision["overall_status"] == "needs_fix":
        return False, "needs_fix", False, failed_fields
    if decision["overall_status"] == "deferred":
        if failed_fields:
            return False, "incomplete_field_review", False, failed_fields
        return False, "deferred", False, []
    if failed_fields:
        return False, "incomplete_field_review", False, failed_fields
    return True, "", False, []


def build_payloads(export: dict[str, Any]) -> dict[str, Any]:
    review_items = read_json(REVIEW_FIXTURE / "review-items.json")
    questions = {
        item["question_id"]: item
        for item in read_json(PART4_FIXTURE / "questions.json")
    }
    points = {
        item["question_id"]: item
        for item in read_json(PART4_FIXTURE / "answer-points.json")
    }
    sources = {
        item["source_id"]: item
        for item in read_json(PART4_FIXTURE / "sources.json")
    }
    decisions = {
        item["question_id"]: item
        for item in export["decisions"]
    }

    reviewed_questions: list[dict[str, Any]] = []
    reviewed_points: list[dict[str, Any]] = []
    reviewed_decisions: list[dict[str, Any]] = []
    selected_references: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []

    for item in review_items:
        question_id = item["question_id"]
        decision = decisions.get(question_id)
        eligible, reason, stale, failed_fields = classify(item, decision)
        if eligible:
            question = dict(questions[question_id])
            question["question_status"] = "verified"
            point = dict(points[question_id])
            point["point_status"] = "reviewed"
            reviewed_questions.append(question)
            reviewed_points.append(point)
            reviewed_decisions.append(decision)
            selected_references.extend(item["question_source_references"])
            selected_references.extend(item["answer_point_source_references"])
        else:
            excluded.append(
                {
                    "question_id": question_id,
                    "exclusion_reason": reason,
                    "overall_status": (
                        decision["overall_status"] if decision else "no_decision"
                    ),
                    "failed_fields": failed_fields,
                    "stale": stale,
                    "reviewer_note": decision["reviewer_note"] if decision else "",
                }
            )

    if not reviewed_questions:
        raise PromotionError(
            "0 approved non-stale items; reviewed output was not created"
        )
    selected_references.sort(key=lambda item: item["source_reference_id"])
    source_ids = sorted({item["source_id"] for item in selected_references})
    return {
        "questions.json": reviewed_questions,
        "answer-points.json": reviewed_points,
        "sources.json": [sources[source_id] for source_id in source_ids],
        "source-references.json": selected_references,
        "review-decisions.json": reviewed_decisions,
        "excluded-items.json": excluded,
    }


def validate_payloads(payloads: dict[str, Any]) -> None:
    questions = payloads["questions.json"]
    points = payloads["answer-points.json"]
    references = payloads["source-references.json"]
    sources = payloads["sources.json"]
    decisions = payloads["review-decisions.json"]
    question_ids = [item["question_id"] for item in questions]
    if len(set(question_ids)) != len(question_ids):
        raise PromotionError("reviewed Question IDs are not unique")
    if any(item["question_status"] != "verified" for item in questions):
        raise PromotionError("reviewed Questions must use verified status")
    if len(points) != len(questions) or any(
        item["point_status"] != "reviewed" or item["question_id"] not in question_ids
        for item in points
    ):
        raise PromotionError("reviewed AnswerPoint references are invalid")
    point_ids = {item["answer_point_id"] for item in points}
    source_ids = {item["source_id"] for item in sources}
    for reference in references:
        if reference["source_id"] not in source_ids:
            raise PromotionError("SourceReference has an unknown Source")
        if reference["verification_status"] == "verified":
            raise PromotionError(
                "promotion must not verify claimed source metadata automatically"
            )
        target_valid = (
            reference["target_type"] == "question"
            and reference["target_id"] in question_ids
        ) or (
            reference["target_type"] == "answer_point"
            and reference["target_id"] in point_ids
        )
        if not target_valid:
            raise PromotionError("SourceReference has an unknown promoted target")
    if [item["question_id"] for item in decisions] != question_ids:
        raise PromotionError("review decision audit order does not match Questions")


def build_readme() -> str:
    return """# Part 4 reviewed canonical data

이 디렉터리는 사용자가 내보낸 명시적 ReviewDecision 중 모든 필드가 승인되고 원문 해시가 최신인 Part 4 항목만 포함한다.

- Question 원문은 working fixture에서 그대로 복사하고 상태만 `verified`로 승격한다.
- AnswerPoint 원문은 그대로 복사하고 상태만 `reviewed`로 승격한다.
- SourceReference의 검수는 workbook에 기록된 값과 locator 확인이며, 주장된 외부 출처의 진위가 검증됐다는 뜻이 아니다.
- 포함되지 않은 항목과 이유는 `excluded-items.json`에 기록한다.
- 이 데이터셋은 이번 작업에서 학습 앱 기본 source로 연결하지 않는다.
"""


def build_file_bytes(decision_path: Path) -> tuple[dict[str, bytes], dict[str, int]]:
    export = validate_decision_export(decision_path)
    payloads = build_payloads(export)
    validate_payloads(payloads)
    files = {name: json_bytes(value) for name, value in payloads.items()}
    files["README.md"] = build_readme().encode("utf-8")
    exclusions = Counter(
        item["exclusion_reason"] for item in payloads["excluded-items.json"]
    )
    stale_count = sum(
        1 for item in payloads["excluded-items.json"] if item["stale"]
    )
    manifest = {
        "dataset_id": REVIEWED_DATASET_ID,
        "dataset_status": "reviewed",
        "schema_version": "data-schema-v1.1",
        "source_working_fixture": {
            "path": relative_path(PART4_FIXTURE),
            "manifest_sha256": sha256_file(PART4_FIXTURE / "manifest.json"),
        },
        "review_fixture": {
            "path": relative_path(REVIEW_FIXTURE),
            "manifest_sha256": sha256_file(REVIEW_FIXTURE / "manifest.json"),
        },
        "decision_file": {
            "path": relative_path(decision_path),
            "sha256": sha256_file(decision_path),
        },
        "promotion_script_sha256": sha256_file(Path(__file__)),
        "counts": {
            "reviewed_question": len(payloads["questions.json"]),
            "excluded_question": len(payloads["excluded-items.json"]),
            "answer_point": len(payloads["answer-points.json"]),
            "source": len(payloads["sources.json"]),
            "source_reference": len(payloads["source-references.json"]),
            "stale_decision": stale_count,
        },
        "exclusion_reasons": dict(sorted(exclusions.items())),
        "generated_files": {
            name: sha256_bytes(content) for name, content in files.items()
        },
        "validation": {
            "result": "passed",
            "all_required_fields_approved": True,
            "source_hashes_current": True,
            "source_verification_escalated": False,
        },
        "manifest_hash_policy": "manifest.json is excluded from generated_files because a self-hash cannot be stable.",
    }
    files["manifest.json"] = json_bytes(manifest)
    return files, manifest["counts"]


def validate_output(
    output_dir: Path, decision_path: Path
) -> dict[str, int]:
    if not output_dir.is_dir():
        raise PromotionError(f"reviewed output does not exist: {output_dir}")
    names = sorted(item.name for item in output_dir.iterdir() if item.is_file())
    if names != sorted(OUTPUT_FILES):
        raise PromotionError(f"unexpected reviewed file set: {names}")
    expected, counts = build_file_bytes(decision_path)
    for name in OUTPUT_FILES:
        if (output_dir / name).read_bytes() != expected[name]:
            raise PromotionError(f"reviewed output differs: {name}")
    return counts


def publish(
    output_dir: Path, decision_path: Path
) -> dict[str, int]:
    files, _ = build_file_bytes(decision_path)
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.build-", dir=output_dir.parent)
    )
    backup: Path | None = None
    try:
        for name, content in files.items():
            (staging / name).write_bytes(content)
        validate_output(staging, decision_path)
        if output_dir.exists():
            backup = Path(
                tempfile.mkdtemp(
                    prefix=f".{output_dir.name}.backup-", dir=output_dir.parent
                )
            )
            backup.rmdir()
            output_dir.replace(backup)
        staging.replace(output_dir)
        staging = output_dir.parent / f".{output_dir.name}.published"
        if backup is not None:
            shutil.rmtree(backup)
        return validate_output(output_dir, decision_path)
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
    parser.add_argument("--decisions", type=Path, required=True)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        counts = (
            validate_output(args.output_dir, args.decisions)
            if args.validate_only
            else publish(args.output_dir, args.decisions)
        )
    except (PromotionError, OSError) as cause:
        print(f"error: {cause}", file=sys.stderr)
        return 1
    action = "Validated" if args.validate_only else "Promoted"
    print(
        f"{action} Part 4 reviewed data at {args.output_dir} "
        f"(reviewed={counts['reviewed_question']}, "
        f"excluded={counts['excluded_question']}, stale={counts['stale_decision']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

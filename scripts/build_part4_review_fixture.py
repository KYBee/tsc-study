#!/usr/bin/env python3
"""Build or validate the deterministic Part 4 local review fixture."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PART4_FIXTURE = ROOT / "data" / "working" / "app-fixtures" / "part4-full"
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
DEFAULT_OUTPUT = ROOT / "data" / "working" / "review-fixtures" / "part4-v1"

DATASET_ID = "part4-review-fixture-v1"
TARGET_IDS = [f"P4-{number:03d}" for number in range(1, 51)]
REQUIRED_REVIEW_FIELDS = [
    "chinese_text",
    "pinyin",
    "korean_translation",
    "question_type",
    "answer_point",
    "source_locator",
    "claimed_source_metadata",
]
OUTPUT_FILES = ["review-items.json", "README.md", "manifest.json"]


class ReviewFixtureError(RuntimeError):
    """Raised when the review fixture contract is not satisfied."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def relative_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.name


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as cause:
        raise ReviewFixtureError(
            f"required input is missing: {relative_path(path)}"
        ) from cause
    except json.JSONDecodeError as cause:
        raise ReviewFixtureError(
            f"invalid JSON input: {relative_path(path)}: {cause}"
        ) from cause


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def canonical_record_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256_bytes(encoded)


def review_queue_summary(item: dict[str, Any]) -> dict[str, Any]:
    return {
        key: item.get(key, "")
        for key in (
            "review_item_id",
            "target_type",
            "issue_type",
            "priority",
            "reason",
            "source_locator",
            "review_status",
            "notes",
        )
    }


def build_review_items() -> list[dict[str, Any]]:
    questions = read_json(PART4_FIXTURE / "questions.json")
    answer_points = read_json(PART4_FIXTURE / "answer-points.json")
    references = read_json(PART4_FIXTURE / "source-references.json")
    queue = read_json(FULL_IMPORT / "review-queue.json")

    questions_by_id = {item["question_id"]: item for item in questions}
    points_by_question: dict[str, list[dict[str, Any]]] = {}
    for point in answer_points:
        points_by_question.setdefault(point["question_id"], []).append(point)

    items: list[dict[str, Any]] = []
    for question_id in TARGET_IDS:
        question = questions_by_id.get(question_id)
        if question is None:
            raise ReviewFixtureError(f"missing review Question: {question_id}")
        points = points_by_question.get(question_id, [])
        if len(points) != 1:
            raise ReviewFixtureError(
                f"{question_id} must have exactly one AnswerPoint"
            )
        answer_point = points[0]
        question_references = sorted(
            [
                item
                for item in references
                if item.get("target_type") == "question"
                and item.get("target_id") == question_id
            ],
            key=lambda item: item["source_reference_id"],
        )
        answer_point_references = sorted(
            [
                item
                for item in references
                if item.get("target_type") == "answer_point"
                and item.get("target_id") == answer_point["answer_point_id"]
            ],
            key=lambda item: item["source_reference_id"],
        )
        related_queue = [
            review_queue_summary(item)
            for item in queue
            if question_id in item.get("target_ids", [])
            or any(
                reference["source_reference_id"] in item.get("target_ids", [])
                for reference in question_references + answer_point_references
            )
        ]
        items.append(
            {
                "review_item_id": f"p4-review-item-{question_id}",
                "dataset_id": DATASET_ID,
                "question_id": question_id,
                "question": question,
                "answer_point": answer_point,
                "question_source_references": question_references,
                "answer_point_source_references": answer_point_references,
                "review_queue_items": related_queue,
                "required_review_fields": REQUIRED_REVIEW_FIELDS,
                "source_question_hash": canonical_record_hash(question),
                "source_answer_point_hash": canonical_record_hash(answer_point),
            }
        )
    return items


def validate_items(items: list[dict[str, Any]]) -> None:
    if [item.get("question_id") for item in items] != TARGET_IDS:
        raise ReviewFixtureError("review fixture must contain P4-001..P4-050")
    review_item_ids = [item.get("review_item_id") for item in items]
    if len(set(review_item_ids)) != 50:
        raise ReviewFixtureError("review_item_id values must be unique")

    for item in items:
        question_id = item["question_id"]
        question = item.get("question", {})
        point = item.get("answer_point", {})
        if (
            question.get("question_id") != question_id
            or question.get("part") != 4
            or question.get("question_status") != "raw"
        ):
            raise ReviewFixtureError(f"{question_id}: invalid source Question")
        if (
            point.get("question_id") != question_id
            or point.get("answer_point_id") != f"ap-{question_id}-001"
            or point.get("point_status") != "raw"
        ):
            raise ReviewFixtureError(f"{question_id}: invalid AnswerPoint")
        if item.get("required_review_fields") != REQUIRED_REVIEW_FIELDS:
            raise ReviewFixtureError(f"{question_id}: required fields changed")
        if item.get("source_question_hash") != canonical_record_hash(question):
            raise ReviewFixtureError(f"{question_id}: Question hash mismatch")
        if item.get("source_answer_point_hash") != canonical_record_hash(point):
            raise ReviewFixtureError(f"{question_id}: AnswerPoint hash mismatch")
        question_references = item.get("question_source_references", [])
        point_references = item.get("answer_point_source_references", [])
        if len(question_references) != 1 or len(point_references) != 1:
            raise ReviewFixtureError(
                f"{question_id}: expected one Question and AnswerPoint reference"
            )
        for reference in question_references:
            if (
                reference.get("target_type") != "question"
                or reference.get("target_id") != question_id
                or reference.get("source_id") != "src-001"
            ):
                raise ReviewFixtureError(
                    f"{question_id}: invalid Question SourceReference"
                )
        for reference in point_references:
            if (
                reference.get("target_type") != "answer_point"
                or reference.get("target_id") != point["answer_point_id"]
                or reference.get("source_id") != "src-001"
            ):
                raise ReviewFixtureError(
                    f"{question_id}: invalid AnswerPoint SourceReference"
                )
        if not item.get("review_queue_items"):
            raise ReviewFixtureError(f"{question_id}: review queue context missing")


def build_readme() -> str:
    return """# Part 4 로컬 검수 fixture

이 디렉터리는 Part 4 working Question 50개의 사람 검수를 위한 결정적 입력이다.

- dataset ID: `part4-review-fixture-v1`
- 원문 Question, AnswerPoint와 SourceReference를 수정하지 않는다.
- `ReviewDecision`과 사용자 승인 결과는 fixture에 포함하지 않는다.
- 화면 진입이나 fixture 생성만으로 어떤 항목도 승인되지 않는다.
- `source_question_hash`와 `source_answer_point_hash`는 원문 변경 후 기존 결정을 stale로 판정하는 데 사용한다.
- 이 데이터는 reviewed 또는 production 데이터가 아니다.

생성:

```sh
python3 scripts/build_part4_review_fixture.py
```

검증:

```sh
python3 scripts/build_part4_review_fixture.py --validate-only
```
"""


def build_file_bytes() -> dict[str, bytes]:
    items = build_review_items()
    validate_items(items)
    files = {
        "review-items.json": json_bytes(items),
        "README.md": build_readme().encode("utf-8"),
    }
    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_status": "review_fixture",
        "schema_version": "part4-review-decision-v1",
        "inputs": {
            "part4_fixture_manifest": {
                "path": relative_path(PART4_FIXTURE / "manifest.json"),
                "sha256": sha256_file(PART4_FIXTURE / "manifest.json"),
            },
            "full_import_review_queue": {
                "path": relative_path(FULL_IMPORT / "review-queue.json"),
                "sha256": sha256_file(FULL_IMPORT / "review-queue.json"),
            },
        },
        "script_sha256": sha256_file(Path(__file__)),
        "generated_files": {
            name: sha256_bytes(content) for name, content in files.items()
        },
        "counts": {"review_item": len(items)},
        "ids": {
            "question": [item["question_id"] for item in items],
            "review_item": [item["review_item_id"] for item in items],
        },
        "required_review_fields": REQUIRED_REVIEW_FIELDS,
        "validation": {
            "answer_point_cardinality": "one_per_question",
            "source_hashes_stable": True,
            "review_decisions_included": False,
            "working_content_modified": False,
        },
        "manifest_hash_policy": "manifest.json is excluded from generated_files because a self-hash cannot be stable.",
    }
    files["manifest.json"] = json_bytes(manifest)
    return files


def validate_output(output_dir: Path) -> dict[str, int]:
    if not output_dir.is_dir():
        raise ReviewFixtureError(f"review fixture does not exist: {output_dir}")
    names = sorted(item.name for item in output_dir.iterdir() if item.is_file())
    if names != sorted(OUTPUT_FILES):
        raise ReviewFixtureError(f"unexpected review fixture file set: {names}")
    expected = build_file_bytes()
    for name in OUTPUT_FILES:
        if (output_dir / name).read_bytes() != expected[name]:
            raise ReviewFixtureError(f"review fixture differs: {name}")
    items = read_json(output_dir / "review-items.json")
    validate_items(items)
    return {"review_item": len(items)}


def publish(output_dir: Path, files: dict[str, bytes]) -> dict[str, int]:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.build-", dir=output_dir.parent)
    )
    backup: Path | None = None
    try:
        for name, content in files.items():
            (staging / name).write_bytes(content)
        validate_output(staging)
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
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        counts = (
            validate_output(args.output_dir)
            if args.validate_only
            else publish(args.output_dir, build_file_bytes())
        )
    except (ReviewFixtureError, OSError) as cause:
        print(f"error: {cause}", file=sys.stderr)
        return 1
    action = "Validated" if args.validate_only else "Built"
    print(
        f"{action} Part 4 review fixture at {args.output_dir} "
        f"(review_items={counts['review_item']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

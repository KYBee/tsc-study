#!/usr/bin/env python3
"""Build the deterministic working fixture for all non-visual text parts.

The builder reads existing working JSON only. It never edits the full workbook
import, course import, or either existing Part 4 app fixture.
"""

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
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
COURSE_IMPORT = ROOT / "data" / "working" / "course-import-v1"
DEFAULT_OUTPUT = ROOT / "data" / "working" / "app-fixtures" / "text-parts-v1"

DATASET_ID = "text-parts-working-development-fixture-v1"
PART_COUNTS = {1: 4, 3: 84, 4: 50, 5: 36, 6: 19}
TARGET_PARTS = tuple(PART_COUNTS)
TARGET_IDS = [
    f"P{part}-{number:03d}"
    for part, count in PART_COUNTS.items()
    for number in range(1, count + 1)
]
OUTPUT_FILES = [
    "sources.json",
    "source-references.json",
    "questions.json",
    "answer-points.json",
    "part-guides.json",
    "learning-expressions.json",
    "practice-drills.json",
    "course-insights.json",
    "model-answers.json",
    "README.md",
    "manifest.json",
]
GENERATED_FILES = [name for name in OUTPUT_FILES if name != "manifest.json"]


class FixtureError(RuntimeError):
    """Raised when source or generated fixture data violates the contract."""


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
        raise FixtureError(f"required input is missing: {relative_path(path)}") from cause
    except json.JSONDecodeError as cause:
        raise FixtureError(f"invalid JSON input: {relative_path(path)}: {cause}") from cause


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def stable_records(
    records: list[dict[str, Any]], identifier: str
) -> list[dict[str, Any]]:
    return sorted(records, key=lambda item: item[identifier])


def selected_payloads() -> dict[str, Any]:
    full_questions = read_json(FULL_IMPORT / "questions.json")
    full_answer_points = read_json(FULL_IMPORT / "answer-points.json")
    full_part_guides = read_json(FULL_IMPORT / "part-guides.json")
    full_references = read_json(FULL_IMPORT / "source-references.json")
    full_sources = read_json(FULL_IMPORT / "sources.json")

    course_part_guides = read_json(COURSE_IMPORT / "part-guides.json")
    course_expressions = read_json(COURSE_IMPORT / "learning-expressions.json")
    course_drills = read_json(COURSE_IMPORT / "practice-drills.json")
    course_insights = read_json(COURSE_IMPORT / "course-insights.json")
    course_references = read_json(COURSE_IMPORT / "source-references.json")
    course_sources = read_json(COURSE_IMPORT / "sources.json")

    questions = [
        item for item in full_questions if item.get("part") in TARGET_PARTS
    ]
    question_ids = {item["question_id"] for item in questions}
    answer_points = [
        item
        for item in full_answer_points
        if item.get("question_id") in question_ids
    ]
    workbook_guides = [
        item for item in full_part_guides if item.get("part") in TARGET_PARTS
    ]
    course_guides = [
        item for item in course_part_guides if item.get("part") in TARGET_PARTS
    ]
    expressions = [
        item
        for item in course_expressions
        if set(item.get("part_numbers", [])) & set(TARGET_PARTS)
    ]
    drills = [
        item for item in course_drills if item.get("part") in TARGET_PARTS
    ]
    insights = [
        item
        for item in course_insights
        if set(item.get("part_numbers", [])) & set(TARGET_PARTS)
    ]
    part_guides = workbook_guides + course_guides

    targets: set[tuple[str, str]] = {
        *(("question", item["question_id"]) for item in questions),
        *(("answer_point", item["answer_point_id"]) for item in answer_points),
        *(("part_guide", item["part_guide_id"]) for item in part_guides),
        *(("learning_expression", item["expression_id"]) for item in expressions),
        *(("practice_drill", item["drill_id"]) for item in drills),
        *(("course_insight", item["insight_id"]) for item in insights),
    }
    references = [
        item
        for item in full_references + course_references
        if (item.get("target_type"), item.get("target_id")) in targets
    ]
    source_ids = {item["source_id"] for item in references}
    sources_by_id = {
        item["source_id"]: item
        for item in full_sources + course_sources
        if item.get("source_id") in source_ids
    }

    return {
        "sources.json": stable_records(list(sources_by_id.values()), "source_id"),
        "source-references.json": stable_records(
            references, "source_reference_id"
        ),
        "questions.json": stable_records(questions, "question_id"),
        "answer-points.json": stable_records(answer_points, "answer_point_id"),
        "part-guides.json": stable_records(part_guides, "part_guide_id"),
        "learning-expressions.json": stable_records(expressions, "expression_id"),
        "practice-drills.json": stable_records(drills, "drill_id"),
        "course-insights.json": stable_records(insights, "insight_id"),
        "model-answers.json": [],
    }


def build_readme() -> str:
    return """# 전체 텍스트 파트 working 앱 fixture

이 디렉터리는 시각 자료가 필요하지 않은 Part 1·3·4·5·6 문제를 앱에서
연습하기 위한 개발용 working fixture다.

- Question 193개와 AnswerPoint 193개를 원문 그대로 보존한다.
- Part별 Question 수는 4·84·50·36·19개다.
- Part 2와 Part 7은 시각 자료 연결이 필요하므로 포함하지 않는다.
- 검수 완료 또는 production 데이터가 아니다.
- workbook 기반 PartGuide와 3급 과정 기반 PartGuide를 병합하지 않는다.
- LearningExpression, PracticeDrill, CourseInsight는 해당 Part의 공통 참고
  자료이며 특정 Question의 정답이 아니다.
- ModelAnswer를 생성하지 않으며 `model-answers.json`은 빈 배열이다.
- 기존 Part 4 fixture와 원본 working 데이터는 수정하지 않는다.

생성:

```sh
python3 scripts/build_text_parts_app_fixture.py
```

검증만 수행:

```sh
python3 scripts/build_text_parts_app_fixture.py --validate-only
```
"""


def expected_ids(payloads: dict[str, Any]) -> dict[str, list[str]]:
    return {
        "source": [item["source_id"] for item in payloads["sources.json"]],
        "source_reference": [
            item["source_reference_id"]
            for item in payloads["source-references.json"]
        ],
        "question": [item["question_id"] for item in payloads["questions.json"]],
        "answer_point": [
            item["answer_point_id"] for item in payloads["answer-points.json"]
        ],
        "part_guide": [
            item["part_guide_id"] for item in payloads["part-guides.json"]
        ],
        "learning_expression": [
            item["expression_id"]
            for item in payloads["learning-expressions.json"]
        ],
        "practice_drill": [
            item["drill_id"] for item in payloads["practice-drills.json"]
        ],
        "course_insight": [
            item["insight_id"] for item in payloads["course-insights.json"]
        ],
        "model_answer": [
            item["answer_id"] for item in payloads["model-answers.json"]
        ],
    }


def expected_counts(payloads: dict[str, Any]) -> dict[str, int]:
    return {name: len(values) for name, values in expected_ids(payloads).items()}


def validate_payloads(payloads: dict[str, Any]) -> None:
    questions = payloads["questions.json"]
    answer_points = payloads["answer-points.json"]
    guides = payloads["part-guides.json"]
    expressions = payloads["learning-expressions.json"]
    drills = payloads["practice-drills.json"]
    insights = payloads["course-insights.json"]
    references = payloads["source-references.json"]
    sources = payloads["sources.json"]

    question_ids = [item.get("question_id") for item in questions]
    if question_ids != TARGET_IDS:
        raise FixtureError("fixture question IDs or deterministic order changed")
    if len(set(question_ids)) != 193:
        raise FixtureError("question_id values must be unique")
    for part, count in PART_COUNTS.items():
        selected = [item for item in questions if item.get("part") == part]
        if len(selected) != count:
            raise FixtureError(f"Part {part} requires exactly {count} Questions")
    if any(item.get("part") in {2, 7} for item in questions):
        raise FixtureError("visual Parts 2 and 7 must not be included")

    answer_point_ids = {item.get("answer_point_id") for item in answer_points}
    if len(answer_points) != 193 or len(answer_point_ids) != 193:
        raise FixtureError("fixture requires exactly 193 unique AnswerPoints")
    for question_id in TARGET_IDS:
        matches = [
            item for item in answer_points if item.get("question_id") == question_id
        ]
        if len(matches) != 1:
            raise FixtureError(f"{question_id} must have exactly one AnswerPoint")
        if matches[0].get("answer_point_id") != f"ap-{question_id}-001":
            raise FixtureError(f"{question_id} AnswerPoint identity changed")

    expected_guide_ids = {
        *(
            f"part-guide-workbook-{part:02d}"
            for part in TARGET_PARTS
        ),
        *(f"part-guide-{part:02d}" for part in TARGET_PARTS),
    }
    if {item.get("part_guide_id") for item in guides} != expected_guide_ids:
        raise FixtureError("workbook and course PartGuides must stay separate")
    for part in TARGET_PARTS:
        course_guide = next(
            item
            for item in guides
            if item["part_guide_id"] == f"part-guide-{part:02d}"
        )
        if course_guide.get("course_target_context") != "level_3":
            raise FixtureError("course PartGuide must preserve level_3 context")
    if len(expressions) != 29 or any(
        not set(item.get("part_numbers", [])) & set(TARGET_PARTS)
        for item in expressions
    ):
        raise FixtureError("expected 29 text-part LearningExpressions")
    if len(drills) != 5 or any(
        item.get("part") not in TARGET_PARTS for item in drills
    ):
        raise FixtureError("expected five text-part PracticeDrills")
    if len(insights) != 8 or any(
        not set(item.get("part_numbers", [])) & set(TARGET_PARTS)
        for item in insights
    ):
        raise FixtureError("expected eight text-part CourseInsights")
    if payloads["model-answers.json"]:
        raise FixtureError("ModelAnswer generation is prohibited")

    source_ids = {item.get("source_id") for item in sources}
    if len(sources) != 7 or len(source_ids) != 7:
        raise FixtureError("fixture requires seven unique Sources")
    target_ids: dict[str, set[str]] = {
        "question": set(TARGET_IDS),
        "answer_point": answer_point_ids,
        "part_guide": {item["part_guide_id"] for item in guides},
        "learning_expression": {
            item["expression_id"] for item in expressions
        },
        "practice_drill": {item["drill_id"] for item in drills},
        "course_insight": {item["insight_id"] for item in insights},
    }
    if len(references) != 451:
        raise FixtureError("fixture requires exactly 451 SourceReferences")
    reference_ids: set[str] = set()
    for reference in references:
        reference_id = reference.get("source_reference_id")
        if reference_id in reference_ids:
            raise FixtureError(f"duplicate SourceReference: {reference_id}")
        reference_ids.add(reference_id)
        if reference.get("source_id") not in source_ids:
            raise FixtureError(f"unknown Source for {reference_id}")
        target_type = reference.get("target_type")
        if (
            target_type not in target_ids
            or reference.get("target_id") not in target_ids[target_type]
        ):
            raise FixtureError(f"unknown target for {reference_id}")


def build_file_bytes() -> dict[str, bytes]:
    payloads = selected_payloads()
    validate_payloads(payloads)
    files = {name: json_bytes(value) for name, value in payloads.items()}
    files["README.md"] = build_readme().encode("utf-8")
    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_status": "development_fixture",
        "schema_version": "data-schema-v1.1-working",
        "inputs": {
            "full_import_manifest": {
                "path": relative_path(FULL_IMPORT / "manifest.json"),
                "sha256": sha256_file(FULL_IMPORT / "manifest.json"),
            },
            "course_import_manifest": {
                "path": relative_path(COURSE_IMPORT / "manifest.json"),
                "sha256": sha256_file(COURSE_IMPORT / "manifest.json"),
            },
        },
        "script_sha256": sha256_file(Path(__file__)),
        "generated_files": {
            name: sha256_bytes(files[name]) for name in GENERATED_FILES
        },
        "counts": expected_counts(payloads),
        "part_question_counts": {
            str(part): count for part, count in PART_COUNTS.items()
        },
        "ids": expected_ids(payloads),
        "validation": {
            "target_parts": list(TARGET_PARTS),
            "excluded_visual_parts": [2, 7],
            "model_answers_generated": False,
            "course_target_context_preserved": True,
            "working_status_preserved": True,
        },
        "manifest_hash_policy": (
            "manifest.json is excluded from generated_files because a self-hash "
            "cannot be stable."
        ),
    }
    files["manifest.json"] = json_bytes(manifest)
    return files


def validate_output(output_dir: Path) -> dict[str, int]:
    if not output_dir.is_dir():
        raise FixtureError(f"fixture output does not exist: {output_dir}")
    actual_names = sorted(item.name for item in output_dir.iterdir() if item.is_file())
    if actual_names != sorted(OUTPUT_FILES):
        raise FixtureError(f"unexpected fixture file set: {actual_names}")

    expected = build_file_bytes()
    for name in OUTPUT_FILES:
        if (output_dir / name).read_bytes() != expected[name]:
            raise FixtureError(
                f"fixture file differs from deterministic source selection: {name}"
            )
    payloads = {
        name: json.loads((output_dir / name).read_text(encoding="utf-8"))
        for name in expected
        if name.endswith(".json") and name != "manifest.json"
    }
    validate_payloads(payloads)
    return expected_counts(payloads)


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
        if output_dir.exists() and backup is not None and backup.exists():
            shutil.rmtree(output_dir)
            backup.replace(output_dir)
        raise
    finally:
        if staging.exists() and staging != output_dir:
            shutil.rmtree(staging, ignore_errors=True)


def build_fixture(output_dir: Path = DEFAULT_OUTPUT) -> dict[str, int]:
    return publish(output_dir, build_file_bytes())


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
            else build_fixture(args.output_dir)
        )
    except (FixtureError, OSError) as cause:
        print(f"error: {cause}", file=sys.stderr)
        return 1

    action = "Validated" if args.validate_only else "Built"
    print(
        f"{action} text-parts fixture at {args.output_dir} "
        f"(questions={counts['question']}, "
        f"answer_points={counts['answer_point']}, "
        f"part_guides={counts['part_guide']}, "
        f"expressions={counts['learning_expression']}, "
        f"drills={counts['practice_drill']}, "
        f"insights={counts['course_insight']}, "
        f"model_answers={counts['model_answer']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

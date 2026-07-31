#!/usr/bin/env python3
"""Build the deterministic local-only Part 7 story-image learning fixture."""

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
DEFAULT_OUTPUT = (
    ROOT / "data" / "working" / "app-fixtures" / "part7-visual-v1"
)
DATASET_ID = "part7-visual-working-development-fixture-v1"
OUTPUT_FILES = [
    "visual-sets.json",
    "visual-assets.json",
    "visual-set-assets.json",
    "story-guides.json",
    "questions.json",
    "question-visual-link-candidates.json",
    "model-answers.json",
    "sources.json",
    "source-references.json",
    "part-guides.json",
    "learning-expressions.json",
    "practice-drills.json",
    "course-insights.json",
    "README.md",
    "manifest.json",
]
GENERATED_FILES = [name for name in OUTPUT_FILES if name != "manifest.json"]
SAFE_ASSET_ROOT = Path("data/working/generated-assets/full-import-v1")
SUPPORTED_MEDIA = {
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/gif": {".gif"},
}


class FixtureError(RuntimeError):
    """Raised when input or output violates the Part 7 fixture contract."""


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
        raise FixtureError(
            f"required input is missing: {relative_path(path)}"
        ) from cause
    except json.JSONDecodeError as cause:
        raise FixtureError(
            f"invalid JSON input: {relative_path(path)}: {cause}"
        ) from cause


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )


def stable(records: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    return sorted(records, key=lambda item: item[key])


def selected_payloads() -> dict[str, Any]:
    full_sets = read_json(FULL_IMPORT / "visual-sets.json")
    full_assets = read_json(FULL_IMPORT / "visual-assets.json")
    full_links = read_json(FULL_IMPORT / "visual-set-assets.json")
    full_guides = read_json(FULL_IMPORT / "story-guides.json")
    full_questions = read_json(FULL_IMPORT / "questions.json")
    full_candidates = read_json(FULL_IMPORT / "workbook-link-candidates.json")
    full_part_guides = read_json(FULL_IMPORT / "part-guides.json")
    full_sources = read_json(FULL_IMPORT / "sources.json")
    full_references = read_json(FULL_IMPORT / "source-references.json")

    course_guides = read_json(COURSE_IMPORT / "part-guides.json")
    course_expressions = read_json(COURSE_IMPORT / "learning-expressions.json")
    course_drills = read_json(COURSE_IMPORT / "practice-drills.json")
    course_insights = read_json(COURSE_IMPORT / "course-insights.json")
    course_sources = read_json(COURSE_IMPORT / "sources.json")
    course_references = read_json(COURSE_IMPORT / "source-references.json")

    visual_sets = [
        item
        for item in full_sets
        if item.get("part") == 7 and item.get("set_type") == "story_image"
    ]
    visual_set_ids = {item["visual_set_id"] for item in visual_sets}
    visual_set_assets = [
        item for item in full_links if item.get("visual_set_id") in visual_set_ids
    ]
    visual_asset_ids = {
        item["visual_asset_id"] for item in visual_set_assets
    }
    visual_assets = [
        item
        for item in full_assets
        if item.get("visual_asset_id") in visual_asset_ids
    ]
    story_guides = [
        item
        for item in full_guides
        if item.get("visual_set_id") in visual_set_ids
    ]
    questions = [
        item for item in full_questions if item.get("part") == 7
    ]
    candidates = [
        {
            **item,
            "candidate_status": "candidate",
            "canonical_status": "not_canonical",
        }
        for item in full_candidates
        if item.get("source_entity_type") == "visual_set"
        and item.get("source_entity_id") in visual_set_ids
    ]
    workbook_guides = [
        item for item in full_part_guides if item.get("part") == 7
    ]
    selected_course_guides = [
        item for item in course_guides if item.get("part") == 7
    ]
    part_guides = workbook_guides + selected_course_guides
    expressions = [
        item for item in course_expressions if 7 in item.get("part_numbers", [])
    ]
    drills = [item for item in course_drills if item.get("part") == 7]
    insights = [
        item for item in course_insights if 7 in item.get("part_numbers", [])
    ]

    targets: set[tuple[str, str]] = {
        *(("visual_set", item["visual_set_id"]) for item in visual_sets),
        *(("story_guide", item["story_guide_id"]) for item in story_guides),
        *(("question", item["question_id"]) for item in questions),
        *(("part_guide", item["part_guide_id"]) for item in part_guides),
        *(
            ("learning_expression", item["expression_id"])
            for item in expressions
        ),
        *(("practice_drill", item["drill_id"]) for item in drills),
        *(("course_insight", item["insight_id"]) for item in insights),
    }
    references = [
        item
        for item in full_references + course_references
        if (item.get("target_type"), item.get("target_id")) in targets
    ]
    source_ids = {
        *(item["source_id"] for item in references),
        *(item["source_id"] for item in visual_assets),
    }
    source_by_id = {
        item["source_id"]: item
        for item in full_sources + course_sources
        if item.get("source_id") in source_ids
    }

    return {
        "visual-sets.json": stable(visual_sets, "visual_set_id"),
        "visual-assets.json": stable(visual_assets, "visual_asset_id"),
        "visual-set-assets.json": stable(
            visual_set_assets, "visual_set_asset_id"
        ),
        "story-guides.json": stable(story_guides, "story_guide_id"),
        "questions.json": stable(questions, "question_id"),
        "question-visual-link-candidates.json": stable(
            candidates, "candidate_id"
        ),
        "model-answers.json": [],
        "sources.json": stable(list(source_by_id.values()), "source_id"),
        "source-references.json": stable(
            references, "source_reference_id"
        ),
        "part-guides.json": stable(part_guides, "part_guide_id"),
        "learning-expressions.json": stable(expressions, "expression_id"),
        "practice-drills.json": stable(drills, "drill_id"),
        "course-insights.json": stable(insights, "insight_id"),
    }


def build_readme() -> str:
    return """# Part 7 스토리 그림 working 앱 fixture

이 디렉터리는 원본 workbook의 Part 7 스토리 그림 세트 12개를 로컬 개발
앱에서 연습하기 위한 deterministic working fixture다.

- VisualSet·VisualAsset·VisualSetAsset·StoryGuide는 각각 12개다.
- Part 7 Question 12개는 공통 지시문 자료로만 보존한다.
- 숫자 접미사 기반 Question 연결 후보 12개는 `review_needed`인
  `not_canonical` 후보일 뿐 실제 QuestionVisualSet 관계가 아니다.
- 확정 QuestionVisualSet은 0개이며 앱은 VisualSet을 직접 학습 대상으로 쓴다.
- StoryGuide는 원본의 이야기 흐름 참고 자료이며 ModelAnswer가 아니다.
- ModelAnswer를 만들지 않으며 `model-answers.json`은 빈 배열이다.
- 공식 샘플 이미지와 Part 2 자료는 포함하지 않는다.
- 이미지 권리는 모두 `review_needed`이며 공개 허용으로 승격하지 않는다.
- 이미지 바이트는 JSON 또는 Git에 포함하지 않는다.

```sh
python3 scripts/build_full_workbook_import.py --extract-assets
python3 scripts/build_part7_visual_app_fixture.py
python3 scripts/build_part7_visual_app_fixture.py --validate-only
```

이미지는 개발 서버에서만 등록된 asset ID를 통해 제공한다. production
빌드에는 이미지 바이트가 포함되지 않으며 권리 검수 전에는 배포할 수 없다.
"""


def entity_ids(payloads: dict[str, Any]) -> dict[str, list[str]]:
    fields = {
        "visual_set": ("visual-sets.json", "visual_set_id"),
        "visual_asset": ("visual-assets.json", "visual_asset_id"),
        "visual_set_asset": (
            "visual-set-assets.json",
            "visual_set_asset_id",
        ),
        "story_guide": ("story-guides.json", "story_guide_id"),
        "question": ("questions.json", "question_id"),
        "question_visual_link_candidate": (
            "question-visual-link-candidates.json",
            "candidate_id",
        ),
        "model_answer": ("model-answers.json", "answer_id"),
        "source": ("sources.json", "source_id"),
        "source_reference": (
            "source-references.json",
            "source_reference_id",
        ),
        "part_guide": ("part-guides.json", "part_guide_id"),
        "learning_expression": (
            "learning-expressions.json",
            "expression_id",
        ),
        "practice_drill": ("practice-drills.json", "drill_id"),
        "course_insight": ("course-insights.json", "insight_id"),
    }
    return {
        name: [item[field] for item in payloads[filename]]
        for name, (filename, field) in fields.items()
    }


def validate_payloads(payloads: dict[str, Any]) -> None:
    ids = entity_ids(payloads)
    for label, values in ids.items():
        if len(values) != len(set(values)):
            raise FixtureError(f"{label}: duplicate stable ID")

    expected_sets = [f"vs-P7-V{number:02d}" for number in range(1, 13)]
    expected_questions = [f"P7-{number:03d}" for number in range(1, 13)]
    if ids["visual_set"] != expected_sets:
        raise FixtureError("VisualSet: expected vs-P7-V01..vs-P7-V12")
    if ids["question"] != expected_questions:
        raise FixtureError("Question: expected P7-001..P7-012")
    if any(
        item.get("part") != 7
        or item.get("set_type") != "story_image"
        or item.get("set_status") != "raw"
        for item in payloads["visual-sets.json"]
    ):
        raise FixtureError("VisualSet: only raw Part 7 story sets are allowed")
    if any(item.get("part") != 7 for item in payloads["questions.json"]):
        raise FixtureError("Question: only Part 7 records are allowed")
    if (
        len(ids["visual_asset"]) != 12
        or len(ids["visual_set_asset"]) != 12
        or len(ids["story_guide"]) != 12
        or len(ids["question_visual_link_candidate"]) != 12
        or ids["model_answer"]
    ):
        raise FixtureError("Part 7 exact entity counts changed")

    sets = set(ids["visual_set"])
    assets = set(ids["visual_asset"])
    sources = set(ids["source"])
    for item in payloads["visual-set-assets.json"]:
        if (
            item["visual_set_id"] not in sets
            or item["visual_asset_id"] not in assets
        ):
            raise FixtureError("VisualSetAsset: broken reference")
    for item in payloads["story-guides.json"]:
        if (
            item["visual_set_id"] not in sets
            or item.get("question_id", "") != ""
            or item["guide_status"] != "raw"
        ):
            raise FixtureError("StoryGuide: explicit VisualSet boundary changed")
    for item in payloads["question-visual-link-candidates.json"]:
        if (
            item["source_entity_type"] != "visual_set"
            or item["source_entity_id"] not in sets
            or item["candidate_question_id"] not in set(expected_questions)
            or item["candidate_status"] != "candidate"
            or item["review_status"] != "review_needed"
            or item["canonical_status"] != "not_canonical"
            or item["match_basis"] != "numeric_suffix_only"
        ):
            raise FixtureError("QuestionVisualSet candidate boundary changed")

    for item in payloads["visual-assets.json"]:
        path = Path(item["repository_path"])
        if (
            item["rights_status"] != "review_needed"
            or item["asset_status"] != "raw"
            or path.is_absolute()
            or ".." in path.parts
            or path.parent != SAFE_ASSET_ROOT
            or path.suffix.lower()
            not in SUPPORTED_MEDIA.get(item["media_type"], set())
        ):
            raise FixtureError(
                f"VisualAsset local rights/path contract changed: "
                f"{item['visual_asset_id']}"
            )
        if item["source_id"] not in sources:
            raise FixtureError("VisualAsset: unknown Source")

    if set(ids["part_guide"]) != {
        "part-guide-07",
        "part-guide-workbook-07",
    }:
        raise FixtureError("PartGuide workbook/course records must stay separate")
    course_guide = next(
        item
        for item in payloads["part-guides.json"]
        if item["part_guide_id"] == "part-guide-07"
    )
    if course_guide.get("course_target_context") != "level_3":
        raise FixtureError("course PartGuide must preserve level_3 context")
    if (
        ids["learning_expression"]
        or ids["practice_drill"]
        or ids["course_insight"] != ["ci-course-part6-7-gap"]
    ):
        raise FixtureError("Part 7 course limitation material changed")

    target_ids = {
        "visual_set": sets,
        "story_guide": set(ids["story_guide"]),
        "question": set(ids["question"]),
        "part_guide": set(ids["part_guide"]),
        "learning_expression": set(ids["learning_expression"]),
        "practice_drill": set(ids["practice_drill"]),
        "course_insight": set(ids["course_insight"]),
    }
    for item in payloads["source-references.json"]:
        target_type = item["target_type"]
        if (
            item["source_id"] not in sources
            or target_type not in target_ids
            or item["target_id"] not in target_ids[target_type]
        ):
            raise FixtureError("SourceReference: broken fixture reference")


def build_file_bytes() -> dict[str, bytes]:
    payloads = selected_payloads()
    validate_payloads(payloads)
    files = {name: json_bytes(value) for name, value in payloads.items()}
    files["README.md"] = build_readme().encode("utf-8")
    ids = entity_ids(payloads)
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
        "counts": {name: len(values) for name, values in ids.items()},
        "ids": ids,
        "question_visual_set_links": {
            "confirmed": 0,
            "candidates": len(ids["question_visual_link_candidate"]),
        },
        "validation": {
            "part": 7,
            "official_sample_excluded": True,
            "part2_data_excluded": True,
            "rights_status_preserved": True,
            "public_allowed": False,
            "asset_bytes_embedded": False,
            "working_status_preserved": True,
            "canonical_links_created": False,
            "story_guides_are_model_answers": False,
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
    actual_names = sorted(
        item.name for item in output_dir.iterdir() if item.is_file()
    )
    if actual_names != sorted(OUTPUT_FILES):
        raise FixtureError(f"unexpected fixture file set: {actual_names}")
    expected = build_file_bytes()
    for name in OUTPUT_FILES:
        if (output_dir / name).read_bytes() != expected[name]:
            raise FixtureError(
                f"fixture differs from deterministic source selection: {name}"
            )
    payloads = {
        name: json.loads((output_dir / name).read_text(encoding="utf-8"))
        for name in expected
        if name.endswith(".json") and name != "manifest.json"
    }
    validate_payloads(payloads)
    return {
        name: len(values) for name, values in entity_ids(payloads).items()
    }


def publish(output_dir: Path, files: dict[str, bytes]) -> dict[str, int]:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(
            prefix=f".{output_dir.name}.build-", dir=output_dir.parent
        )
    )
    backup: Path | None = None
    try:
        for name, content in files.items():
            (staging / name).write_bytes(content)
        validate_output(staging)
        if output_dir.exists():
            backup = Path(
                tempfile.mkdtemp(
                    prefix=f".{output_dir.name}.backup-",
                    dir=output_dir.parent,
                )
            )
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
        f"{action} Part 7 visual fixture at {args.output_dir} "
        f"(sets={counts['visual_set']}, assets={counts['visual_asset']}, "
        f"story_guides={counts['story_guide']}, "
        f"questions={counts['question']}, "
        f"candidates={counts['question_visual_link_candidate']}, "
        f"model_answers={counts['model_answer']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build the deterministic local-only Part 2 visual learning fixture."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
from typing import Any

from named_visual_asset_data import (
    ASSET_ROOT as SAFE_ASSET_ROOT,
    NamedAssetDataError,
    SOURCE_ID as NAMED_ASSET_SOURCE_ID,
    load_manifest as load_named_asset_manifest,
    source_record as named_asset_source_record,
    visual_entities as named_visual_entities,
)


ROOT = Path(__file__).resolve().parents[1]
FULL_IMPORT = ROOT / "data" / "working" / "full-import-v1"
COURSE_IMPORT = ROOT / "data" / "working" / "course-import-v1"
DEFAULT_OUTPUT = (
    ROOT / "data" / "working" / "app-fixtures" / "part2-visual-v1"
)
DATASET_ID = "part2-visual-working-development-fixture-v1"
OUTPUT_FILES = [
    "visual-sets.json",
    "visual-assets.json",
    "visual-set-assets.json",
    "visual-questions.json",
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
SUPPORTED_MEDIA = {
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/gif": {".gif"},
}


class FixtureError(RuntimeError):
    """Raised when input or output violates the Part 2 fixture contract."""


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
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )


def stable(records: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    return sorted(records, key=lambda item: item[key])


def selected_payloads() -> dict[str, Any]:
    full_sets = read_json(FULL_IMPORT / "visual-sets.json")
    full_questions = read_json(FULL_IMPORT / "visual-questions.json")
    full_answers = read_json(FULL_IMPORT / "model-answers.json")
    full_guides = read_json(FULL_IMPORT / "part-guides.json")
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
        if item.get("part") == 2
        and item.get("set_type") == "four_question_image"
    ]
    visual_set_ids = {item["visual_set_id"] for item in visual_sets}
    visual_assets, visual_set_assets = named_visual_entities(2)
    visual_questions = [
        item
        for item in full_questions
        if item.get("visual_set_id") in visual_set_ids
    ]
    visual_question_ids = {
        item["visual_question_id"] for item in visual_questions
    }
    model_answers = [
        item
        for item in full_answers
        if item.get("answer_target_type") == "visual_question"
        and item.get("answer_target_id") in visual_question_ids
    ]
    workbook_guides = [
        item for item in full_guides if item.get("part") == 2
    ]
    selected_course_guides = [
        item for item in course_guides if item.get("part") == 2
    ]
    part_guides = workbook_guides + selected_course_guides
    expressions = [
        item for item in course_expressions if 2 in item.get("part_numbers", [])
    ]
    drills = [item for item in course_drills if item.get("part") == 2]
    insights = [
        item for item in course_insights if 2 in item.get("part_numbers", [])
    ]

    targets: set[tuple[str, str]] = {
        *(("visual_set", item["visual_set_id"]) for item in visual_sets),
        *(
            ("visual_question", item["visual_question_id"])
            for item in visual_questions
        ),
        *(("model_answer", item["answer_id"]) for item in model_answers),
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
    named_manifest = load_named_asset_manifest()
    source_by_id = {
        item["source_id"]: item
        for item in full_sources + course_sources
        if item.get("source_id") in source_ids
    }
    if NAMED_ASSET_SOURCE_ID in source_ids:
        source_by_id[NAMED_ASSET_SOURCE_ID] = named_asset_source_record(named_manifest)

    return {
        "visual-sets.json": stable(visual_sets, "visual_set_id"),
        "visual-assets.json": stable(visual_assets, "visual_asset_id"),
        "visual-set-assets.json": stable(
            visual_set_assets, "visual_set_asset_id"
        ),
        "visual-questions.json": stable(
            visual_questions, "visual_question_id"
        ),
        "model-answers.json": stable(model_answers, "answer_id"),
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
    return """# Part 2 시각 문제 working 앱 fixture

이 디렉터리는 원본 workbook의 Part 2 그림 세트 12개와 세부 질문 48개를
로컬 개발 앱에서 연습하기 위한 deterministic working fixture다.

- VisualSet·VisualAsset·VisualSetAsset은 각각 12개다.
- VisualQuestion과 원본 추천 ModelAnswer는 각각 48개다.
- 공식 샘플 이미지와 Part 7 자료는 포함하지 않는다.
- canonical Question 연결 18개는 원본 working 관계를 보존하며, 미연결
  VisualQuestion 30개도 독립 학습 대상으로 유지한다.
- ModelAnswer는 `review_needed`/`unverified_source` 상태인 원본 추천
  답변이다. 공식 정답이나 검수 완료 답변이 아니다.
- 이미지 권리는 모두 `review_needed`이며 공개 허용으로 승격하지 않는다.
- 이름 지정 이미지 묶음에서 추출한 PNG 바이트는 working 앱 자산으로 Git에
  보존한다. 공개 권리는 검수되지 않았으므로 production 화면에서는 비활성이다.

```sh
npm run assets:visual-local
python3 scripts/build_part2_visual_app_fixture.py
```

검증만 수행:

```sh
python3 scripts/build_part2_visual_app_fixture.py --validate-only
```

이미지는 개발 서버에서만 등록된 asset ID를 통해 제공한다. 저장소에 보존된
원본 PNG 바이트는 production build에 포함되지 않으며 권리 검수 전에는
화면에서 공개하지 않는다.
"""


def entity_ids(payloads: dict[str, Any]) -> dict[str, list[str]]:
    fields = {
        "visual_set": ("visual-sets.json", "visual_set_id"),
        "visual_asset": ("visual-assets.json", "visual_asset_id"),
        "visual_set_asset": (
            "visual-set-assets.json",
            "visual_set_asset_id",
        ),
        "visual_question": (
            "visual-questions.json",
            "visual_question_id",
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

    expected_sets = [f"vs-P2-V{number:02d}" for number in range(1, 13)]
    if ids["visual_set"] != expected_sets:
        raise FixtureError("VisualSet: expected vs-P2-V01..vs-P2-V12")
    if (
        len(ids["visual_asset"]) != 12
        or len(ids["visual_set_asset"]) != 12
        or len(ids["visual_question"]) != 48
        or len(ids["model_answer"]) != 48
    ):
        raise FixtureError("Part 2 exact visual entity counts changed")

    sets = set(ids["visual_set"])
    assets = set(ids["visual_asset"])
    questions = set(ids["visual_question"])
    sources = set(ids["source"])
    for item in payloads["visual-set-assets.json"]:
        if (
            item["visual_set_id"] not in sets
            or item["visual_asset_id"] not in assets
        ):
            raise FixtureError("VisualSetAsset: broken reference")
    for item in payloads["visual-questions.json"]:
        if item["visual_set_id"] not in sets:
            raise FixtureError("VisualQuestion: unknown VisualSet")
    for item in payloads["model-answers.json"]:
        if (
            item["answer_target_type"] != "visual_question"
            or item["answer_target_id"] not in questions
            or item["answer_status"] != "review_needed"
            or item["provenance_kind"] != "unverified_source"
        ):
            raise FixtureError("ModelAnswer: working source contract changed")

    linked = sum(
        bool(item.get("question_id"))
        for item in payloads["visual-questions.json"]
    )
    if linked != 18:
        raise FixtureError("VisualQuestion canonical link count changed")
    if any(
        item["set_type"] == "official_sample"
        for item in payloads["visual-sets.json"]
    ):
        raise FixtureError("official sample must be excluded")

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

    target_ids = {
        "visual_set": sets,
        "visual_question": questions,
        "model_answer": set(ids["model_answer"]),
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

    if set(ids["part_guide"]) != {
        "part-guide-02",
        "part-guide-workbook-02",
    }:
        raise FixtureError("PartGuide workbook/course records must stay separate")
    course_guide = next(
        item
        for item in payloads["part-guides.json"]
        if item["part_guide_id"] == "part-guide-02"
    )
    if course_guide.get("course_target_context") != "level_3":
        raise FixtureError("course PartGuide must preserve level_3 context")
    if (
        len(ids["learning_expression"]) != 6
        or len(ids["practice_drill"]) != 1
        or len(ids["course_insight"]) != 4
    ):
        raise FixtureError("Part 2 course common-material count changed")


def build_file_bytes() -> dict[str, bytes]:
    payloads = selected_payloads()
    validate_payloads(payloads)
    files = {name: json_bytes(value) for name, value in payloads.items()}
    files["README.md"] = build_readme().encode("utf-8")
    ids = entity_ids(payloads)
    linked = sum(
        bool(item.get("question_id"))
        for item in payloads["visual-questions.json"]
    )
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
            "named_visual_asset_manifest": {
                "path": relative_path(
                    ROOT / SAFE_ASSET_ROOT / "manifest.json"
                ),
                "sha256": sha256_file(
                    ROOT / SAFE_ASSET_ROOT / "manifest.json"
                ),
            },
        },
        "script_sha256": sha256_file(Path(__file__)),
        "generated_files": {
            name: sha256_bytes(files[name]) for name in GENERATED_FILES
        },
        "counts": {name: len(values) for name, values in ids.items()},
        "ids": ids,
        "visual_question_links": {
            "linked": linked,
            "unlinked": len(ids["visual_question"]) - linked,
        },
        "validation": {
            "part": 2,
            "official_sample_excluded": True,
            "rights_status_preserved": True,
            "public_allowed": False,
            "asset_bytes_embedded": False,
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
    return {name: len(values) for name, values in entity_ids(payloads).items()}


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
    except (FixtureError, NamedAssetDataError, OSError) as cause:
        print(f"error: {cause}", file=sys.stderr)
        return 1
    action = "Validated" if args.validate_only else "Built"
    print(
        f"{action} Part 2 visual fixture at {args.output_dir} "
        f"(sets={counts['visual_set']}, assets={counts['visual_asset']}, "
        f"questions={counts['visual_question']}, "
        f"model_answers={counts['model_answer']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

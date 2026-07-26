#!/usr/bin/env python3
"""Build and validate the deterministic course-analysis working import."""

from __future__ import annotations

import argparse
import ctypes
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile
from typing import Any, Iterable, Sequence


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "data/working/course-import-v1"
DATASET_ID = "course-working-import-v1"

INPUT_PATHS = (
    "other-output/TSC_1-7강_전체통합분석.md",
    "other-output/lessons/01강_상세분석.md",
    "other-output/lessons/02강_상세분석.md",
    "other-output/lessons/03강_상세분석.md",
    "other-output/lessons/04강_상세분석.md",
    "other-output/lessons/05강_상세분석.md",
    "other-output/lessons/06강_상세분석.md",
    "other-output/lessons/07강_상세분석.md",
    "other-output/study/TSC_1-7강_핵심요약.md",
    "other-output/study/TSC_문제유형별_답변템플릿.md",
    "other-output/study/TSC_복습계획.md",
    "other-output/study/TSC_시험직전_체크리스트.md",
    "other-output/study/TSC_실수와_감점방지.md",
    "other-output/study/TSC_필수표현_암기장.md",
    "other-output/pdf_extracts/01강/2024.05 3급 TSC_5월 제1강.pdf.md",
    "other-output/pdf_extracts/02강/2024.05 3급 TSC_5월 제2강.pdf.md",
    "other-output/pdf_extracts/04강/2024.05 3급 TSC_5월.pdf.md",
    "other-output/pdf_extracts/05강_TSC기출문제.docx.md",
    "other-output/99_validation_report.md",
    "other-output/00_file_inventory.md",
)

SOURCE_CONFIG = {
    INPUT_PATHS[0]: ("src-course-analysis-integrated", "course_analysis"),
    INPUT_PATHS[1]: ("src-course-analysis-lesson-01", "course_analysis"),
    INPUT_PATHS[2]: ("src-course-analysis-lesson-02", "course_analysis"),
    INPUT_PATHS[3]: ("src-course-analysis-lesson-03", "course_analysis"),
    INPUT_PATHS[4]: ("src-course-analysis-lesson-04", "course_analysis"),
    INPUT_PATHS[5]: ("src-course-analysis-lesson-05", "course_analysis"),
    INPUT_PATHS[6]: ("src-course-analysis-lesson-06", "course_analysis"),
    INPUT_PATHS[7]: ("src-course-analysis-lesson-07", "course_analysis"),
    INPUT_PATHS[8]: ("src-course-study-summary", "self_created"),
    INPUT_PATHS[9]: ("src-course-study-templates", "self_created"),
    INPUT_PATHS[10]: ("src-course-study-review-plan", "self_created"),
    INPUT_PATHS[11]: ("src-course-study-checklist", "self_created"),
    INPUT_PATHS[12]: ("src-course-study-mistakes", "self_created"),
    INPUT_PATHS[13]: ("src-course-study-expressions", "self_created"),
    INPUT_PATHS[14]: ("src-course-extract-pdf-01", "other"),
    INPUT_PATHS[15]: ("src-course-extract-pdf-02", "other"),
    INPUT_PATHS[16]: ("src-course-extract-pdf-04", "other"),
    INPUT_PATHS[17]: ("src-course-extract-docx-05", "other"),
    INPUT_PATHS[18]: ("src-course-validation-report", "other"),
    INPUT_PATHS[19]: ("src-course-file-inventory", "other"),
}

CLAIMED_ORIGINAL_NAMES = {
    INPUT_PATHS[0]: [
        "01강 / P01",
        "01강 / V01a",
        "02강 / V02a",
        "02강 / V02b",
        "03강 / V03",
        "04강 / V04c",
        "05강 / V05",
        "06강 / V06",
        "07강 / V07",
        "05강 / D05",
        "02강 / P02",
        "04강 / P04",
        "04강 / V04b",
    ],
    INPUT_PATHS[1]: [
        "V01a — 첫 번째 MP4(19:33 시작)",
        "V01b — 두 번째 MP4(20:22 시작)",
        "lecture1/2024.05 3급 TSC_5월 제1강.pdf",
    ],
    INPUT_PATHS[2]: [
        "V02a — 첫 MP4(19:34 시작)",
        "V02b — 둘째 MP4(20:09 시작)",
        "lecture2/2024.05 3급 TSC_5월 제2강.pdf",
    ],
    INPUT_PATHS[3]: ["lecture3/3강.mp4"],
    INPUT_PATHS[4]: [
        "V04a — 19:31:55 대표 MP4",
        "V04a-dup — 19:31:55 (1) MP4",
        "V04b — 19:41:10 MP4",
        "V04c — 19:55:48 MP4",
        "lecture4/2024.05 3급 TSC_5월.pdf",
    ],
    INPUT_PATHS[5]: [
        "V05 — 5강 MP4(19:36 시작)",
        "lecture5/TSC기출문제.docx",
    ],
    INPUT_PATHS[6]: ["V06 — 6강 MP4(2024-05-27 19:44)"],
    INPUT_PATHS[7]: [
        "V07dup — 7강의 2024-05-27 (1).mp4",
        "V07 — 2024-05-30 09:40 요약 MP4",
    ],
    INPUT_PATHS[8]: ["01강 / V01a", "04강 / V04c"],
    INPUT_PATHS[9]: [
        "01강 / P01",
        "07강 / V07",
        "06강 / V06",
        "05강 / D05",
        "05강 / V05",
    ],
    INPUT_PATHS[10]: [
        "01강 / V01a",
        "06강 / V06",
        "03강 / V03",
        "07강 / V07",
    ],
    INPUT_PATHS[11]: ["01강 / P01", "04강 / V04c"],
    INPUT_PATHS[12]: [
        "01강 / P01",
        "04강 / V04b",
        "05강 / D05",
        "06강 / V06",
        "07강 / V07",
        "04강 / V04c",
    ],
    INPUT_PATHS[13]: [
        "01강 / P01",
        "07강 / V07",
        "02강 / P02",
        "04강 / P04",
        "05강 / D05",
        "06강 / V06",
    ],
    INPUT_PATHS[14]: ["2024.05 3급 TSC_5월 제1강.pdf"],
    INPUT_PATHS[15]: ["2024.05 3급 TSC_5월 제2강.pdf"],
    INPUT_PATHS[16]: ["2024.05 3급 TSC_5월.pdf"],
    INPUT_PATHS[17]: ["TSC기출문제.docx"],
    INPUT_PATHS[18]: ["04강 / V04c", "05강 / V05"],
    INPUT_PATHS[19]: [
        "2024.05 3급 TSC_5월 제1강.pdf",
        "Recording_2024-05-13 19-33-18_[깨진 원본 문자] ... .mp4",
        "Recording_2024-05-13 20-22-28_[깨진 원본 문자] ... .mp4",
        "2024.05 3급 TSC_5월 제2강.pdf",
        "Recording_2024-05-17 19-34-34_[깨진 원본 문자] ... .mp4",
        "Recording_2024-05-17 20-09-15_[깨진 원본 문자] ... .mp4",
        "3강.mp4",
        "2024.05 3급 TSC_5월.pdf",
        "편집충돌 로컬Recording 2024 05 22 19 31 55 ... (1).mp4",
        "편집충돌 로컬Recording 2024 05 22 19 31 55 ... .mp4",
        "편집충돌 로컬Recording 2024 05 22 19 41 10 ... .mp4",
        "Recording 2024 05 22 19 55 48 ... .mp4",
        "TSC기출문제.docx",
        "Recording 2024 05 24 19 36 42 ... .mp4",
        "Recording 2024 05 27 19 44 32 ... .mp4",
        "Recording 2024 05 27 19 44 32 ... (1).mp4",
        "Recording_2024-05-30 09-40-07_[글로벌라운지] ... .mp4",
    ],
}

OUTPUT_FILES = (
    "sources.json",
    "source-references.json",
    "part-guides.json",
    "corrections.json",
    "learning-expressions.json",
    "pronunciation-items.json",
    "practice-drills.json",
    "course-insights.json",
    "model-answer-candidates.json",
    "question-link-candidates.json",
    "conflicts.json",
    "manifest.json",
    "README.md",
)

DATA_FILES = (
    "sources.json",
    "source-references.json",
    "part-guides.json",
    "corrections.json",
    "learning-expressions.json",
    "pronunciation-items.json",
    "practice-drills.json",
    "course-insights.json",
    "model-answer-candidates.json",
    "question-link-candidates.json",
    "conflicts.json",
)

ALLOWED_STATES = {"raw", "review_needed", "draft"}
ALLOWED_EVIDENCE_KINDS = {
    "document_text",
    "screen_text",
    "instructor_speech",
    "analyst_synthesis",
    "generated_study_material",
}
ALLOWED_RELATIONSHIP_KINDS = {
    "extracted_from",
    "claimed_origin",
    "derived_from",
    "supports",
    "self_created",
}
ALLOWED_SOURCE_TYPES = {
    "course_analysis",
    "excel",
    "pdf",
    "instructor_correction",
    "self_created",
    "other",
}
ALLOWED_EXPRESSION_TYPES = {
    "fixed_response",
    "reaction",
    "connector",
    "grammar_pattern",
    "comparison",
    "location",
    "opinion_structure",
    "conclusion",
    "reusable_sentence",
    "other",
}
ALLOWED_DRILL_TYPES = {
    "timed_response",
    "shadowing",
    "correction_recall",
    "picture_accuracy",
    "reaction_drill",
    "structure_recall",
    "pronunciation",
    "self_recording",
    "other",
}
ALLOWED_INSIGHT_TYPES = {
    "strategy",
    "evaluation_focus",
    "time_guidance",
    "common_risk",
    "study_method",
    "test_day_behavior",
    "scope_limitation",
    "other",
}
ALLOWED_COURSE_TARGETS = {"level_3", "not_specified"}

SOURCE_FIELDS = {
    "source_id",
    "title",
    "source_type",
    "provenance_status",
    "creator_or_provider",
    "original_file_name",
    "file_ref",
    "claimed_original_names",
    "sha256",
    "rights_status",
    "source_status",
    "evidence_kind",
    "notes",
}
SOURCE_REFERENCE_FIELDS = {
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
    "evidence_kind",
    "notes",
}
PART_GUIDE_REQUIRED_FIELDS = {
    "part_guide_id",
    "part",
    "goal",
    "preparation_tips",
    "response_structure",
    "response_seconds",
    "key_expressions",
    "key_expression_ids",
    "representative_question_ids",
    "frequent_correction_ids",
    "representative_drill_ids",
    "course_target_context",
    "evidence_kind",
    "source_reference_ids",
    "guide_status",
    "notes",
}
PART_GUIDE_OPTIONAL_FIELDS = {"preparation_seconds"}
LEARNING_EXPRESSION_FIELDS = {
    "expression_id",
    "language",
    "part_numbers",
    "expression_type",
    "usage_context",
    "pattern_or_slots",
    "cautions",
    "related_correction_ids",
    "status",
    "evidence_kind",
    "source_reference_ids",
    "notes",
}
PRONUNCIATION_ITEM_FIELDS = {
    "pronunciation_item_id",
    "target_text",
    "pinyin_or_sound",
    "pronunciation_focus",
    "explanation_ko",
    "example_expression_ids",
    "part_numbers",
    "status",
    "evidence_kind",
    "source_reference_ids",
    "notes",
}
PRACTICE_DRILL_REQUIRED_FIELDS = {
    "drill_id",
    "drill_type",
    "prompt_or_task",
    "completion_criteria",
    "required_content_ids",
    "status",
    "evidence_kind",
    "source_reference_ids",
    "notes",
}
PRACTICE_DRILL_OPTIONAL_FIELDS = {
    "part",
    "preparation_seconds",
    "response_seconds",
}
COURSE_INSIGHT_FIELDS = {
    "insight_id",
    "part_numbers",
    "insight_type",
    "content_ko",
    "course_target_context",
    "evidence_kind",
    "confidence_or_status",
    "source_reference_ids",
    "notes",
}
CONFLICT_REQUIRED_FIELDS = {
    "conflict_id",
    "issue_code",
    "conflict_type",
    "detail",
    "evidence_kind",
    "evidence_locations",
    "conflict_status",
    "notes",
}
EXPECTED_PRONUNCIATION_IDS = [
    "pi-course-priority",
    "pi-course-f-mouth",
    "pi-course-jqx",
    "pi-course-zcs-zhchsh",
    "pi-course-serial-room",
    "pi-course-bi-geng",
    "pi-course-season-money",
    "pi-course-pangbian-erhua",
]
EXPECTED_DRILL_IDS = [
    "drill-course-p1-pronunciation-warmup",
    "drill-course-p2-timed-accuracy",
    "drill-course-p3-timed-reaction",
    "drill-course-p4-timed-structure",
    "drill-course-p5-timed-opinion",
    "drill-course-correction-before-after",
    "drill-course-self-record-mark-errors",
    "drill-course-stop-after-certain-sentence",
    "drill-course-screen-hanzi-keyword",
    "drill-course-typical-vs-personal",
]
REQUIRED_INSIGHT_IDS = {
    "ci-course-pronunciation-priority",
    "ci-course-p2-accuracy",
    "ci-course-p3-utterance-function",
    "ci-course-p4-structure",
    "ci-course-error-accumulation",
    "ci-course-last-five-seconds",
    "ci-course-typical-vs-personal",
    "ci-course-type-and-review",
    "ci-course-old-set-limit",
    "ci-course-part6-7-gap",
}
INSTRUCTOR_REFERENCE_ANCHORS = {
    "sr-pi-course-priority-01": "발음·딕션·성조를 내용보다 뒤로 미루지 않는다.",
    "sr-pi-course-f-mouth-01": "`f` 발음은 윗니와 아랫입술 접촉",
    "sr-pi-course-jqx-01": "`j/q/x` 뒤 모음 표기",
    "sr-pi-course-zcs-zhchsh-01": "`z/c/s`, `zh/ch/sh` 계열",
    "sr-pi-course-serial-room-01": "연속 숫자·호수에서 1과 2의 읽기",
    "sr-pi-course-bi-geng-01": "비교문 `比`의 성조와 `更` 사용",
    "sr-pi-course-season-money-01": "계절 `秋天`, 바람, 가을 관련 성조",
    "sr-pi-course-season-money-02": "월급 관리 Part 4를 25초 길이로 만들며",
    "sr-pi-course-pangbian-erhua-01": "`旁边`은 `边`에 얼화를 더해",
    "sr-ci-course-pronunciation-priority-01": (
        "발음·딕션·성조를 내용보다 뒤로 미루지 않는다."
    ),
    "sr-ci-course-p2-accuracy-01": "Part 2의 핵심은 `짧고 정확하게`",
    "sr-ci-course-p3-utterance-function-01": (
        "모든 입력을 의문문으로 간주하지 않음"
    ),
    "sr-ci-course-p4-structure-01": "직답→특징→관계/사례→정리",
    "sr-ci-course-error-accumulation-01": (
        "전치사·어순·문법 오류가 문장마다 누적"
    ),
    "sr-ci-course-last-five-seconds-01": (
        "약 5초가 남았을 때 확신 없는 표현"
    ),
    "sr-ci-course-typical-vs-personal-01": (
        "전형 문제 모범 답을 암기하고 비전형 답을 직접 만든다."
    ),
    "sr-ci-course-type-and-review-01": (
        "본인이 말한 답을 타이핑해 전치사·어순·문법 오류"
    ),
    "sr-ci-course-old-set-limit-01": (
        "오래된 세트를 그대로 외우는 방식은 새 문제에 약하다고 경고"
    ),
}
PERSONAL_FIELDS = {
    "user_answer_id",
    "learner_ref",
    "learning_status",
    "review_state_id",
    "original_input",
    "corrected_zh",
}


class ImportError(Exception):
    """The course working import does not satisfy its contract."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ImportError(message)


def _sha256_bytes(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def _sha256_file(path: Path) -> str:
    try:
        return _sha256_bytes(path.read_bytes())
    except OSError as error:
        raise ImportError(f"cannot read {path}: {error}") from error


def _safe_input_path(relative_path: str) -> Path:
    _require(
        relative_path in INPUT_PATHS,
        f"unregistered input path: {relative_path}",
    )
    path = ROOT / relative_path
    current = path
    while current != ROOT:
        _require(
            not current.is_symlink(),
            f"input path must not contain a symlink: {relative_path}",
        )
        current = current.parent
    try:
        resolved = path.resolve(strict=True)
        resolved.relative_to((ROOT / "other-output").resolve(strict=True))
    except (OSError, ValueError) as error:
        raise ImportError(
            f"input path is missing or outside other-output: {relative_path}"
        ) from error
    _require(resolved.is_file(), f"input path is not a file: {relative_path}")
    return resolved


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _read_text(relative_path: str) -> str:
    path = _safe_input_path(relative_path)
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise ImportError(f"cannot read {relative_path}: {error}") from error


def _first_heading(text: str, relative_path: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    raise ImportError(f"{relative_path} has no level-one heading")


def _source_notes(relative_path: str) -> str:
    if "/pdf_extracts/" in relative_path:
        if relative_path.endswith("05강_TSC기출문제.docx.md"):
            return (
                "DOCX OOXML 텍스트 추출 Markdown이다. 주장된 원본 "
                "TSC기출문제.docx는 현재 저장소에 없음. 전체 페이지 시각 렌더를 "
                "확인하지 못했고 취소선·페이지 표식 해석에 제한이 있다."
            )
        return (
            "PDF 텍스트 추출 Markdown이다. 주장된 원본 PDF는 현재 저장소에 없음. "
            "텍스트 레이어와 렌더 검토 결과를 보존하지만 원본 자체의 공개 권리와 "
            "현재 시험 정보 여부는 확인되지 않았다."
        )
    if "/lessons/" in relative_path or relative_path.endswith(
        "TSC_1-7강_전체통합분석.md"
    ):
        return (
            "원본 영상·문서에서 만든 분석 Markdown이다. 주장된 MP4/PDF/DOCX "
            "원본은 현재 저장소에 없음. 자동 전사는 로컬 한국어 모델의 한계가 "
            "있으므로 중국어를 검수 완료 데이터로 간주하지 않는다."
        )
    if "/study/" in relative_path:
        return (
            "분석 결과에서 생성된 학습용 Markdown이다. 주장된 원본 강의 파일은 "
            "현재 저장소에 없음. 자동 전사와 부분 병음의 한계를 상속하므로 "
            "generated study material을 검수 완료 콘텐츠로 간주하지 않는다."
        )
    if relative_path.endswith("99_validation_report.md"):
        return (
            "처리 완전성 검증 보고서다. 원본 파일 처리와 산출물 구조를 다루며 "
            "중국어 표현이나 시험 규칙의 내용 검수를 의미하지 않는다. 원본 "
            "MP4/PDF/DOCX는 현재 저장소에 없음."
        )
    return (
        "원본 파일 인벤토리다. 주장된 MP4/PDF/DOCX 원본은 현재 저장소에 없음. "
        "파일명·중복·도구 제한을 보존하며 실제 원본 Source를 생성하지 않는다."
    )


def _source_evidence_kind(relative_path: str) -> str:
    if "/pdf_extracts/" in relative_path:
        return "document_text"
    if "/study/" in relative_path:
        return "generated_study_material"
    return "analyst_synthesis"


def _source_provenance_status(relative_path: str) -> str:
    if "/study/" in relative_path:
        return "self_created"
    return "unverified_source"


def _build_sources() -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for relative_path in INPUT_PATHS:
        path = ROOT / relative_path
        _require(path.is_file(), f"required Markdown input is missing: {relative_path}")
        source_id, source_type = SOURCE_CONFIG[relative_path]
        text = _read_text(relative_path)
        sources.append(
            {
                "source_id": source_id,
                "title": _first_heading(text, relative_path),
                "source_type": source_type,
                "provenance_status": _source_provenance_status(relative_path),
                "creator_or_provider": "",
                "original_file_name": path.name,
                "file_ref": relative_path,
                "claimed_original_names": CLAIMED_ORIGINAL_NAMES[relative_path],
                "sha256": _sha256_file(path),
                "rights_status": "review_needed",
                "source_status": "review_needed",
                "evidence_kind": _source_evidence_kind(relative_path),
                "notes": _source_notes(relative_path),
            }
        )
    return sources


class ReferenceBuilder:
    def __init__(self) -> None:
        self.items: list[dict[str, Any]] = []
        self.target_counts: dict[str, int] = {}

    def add(
        self,
        *,
        target_type: str,
        target_id: str,
        source_id: str,
        source_locator: str,
        evidence_kind: str,
        relationship_kind: str = "extracted_from",
        notes: str = "",
    ) -> str:
        _require(
            evidence_kind in ALLOWED_EVIDENCE_KINDS,
            f"unsupported evidence kind: {evidence_kind}",
        )
        count = self.target_counts.get(target_id, 0) + 1
        self.target_counts[target_id] = count
        reference_id = f"sr-{target_id}-{count:02d}"
        self.items.append(
            {
                "source_reference_id": reference_id,
                "target_type": target_type,
                "target_id": target_id,
                "source_id": source_id,
                "source_locator": source_locator,
                "relationship_kind": relationship_kind,
                "claimed_source_name": "",
                "claimed_source_url": "",
                "source_grade": "",
                "originality": "",
                "evidence_kind": evidence_kind,
                "verification_status": "review_needed",
                "notes": notes,
            }
        )
        return reference_id


def _build_part_guides(refs: ReferenceBuilder) -> list[dict[str, Any]]:
    definitions = (
        (
            1,
            "이름, 생년월일, 가족, 소속 네 고정 질문에 짧게 답한다.",
            [],
            ["이름", "생년월일", "가족", "소속"],
            None,
            10,
            ["drill-course-p1-pronunciation-warmup"],
            "자료는 고정 질문과 짧은 응답만 제시한다.",
        ),
        (
            2,
            "그림의 위치, 존재, 비교, 동작, 시간, 수량을 질문에 맞춰 말한다.",
            ["그림의 대상·관계·수량을 먼저 확인한다."],
            ["그림 핵심 정보 확인", "의문사 자리에 답 정보", "한 문장으로 답하기"],
            3,
            6,
            ["drill-course-p2-timed-accuracy"],
            "길이보다 그림 정보와 문장 정확성을 우선한다.",
        ),
        (
            3,
            "상대 발화의 기능과 대상을 파악해 자연스러운 다음 말을 한다.",
            ["감사·부탁·초대·축하·곤란의 기능을 먼저 파악한다."],
            ["쿠션·리액션", "직접 수락·거절·공감", "후속 질문·대안"],
            2,
            15,
            ["drill-course-p3-timed-reaction"],
            "모든 발화를 질문으로 처리하지 않는다.",
        ),
        (
            4,
            "화제에 직접 답하고 이유와 구체 사례를 연결한다.",
            ["입장 또는 사실, 이유, 경험·예, 정리를 준비한다."],
            ["직접 답", "이유·세부 또는 사례", "정리"],
            15,
            25,
            ["drill-course-p4-timed-structure"],
            "강의의 3급·4급 표현은 수준 체계 확인이 필요하다.",
        ),
        (
            5,
            "의견·사회 문제에 입장과 근거를 순서화해 답한다.",
            ["입장, 이유·장단점, 구체 예 또는 대책, 마무리를 정한다."],
            ["입장", "이유 또는 장단점", "구체 예 또는 대책", "마무리"],
            30,
            50,
            ["drill-course-p5-timed-opinion"],
            "강의는 3급 목표에서 정확한 문장을 먼저 확보하도록 안내한다.",
        ),
        (
            6,
            "상황에 대응한다.",
            [],
            [],
            30,
            40,
            [],
            "근거 부족: 전체 구성과 시간만 확인됐고 상세 답변 훈련이 거의 없다.",
        ),
        (
            7,
            "그림 순서와 마지막 반전을 확인한다.",
            ["그림 순서와 마지막 반전을 확인한다."],
            [],
            30,
            90,
            [],
            "근거 부족: 예고 수준 자료만 있으며 완전한 90초 템플릿은 없다.",
        ),
    )
    guides: list[dict[str, Any]] = []
    for (
        part,
        goal,
        tips,
        structure,
        preparation_seconds,
        response_seconds,
        drill_ids,
        notes,
    ) in definitions:
        guide_id = f"part-guide-{part:02d}"
        reference_id = refs.add(
            target_type="part_guide",
            target_id=guide_id,
            source_id="src-course-analysis-integrated",
            source_locator=(
                "## 3. 문제 유형별 완전 정리 / "
                f"### Part {part if part <= 5 else '6·7'}"
            ),
            evidence_kind="analyst_synthesis",
            relationship_kind="derived_from",
            notes="통합분석의 Part별 설명에서 working 가이드로 옮김.",
        )
        guide = {
            "part_guide_id": guide_id,
            "part": part,
            "goal": goal,
            "preparation_tips": tips,
            "response_structure": structure,
            "response_seconds": response_seconds,
            "key_expressions": [],
            "key_expression_ids": [],
            "representative_question_ids": [],
            "frequent_correction_ids": [],
            "representative_drill_ids": drill_ids,
            "course_target_context": "level_3",
            "evidence_kind": "analyst_synthesis",
            "source_reference_ids": [reference_id],
            "guide_status": "draft",
            "notes": notes,
        }
        if preparation_seconds is not None:
            guide["preparation_seconds"] = preparation_seconds
        guides.append(guide)
    return guides


def _split_markdown_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _expression_rows() -> list[list[str]]:
    relative_path = "other-output/study/TSC_필수표현_암기장.md"
    rows: list[list[str]] = []
    for line in _read_text(relative_path).splitlines():
        if not re.match(r"^\|\s*\d+\s*\|", line):
            continue
        cells = _split_markdown_row(line)
        _require(
            len(cells) == 7,
            f"{relative_path} expression row has {len(cells)} columns: {line}",
        )
        rows.append(cells)
    _require(len(rows) == 37, f"expected 37 expression rows, found {len(rows)}")
    _require(
        [int(row[0]) for row in rows] == list(range(1, 38)),
        "expression sequence must remain 1..37",
    )
    return rows


def _build_learning_expressions(
    refs: ReferenceBuilder,
) -> list[dict[str, Any]]:
    expression_types = {
        1: "fixed_response",
        2: "fixed_response",
        3: "fixed_response",
        4: "comparison",
        5: "comparison",
        6: "location",
        7: "location",
        8: "comparison",
        9: "reaction",
        10: "reaction",
        11: "reaction",
        12: "reaction",
        13: "reaction",
        14: "reaction",
        15: "reaction",
        16: "reaction",
        17: "reaction",
        18: "reaction",
        19: "reaction",
        23: "opinion_structure",
        24: "opinion_structure",
        25: "opinion_structure",
        26: "grammar_pattern",
        34: "connector",
        36: "opinion_structure",
        37: "conclusion",
    }
    expressions: list[dict[str, Any]] = []
    for cells in _expression_rows():
        sequence = int(cells[0])
        expression_id = f"le-course-{sequence:03d}"
        raw_pinyin = cells[2]
        complete_pinyin = raw_pinyin if sequence in (16, 17, 18) else ""
        part_match = re.search(r"Part\s*([1-7])", cells[4])
        reference_id = refs.add(
            target_type="learning_expression",
            target_id=expression_id,
            source_id="src-course-study-expressions",
            source_locator=f"필수표현 표 / 번호 {sequence}",
            evidence_kind="generated_study_material",
            relationship_kind="self_created",
            notes=f"원문 출처 표기 보존: {cells[6]}",
        )
        if complete_pinyin:
            notes = (
                f"원본 병음 셀: {raw_pinyin}. 전체 문장 병음으로 보이는 원문 "
                f"표기를 그대로 보존했으며 검수가 필요하다. 원문 출처: {cells[6]}"
            )
            status = "review_needed"
        else:
            notes = (
                f"원본 병음 셀: {raw_pinyin}. 전체 문장 병음으로 확인되지 않아 "
                f"pinyin을 비워 두었다. 원문 출처: {cells[6]}"
            )
            status = "raw"
        expressions.append(
            {
                "expression_id": expression_id,
                "language": {
                    "zh": cells[1],
                    "pinyin": complete_pinyin,
                    "ko": cells[3],
                },
                "part_numbers": (
                    [int(part_match.group(1))] if part_match else []
                ),
                "expression_type": expression_types.get(
                    sequence, "reusable_sentence"
                ),
                "usage_context": cells[4],
                "pattern_or_slots": cells[1] if "XX" in cells[1] else "",
                "cautions": cells[5],
                "related_correction_ids": [],
                "status": status,
                "evidence_kind": "generated_study_material",
                "source_reference_ids": [reference_id],
                "notes": notes,
            }
        )
    return expressions


def _build_pronunciation_items(
    refs: ReferenceBuilder,
) -> list[dict[str, Any]]:
    definitions = (
        (
            "pi-course-priority",
            "중국어 답변 전체",
            [1, 2, 3, 4, 5],
            "발음·딕션·성조",
            "고급 표현보다 또렷한 발음과 성조를 우선한다.",
            [],
            (
                (
                    "src-course-analysis-lesson-01",
                    "[01강 / V01a / 00:11:00-00:12:12]",
                ),
            ),
        ),
        (
            "pi-course-f-mouth",
            "f",
            [2, 3],
            "윗니와 아랫입술을 사용하는 입 모양",
            "f는 윗니와 아랫입술을 쓰는 입 모양으로 지도했다.",
            [],
            (
                (
                    "src-course-analysis-lesson-02",
                    "[02강 / V02a / 00:00:00-00:08:33]",
                ),
            ),
        ),
        (
            "pi-course-jqx",
            "j/q/x 뒤 모음",
            [2, 4, 5],
            "j/q/x 뒤 모음 구분",
            "j/q/x 뒤 모음을 개별 교정한 항목으로 보존한다.",
            [],
            (
                (
                    "src-course-analysis-lesson-05",
                    "[05강 / V05 / 00:34:19-00:36:51]",
                ),
            ),
        ),
        (
            "pi-course-zcs-zhchsh",
            "z/c/s와 zh/ch/sh",
            [2, 4, 5],
            "평설음과 권설음 구분",
            "z/c/s와 zh/ch/sh를 개별 교정한 항목으로 보존한다.",
            [],
            (
                (
                    "src-course-analysis-lesson-05",
                    "[05강 / V05 / 00:34:19-00:36:51]",
                ),
            ),
        ),
        (
            "pi-course-serial-room",
            "연속 숫자·호수",
            [2],
            "연속 숫자와 호수 발음",
            "연속 숫자와 호수 발음을 개별 교정한 항목으로 보존한다.",
            [],
            (
                (
                    "src-course-analysis-lesson-01",
                    "[01강 / V01b / 00:00:08-00:08:25]",
                ),
            ),
        ),
        (
            "pi-course-bi-geng",
            "比/更",
            [2],
            "비교 표현 발음",
            "비교 표현 比와 更의 발음을 개별 교정한 항목으로 보존한다.",
            ["le-course-004", "le-course-008"],
            (
                (
                    "src-course-analysis-lesson-01",
                    "[01강 / V01a / 00:17:05-00:18:02]",
                ),
            ),
        ),
        (
            "pi-course-season-money",
            "계절·돈 관련 단어",
            [4, 5],
            "계절과 돈 관련 어휘 발음",
            "계절과 돈 관련 단어를 개별 교정한 항목으로 보존한다.",
            [],
            (
                (
                    "src-course-analysis-lesson-06",
                    "[06강 / V06 / 00:37:50-00:38:11]",
                ),
                (
                    "src-course-analysis-lesson-05",
                    "[05강 / V05 / 00:15:49-00:39:38]",
                ),
            ),
        ),
        (
            "pi-course-pangbian-erhua",
            "旁边",
            [2],
            "旁边의 얼화",
            "旁边의 边에는 얼화를 더하면 자연스럽다고 안내했다.",
            ["le-course-007"],
            (
                (
                    "src-course-analysis-lesson-07",
                    "[07강 / V07 / 00:01:06-00:01:19]",
                ),
            ),
        ),
    )
    result: list[dict[str, Any]] = []
    for (
        item_id,
        target_text,
        parts,
        focus,
        explanation,
        expression_ids,
        reference_specs,
    ) in definitions:
        reference_ids = [
            refs.add(
                target_type="pronunciation_item",
                target_id=item_id,
                source_id=source_id,
                source_locator=locator,
                evidence_kind="instructor_speech",
                relationship_kind="supports",
                notes=(
                    "상세분석에 기록된 강사 발언과 타임스탬프다. 원본 영상이 "
                    "저장소에 없어 검수 대기로 유지하고 음성·병음을 생성하지 않는다."
                ),
            )
            for source_id, locator in reference_specs
        ]
        result.append(
            {
                "pronunciation_item_id": item_id,
                "target_text": target_text,
                "pinyin_or_sound": "",
                "pronunciation_focus": focus,
                "explanation_ko": explanation,
                "example_expression_ids": expression_ids,
                "part_numbers": parts,
                "status": "review_needed",
                "evidence_kind": "instructor_speech",
                "source_reference_ids": reference_ids,
                "notes": "정량 속도·억양 기준이나 새 병음은 포함하지 않는다.",
            }
        )
    return result


def _build_practice_drills(refs: ReferenceBuilder) -> list[dict[str, Any]]:
    definitions = (
        (
            "drill-course-p1-pronunciation-warmup",
            1,
            "pronunciation",
            "Part 1 네 고정 답을 화면 없이 소리 내어 말해 발음을 푼다.",
            None,
            10,
            "네 고정 답을 짧고 또렷하게 말한다.",
            ["part-guide-01"],
            (
                (
                    "src-course-study-review-plan",
                    "## 2회차 복습: 화면 없이 말하기 / Part 1",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 2. TSC 시험에 관한 전체 설명 / "
                    "### 자료에서 확인된 전체 구성 / | 1 |; "
                    "## 5. 강사가 제시한 공부법 총정리 / "
                    "1. 고정 Part 1 답",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-p2-timed-accuracy",
            2,
            "picture_accuracy",
            "3초 동안 그림을 확인하고 6초 안에 한 문장으로 정확히 답한다.",
            3,
            6,
            "그림의 핵심 정보에 맞는 한 문장으로 답한다.",
            ["part-guide-02"],
            (
                (
                    "src-course-study-review-plan",
                    "## 2회차 복습: 화면 없이 말하기 / Part 2",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 2. TSC 시험에 관한 전체 설명 / "
                    "### 자료에서 확인된 전체 구성 / | 2 |; "
                    "## 3. 문제 유형별 완전 정리 / ### Part 2",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-p3-timed-reaction",
            3,
            "reaction_drill",
            "2초 준비 후 15초 안에 발화 기능에 맞는 첫 반응을 말한다.",
            2,
            15,
            "상대 발화의 기능에 맞는 첫 반응을 말한다.",
            ["part-guide-03"],
            (
                (
                    "src-course-study-review-plan",
                    "## 2회차 복습: 화면 없이 말하기 / Part 3",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 2. TSC 시험에 관한 전체 설명 / "
                    "### 자료에서 확인된 전체 구성 / | 3 |; "
                    "## 3. 문제 유형별 완전 정리 / ### Part 3",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-p4-timed-structure",
            4,
            "timed_response",
            "15초 동안 구조를 준비하고 Part 4 전형 주제를 25초 안에 답한다.",
            15,
            25,
            "직접 답, 이유·세부 또는 사례, 정리 순서를 사용한다.",
            ["part-guide-04"],
            (
                (
                    "src-course-study-review-plan",
                    "## 2회차 복습: 화면 없이 말하기 / Part 4",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 2. TSC 시험에 관한 전체 설명 / "
                    "### 자료에서 확인된 전체 구성 / | 4 |; "
                    "## 3. 문제 유형별 완전 정리 / ### Part 4",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-p5-timed-opinion",
            5,
            "timed_response",
            "30초 동안 순서를 준비하고 Part 5 의견을 50초 안에 답한다.",
            30,
            50,
            "입장, 이유 또는 장단점, 구체 예 또는 대책, 마무리 순서를 사용한다.",
            ["part-guide-05"],
            (
                (
                    "src-course-study-review-plan",
                    "## 2회차 복습: 화면 없이 말하기 / Part 5",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 2. TSC 시험에 관한 전체 설명 / "
                    "### 자료에서 확인된 전체 구성 / | 5 |; "
                    "## 3. 문제 유형별 완전 정리 / ### Part 5",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-correction-before-after",
            None,
            "correction_recall",
            "본인이 실제로 말한 답, 수정 답과 이유를 함께 기록한다.",
            None,
            None,
            "실제 답, 수정 답과 수정 이유를 함께 남긴다.",
            [],
            (
                (
                    "src-course-study-review-plan",
                    "## 오답 관리",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 5. 강사가 제시한 공부법 총정리 / "
                    "5. 본인의 실제 답을 타이핑",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-self-record-mark-errors",
            None,
            "self_recording",
            "실제 시간을 재며 답변을 녹음하고 오류가 난 위치를 표시한다.",
            None,
            None,
            "발음·성조, 침묵, 전치사와 어순 오류를 녹음에서 표시한다.",
            [],
            (
                (
                    "src-course-study-review-plan",
                    "## 녹음 확인",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 5. 강사가 제시한 공부법 총정리 / "
                    "7. 15초 준비+25초 답",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-stop-after-certain-sentence",
            None,
            "other",
            "답변 마지막 약 5초에는 확실한 문장만 추가하고 불확실하면 멈춘다.",
            None,
            None,
            "확실하지 않은 문장을 시간 채우기용으로 덧붙이지 않는다.",
            [],
            (
                (
                    "src-course-study-review-plan",
                    "## 시험 전 점검 / 마지막 약 5초",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "### 감점 가능성이 있다고 말한 것 / 마지막 5초",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-screen-hanzi-keyword",
            None,
            "other",
            "Part 4·5 화면 질문의 한자에서 핵심 뜻과 주제 어휘를 확인한다.",
            None,
            None,
            "질문 전체를 모른다는 이유로 침묵하지 않고 확인한 핵심어를 기준으로 준비한다.",
            ["part-guide-04", "part-guide-05"],
            (
                (
                    "src-course-study-checklist",
                    "## Part 4 / 질문 한자의 핵심 뜻; "
                    "## 시험 구조 / 질문 한자",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "### 반복적으로 강조한 것 / Part 4의 중요성",
                    "analyst_synthesis",
                ),
            ),
        ),
        (
            "drill-course-typical-vs-personal",
            4,
            "structure_recall",
            "전형 답은 반복해 익히고 비전형 질문은 자신의 실제 경험으로 다시 만든다.",
            None,
            None,
            "비전형 답에 사용자가 말하지 않은 경험을 만들지 않고 자신의 가족·회사·취미를 사용한다.",
            ["part-guide-04"],
            (
                (
                    "src-course-study-review-plan",
                    "## 반복 연습",
                    "generated_study_material",
                ),
                (
                    "src-course-analysis-integrated",
                    "## 5. 강사가 제시한 공부법 총정리 / "
                    "6. 전형 Part 4 모범 답",
                    "analyst_synthesis",
                ),
            ),
        ),
    )
    result: list[dict[str, Any]] = []
    for (
        item_id,
        part,
        drill_type,
        prompt,
        preparation_seconds,
        response_seconds,
        completion_criteria,
        required_content_ids,
        reference_specs,
    ) in definitions:
        reference_ids = [
            refs.add(
                target_type="practice_drill",
                target_id=item_id,
                source_id=source_id,
                source_locator=locator,
                evidence_kind=evidence_kind,
                relationship_kind=(
                    "derived_from"
                    if evidence_kind == "generated_study_material"
                    else "supports"
                ),
                notes="날짜·반복 횟수를 새로 만들지 않은 working 연습 항목.",
            )
            for source_id, locator, evidence_kind in reference_specs
        ]
        drill = {
            "drill_id": item_id,
            "drill_type": drill_type,
            "prompt_or_task": prompt,
            "completion_criteria": completion_criteria,
            "required_content_ids": required_content_ids,
            "status": "review_needed",
            "evidence_kind": "generated_study_material",
            "source_reference_ids": reference_ids,
            "notes": "정확한 반복 횟수와 복습 일정은 자료에 없어 추가하지 않는다.",
        }
        if part is not None:
            drill["part"] = part
        if preparation_seconds is not None:
            drill["preparation_seconds"] = preparation_seconds
        if response_seconds is not None:
            drill["response_seconds"] = response_seconds
        result.append(drill)
    return result


def _build_course_insights(refs: ReferenceBuilder) -> list[dict[str, Any]]:
    direct_instructor_evidence = {
        "ci-course-pronunciation-priority": (
            "src-course-analysis-lesson-01",
            "[01강 / V01a / 00:11:00-00:12:12]",
        ),
        "ci-course-p2-accuracy": (
            "src-course-analysis-lesson-01",
            "[01강 / V01a / 00:13:29-00:15:10]",
        ),
        "ci-course-p3-utterance-function": (
            "src-course-analysis-lesson-01",
            "[01강 / V01a / 00:02:03-00:03:44]",
        ),
        "ci-course-p4-structure": (
            "src-course-analysis-lesson-04",
            "[04강 / V04c / 00:14:13-00:19:23]",
        ),
        "ci-course-error-accumulation": (
            "src-course-analysis-lesson-04",
            "[04강 / V04c / 00:44:18-00:46:27]",
        ),
        "ci-course-last-five-seconds": (
            "src-course-analysis-lesson-04",
            "[04강 / V04c / 00:46:27-00:47:24]",
        ),
        "ci-course-typical-vs-personal": (
            "src-course-analysis-lesson-06",
            "[06강 / V06 / 00:13:32-00:13:47]",
        ),
        "ci-course-type-and-review": (
            "src-course-analysis-lesson-04",
            "[04강 / V04c / 00:45:26-00:45:53]",
        ),
        "ci-course-old-set-limit": (
            "src-course-analysis-lesson-05",
            "`00:07-00:15`",
        ),
    }
    definitions = (
        (
            "ci-course-pronunciation-priority",
            [1, 2, 3, 4, 5],
            "strategy",
            "고급 어휘보다 발음·딕션·성조와 쉬운 정확한 문장을 우선한다.",
            "level_3",
            "src-course-analysis-integrated",
            "### 반복적으로 강조한 것; "
            "## 8. 발음과 성조 통합 / 최다 반복 항목",
            "analyst_synthesis",
        ),
        (
            "ci-course-p2-accuracy",
            [2],
            "evaluation_focus",
            "Part 2는 답변 길이보다 그림 정보와 한 문장의 정확성을 우선한다.",
            "level_3",
            "src-course-analysis-integrated",
            "### 특정 문제에서만 적용되는 것 / Part 2",
            "analyst_synthesis",
        ),
        (
            "ci-course-p3-utterance-function",
            [3],
            "common_risk",
            "Part 3의 모든 발화를 질문으로 가정하지 말고 진술에도 기능에 맞게 반응한다.",
            "level_3",
            "src-course-analysis-integrated",
            "### 특정 문제에서만 적용되는 것 / Part 3",
            "analyst_synthesis",
        ),
        (
            "ci-course-p4-structure",
            [4],
            "strategy",
            "Part 4는 직접 답변, 이유, 구체 사례, 정리 순서로 답한다.",
            "level_3",
            "src-course-analysis-integrated",
            "## 3. 문제 유형별 완전 정리 / ### Part 4",
            "analyst_synthesis",
        ),
        (
            "ci-course-error-accumulation",
            [2, 3, 4, 5],
            "common_risk",
            "긴 답변에서 전치사와 어순을 포함한 문법 오류가 누적될 수 있다.",
            "level_3",
            "src-course-analysis-integrated",
            "### 감점 가능성이 있다고 말한 것",
            "analyst_synthesis",
        ),
        (
            "ci-course-last-five-seconds",
            [4, 5],
            "test_day_behavior",
            "마지막 약 5초에는 문법과 발음이 확실한 문장만 추가하고 불확실하면 멈춘다.",
            "level_3",
            "src-course-analysis-integrated",
            "### 감점 가능성이 있다고 말한 것 / 마지막 5초",
            "analyst_synthesis",
        ),
        (
            "ci-course-typical-vs-personal",
            [4],
            "study_method",
            "전형 답은 외우고 비전형 질문은 자신의 가족·회사·취미 경험으로 준비한다.",
            "level_3",
            "src-course-analysis-integrated",
            "## 5. 강사가 제시한 공부법 총정리 / "
            "6. 전형 Part 4 모범 답",
            "analyst_synthesis",
        ),
        (
            "ci-course-type-and-review",
            [2, 3, 4, 5],
            "study_method",
            "본인이 실제로 말한 답을 타이핑하고 수정 전후와 이유를 기록한 뒤 수정 문장을 복습한다.",
            "level_3",
            "src-course-analysis-integrated",
            "## 5. 강사가 제시한 공부법 총정리 / "
            "5. 본인의 실제 답을 타이핑; "
            "## 5. 강사가 제시한 공부법 총정리 / "
            "9. 예습만 늘리지 말고",
            "analyst_synthesis",
        ),
        (
            "ci-course-old-set-limit",
            [],
            "common_risk",
            "오래된 기출 세트가 그대로 출제될 것이라고 믿고 통째로 외우는 방식에만 의존하지 않는다.",
            "level_3",
            "src-course-analysis-integrated",
            "### 피해야 하는 것 / 오래된 세트",
            "analyst_synthesis",
        ),
        (
            "ci-course-part6-7-gap",
            [6, 7],
            "scope_limitation",
            "Part 6과 Part 7은 현재 과정에서 상세 답변 훈련 근거가 부족하다.",
            "level_3",
            "src-course-analysis-integrated",
            "## 3. 문제 유형별 완전 정리 / ### Part 6·7",
            "analyst_synthesis",
        ),
        (
            "ci-course-scope",
            [],
            "scope_limitation",
            "전체 과정은 3급 대비 자료이며 Level 8 근거로 사용할 수 없다.",
            "level_3",
            "src-course-analysis-integrated",
            "## 1. 전체 강의 개요",
            "analyst_synthesis",
        ),
        (
            "ci-course-processing-scope",
            [],
            "scope_limitation",
            "MP4 13개, PDF 3개 261페이지, DOCX 1개가 처리 대상으로 기록됐다.",
            "not_specified",
            "src-course-validation-report",
            "## 2. 처리 완료 파일 수",
            "analyst_synthesis",
        ),
        (
            "ci-course-transcription-limit",
            [],
            "scope_limitation",
            "중국어 음성은 로컬 한국어 모델에서 오인될 수 있어 사람 재확인이 필요하다.",
            "not_specified",
            "src-course-validation-report",
            "## 1. 최종 판정; ## 8. 사람이 직접 재확인하면 좋은 구간",
            "analyst_synthesis",
        ),
        (
            "ci-course-document-limit",
            [],
            "scope_limitation",
            "DOCX는 OOXML 전체 텍스트를 추출했지만 전체 페이지 시각 렌더를 확인하지 못했다.",
            "not_specified",
            "src-course-validation-report",
            "## 4. PDF·DOCX 검증 결과",
            "analyst_synthesis",
        ),
        (
            "ci-course-duplicate-media",
            [],
            "scope_limitation",
            "04강 한 쌍과 06·07강 한 쌍의 영상이 SHA-256 완전 중복으로 기록됐다.",
            "not_specified",
            "src-course-file-inventory",
            "## 완전 중복 파일",
            "analyst_synthesis",
        ),
        (
            "ci-course-review-schedule-limit",
            [],
            "scope_limitation",
            "강의에서 정확한 일수와 반복 횟수를 제시하지 않아 날짜형 계획을 만들지 않는다.",
            "not_specified",
            "src-course-study-review-plan",
            "문서 서문; ## 반복 연습",
            "generated_study_material",
        ),
    )
    result: list[dict[str, Any]] = []
    for (
        item_id,
        part_numbers,
        insight_type,
        content,
        course_target_context,
        source_id,
        locator,
        evidence_kind,
    ) in definitions:
        reference_ids: list[str] = []
        item_evidence_kind = evidence_kind
        if item_id in direct_instructor_evidence:
            direct_source_id, direct_locator = direct_instructor_evidence[item_id]
            reference_ids.append(
                refs.add(
                    target_type="course_insight",
                    target_id=item_id,
                    source_id=direct_source_id,
                    source_locator=direct_locator,
                    evidence_kind="instructor_speech",
                    relationship_kind="supports",
                    notes=(
                        "상세분석에 강사 발언으로 기록된 타임스탬프다. 원본 영상은 "
                        "저장소에 없어 verification_status를 review_needed로 유지한다."
                    ),
                )
            )
            item_evidence_kind = "instructor_speech"
        reference_ids.append(
            refs.add(
                target_type="course_insight",
                target_id=item_id,
                source_id=source_id,
                source_locator=locator,
                evidence_kind=evidence_kind,
                relationship_kind="derived_from",
                notes=(
                    "분석 또는 재구성 문서에서 정리한 근거이며 강사 직접 발언으로 "
                    "자동 승격하지 않는다."
                ),
            )
        )
        result.append(
            {
                "insight_id": item_id,
                "part_numbers": part_numbers,
                "insight_type": insight_type,
                "content_ko": content,
                "course_target_context": course_target_context,
                "evidence_kind": item_evidence_kind,
                "confidence_or_status": "review_needed",
                "source_reference_ids": reference_ids,
                "notes": "working 분석 항목이며 공식 시험 규칙이나 reviewed 콘텐츠가 아니다.",
            }
        )
    return result


CORRECTION_CANDIDATES = (
    (1, "哥哥比弟弟很高。", "", "哥哥比弟弟更高。", "비교 부사"),
    (2, "我10年工作了。", "", "我工作10年了。", "기간 어순"),
    (3, "他们在图书馆做读书。", "", "他们在图书馆看书。", "동사 결합"),
    (5, "每天每天努力学习了。", "", "每天都努力学习。", "시간어 중복"),
    (6, "物价越来越很贵。", "", "物价越来越贵。", "정도 중복"),
    (7, "一个小时半", "", "一个半小时", "수량 어순"),
    (8, "健身房对天气不影响。", "", "健身房不受天气的影响。", "관계 표현"),
    (9, "香蕉很更重。", "", "香蕉更重。", "비교 중복"),
    (10, "", "질문은 노래, 답은 춤만 말함", "不是，她在跳舞。", "부정 누락"),
)


def _conflict(
    *,
    conflict_id: str,
    issue_code: str,
    conflict_type: str,
    detail: str,
    source_id: str,
    source_locator: str,
    evidence_kind: str,
    notes: str,
    candidate: dict[str, Any] | None = None,
    extra_sources: Sequence[tuple[str, str, str]] = (),
) -> dict[str, Any]:
    evidence_locations = [
        {
            "source_id": source_id,
            "source_locator": source_locator,
            "evidence_kind": evidence_kind,
        }
    ]
    for extra_source_id, extra_locator, extra_evidence_kind in extra_sources:
        evidence_locations.append(
            {
                "source_id": extra_source_id,
                "source_locator": extra_locator,
                "evidence_kind": extra_evidence_kind,
            }
        )
    result: dict[str, Any] = {
        "conflict_id": conflict_id,
        "issue_code": issue_code,
        "conflict_type": conflict_type,
        "detail": detail,
        "evidence_kind": evidence_kind,
        "evidence_locations": evidence_locations,
        "conflict_status": "review_needed",
        "notes": notes,
    }
    if candidate is not None:
        result["candidate"] = candidate
    return result


def _build_conflicts() -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    for sequence, (
        source_table_row,
        wrong,
        wrong_description,
        correct,
        error_type,
    ) in enumerate(
        CORRECTION_CANDIDATES, start=1
    ):
        detail = (
            "잘못된 표현과 수정 표현 전체에 대응하는 완전한 문장 병음이 없어 "
            "canonical Correction으로 만들 수 없다."
        )
        extra_sources: tuple[tuple[str, str, str], ...] = ()
        candidate = {
            "sequence": sequence,
            "error_type": error_type,
            "wrong": wrong,
            "wrong_description": wrong_description,
            "correct": correct,
            "wrong_pinyin": "",
            "correct_pinyin": "",
        }
        if not wrong:
            detail = (
                "정확한 wrong_zh 원문이 없고 수정 표현 전체에 대응하는 완전한 "
                "문장 병음도 없어 canonical Correction으로 만들 수 없다."
            )
        if sequence == 4:
            detail = (
                "analyst_synthesis의 교정 문구와 PDF document_text의 전후 문장이 "
                "서로 다르고, 두 후보 모두 전체 문장 병음이 없어 canonical "
                "Correction으로 만들 수 없다."
            )
            candidate["document_text_variants"] = {
                "wrong": "因为我每天都每天努力学习了。",
                "correct": "因为我每天都努力学了。",
            }
            extra_sources = (
                (
                    "src-course-extract-pdf-04",
                    "### 35페이지; ### 36페이지; ### 37페이지",
                    "document_text",
                ),
            )
        conflicts.append(
            _conflict(
                conflict_id=f"conf-correction-{sequence:02d}",
                issue_code=f"correction_missing_full_pinyin_{sequence:02d}",
                conflict_type="correction_blocker",
                detail=detail,
                source_id="src-course-analysis-integrated",
                source_locator=(
                    "## 9. 수강생 실수 데이터베이스 / "
                    f"{wrong or correct}"
                ),
                evidence_kind="analyst_synthesis",
                notes="중국어·병음·한국어 검수 전까지 후보로만 보존한다.",
                candidate=candidate,
                extra_sources=extra_sources,
            )
        )

    definitions = (
        (
            "conf-lesson04-grade-wording",
            "lesson04_grade_wording",
            "content_ambiguity",
            "04강 분석의 '4급 수준의 짧은 답'과 '3급 목표 답' 표현은 프로젝트의 Level 체계와 직접 대응하지 않는다.",
            "src-course-analysis-lesson-04",
            "## 1. 강의 정보; ## 2. 강의 전체 흐름",
            "analyst_synthesis",
            "등급 체계를 확인하기 전 target_level로 변환하지 않는다.",
            (),
        ),
        (
            "conf-p02-internal-title",
            "p02_internal_title",
            "source_metadata_conflict",
            "제2강 PDF 추출본의 2페이지 내부 제목은 '5월 제1강'으로 기록돼 파일명·강의 번호와 충돌한다.",
            "src-course-extract-pdf-02",
            "### 2페이지",
            "document_text",
            "원문 충돌을 수정하지 않고 보존한다.",
            (),
        ),
        (
            "conf-p04-internal-title",
            "p04_internal_title",
            "source_metadata_conflict",
            "04강 PDF 추출본의 2페이지 내부 제목은 '5월 제1강'으로 기록돼 폴더·강의 번호와 충돌한다.",
            "src-course-extract-pdf-04",
            "### 2페이지",
            "document_text",
            "원문 충돌을 수정하지 않고 보존한다.",
            (),
        ),
        (
            "conf-cumulative-pdf-overlap",
            "cumulative_pdf_overlap",
            "duplicate_candidate",
            "제1·2·4강 PDF 추출본은 누적 교재로 보이는 중복 페이지와 표현을 포함한다.",
            "src-course-extract-pdf-02",
            "### 1페이지",
            "document_text",
            "문장 일치만으로 병합하지 않고 page-level duplicate candidate로 검수한다.",
            (("src-course-extract-pdf-04", "### 1페이지", "document_text"),),
        ),
        (
            "conf-p02-page-citation",
            "p02_page_citation_mismatch",
            "source_locator_conflict",
            "학습 표현집의 P02 페이지 인용과 PDF 추출본의 실제 페이지 내용이 일부 일치하지 않는다.",
            "src-course-study-expressions",
            "| 10 | 当然可以。 |; | 15 | 谢谢，不用了。 |",
            "generated_study_material",
            "원문 페이지를 직접 재확인하기 전 locator를 verified로 만들지 않는다.",
            (
                (
                    "src-course-extract-pdf-02",
                    "### 29페이지; ### 30페이지; ### 31페이지; "
                    "### 32페이지; ### 33페이지",
                    "document_text",
                ),
            ),
        ),
        (
            "conf-d05-eye-glasses",
            "d05_eye_glasses_ambiguity",
            "source_text_conflict",
            "DOCX의 '안경 옆' 문맥에 眼睛 병음이 붙어 안경과 눈 표현이 충돌한다.",
            "src-course-extract-docx-05",
            "## 원문 / -2P- / 3.钱包在哪儿？(안경 옆)",
            "document_text",
            "Question이나 표현으로 정규화하지 않는다.",
            (),
        ),
        (
            "conf-d05-strikethrough",
            "d05_strikethrough_semantics",
            "format_semantics_uncertain",
            "DOCX의 취소선 런은 인접 런 분할과 함께 추출되어 삭제·교정 의미를 자동 확정할 수 없다.",
            "src-course-extract-docx-05",
            "## 강조 서식 보존 목록",
            "document_text",
            "시각 렌더 또는 원본 확인 전 Correction 근거로 사용하지 않는다.",
            (),
        ),
        (
            "conf-d05-page-marker",
            "d05_page_marker_not_physical",
            "source_locator_conflict",
            "DOCX의 -2P- 같은 표식은 작성자 입력값이며 실제 Word 페이지 위치가 아니다.",
            "src-course-extract-docx-05",
            "## 문서 정보 / 페이지 주의",
            "document_text",
            "source_locator에 physical page로 기록하지 않는다.",
            (),
        ),
        (
            "conf-duplicate-video-04",
            "duplicate_video_04",
            "absent_source_claim",
            "04강 19:31:55 MP4 두 파일이 같은 SHA-256이라는 주장만 Markdown에 남아 있다.",
            "src-course-file-inventory",
            "## 완전 중복 파일 / ### 04강 중복쌍",
            "analyst_synthesis",
            "원본 MP4가 없으므로 fake Source를 만들거나 해시를 재검증하지 않는다.",
            (),
        ),
        (
            "conf-duplicate-video-06-07",
            "duplicate_video_06_07",
            "absent_source_claim",
            "06강 MP4와 07강 (1) MP4가 같은 SHA-256이라는 주장만 Markdown에 남아 있다.",
            "src-course-file-inventory",
            "## 완전 중복 파일 / ### 06강/07강 중복쌍",
            "analyst_synthesis",
            "독립 근거 두 건으로 집계하지 않는다.",
            (),
        ),
        (
            "conf-originals-absent",
            "originals_absent",
            "missing_primary_source",
            "인벤토리가 주장하는 13개 MP4·3개 PDF·1개 DOCX 원본은 현재 저장소에 없다.",
            "src-course-file-inventory",
            "## 강의별 원본 파일",
            "analyst_synthesis",
            "현재 존재하는 Markdown 20개만 Source로 만든다.",
            (),
        ),
        (
            "conf-grade-level-ambiguity",
            "grade_level_ambiguity",
            "content_ambiguity",
            "강의의 3급·4급 표현과 프로젝트의 Level 5·8 목표 사이 대응 관계가 확인되지 않았다.",
            "src-course-analysis-integrated",
            "## 2. TSC 시험에 관한 전체 설명 / "
            "### 평가 기준과 고득점 조건 / "
            "4급 수준의 짧은 답과 3급 목표 답",
            "analyst_synthesis",
            "Level 8 답변·규칙을 생성하지 않는다.",
            (),
        ),
        (
            "conf-part6-insufficient",
            "part6_insufficient_evidence",
            "insufficient_evidence",
            "Part 6은 구성과 시간만 확인됐고 실제 답변 구조의 상세 훈련이 거의 없다.",
            "src-course-analysis-integrated",
            "## 3. 문제 유형별 완전 정리 / ### Part 6·7",
            "analyst_synthesis",
            "PartGuide 구조를 비워 둔다.",
            (),
        ),
        (
            "conf-part7-insufficient",
            "part7_insufficient_evidence",
            "insufficient_evidence",
            "Part 7은 예고 수준이며 완성된 90초 템플릿이나 ModelAnswer 근거가 없다.",
            "src-course-analysis-integrated",
            "## 3. 문제 유형별 완전 정리 / ### Part 6·7",
            "analyst_synthesis",
            "StoryGuide나 ModelAnswer를 생성하지 않는다.",
            (),
        ),
    )
    for (
        conflict_id,
        issue_code,
        conflict_type,
        detail,
        source_id,
        locator,
        evidence_kind,
        notes,
        extra_sources,
    ) in definitions:
        conflicts.append(
            _conflict(
                conflict_id=conflict_id,
                issue_code=issue_code,
                conflict_type=conflict_type,
                detail=detail,
                source_id=source_id,
                source_locator=locator,
                evidence_kind=evidence_kind,
                notes=notes,
                extra_sources=extra_sources,
            )
        )
    return conflicts


def _readme_bytes() -> bytes:
    content = """# TSC 강의 분석 working import v1

이 디렉터리는 `other-output`의 실제 Markdown 20개만 읽어 만든 결정적 working
import다. 검수 완료 또는 production 데이터가 아니며 전체 문제·모범답안을
추출한 결과가 아니다.

## 실행

```sh
python3 scripts/build_course_working_import.py
python3 scripts/build_course_working_import.py --validate-only
```

테스트에서는 `--output-dir`로 별도 디렉터리를 지정할 수 있다.
기존 출력 교체는 macOS의 `renameatx_np` 또는 Linux의 `renameat2` 원자 교환을
사용하며, 지원하지 않는 플랫폼에서는 기존 결과를 건드리지 않고 실패한다.

## 경계

- 현재 저장소에 없는 MP4, PDF, DOCX 원본 Source를 만들지 않는다.
- 주장된 원본 이름·별칭은 `claimed_original_names`, 중복 SHA-256과 도구
  한계는 notes와 conflicts에 보존한다.
- 분석에서 재구성한 study 문서 6개는 `self_created` Source와
  `generated_study_material` 근거로 구분한다.
- 모든 SourceReference는 `review_needed`다.
- 상세분석에 강사 발언과 타임스탬프가 함께 있는 발음·전략 근거는
  `instructor_speech`로 보존하되 원본 영상 부재 때문에 검수 완료로 승격하지
  않는다.
- 표현 37개의 중국어와 원문 병음 셀을 보존하지만 전체 문장 병음으로 확인된
  16~18번만 `language.pinyin`에 넣는다. 나머지는 새로 생성하지 않는다.
- 아홉 교정 후보 모두 전체 문장 병음이 없다. 4번은 통합 분석과 PDF 직접
  텍스트의 전후 문장이 충돌하고, 9번은 정확한 잘못된 중국어 원문도 없어
  `corrections.json`은 빈 배열이다.
- `conflicts.json`은 `SourceReference`의 허용 대상이 아니므로 각 충돌에
  `evidence_kind`와 문서 근거 위치를 직접 보존한다.
- 엄격한 대상 연결과 세 언어 조건을 충족하지 못해 ModelAnswer와 Question 연결
  후보도 빈 배열이다.
- Part 6·7은 근거가 부족하므로 가이드 구조를 비워 둔다.
- 3급·4급 강의 표현을 프로젝트의 Level 5·8 체계로 변환하지 않는다.
- 공용 working 데이터에 UserAnswer, 개인 Correction, ReviewState를 넣지 않는다.

## 파일 역할

- `sources.json`: 실제 존재하는 입력 Markdown 20개
- `source-references.json`: working 항목과 Markdown 근거 위치
- `part-guides.json`: Part 1~7 초안
- `learning-expressions.json`: 암기장 표 37행
- `pronunciation-items.json`: 문서에서 확인한 텍스트 발음 지침
- `practice-drills.json`: 날짜·횟수를 만들지 않은 연습 항목
- `course-insights.json`: 처리 범위와 학습 방향 요약
- `conflicts.json`: 검수 차단 조건과 원본 주장 충돌
- `corrections.json`, `model-answer-candidates.json`,
  `question-link-candidates.json`: 현재 엄격 조건에서는 빈 배열
- `manifest.json`: 입력·출력 SHA-256과 엔터티 수
"""
    return content.encode("utf-8")


def _walk_items(value: Any) -> Iterable[tuple[str, Any]]:
    if isinstance(value, dict):
        for key, child in value.items():
            yield key, child
            yield from _walk_items(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_items(child)


def _require_exact_fields(
    item: dict[str, Any],
    *,
    required: set[str],
    optional: set[str] | None = None,
    label: str,
) -> None:
    optional = optional or set()
    keys = set(item)
    _require(
        required.issubset(keys),
        f"{label} is missing fields: {sorted(required - keys)}",
    )
    _require(
        keys.issubset(required | optional),
        f"{label} has unexpected fields: {sorted(keys - required - optional)}",
    )


def _require_string_fields(
    item: dict[str, Any], fields: Iterable[str], label: str
) -> None:
    for field in fields:
        _require(
            type(item[field]) is str,
            f"{label}.{field} must be a string",
        )


def _require_nonempty_string_fields(
    item: dict[str, Any], fields: Iterable[str], label: str
) -> None:
    _require_string_fields(item, fields, label)
    for field in fields:
        _require(
            bool(item[field].strip()),
            f"{label}.{field} must not be empty",
        )


def _require_string_list(value: Any, label: str, *, nonempty: bool = False) -> None:
    _require(type(value) is list, f"{label} must be a list")
    _require(
        all(type(item) is str for item in value),
        f"{label} must contain only strings",
    )
    if nonempty:
        _require(bool(value), f"{label} must not be empty")


def _require_integer(value: Any, label: str) -> None:
    _require(type(value) is int, f"{label} must be an integer")


def _require_part_numbers(value: Any, label: str) -> None:
    _require(type(value) is list, f"{label} must be a list")
    _require(
        all(type(part) is int and part in range(1, 8) for part in value),
        f"{label} must contain only Part numbers 1 through 7",
    )


def _markdown_section(source_text: str, heading: str) -> str | None:
    lines = source_text.splitlines()
    matching_indexes = [
        index
        for index, line in enumerate(lines)
        if line == heading or line.startswith(f"{heading} ")
    ]
    if len(matching_indexes) != 1:
        return None
    start = matching_indexes[0]
    level = len(heading) - len(heading.lstrip("#"))
    end = len(lines)
    for index in range(start + 1, len(lines)):
        match = re.match(r"^(#+)\s", lines[index])
        if match and len(match.group(1)) <= level:
            end = index
            break
    return "\n".join(lines[start:end])


def _locator_segment_is_bound(source_text: str, segment: str) -> bool:
    tokens = [token.strip() for token in segment.split(" / ")]
    if not tokens or any(not token for token in tokens):
        return False

    scope = source_text
    for index, token in enumerate(tokens):
        if token == "문서 서문":
            if index != 0 or not source_text.lstrip().startswith("# "):
                return False
            continue
        if token.startswith("#"):
            section = _markdown_section(scope, token)
            if section is None:
                return False
            scope = section
            continue
        if token not in scope:
            return False
    return True


def _require_locator_binding(
    source_text: str,
    source_locator: str,
    reference_id: str,
) -> None:
    segments = [segment.strip() for segment in source_locator.split(";")]
    _require(
        bool(segments)
        and all(
            segment and _locator_segment_is_bound(source_text, segment)
            for segment in segments
        ),
        f"SourceReference locator is not bound to its Source: {reference_id}",
    )


def _require_unique_ids(
    items: Sequence[dict[str, Any]], id_field: str, label: str
) -> None:
    ids = [item[id_field] for item in items]
    _require(
        all(type(item_id) is str and item_id for item_id in ids),
        f"{label} ID must be a nonempty string",
    )
    _require(len(ids) == len(set(ids)), f"duplicate {label} ID")


def _entity_registry(payloads: dict[str, Any]) -> dict[str, set[str]]:
    return {
        "part_guide": {
            item["part_guide_id"] for item in payloads["part-guides.json"]
        },
        "learning_expression": {
            item["expression_id"]
            for item in payloads["learning-expressions.json"]
        },
        "pronunciation_item": {
            item["pronunciation_item_id"]
            for item in payloads["pronunciation-items.json"]
        },
        "practice_drill": {
            item["drill_id"] for item in payloads["practice-drills.json"]
        },
        "course_insight": {
            item["insight_id"] for item in payloads["course-insights.json"]
        },
        "correction": {
            item["correction_id"] for item in payloads["corrections.json"]
        },
    }


def _validate_payloads(payloads: dict[str, Any]) -> None:
    _require(set(payloads) == set(DATA_FILES), "unexpected data payload set")
    sources = payloads["sources.json"]
    _require(len(sources) == 20, "sources.json must contain exactly 20 records")
    _require(
        [item["file_ref"] for item in sources] == list(INPUT_PATHS),
        "Source file order or paths changed",
    )
    _require_unique_ids(sources, "source_id", "Source")
    source_ids = [item["source_id"] for item in sources]
    for source in sources:
        _require_exact_fields(
            source,
            required=SOURCE_FIELDS,
            label="Source",
        )
        _require_string_fields(
            source,
            SOURCE_FIELDS - {"claimed_original_names"},
            "Source",
        )
        _require_string_list(
            source["claimed_original_names"],
            "Source.claimed_original_names",
            nonempty=True,
        )
        _require_nonempty_string_fields(
            source,
            {
                "source_id",
                "title",
                "source_type",
                "provenance_status",
                "original_file_name",
                "file_ref",
                "sha256",
                "rights_status",
                "source_status",
                "evidence_kind",
                "notes",
            },
            "Source",
        )
        expected_source_id, expected_source_type = SOURCE_CONFIG[
            source["file_ref"]
        ]
        expected_source_text = _read_text(source["file_ref"])
        _require(
            source["source_id"] == expected_source_id
            and source["source_type"] == expected_source_type,
            "Source ID or type does not match its registered file",
        )
        _require(
            source["title"]
            == _first_heading(expected_source_text, source["file_ref"]),
            "Source title does not match its Markdown heading",
        )
        _require(
            source["original_file_name"] == Path(source["file_ref"]).name,
            "Source original_file_name does not match its present file",
        )
        _require(
            source["sha256"]
            == _sha256_file(_safe_input_path(source["file_ref"])),
            "Source SHA-256 does not match its present file",
        )
        _require(
            source["claimed_original_names"]
            == CLAIMED_ORIGINAL_NAMES[source["file_ref"]],
            "Source claimed original names differ from the documented mapping",
        )
        _require(
            source["evidence_kind"]
            == _source_evidence_kind(source["file_ref"])
            and source["provenance_status"]
            == _source_provenance_status(source["file_ref"]),
            "Source evidence or provenance differs from its registered file",
        )
        _require(
            source["source_type"] in ALLOWED_SOURCE_TYPES,
            "Source type is invalid",
        )
        _require(
            source["source_status"] == "review_needed",
            "Source must need review",
        )
        expected_provenance = (
            "self_created"
            if source["evidence_kind"] == "generated_study_material"
            else "unverified_source"
        )
        _require(
            source["provenance_status"] == expected_provenance,
            "Source provenance does not match its evidence kind",
        )
        if source["provenance_status"] == "self_created":
            _require(
                source["source_type"] == "self_created"
                and source["evidence_kind"] == "generated_study_material",
                "self-created Source classification triad is inconsistent",
            )
        else:
            _require(
                source["source_type"] != "self_created"
                and source["evidence_kind"] != "generated_study_material",
                "unverified Source classification triad is inconsistent",
            )
        _require(
            bool(source["claimed_original_names"]),
            "Source must preserve claimed original names or aliases",
        )
        _require(
            source["rights_status"] == "review_needed",
            "Source rights must need review",
        )
        _require(
            source["file_ref"].endswith(".md"),
            "only present Markdown files may become Sources",
        )
        _require(
            not re.search(r"\.(mp4|pdf|docx)$", source["file_ref"]),
            "absent raw original cannot become a Source",
        )
        _require(
            source["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "Source evidence kind is invalid",
        )

    guides = payloads["part-guides.json"]
    _require_unique_ids(guides, "part_guide_id", "PartGuide")
    _require([item["part"] for item in guides] == list(range(1, 8)), "Part guides")
    _require(
        all(item["guide_status"] == "draft" for item in guides),
        "PartGuide must remain draft",
    )
    for guide in guides:
        _require_exact_fields(
            guide,
            required=PART_GUIDE_REQUIRED_FIELDS,
            optional=PART_GUIDE_OPTIONAL_FIELDS,
            label="PartGuide",
        )
        _require_string_fields(
            guide,
            {
                "part_guide_id",
                "goal",
                "course_target_context",
                "evidence_kind",
                "guide_status",
                "notes",
            },
            "PartGuide",
        )
        _require_integer(guide["part"], "PartGuide.part")
        _require_integer(guide["response_seconds"], "PartGuide.response_seconds")
        _require(
            guide["response_seconds"] > 0,
            "PartGuide.response_seconds must be positive",
        )
        if "preparation_seconds" in guide:
            _require_integer(
                guide["preparation_seconds"],
                "PartGuide.preparation_seconds",
            )
            _require(
                guide["preparation_seconds"] > 0,
                "PartGuide.preparation_seconds must be positive",
            )
        _require(
            bool(guide["goal"].strip()),
            "PartGuide.goal must not be empty",
        )
        for field in {
            "preparation_tips",
            "response_structure",
            "key_expressions",
            "key_expression_ids",
            "representative_question_ids",
            "frequent_correction_ids",
            "representative_drill_ids",
        }:
            _require_string_list(guide[field], f"PartGuide.{field}")
        _require_string_list(
            guide["source_reference_ids"],
            "PartGuide.source_reference_ids",
            nonempty=True,
        )
        _require(
            guide["course_target_context"] == "level_3",
            "course PartGuide target must remain level_3",
        )
        _require(
            guide["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "PartGuide evidence kind is invalid",
        )
    for part in (6, 7):
        guide = next(item for item in guides if item["part"] == part)
        _require(not guide["response_structure"], f"Part {part} must remain sparse")
        _require("근거 부족" in guide["notes"], f"Part {part} lacks evidence note")

    _require(payloads["corrections.json"] == [], "corrections must remain empty")
    expressions = payloads["learning-expressions.json"]
    _require_unique_ids(expressions, "expression_id", "LearningExpression")
    _require(len(expressions) == 37, "expected 37 learning expressions")
    _require(
        [item["expression_id"] for item in expressions]
        == [f"le-course-{index:03d}" for index in range(1, 38)],
        "expression order changed",
    )
    _require(
        [
            index
            for index, item in enumerate(expressions, start=1)
            if item["language"]["pinyin"]
        ]
        == [16, 17, 18],
        "only expression rows 16-18 may have complete pinyin",
    )
    _require(
        all("원본 병음 셀:" in item["notes"] for item in expressions),
        "raw pinyin note must be preserved",
    )
    _require(
        [item["expression_type"] for item in expressions[:3]]
        == ["fixed_response", "fixed_response", "fixed_response"],
        "Part 1 expressions must remain fixed responses",
    )
    expression_rows_by_sequence = {
        int(row[0]): row for row in _expression_rows()
    }
    for expression in expressions:
        _require_exact_fields(
            expression,
            required=LEARNING_EXPRESSION_FIELDS,
            label="LearningExpression",
        )
        _require_string_fields(
            expression,
            {
                "expression_id",
                "expression_type",
                "usage_context",
                "pattern_or_slots",
                "cautions",
                "status",
                "evidence_kind",
                "notes",
            },
            "LearningExpression",
        )
        _require(
            type(expression["language"]) is dict,
            "LearningExpression.language must be an object",
        )
        _require(
            set(expression["language"]) == {"zh", "pinyin", "ko"},
            "LearningExpression language fields differ",
        )
        _require_string_fields(
            expression["language"],
            {"zh", "pinyin", "ko"},
            "LearningExpression.language",
        )
        _require_part_numbers(
            expression["part_numbers"],
            "LearningExpression.part_numbers",
        )
        _require_string_list(
            expression["related_correction_ids"],
            "LearningExpression.related_correction_ids",
        )
        _require_string_list(
            expression["source_reference_ids"],
            "LearningExpression.source_reference_ids",
            nonempty=True,
        )
        _require(
            expression["expression_type"] in ALLOWED_EXPRESSION_TYPES,
            "LearningExpression type is invalid",
        )
        _require(
            expression["status"] in {"raw", "review_needed"},
            "LearningExpression status is invalid",
        )
        _require(
            expression["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "LearningExpression evidence kind is invalid",
        )
        sequence = int(expression["expression_id"].rsplit("-", 1)[1])
        row = expression_rows_by_sequence[sequence]
        raw_pinyin = row[2]
        expected_pinyin = raw_pinyin if sequence in (16, 17, 18) else ""
        expected_notes = (
            f"원본 병음 셀: {raw_pinyin}. "
            + (
                "전체 문장 병음으로 보이는 원문 표기를 그대로 보존했으며 "
                "검수가 필요하다. "
                if expected_pinyin
                else "전체 문장 병음으로 확인되지 않아 pinyin을 비워 두었다. "
            )
            + f"원문 출처: {row[6]}"
        )
        part_match = re.search(r"Part\s*([1-7])", row[4])
        _require(
            expression["language"]
            == {
                "zh": row[1],
                "pinyin": expected_pinyin,
                "ko": row[3],
            },
            (
                "LearningExpression language differs from its exact source "
                f"row: {expression['expression_id']}"
            ),
        )
        _require(
            expression["usage_context"] == row[4]
            and expression["cautions"] == row[5]
            and expression["pattern_or_slots"]
            == (row[1] if "XX" in row[1] else "")
            and expression["part_numbers"]
            == ([int(part_match.group(1))] if part_match else [])
            and expression["notes"] == expected_notes,
            (
                "LearningExpression metadata differs from its exact source "
                f"row: {expression['expression_id']}"
            ),
        )
    pronunciation_items = payloads["pronunciation-items.json"]
    _require_unique_ids(
        pronunciation_items,
        "pronunciation_item_id",
        "PronunciationItem",
    )
    _require(
        [
            item["pronunciation_item_id"]
            for item in pronunciation_items
        ]
        == EXPECTED_PRONUNCIATION_IDS,
        "required pronunciation item set differs",
    )
    for item in pronunciation_items:
        _require_exact_fields(
            item,
            required=PRONUNCIATION_ITEM_FIELDS,
            label="PronunciationItem",
        )
        _require_string_fields(
            item,
            {
                "pronunciation_item_id",
                "target_text",
                "pinyin_or_sound",
                "pronunciation_focus",
                "explanation_ko",
                "status",
                "evidence_kind",
                "notes",
            },
            "PronunciationItem",
        )
        _require_nonempty_string_fields(
            item,
            {
                "pronunciation_item_id",
                "target_text",
                "pronunciation_focus",
                "explanation_ko",
                "status",
                "evidence_kind",
            },
            "PronunciationItem",
        )
        _require(
            item["pinyin_or_sound"] == "",
            "course import cannot generate an unverified pronunciation value",
        )
        _require_string_list(
            item["example_expression_ids"],
            "PronunciationItem.example_expression_ids",
        )
        _require_part_numbers(
            item["part_numbers"],
            "PronunciationItem.part_numbers",
        )
        _require_string_list(
            item["source_reference_ids"],
            "PronunciationItem.source_reference_ids",
            nonempty=True,
        )
        _require(
            item["status"] in {"raw", "review_needed"},
            "PronunciationItem status is invalid",
        )
        _require(
            item["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "PronunciationItem evidence kind is invalid",
        )
    drills = payloads["practice-drills.json"]
    _require_unique_ids(drills, "drill_id", "PracticeDrill")
    _require(
        [item["drill_id"] for item in drills]
        == EXPECTED_DRILL_IDS,
        "required practice drill set differs",
    )
    for drill in drills:
        _require_exact_fields(
            drill,
            required=PRACTICE_DRILL_REQUIRED_FIELDS,
            optional=PRACTICE_DRILL_OPTIONAL_FIELDS,
            label="PracticeDrill",
        )
        _require_string_fields(
            drill,
            {
                "drill_id",
                "drill_type",
                "prompt_or_task",
                "completion_criteria",
                "status",
                "evidence_kind",
                "notes",
            },
            "PracticeDrill",
        )
        _require_nonempty_string_fields(
            drill,
            {
                "drill_id",
                "drill_type",
                "prompt_or_task",
                "completion_criteria",
                "status",
                "evidence_kind",
            },
            "PracticeDrill",
        )
        _require_string_list(
            drill["required_content_ids"],
            "PracticeDrill.required_content_ids",
        )
        _require_string_list(
            drill["source_reference_ids"],
            "PracticeDrill.source_reference_ids",
            nonempty=True,
        )
        _require(
            drill["drill_type"] in ALLOWED_DRILL_TYPES,
            "PracticeDrill type is invalid",
        )
        if "part" in drill:
            _require_integer(drill["part"], "PracticeDrill.part")
            _require(drill["part"] in range(1, 8), "PracticeDrill Part is invalid")
        for field in {"preparation_seconds", "response_seconds"}:
            if field in drill:
                _require_integer(drill[field], f"PracticeDrill.{field}")
                _require(
                    drill[field] > 0,
                    f"PracticeDrill.{field} must be positive",
                )
        _require(
            drill["status"] in {"raw", "review_needed"},
            "PracticeDrill status is invalid",
        )
        _require(
            drill["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "PracticeDrill evidence kind is invalid",
        )
    insights = payloads["course-insights.json"]
    _require_unique_ids(insights, "insight_id", "CourseInsight")
    _require(
        REQUIRED_INSIGHT_IDS.issubset(
            {item["insight_id"] for item in insights}
        ),
        "required course insight set is incomplete",
    )
    for insight in insights:
        _require_exact_fields(
            insight,
            required=COURSE_INSIGHT_FIELDS,
            label="CourseInsight",
        )
        _require_string_fields(
            insight,
            {
                "insight_id",
                "insight_type",
                "content_ko",
                "course_target_context",
                "evidence_kind",
                "confidence_or_status",
                "notes",
            },
            "CourseInsight",
        )
        _require_nonempty_string_fields(
            insight,
            {
                "insight_id",
                "insight_type",
                "content_ko",
                "course_target_context",
                "evidence_kind",
                "confidence_or_status",
            },
            "CourseInsight",
        )
        _require_part_numbers(
            insight["part_numbers"],
            "CourseInsight.part_numbers",
        )
        _require_string_list(
            insight["source_reference_ids"],
            "CourseInsight.source_reference_ids",
            nonempty=True,
        )
        _require(
            insight["insight_type"] in ALLOWED_INSIGHT_TYPES,
            "CourseInsight type is invalid",
        )
        _require(
            insight["course_target_context"] in ALLOWED_COURSE_TARGETS,
            "CourseInsight target context is invalid",
        )
        _require(
            insight["confidence_or_status"] in {"raw", "review_needed"},
            "CourseInsight status is invalid",
        )
        _require(
            insight["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "CourseInsight evidence kind is invalid",
        )
    _require(
        payloads["model-answer-candidates.json"] == [],
        "ModelAnswer candidates must remain empty",
    )
    _require(
        payloads["question-link-candidates.json"] == [],
        "Question link candidates must remain empty",
    )

    blockers = [
        item
        for item in payloads["conflicts.json"]
        if item["conflict_type"] == "correction_blocker"
    ]
    _require(len(blockers) == 9, "all nine correction blockers are required")
    for sequence, (blocker, source_candidate) in enumerate(
        zip(blockers, CORRECTION_CANDIDATES),
        start=1,
    ):
        _, wrong, wrong_description, correct, error_type = source_candidate
        candidate = blocker["candidate"]
        _require(
            candidate["sequence"] == sequence
            and candidate["error_type"] == error_type
            and candidate["wrong"] == wrong
            and candidate["wrong_description"] == wrong_description
            and candidate["correct"] == correct,
            f"correction blocker {sequence} differs from the documented row",
        )
        _require(
            candidate["wrong_pinyin"] == ""
            and candidate["correct_pinyin"] == "",
            f"correction blocker {sequence} cannot invent full pinyin",
        )
    _require(
        blockers[-1]["candidate"]["wrong"] == "",
        "correction candidate 9 must not invent wrong_zh",
    )
    _require(
        bool(blockers[-1]["candidate"]["wrong_description"]),
        "correction candidate 9 must preserve its Korean description",
    )
    conflicts = payloads["conflicts.json"]
    _require_unique_ids(conflicts, "conflict_id", "Conflict")
    for conflict in conflicts:
        _require_exact_fields(
            conflict,
            required=CONFLICT_REQUIRED_FIELDS,
            optional={"candidate"},
            label="Conflict",
        )
        _require_string_fields(
            conflict,
            {
                "conflict_id",
                "issue_code",
                "conflict_type",
                "detail",
                "evidence_kind",
                "conflict_status",
                "notes",
            },
            "Conflict",
        )
        _require(
            type(conflict["evidence_locations"]) is list,
            "Conflict.evidence_locations must be a list",
        )
        _require(
            conflict["conflict_status"] == "review_needed",
            "Conflict must need review",
        )
        if "candidate" in conflict:
            candidate_required = {
                "sequence",
                "error_type",
                "wrong",
                "wrong_description",
                "correct",
                "wrong_pinyin",
                "correct_pinyin",
            }
            _require_exact_fields(
                conflict["candidate"],
                required=candidate_required,
                optional={"document_text_variants"},
                label="Correction conflict candidate",
            )
            _require_integer(
                conflict["candidate"]["sequence"],
                "Correction conflict candidate.sequence",
            )
            _require_string_fields(
                conflict["candidate"],
                candidate_required - {"sequence"},
                "Correction conflict candidate",
            )
            if "document_text_variants" in conflict["candidate"]:
                _require(
                    type(
                        conflict["candidate"]["document_text_variants"]
                    )
                    is dict,
                    "document correction variants must be an object",
                )
                _require(
                    set(conflict["candidate"]["document_text_variants"])
                    == {"wrong", "correct"},
                    "document correction variants differ",
                )
                _require_string_fields(
                    conflict["candidate"]["document_text_variants"],
                    {"wrong", "correct"},
                    "Correction conflict document variants",
                )

    registry = _entity_registry(payloads)
    source_id_set = set(source_ids)
    sources_by_id = {item["source_id"]: item for item in sources}
    expressions_by_id = {
        item["expression_id"]: item for item in expressions
    }
    references = payloads["source-references.json"]
    _require_unique_ids(references, "source_reference_id", "SourceReference")
    reference_ids = [item["source_reference_id"] for item in references]
    instructor_reference_ids = {
        item["source_reference_id"]
        for item in references
        if item["evidence_kind"] == "instructor_speech"
    }
    _require(
        instructor_reference_ids == set(INSTRUCTOR_REFERENCE_ANCHORS),
        "instructor evidence anchor set differs",
    )
    for item in references:
        _require_exact_fields(
            item,
            required=SOURCE_REFERENCE_FIELDS,
            label="SourceReference",
        )
        _require_string_fields(
            item,
            SOURCE_REFERENCE_FIELDS,
            "SourceReference",
        )
        for field in {
            "source_reference_id",
            "target_type",
            "target_id",
            "source_id",
            "source_locator",
        }:
            _require(
                bool(item[field]),
                f"SourceReference.{field} must not be empty",
            )
        _require(item["source_id"] in source_id_set, "SourceReference source missing")
        _require(
            item["verification_status"] == "review_needed",
            "SourceReference must need review",
        )
        _require(
            item["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "SourceReference evidence kind is invalid",
        )
        _require(
            item["relationship_kind"] in ALLOWED_RELATIONSHIP_KINDS,
            "SourceReference relationship kind is invalid",
        )
        _require(
            item["target_type"] in registry
            and item["target_id"] in registry[item["target_type"]],
            f"SourceReference target does not exist: {item['target_id']}",
        )
        source = sources_by_id[item["source_id"]]
        if source["provenance_status"] == "self_created":
            _require(
                item["evidence_kind"] == "generated_study_material",
                (
                    "self-created SourceReference cannot be promoted to "
                    f"{item['evidence_kind']}"
                ),
            )
            _require(
                item["relationship_kind"] in {"self_created", "derived_from"},
                "self-created SourceReference relationship is incompatible",
            )
        else:
            _require(
                item["relationship_kind"] != "self_created",
                "unverified Source cannot use a self_created relationship",
            )
            _require(
                item["evidence_kind"] != "generated_study_material",
                "unverified Source cannot assert generated study evidence",
            )
        source_text = _read_text(source["file_ref"])
        if item["evidence_kind"] == "instructor_speech":
            matching_lines = [
                line
                for line in source_text.splitlines()
                if item["source_locator"] in line
            ]
            anchor = INSTRUCTOR_REFERENCE_ANCHORS[
                item["source_reference_id"]
            ]
            _require(
                any(anchor in line for line in matching_lines),
                (
                    "instructor SourceReference locator and evidence anchor "
                    "are not bound in its "
                    f"Source: {item['source_reference_id']}"
                ),
            )
        elif item["target_type"] == "learning_expression":
            expression = expressions_by_id[item["target_id"]]
            sequence = int(expression["expression_id"].rsplit("-", 1)[1])
            _require(
                item["source_locator"]
                == f"필수표현 표 / 번호 {sequence}",
                "LearningExpression locator format differs",
            )
            matching_rows = [
                line
                for line in source_text.splitlines()
                if line.startswith(f"| {sequence} |")
            ]
            _require(
                len(matching_rows) == 1
                and expression["language"]["zh"] in matching_rows[0]
                and expression["language"]["ko"] in matching_rows[0],
                (
                    "LearningExpression locator is not bound to its table row: "
                    f"{item['source_reference_id']}"
                ),
            )
        else:
            _require_locator_binding(
                source_text,
                item["source_locator"],
                item["source_reference_id"],
            )

    reference_id_set = set(reference_ids)
    for conflict in conflicts:
        _require(
            conflict["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
            "Conflict evidence kind is invalid",
        )
        _require(
            bool(conflict.get("evidence_locations")),
            "Conflict must preserve documented evidence locations",
        )
        location_evidence_kinds: set[str] = set()
        for location in conflict["evidence_locations"]:
            _require(
                set(location)
                == {"source_id", "source_locator", "evidence_kind"},
                "Conflict evidence location fields differ",
            )
            _require_string_fields(
                location,
                {"source_id", "source_locator", "evidence_kind"},
                "Conflict evidence location",
            )
            _require(
                location["source_id"] in source_id_set,
                "Conflict evidence Source is missing",
            )
            _require(
                bool(location["source_locator"]),
                "Conflict evidence locator is required",
            )
            _require(
                location["evidence_kind"] in ALLOWED_EVIDENCE_KINDS,
                "Conflict evidence location kind is invalid",
            )
            location_evidence_kinds.add(location["evidence_kind"])
            source = sources_by_id[location["source_id"]]
            if source["provenance_status"] == "self_created":
                _require(
                    location["evidence_kind"] == "generated_study_material",
                    "self-created Conflict evidence cannot be promoted",
                )
            else:
                _require(
                    location["evidence_kind"] != "generated_study_material",
                    "unverified Conflict Source cannot assert generated evidence",
                )
            _require_locator_binding(
                _read_text(source["file_ref"]),
                location["source_locator"],
                f"{conflict['conflict_id']} evidence location",
            )
        _require(
            conflict["evidence_kind"] in location_evidence_kinds,
            (
                "Conflict evidence_kind has no matching evidence location: "
                f"{conflict['conflict_id']}"
            ),
        )

    references_by_id = {
        item["source_reference_id"]: item for item in references
    }
    reference_owners = (
        ("part-guides.json", "part_guide", "part_guide_id"),
        ("learning-expressions.json", "learning_expression", "expression_id"),
        (
            "pronunciation-items.json",
            "pronunciation_item",
            "pronunciation_item_id",
        ),
        ("practice-drills.json", "practice_drill", "drill_id"),
        ("course-insights.json", "course_insight", "insight_id"),
    )
    for file_name, target_type, id_field in reference_owners:
        for entity in payloads[file_name]:
            for reference_id in entity["source_reference_ids"]:
                _require(
                    reference_id in references_by_id,
                    f"missing SourceReference in {file_name}: {reference_id}",
                )
                reference = references_by_id[reference_id]
                _require(
                    reference["target_type"] == target_type
                    and reference["target_id"] == entity[id_field],
                    (
                        f"SourceReference ownership differs in {file_name}: "
                        f"{reference_id}"
                    ),
                )
            _require(
                any(
                    references_by_id[reference_id]["evidence_kind"]
                    == entity["evidence_kind"]
                    for reference_id in entity["source_reference_ids"]
                ),
                (
                    f"{file_name} evidence_kind has no matching "
                    f"SourceReference: {entity[id_field]}"
                ),
            )

    expression_ids = registry["learning_expression"]
    correction_ids = registry["correction"]
    drill_ids = registry["practice_drill"]
    guide_ids = registry["part_guide"]
    drills_by_id = {item["drill_id"]: item for item in drills}
    guides_by_id = {item["part_guide_id"]: item for item in guides}
    known_required_content_ids = expression_ids | correction_ids | guide_ids
    for guide in guides:
        _require(
            all(item in expression_ids for item in guide["key_expression_ids"]),
            "PartGuide references an unknown LearningExpression",
        )
        _require(
            all(
                item in correction_ids
                for item in guide["frequent_correction_ids"]
            ),
            "PartGuide references an unknown Correction",
        )
        _require(
            all(
                item in drill_ids
                for item in guide["representative_drill_ids"]
            ),
            "PartGuide references an unknown PracticeDrill",
        )
        _require(
            not guide["representative_question_ids"],
            "course import cannot assert canonical Question links",
        )
        for drill_id in guide["representative_drill_ids"]:
            drill = drills_by_id[drill_id]
            _require(
                drill.get("part") == guide["part"],
                "PartGuide and representative PracticeDrill Part differ",
            )
            _require(
                guide["part_guide_id"] in drill["required_content_ids"],
                "representative PracticeDrill does not require its PartGuide",
            )
    for expression in expressions:
        _require(
            all(
                item in correction_ids
                for item in expression["related_correction_ids"]
            ),
            "LearningExpression references an unknown Correction",
        )
    for item in pronunciation_items:
        _require(
            all(
                expression_id in expression_ids
                for expression_id in item["example_expression_ids"]
            ),
            "PronunciationItem references an unknown LearningExpression",
        )
        for expression_id in item["example_expression_ids"]:
            expression = next(
                candidate
                for candidate in expressions
                if candidate["expression_id"] == expression_id
            )
            _require(
                bool(
                    set(item["part_numbers"])
                    & set(expression["part_numbers"])
                ),
                "PronunciationItem and example LearningExpression Parts differ",
            )
    for drill in drills:
        _require(
            all(
                content_id in known_required_content_ids
                for content_id in drill["required_content_ids"]
            ),
            "PracticeDrill references unknown required content",
        )
        if "part" in drill:
            for content_id in drill["required_content_ids"]:
                if content_id in guides_by_id:
                    _require(
                        guides_by_id[content_id]["part"] == drill["part"],
                        "PracticeDrill and required PartGuide Parts differ",
                    )

    for file_name, payload in payloads.items():
        for key, value in _walk_items(payload):
            _require(key not in PERSONAL_FIELDS, f"personal field in {file_name}: {key}")
            if key == "source_reference_ids":
                _require(
                    all(item in reference_id_set for item in value),
                    f"missing SourceReference in {file_name}",
                )
            if key == "verification_status":
                _require(value == "review_needed", "verified evidence is forbidden")
            elif key == "provenance_status":
                _require(
                    value in {"unverified_source", "self_created"},
                    "Source provenance is invalid",
                )
            elif key.endswith("_status") or key == "status":
                _require(
                    value in ALLOWED_STATES,
                    f"disallowed state in {file_name}: {key}={value}",
                )
    _require(
        payloads == _assemble_payloads(),
        (
            "working payload differs from the expected deterministic source mapping; "
            "update the importer mapping and evidence checks together"
        ),
    )


def _assemble_payloads() -> dict[str, Any]:
    refs = ReferenceBuilder()
    sources = _build_sources()
    part_guides = _build_part_guides(refs)
    expressions = _build_learning_expressions(refs)
    pronunciation_items = _build_pronunciation_items(refs)
    practice_drills = _build_practice_drills(refs)
    course_insights = _build_course_insights(refs)
    conflicts = _build_conflicts()
    payloads = {
        "sources.json": sources,
        "source-references.json": refs.items,
        "part-guides.json": part_guides,
        "corrections.json": [],
        "learning-expressions.json": expressions,
        "pronunciation-items.json": pronunciation_items,
        "practice-drills.json": practice_drills,
        "course-insights.json": course_insights,
        "model-answer-candidates.json": [],
        "question-link-candidates.json": [],
        "conflicts.json": conflicts,
    }
    return payloads


def _build_payloads() -> dict[str, Any]:
    payloads = _assemble_payloads()
    _validate_payloads(payloads)
    return payloads


def _counts(payloads: dict[str, Any]) -> dict[str, int]:
    return {
        "sources": len(payloads["sources.json"]),
        "source_references": len(payloads["source-references.json"]),
        "part_guides": len(payloads["part-guides.json"]),
        "corrections": len(payloads["corrections.json"]),
        "learning_expressions": len(payloads["learning-expressions.json"]),
        "pronunciation_items": len(payloads["pronunciation-items.json"]),
        "practice_drills": len(payloads["practice-drills.json"]),
        "course_insights": len(payloads["course-insights.json"]),
        "model_answer_candidates": len(payloads["model-answer-candidates.json"]),
        "question_link_candidates": len(payloads["question-link-candidates.json"]),
        "conflicts": len(payloads["conflicts.json"]),
    }


def _input_manifest() -> list[dict[str, str]]:
    return [
        {
            "path": relative_path,
            "sha256": _sha256_file(_safe_input_path(relative_path)),
        }
        for relative_path in INPUT_PATHS
    ]


def _build_manifest(
    payloads: dict[str, Any],
    generated_directory: Path,
    input_files: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    generated_names = [
        file_name for file_name in OUTPUT_FILES if file_name != "manifest.json"
    ]
    return {
        "dataset_id": DATASET_ID,
        "dataset_status": "working",
        "schema_version": "data-schema-v1.1-working",
        "input_files": input_files if input_files is not None else _input_manifest(),
        "generated_files": [
            {
                "path": file_name,
                "sha256": _sha256_file(generated_directory / file_name),
            }
            for file_name in generated_names
        ],
        "counts": _counts(payloads),
        "notes": (
            "결정적 working import. 원본 MP4/PDF/DOCX, reviewed 콘텐츠, "
            "개인 학습 데이터와 생성 시각을 포함하지 않는다."
        ),
    }


def _directory_identity(path: Path) -> tuple[int, int]:
    try:
        metadata = os.stat(path, follow_symlinks=False)
    except OSError as error:
        raise ImportError(f"cannot inspect output directory {path}: {error}") from error
    _require(
        stat.S_ISDIR(metadata.st_mode),
        f"output target is not a directory: {path}",
    )
    return metadata.st_dev, metadata.st_ino


FileIdentity = tuple[int, int, int, int, int]


def _file_identity_from_stat(metadata: os.stat_result) -> FileIdentity:
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
    )


def _regular_file_identity(path: Path) -> FileIdentity:
    try:
        metadata = os.stat(path, follow_symlinks=False)
    except OSError as error:
        raise ImportError(f"cannot inspect output file {path}: {error}") from error
    _require(
        stat.S_ISREG(metadata.st_mode),
        f"output entry is not a regular file: {path}",
    )
    return _file_identity_from_stat(metadata)


def _regular_descriptor_identity(descriptor: int, label: str) -> FileIdentity:
    try:
        metadata = os.fstat(descriptor)
    except OSError as error:
        raise ImportError(f"cannot inspect output file {label}: {error}") from error
    _require(
        stat.S_ISREG(metadata.st_mode),
        f"output entry is not a regular file: {label}",
    )
    return _file_identity_from_stat(metadata)


def _validate_owned_output_generation(
    output_dir: Path,
    expected_identity: tuple[int, int] | None = None,
    file_identities: dict[str, FileIdentity] | None = None,
) -> tuple[int, int]:
    _require(
        not output_dir.is_symlink(),
        f"refusing symlink output target: {output_dir}",
    )
    identity_before = _directory_identity(output_dir)
    if expected_identity is not None:
        _require(
            identity_before == expected_identity,
            f"output target identity changed: {output_dir}",
        )
    entries = list(output_dir.iterdir())
    _require(
        all(entry.is_file() and not entry.is_symlink() for entry in entries),
        f"refusing output directory containing non-file or symlink: {output_dir}",
    )
    actual_names = sorted(entry.name for entry in entries)
    _require(
        actual_names == sorted(OUTPUT_FILES),
        (
            f"refusing output directory with an unowned file set "
            f"{output_dir}: {actual_names}"
        ),
    )
    manifest_path = output_dir / "manifest.json"
    validated_file_identities: dict[str, FileIdentity] = {}
    manifest_identity_before = _regular_file_identity(manifest_path)
    try:
        existing_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ImportError(
            f"refusing to replace unowned output directory {output_dir}: {error}"
        ) from error
    _require(
        type(existing_manifest) is dict,
        f"refusing output directory with a non-object manifest: {output_dir}",
    )
    _require(
        existing_manifest.get("dataset_id") == DATASET_ID,
        f"refusing to replace unowned output directory: {output_dir}",
    )
    _require(
        set(existing_manifest)
        == {
            "dataset_id",
            "dataset_status",
            "schema_version",
            "input_files",
            "generated_files",
            "counts",
            "notes",
        },
        f"refusing output directory with an invalid manifest: {output_dir}",
    )
    _require(
        existing_manifest["dataset_status"] == "working"
        and existing_manifest["schema_version"] == "data-schema-v1.1-working",
        f"refusing output directory with incompatible metadata: {output_dir}",
    )
    _require(
        _regular_file_identity(manifest_path) == manifest_identity_before,
        f"manifest changed during ownership validation: {output_dir}",
    )
    validated_file_identities["manifest.json"] = manifest_identity_before
    expected_generated_names = [
        file_name for file_name in OUTPUT_FILES if file_name != "manifest.json"
    ]
    generated_files = existing_manifest["generated_files"]
    _require(
        type(generated_files) is list,
        f"refusing output directory with a non-list file manifest: {output_dir}",
    )
    _require(
        all(type(item) is dict for item in generated_files),
        f"refusing output directory with invalid file entries: {output_dir}",
    )
    _require(
        [item.get("path") for item in generated_files] == expected_generated_names,
        f"refusing output directory with an invalid file manifest: {output_dir}",
    )
    for item in generated_files:
        _require(
            set(item) == {"path", "sha256"}
            and type(item["path"]) is str
            and type(item["sha256"]) is str,
            f"refusing output directory with invalid hash metadata: {output_dir}",
        )
        generated_path = output_dir / item["path"]
        file_identity_before = _regular_file_identity(generated_path)
        _require(
            _sha256_file(generated_path) == item["sha256"],
            f"refusing output directory with modified content: {item['path']}",
        )
        _require(
            _regular_file_identity(generated_path) == file_identity_before,
            f"output file changed during ownership validation: {item['path']}",
        )
        validated_file_identities[item["path"]] = file_identity_before
    identity_after = _directory_identity(output_dir)
    _require(
        identity_after == identity_before,
        f"output target changed during ownership validation: {output_dir}",
    )
    if file_identities is not None:
        file_identities.clear()
        file_identities.update(validated_file_identities)
    return identity_after


def _require_owned_output_target(output_dir: Path) -> tuple[int, int] | None:
    _require(
        output_dir != ROOT and output_dir not in ROOT.parents,
        f"refusing broad output target: {output_dir}",
    )
    _require(
        not output_dir.is_symlink(),
        f"refusing symlink output target: {output_dir}",
    )
    if not output_dir.exists():
        return None
    return _validate_owned_output_generation(output_dir)


def _fsync_file(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _remove_owned_output_generation(
    output_dir: Path,
    expected_identity: tuple[int, int],
) -> None:
    directory_flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    directory_flags |= getattr(os, "O_NOFOLLOW", 0)
    try:
        directory_descriptor = os.open(output_dir, directory_flags)
    except OSError as error:
        raise ImportError(
            f"cannot lock previous output generation {output_dir}: {error}"
        ) from error
    try:
        try:
            fcntl.flock(
                directory_descriptor,
                fcntl.LOCK_EX | fcntl.LOCK_NB,
            )
        except OSError as error:
            raise ImportError(
                f"cannot lock previous output generation {output_dir}: {error}"
            ) from error
        directory_metadata = os.fstat(directory_descriptor)
        _require(
            (directory_metadata.st_dev, directory_metadata.st_ino)
            == expected_identity,
            f"previous output generation identity changed: {output_dir}",
        )
        file_identities: dict[str, FileIdentity] = {}
        _validate_owned_output_generation(
            output_dir,
            expected_identity,
            file_identities,
        )
        _require(
            _directory_identity(output_dir) == expected_identity,
            f"previous output generation path changed: {output_dir}",
        )
        file_flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
        for file_name in OUTPUT_FILES:
            try:
                file_descriptor = os.open(
                    file_name,
                    file_flags,
                    dir_fd=directory_descriptor,
                )
            except OSError as error:
                raise ImportError(
                    f"cannot open previous output file {file_name}: {error}"
                ) from error
            try:
                _require(
                    _regular_descriptor_identity(file_descriptor, file_name)
                    == file_identities[file_name],
                    (
                        "refusing to remove a substituted output file: "
                        f"{output_dir / file_name}"
                    ),
                )
                os.unlink(file_name, dir_fd=directory_descriptor)
            finally:
                os.close(file_descriptor)
        _require(
            not os.listdir(directory_descriptor),
            f"previous output generation gained an unexpected file: {output_dir}",
        )
        _require(
            _directory_identity(output_dir) == expected_identity,
            f"previous output generation path changed before removal: {output_dir}",
        )
        output_dir.rmdir()
    finally:
        os.close(directory_descriptor)


def _atomic_exchange_directories(left: Path, right: Path) -> None:
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == "darwin":
        function = getattr(libc, "renameatx_np", None)
        at_fdcwd = -2
    elif sys.platform.startswith("linux"):
        function = getattr(libc, "renameat2", None)
        at_fdcwd = -100
    else:
        function = None
        at_fdcwd = 0
    if function is None:
        raise ImportError(
            "atomic directory exchange is unavailable on this platform"
        )
    function.argtypes = [
        ctypes.c_int,
        ctypes.c_char_p,
        ctypes.c_int,
        ctypes.c_char_p,
        ctypes.c_uint,
    ]
    function.restype = ctypes.c_int
    result = function(
        at_fdcwd,
        os.fsencode(left),
        at_fdcwd,
        os.fsencode(right),
        2,
    )
    if result != 0:
        error_number = ctypes.get_errno()
        raise OSError(
            error_number,
            os.strerror(error_number),
            f"{left} <-> {right}",
        )


def _write_directory_locked(output_dir: Path) -> dict[str, Any]:
    expected_output_identity = _require_owned_output_target(output_dir)
    input_manifest_before = _input_manifest()
    payloads = _build_payloads()
    output_parent = output_dir.parent
    output_parent.mkdir(parents=True, exist_ok=True)
    temporary_dir = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}-", dir=output_parent)
    )
    preserve_temporary = False
    try:
        for file_name in DATA_FILES:
            (temporary_dir / file_name).write_bytes(_json_bytes(payloads[file_name]))
        (temporary_dir / "README.md").write_bytes(_readme_bytes())

        manifest = _build_manifest(
            payloads,
            temporary_dir,
            input_files=input_manifest_before,
        )
        (temporary_dir / "manifest.json").write_bytes(_json_bytes(manifest))
        _validate_directory(temporary_dir)
        _require(
            _input_manifest() == input_manifest_before,
            "input files changed while building the working import",
        )
        for file_name in OUTPUT_FILES:
            _fsync_file(temporary_dir / file_name)
        _fsync_directory(temporary_dir)
        new_generation_identity = _directory_identity(temporary_dir)

        created_placeholder = False
        if expected_output_identity is None:
            try:
                output_dir.mkdir()
            except FileExistsError as error:
                raise ImportError(
                    f"output target appeared during build: {output_dir}"
                ) from error
            expected_output_identity = _directory_identity(output_dir)
            created_placeholder = True

        try:
            _atomic_exchange_directories(output_dir, temporary_dir)
            try:
                _validate_owned_output_generation(
                    output_dir,
                    new_generation_identity,
                )
                if created_placeholder:
                    _require(
                        _directory_identity(temporary_dir)
                        == expected_output_identity,
                        "new-output placeholder identity changed",
                    )
                    _require(
                        not list(temporary_dir.iterdir()),
                        "new-output placeholder was modified",
                    )
                else:
                    _validate_owned_output_generation(
                        temporary_dir,
                        expected_output_identity,
                    )
                _require(
                    _input_manifest() == input_manifest_before,
                    "input files changed during atomic publication",
                )
                _fsync_directory(output_parent)
                _validate_owned_output_generation(
                    output_dir,
                    new_generation_identity,
                )
                _require(
                    _input_manifest() == input_manifest_before,
                    "input files changed while committing publication",
                )
            except BaseException as ownership_error:
                try:
                    _atomic_exchange_directories(output_dir, temporary_dir)
                except BaseException as rollback_error:
                    preserve_temporary = True
                    raise ImportError(
                        "output target changed during publication; the "
                        f"unexpected directory was preserved at {temporary_dir}"
                    ) from rollback_error
                try:
                    preserve_temporary = (
                        _directory_identity(temporary_dir)
                        != new_generation_identity
                    )
                except BaseException:
                    preserve_temporary = True
                preserved_note = (
                    f"; unexpected directory preserved at {temporary_dir}"
                    if preserve_temporary
                    else ""
                )
                try:
                    _fsync_directory(output_parent)
                except OSError as rollback_fsync_error:
                    raise ImportError(
                        "publication was rolled back, but rollback durability "
                        f"could not be confirmed{preserved_note}"
                    ) from rollback_fsync_error
                raise ImportError(
                    "output target changed after ownership validation; "
                    f"publication was rolled back{preserved_note}"
                ) from ownership_error
            preserve_temporary = True
            try:
                if created_placeholder:
                    _require(
                        _directory_identity(temporary_dir)
                        == expected_output_identity
                        and not list(temporary_dir.iterdir()),
                        "new-output placeholder changed before cleanup",
                    )
                    temporary_dir.rmdir()
                else:
                    _remove_owned_output_generation(
                        temporary_dir,
                        expected_output_identity,
                    )
                _fsync_directory(output_parent)
                preserve_temporary = False
            except OSError as cleanup_error:
                print(
                    "warning: published output is valid, but previous "
                    f"generation cleanup was incomplete: {cleanup_error}",
                    file=sys.stderr,
                )
            except ImportError as cleanup_error:
                print(
                    "warning: published output is valid, but previous "
                    f"generation cleanup was skipped: {cleanup_error}",
                    file=sys.stderr,
                )
        except BaseException:
            if (
                created_placeholder
                and output_dir.exists()
                and _directory_identity(output_dir) == expected_output_identity
            ):
                output_dir.rmdir()
                _fsync_directory(output_parent)
            raise
        return manifest
    except BaseException:
        if not preserve_temporary and temporary_dir.exists():
            shutil.rmtree(temporary_dir)
        raise


def _write_directory(output_dir: Path) -> dict[str, Any]:
    output_parent = output_dir.parent
    output_parent.mkdir(parents=True, exist_ok=True)
    directory_flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    directory_flags |= getattr(os, "O_NOFOLLOW", 0)
    try:
        parent_descriptor = os.open(output_parent, directory_flags)
    except OSError as error:
        raise ImportError(
            f"cannot open output parent for locking {output_parent}: {error}"
        ) from error
    try:
        try:
            fcntl.flock(
                parent_descriptor,
                fcntl.LOCK_EX | fcntl.LOCK_NB,
            )
        except OSError as error:
            raise ImportError(
                f"another importer is using output parent {output_parent}: {error}"
            ) from error
        parent_metadata = os.fstat(parent_descriptor)
        _require(
            stat.S_ISDIR(parent_metadata.st_mode),
            f"output parent is not a directory: {output_parent}",
        )
        parent_identity = (parent_metadata.st_dev, parent_metadata.st_ino)
        _require(
            _directory_identity(output_parent) == parent_identity,
            f"output parent changed while acquiring its lock: {output_parent}",
        )
        result = _write_directory_locked(output_dir)
        _require(
            _directory_identity(output_parent) == parent_identity,
            f"output parent changed while publishing: {output_parent}",
        )
        return result
    finally:
        os.close(parent_descriptor)


def _validate_directory(output_dir: Path) -> dict[str, Any]:
    _require(
        not output_dir.is_symlink(),
        f"output directory must not be a symlink: {output_dir}",
    )
    _require(output_dir.is_dir(), f"output directory is missing: {output_dir}")
    entries = list(output_dir.iterdir())
    _require(
        all(not entry.is_symlink() for entry in entries),
        f"generated output contains a symlink: {output_dir}",
    )
    actual_files = sorted(path.name for path in entries)
    _require(
        actual_files == sorted(OUTPUT_FILES),
        f"output file set differs: {actual_files}",
    )
    try:
        manifest = json.loads((output_dir / "manifest.json").read_text("utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ImportError(f"cannot read manifest: {error}") from error
    _require(manifest.get("dataset_id") == DATASET_ID, "dataset ID differs")
    _require("generated_at" not in manifest, "generated_at is not deterministic")
    expected_inputs = _input_manifest()
    _require(manifest.get("input_files") == expected_inputs, "input hash differs")
    expected_generated_names = [
        file_name for file_name in OUTPUT_FILES if file_name != "manifest.json"
    ]
    generated_files = manifest.get("generated_files", [])
    _require(
        [item.get("path") for item in generated_files] == expected_generated_names,
        "manifest generated file list differs from expected output set",
    )
    for item in generated_files:
        path = output_dir / item["path"]
        _require(path.is_file(), f"generated file is missing: {item['path']}")
        _require(
            _sha256_file(path) == item["sha256"],
            f"generated file hash differs: {item['path']}",
        )

    payloads: dict[str, Any] = {}
    for file_name in DATA_FILES:
        try:
            payloads[file_name] = json.loads(
                (output_dir / file_name).read_text(encoding="utf-8")
            )
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise ImportError(f"cannot read {file_name}: {error}") from error
    _validate_payloads(payloads)
    _require(manifest.get("counts") == _counts(payloads), "manifest counts differ")

    expected_payloads = _build_payloads()
    for file_name in DATA_FILES:
        _require(
            (output_dir / file_name).read_bytes()
            == _json_bytes(expected_payloads[file_name]),
            f"{file_name} differs from expected deterministic output",
        )
    _require(
        (output_dir / "README.md").read_bytes() == _readme_bytes(),
        "README.md differs from expected deterministic output",
    )
    _require(
        manifest.get("counts") == _counts(expected_payloads),
        "manifest counts differ from expected deterministic output",
    )
    expected_manifest = _build_manifest(expected_payloads, output_dir)
    _require(
        (output_dir / "manifest.json").read_bytes()
        == _json_bytes(expected_manifest),
        "manifest differs from expected deterministic output",
    )
    return manifest


def _print_summary(manifest: dict[str, Any], output_dir: Path, action: str) -> None:
    print(f"{action}: {output_dir}")
    print(f"dataset_id: {manifest['dataset_id']}")
    for key, value in manifest["counts"].items():
        print(f"{key}: {value}")
    print("generated files:")
    for item in manifest["generated_files"]:
        print(f"- {item['path']}: {item['sha256']}")


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build or validate the deterministic course working import."
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="validate the existing output without replacing it",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="output directory (tests may override the default)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    output_dir = Path(
        os.path.abspath(os.path.expanduser(os.fspath(args.output_dir)))
    )
    try:
        if args.validate_only:
            manifest = _validate_directory(output_dir)
            action = "validated"
        else:
            manifest = _write_directory(output_dir)
            action = "built"
        _print_summary(manifest, output_dir, action)
        return 0
    except (ImportError, OSError, ValueError) as error:
        print(f"course working import failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

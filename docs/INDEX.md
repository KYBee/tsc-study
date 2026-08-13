# 문서 인덱스

작업 전 `README.md`와 이 문서를 먼저 읽고, 작업 범위에 맞는 문서를 추가로 확인한다.

## 권장 읽기 순서

1. [프로젝트 개요](PROJECT_BRIEF.md)
2. [MVP 범위](MVP_SCOPE.md)
3. [사용자 흐름](USER_FLOWS.md)
4. [데이터 작업 흐름](DATA_WORKFLOW.md)
5. [원본 Excel 구조 조사](WORKBOOK_INVENTORY.md), [원본 Excel 향후 매핑](WORKBOOK_MAPPING.md)
6. [Question 대표 표본 보고서](SAMPLE_IMPORT_REPORT.md), [Part 5~7·시각 자료 확장 표본 보고서](EXTENDED_SAMPLE_REPORT.md)
7. [전체 workbook working 반입 보고서](FULL_WORKBOOK_IMPORT_REPORT.md), [강의 콘텐츠와 Question 연결 후보 보고서](COURSE_QUESTION_LINK_REPORT.md)
8. [데이터 스키마 v1.1 요약](SCHEMA_V1_SUMMARY.md), [데이터 스키마 v1.1](DATA_SCHEMA.md)
9. [MVP 데이터 형식 결정](DATA_FORMAT_DECISION.md)
10. [MVP UI 명세](UI_SPEC.md), [화면 데이터 계약](SCREEN_DATA_CONTRACT.md), [화면 이동 흐름](NAVIGATION_FLOW.md)
11. [MVP 구현 기준](IMPLEMENTATION_BASELINE.md), [Part 4 첫 수직 기능 계획](VERTICAL_SLICE_PLAN.md)
12. [현재 구현 상태](IMPLEMENTATION_STATUS.md), [전체 텍스트 파트 앱 slice](TEXT_PARTS_APP_SLICE.md), [Part 2 로컬 시각 학습 slice](PART2_VISUAL_APP_SLICE.md), [Part 2 시각 문제 전수검사](PART2_VISUAL_QUESTION_AUDIT.md), [Part 7 스토리 그림 로컬 학습 slice](PART7_STORY_VISUAL_APP_SLICE.md), [Part 7 이미지-스토리 전수검사](PART7_STORY_VISUAL_AUDIT.md), [Part 4 전체 working slice](PART4_FULL_WORKING_SLICE.md), [Part 4 로컬 검수 워크플로](PART4_REVIEW_WORKFLOW.md)
13. [AI 답변 교정 규칙](AI_CORRECTION_RULES.md)
14. [Level 8 공백 분석](LEVEL8_GAP_ANALYSIS.md), [고득점 목표 데이터 계획](HIGH_SCORE_DATA_PLAN.md)
15. [로드맵](ROADMAP.md), [백로그](BACKLOG.md), [의사결정 기록](DECISIONS.md)

## 문서별 역할

| 문서 | 역할 | 확인이 필요한 작업 |
|---|---|---|
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | 사용자 배경, 문제, 제품 목표와 비목표 | 제품 방향, 기능 제안 |
| [MVP_SCOPE.md](MVP_SCOPE.md) | MVP 포함·제외 범위와 완료 조건 | 범위 판단, 우선순위 |
| [USER_FLOWS.md](USER_FLOWS.md) | 핵심 네 기능의 텍스트 흐름 | 화면·상호작용 기획 |
| [UI_SPEC.md](UI_SPEC.md) | 모바일 MVP 화면, Part별 차이, 상태·접근성 명세 | UI 구조 검토, 구현 준비 |
| [SCREEN_DATA_CONTRACT.md](SCREEN_DATA_CONTRACT.md) | 화면별 스키마 엔터티, 필수·선택 데이터와 사용자 변경 데이터 | API·상태 설계 전 계약 확인 |
| [NAVIGATION_FLOW.md](NAVIGATION_FLOW.md) | 목업을 참고한 화면 이동, 뒤로가기와 실패·빈 상태 흐름 | 내비게이션·사용자 흐름 검토 |
| [DATA_WORKFLOW.md](DATA_WORKFLOW.md) | `raw`에서 `reviewed`까지의 데이터 운영 절차 | 자료 반입, 변환, 검수 |
| [WORKBOOK_INVENTORY.md](WORKBOOK_INVENTORY.md) | 첫 원본 Excel의 파일 정보, 시트 구조와 품질 조사 결과 | 원본 확인, 표본 범위 선택 |
| [WORKBOOK_MAPPING.md](WORKBOOK_MAPPING.md) | 원본 시트·컬럼의 공용·개인 데이터 분리 및 향후 매핑 | 표본 추출, 데이터 모델 검토 |
| [SAMPLE_IMPORT_REPORT.md](SAMPLE_IMPORT_REPORT.md) | Part 1~4 Question 20개 표본 결과와 스키마 검토 사항 | 추가 표본, 스키마 결정 |
| [EXTENDED_SAMPLE_REPORT.md](EXTENDED_SAMPLE_REPORT.md) | Part 5~7 Question과 Part 2·7 시각 자료 표본 결과 | 스키마 v1 결정 근거, 전체 추출 범위 검토 |
| [FULL_WORKBOOK_IMPORT_REPORT.md](FULL_WORKBOOK_IMPORT_REPORT.md) | Question 253개, 전체 시각 자료와 working 검수 큐 반입 결과 | 사람 검수, reviewed 승격 준비 |
| [COURSE_QUESTION_LINK_REPORT.md](COURSE_QUESTION_LINK_REPORT.md) | course-import와 canonical Question의 엄격 연결·사용 후보 결과 | 후보 승인·거절과 출처 근거 확인 |
| [SCHEMA_V1_SUMMARY.md](SCHEMA_V1_SUMMARY.md) | 표본 검증과 강의 자료 근거 구분을 반영한 스키마 v1.1의 배경·흐름·운영 규칙 요약 | 전체 데이터 반입 전 구조 검토 |
| [DATA_SCHEMA.md](DATA_SCHEMA.md) | 구현 기술에 독립적인 canonical 엔터티, 필드, 관계와 검증 규칙 | 데이터 모델, 가져오기 |
| [DATA_FORMAT_DECISION.md](DATA_FORMAT_DECISION.md) | raw Excel, working CSV, reviewed JSON, 런타임과 개인 IndexedDB의 책임 | 데이터 변환·저장 경계 |
| [AI_CORRECTION_RULES.md](AI_CORRECTION_RULES.md) | 한국어·중국어·혼합 입력의 최소 교정 원칙 | AI 프롬프트, 교정 결과 |
| [IMPLEMENTATION_BASELINE.md](IMPLEMENTATION_BASELINE.md) | MVP 프론트엔드, 공용·개인 데이터, AI 경계와 테스트 기준 | 실제 앱 초기화 전 확인 |
| [VERTICAL_SLICE_PLAN.md](VERTICAL_SLICE_PLAN.md) | Part 4 첫 수직 기능의 17단계 작업·완료 계약 | 첫 앱 구현 |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Part 4 첫 수직 기능의 화면·fixture·저장소·검증 결과와 제한 | 현재 앱 실행·검증·후속 구현 |
| [PART4_FULL_WORKING_SLICE.md](PART4_FULL_WORKING_SLICE.md) | Part 4 working 50문제 fixture, PracticeDraft, migration, 화면·검증 결과 | 현재 Part 4 앱 범위와 제한 확인 |
| [TEXT_PARTS_APP_SLICE.md](TEXT_PARTS_APP_SLICE.md) | Part 1·3·4·5·6의 193문제 fixture, 공통 화면, 자유 입력·회상과 Part 4 전용 UX | 현재 전체 텍스트 문제 앱 범위와 제한 확인 |
| [PART2_VISUAL_APP_SLICE.md](PART2_VISUAL_APP_SLICE.md) | Part 2 12세트·48문항 fixture, 로컬 이미지 권리 경계, 출처 답변·개인 회상 흐름 | 로컬 Part 2 실행·검증과 Part 7 후속 설계 |
| [PART2_VISUAL_QUESTION_AUDIT.md](PART2_VISUAL_QUESTION_AUDIT.md) | Part 2 48개 질문·답변과 12장 이미지의 정합성, 고해상도 교체 결과 | Part 2 그림 의미·스타일 검수와 provenance 확인 |
| [PART7_STORY_VISUAL_APP_SLICE.md](PART7_STORY_VISUAL_APP_SLICE.md) | Part 7 VisualSet 중심 스토리 설계·회상, 후보 관계와 로컬 이미지 권리 경계 | 로컬 Part 7 실행·검증과 관계·권리 사람 검수 |
| [PART7_STORY_VISUAL_AUDIT.md](PART7_STORY_VISUAL_AUDIT.md) | Part 7 12세트 48장 전수검사와 인물·사건 연속성 교체 결과 | StoryGuide-그림 정합성과 생성 교체 provenance 확인 |
| [PART4_REVIEW_WORKFLOW.md](PART4_REVIEW_WORKFLOW.md) | Part 4 필드별 사람 검수, 결정 교환, stale 판정과 reviewed 승격 규칙 | 실제 검수와 부분 승격 전 확인 |
| [LEVEL8_GAP_ANALYSIS.md](LEVEL8_GAP_ANALYSIS.md) | 3급 강의가 제공하는 정확성 기반과 Level 8 목표 대비 Part별·데이터별 공백 | 고득점 데이터 보강 범위 결정 |
| [HIGH_SCORE_DATA_PLAN.md](HIGH_SCORE_DATA_PLAN.md) | 정확성 데이터부터 약점 추천까지 열 단계의 데이터·화면·검수 계획 | 후속 데이터와 기능 우선순위 |
| [ROADMAP.md](ROADMAP.md) | Phase 0~7의 진행 순서 | 단계 계획 |
| [BACKLOG.md](BACKLOG.md) | 우선순위가 있는 상위 사용자 스토리 | 기능 선택, 완료 판단 |
| [DECISIONS.md](DECISIONS.md) | 확정된 스키마 결정과 아직 결정하지 않은 기술·운영 사항 | 설계 결정 전 확인 |

## 데이터 관련 문서

- [`data/README.md`](../data/README.md): `raw`, `working`, `reviewed` 디렉터리의 수정·이동 규칙
- [`sources/README.md`](../sources/README.md): 출처 자료의 이름, 메타데이터, 저작권 주의사항
- [`sources/src-001__tsc-question-bank-workbook.md`](../sources/src-001__tsc-question-bank-workbook.md): 첫 원본 Excel의 출처·파일·권리 확인 메타데이터
- [`data/working/question-sample/README.md`](../data/working/question-sample/README.md): Question 대표 표본의 실행·선정·컬럼·상태 설명
- [`data/working/extended-sample/README.md`](../data/working/extended-sample/README.md): Part 5~7·시각 자료 확장 표본의 실행·선정·상태 설명
- [`data/working/app-fixtures/part4/README.md`](../data/working/app-fixtures/part4/README.md): Part 4 raw 개발 fixture의 생성·검증·사용 제한
- [`data/working/app-fixtures/part4-full/README.md`](../data/working/app-fixtures/part4-full/README.md): Part 4 전체 50문제 working 개발 fixture의 생성·검증·사용 제한
- [`data/working/app-fixtures/text-parts-v1/README.md`](../data/working/app-fixtures/text-parts-v1/README.md): Part 1·3·4·5·6 전체 193문제 working 개발 fixture
- [`data/working/app-fixtures/part2-visual-v1/README.md`](../data/working/app-fixtures/part2-visual-v1/README.md): Part 2 12세트·48문항과 검수 전 출처 답변 working 개발 fixture
- [`data/working/app-fixtures/part7-visual-v1/README.md`](../data/working/app-fixtures/part7-visual-v1/README.md): Part 7 스토리 그림 12세트, StoryGuide와 비canonical 연결 후보 working fixture
- [`data/working/review-fixtures/part4-v1/README.md`](../data/working/review-fixtures/part4-v1/README.md): Part 4 사람 검수 입력 fixture와 원문 해시 규칙
- [`data/working/course-import-v1/README.md`](../data/working/course-import-v1/README.md): 강의 분석 Markdown을 근거 종류별로 구조화한 검수 전 working import
- [`data/working/full-import-v1/README.md`](../data/working/full-import-v1/README.md): 전체 workbook을 스키마 v1.1 형태로 구조화한 검수 전 working import

## UI 참고 자료

- [`docs/mockups/tsc-mock-v2.html`](mockups/tsc-mock-v2.html): `TSC 학습 · 목업 v2` 모바일 화면 참고 목업. 실제 서비스 코드나 canonical 데이터가 아니다.

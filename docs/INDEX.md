# 문서 인덱스

작업 전 `README.md`와 이 문서를 먼저 읽고, 작업 범위에 맞는 문서를 추가로 확인한다.

## 권장 읽기 순서

1. [프로젝트 개요](PROJECT_BRIEF.md)
2. [MVP 범위](MVP_SCOPE.md)
3. [사용자 흐름](USER_FLOWS.md)
4. [데이터 작업 흐름](DATA_WORKFLOW.md)
5. [원본 Excel 구조 조사](WORKBOOK_INVENTORY.md), [원본 Excel 향후 매핑](WORKBOOK_MAPPING.md)
6. [Question 대표 표본 보고서](SAMPLE_IMPORT_REPORT.md), [Part 5~7·시각 자료 확장 표본 보고서](EXTENDED_SAMPLE_REPORT.md)
7. [데이터 스키마 v1 요약](SCHEMA_V1_SUMMARY.md), [데이터 스키마 v1](DATA_SCHEMA.md)
8. [AI 답변 교정 규칙](AI_CORRECTION_RULES.md)
9. [로드맵](ROADMAP.md), [백로그](BACKLOG.md), [의사결정 기록](DECISIONS.md)

## 문서별 역할

| 문서 | 역할 | 확인이 필요한 작업 |
|---|---|---|
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | 사용자 배경, 문제, 제품 목표와 비목표 | 제품 방향, 기능 제안 |
| [MVP_SCOPE.md](MVP_SCOPE.md) | MVP 포함·제외 범위와 완료 조건 | 범위 판단, 우선순위 |
| [USER_FLOWS.md](USER_FLOWS.md) | 핵심 네 기능의 텍스트 흐름 | 화면·상호작용 기획 |
| [DATA_WORKFLOW.md](DATA_WORKFLOW.md) | `raw`에서 `reviewed`까지의 데이터 운영 절차 | 자료 반입, 변환, 검수 |
| [WORKBOOK_INVENTORY.md](WORKBOOK_INVENTORY.md) | 첫 원본 Excel의 파일 정보, 시트 구조와 품질 조사 결과 | 원본 확인, 표본 범위 선택 |
| [WORKBOOK_MAPPING.md](WORKBOOK_MAPPING.md) | 원본 시트·컬럼의 공용·개인 데이터 분리 및 향후 매핑 | 표본 추출, 데이터 모델 검토 |
| [SAMPLE_IMPORT_REPORT.md](SAMPLE_IMPORT_REPORT.md) | Part 1~4 Question 20개 표본 결과와 스키마 검토 사항 | 추가 표본, 스키마 결정 |
| [EXTENDED_SAMPLE_REPORT.md](EXTENDED_SAMPLE_REPORT.md) | Part 5~7 Question과 Part 2·7 시각 자료 표본 결과 | 스키마 v1 결정 근거, 전체 추출 범위 검토 |
| [SCHEMA_V1_SUMMARY.md](SCHEMA_V1_SUMMARY.md) | 두 차례 표본 검증을 반영한 스키마 v1의 배경·흐름·운영 규칙 요약 | 전체 데이터 반입 전 구조 검토 |
| [DATA_SCHEMA.md](DATA_SCHEMA.md) | 구현 기술에 독립적인 canonical 엔터티, 필드, 관계와 검증 규칙 | 데이터 모델, 가져오기 |
| [AI_CORRECTION_RULES.md](AI_CORRECTION_RULES.md) | 한국어·중국어·혼합 입력의 최소 교정 원칙 | AI 프롬프트, 교정 결과 |
| [ROADMAP.md](ROADMAP.md) | Phase 0~7의 진행 순서 | 단계 계획 |
| [BACKLOG.md](BACKLOG.md) | 우선순위가 있는 상위 사용자 스토리 | 기능 선택, 완료 판단 |
| [DECISIONS.md](DECISIONS.md) | 확정된 스키마 결정과 아직 결정하지 않은 기술·운영 사항 | 설계 결정 전 확인 |

## 데이터 관련 문서

- [`data/README.md`](../data/README.md): `raw`, `working`, `reviewed` 디렉터리의 수정·이동 규칙
- [`sources/README.md`](../sources/README.md): 출처 자료의 이름, 메타데이터, 저작권 주의사항
- [`sources/src-001__tsc-question-bank-workbook.md`](../sources/src-001__tsc-question-bank-workbook.md): 첫 원본 Excel의 출처·파일·권리 확인 메타데이터
- [`data/working/question-sample/README.md`](../data/working/question-sample/README.md): Question 대표 표본의 실행·선정·컬럼·상태 설명
- [`data/working/extended-sample/README.md`](../data/working/extended-sample/README.md): Part 5~7·시각 자료 확장 표본의 실행·선정·상태 설명

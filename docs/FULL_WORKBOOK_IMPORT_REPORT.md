# 전체 workbook working 반입 보고서

## 범위

원본 Excel을 수정하지 않고 스키마 v1.1 형태의 결정적 working JSON으로 구조화했다.

- 원본: `data/raw/TSC_파트별_문제은행_그림포함.xlsx`
- 파일 크기: 623,070 bytes
- SHA-256: `a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f`
- 출력: `data/working/full-import-v1/`
- dataset ID: `full-workbook-working-import-v1`
- 상태: `working`
- 스키마: `data-schema-v1.1-working`

이 결과는 `reviewed` 또는 앱 런타임 데이터가 아니다. 중국어·병음·한국어·출처·권리를 사람이 검수하기 전에는 공용 서비스 기준 데이터로 승격하지 않는다.

## 시트별 매핑

| 시트 | working 매핑 |
|---|---|
| 시험 구조 | 전역 안내는 `unmapped-content`, Part별 근거는 workbook 전용 `PartGuide` 검토 자료 |
| 문제은행 | `Question`, `AnswerPoint`, `SourceReference` |
| 요약 | workbook 전용 `PartGuide`와 문제 수 검증 근거 |
| 공식·참고 링크 | 검증된 `Source`로 승격하지 않고 `unmapped-content`에 주장 정보로 보존 |
| 그림 활용 안내 | 시각 자료 운영 안내와 `unmapped-content` |
| Part2 그림 연습 | `VisualSet`, `VisualQuestion`, `VisualAsset`, `VisualSetAsset` |
| Part2 정답 | `VisualQuestion` 대상의 출처 `ModelAnswer` |
| Part7 스토리 그림 | `VisualSet`, `VisualAsset`, `VisualSetAsset` |
| Part7 정답 포인트 | `StoryGuide` |
| 공식 샘플 이미지 | 독립 `official_sample` VisualSet과 VisualAsset; Question 연결 없음 |

`시험 구조`의 Part 1 Q1~Q4 라벨·설명은 `response_structure`로 오인하지 않고 `unmapped-content`에 원문 보존했다. workbook 전용 PartGuide에는 명확한 공통 안내와 시간 정보만 연결했다.

## 엔터티 수

| 엔터티·작업 큐 | 수 |
|---|---:|
| Source | 1 |
| SourceReference | 667 |
| Question | 253 |
| AnswerPoint | 253 |
| PartGuide | 7 |
| VisualAsset | 25 |
| VisualSet | 25 |
| VisualSetAsset | 25 |
| VisualQuestion | 48 |
| QuestionVisualSet | 18 |
| ModelAnswer | 48 |
| StoryGuide | 12 |
| course Question 연결 후보 | 0 |
| course 콘텐츠 사용 후보 | 4 |
| workbook 내부 연결 후보 | 12 |
| unmapped content | 118 |
| review queue | 9 |

Question의 Part별 수는 다음과 같다.

| Part | 수 |
|---:|---:|
| 1 | 4 |
| 2 | 48 |
| 3 | 84 |
| 4 | 50 |
| 5 | 36 |
| 6 | 19 |
| 7 | 12 |
| 합계 | 253 |

`연습 상태`, `최근 연습일`, `내 답변 메모`는 공용 데이터에서 제외했다. 이 값으로 `UserAnswer`나 `ReviewState`를 만들지 않았다.

## Part 2 반입

- 그림 세트 12개
- 시각 하위 질문 48개
- 원본 추천 답변 48개
- canonical Question 자동 연결 18개
- 미연결 VisualQuestion 30개
- 별도 workbook 연결 후보 0개

VisualQuestion은 원본 중국어를 기준으로 유일하고 엄격한 일치가 확인된 경우에만 canonical Question과 연결했다. 행 순서, ID 접미사 또는 의미 유사성은 연결 근거로 사용하지 않았다.

Part 2 추천 답변은 workbook에 있던 세 언어 원문을 그대로 보존한 출처 답변이다. 모든 레코드는 `answer_target_type = visual_question`, `answer_status = review_needed`, `provenance_kind = unverified_source`이며 승인된 공식 정답이 아니다.

## Part 7 반입

- 스토리 그림 세트 12개
- StoryGuide 12개
- QuestionVisualSet 0개
- 접미사 기반 검토 후보 12개

Part 7의 추천 이야기 흐름은 완성 중국어 답변이 아니므로 `ModelAnswer`로 변환하지 않았다. `P7-001`과 `P7-V01`처럼 숫자 접미사가 대응해도 명시적인 연결 근거가 없으므로 실제 관계를 만들지 않았다. 같은 공통 `question_zh`를 사용하는 12개 Question도 병합하지 않았다.

후속 로컬 앱 구현도 이 반입 사실을 바꾸지 않는다. Part 7은 VisualSet을
직접 학습 대상으로 사용하고 접미사 후보 12개를 `not_canonical`
검수 큐로 유지한다. 구현 계약은
[PART7_STORY_VISUAL_APP_SLICE.md](PART7_STORY_VISUAL_APP_SLICE.md)를
참고한다.

## 이미지와 권리

workbook 내부 이미지 25개의 원본 바이트 메타데이터를 기록했다.

- Part 2 이미지: 12개
- Part 7 이미지: 12개
- 공식 샘플 이미지: 1개
- 중복 SHA-256: 0개
- `rights_status = review_needed`: 25개
- `public_allowed`: 0개

공식 샘플 이미지는 별도 `official_sample` VisualSet으로 보존했지만 Question과 연결하지 않았다. 생성 이미지 바이트는 working JSON과 분리된 로컬 생성 경계에서만 다루며 공개·배포 가능 여부는 VisualAsset별 검수 전까지 미결정이다.

## Source와 출처 주장

실제 반입 파일은 기존 `src-001` Source 하나다. 문제은행의 `출처`, `출처 URL`, `자료 등급`, `원문성`은 workbook 내부의 주장으로 `SourceReference`에 보존했다. URL이나 “공식”이라는 문구가 있다는 이유만으로 별도 검증 Source를 만들지 않았다.

## 자동 연결과 미연결

자동 생성한 canonical 관계는 Part 2 VisualQuestion의 엄격 일치 18건이다. 다음은 실제 관계로 만들지 않았다.

- 근거가 부족한 Part 2 VisualQuestion 30개
- Part 7 숫자 접미사 후보 12개
- course-import 콘텐츠와 Question의 의미 유사 연결
- workbook PartGuide와 course-import PartGuide의 자동 병합

강의 콘텐츠의 Part 일치와 중국어 문자열 포함이 동시에 확인된 4건은 `course-content-usage-candidates.json`에 사람 검수용 추천 후보로만 기록했다. LearningExpression 3건과 PronunciationItem 1건이며 canonical 관계가 아니다.

## 비매핑 내용과 검수 큐

`unmapped-content.json`은 118건이다.

- 주장된 참고 링크 셀: 54건
- 시각 문제 안내 문구: 24건
- 전역 안내: 28건
- 시각 자료 전역 지침: 7건
- 제외한 개인 컬럼 메타데이터: 3건
- 공식 샘플 주변 문구: 2건

`review-queue.json`의 9개 검수 묶음은 다음을 다룬다.

1. 253개 Question의 언어·유형·출처 검수
2. Part 2 미연결 VisualQuestion 30개
3. 엄격 문자열 근거로 만든 Part 2 QuestionVisualSet 18개
4. Part 7 접미사 후보 12개
5. workbook/course PartGuide 범위 비교
6. VisualAsset 25개의 공개 권리
7. 주장된 출처 URL 검증
8. Part 2 출처 ModelAnswer 48개의 언어·내용 검수
9. course 콘텐츠 사용 후보 4개

## 결정적 출력과 무결성

JSON은 UTF-8, LF, 2칸 들여쓰기, 안정적인 ID·키 순서와 파일 끝 개행을 사용하며 생성 시각과 절대경로를 넣지 않는다. manifest의 현재 검증 상태는 `passed`이고 원본 workbook 해시, 시트 구조, 엔터티 수, ID·참조 무결성, 엄격 연결, 이미지 바이트 SHA-256, working 상태 경계와 개인 컬럼 제외를 확인한다.

`manifest.json`은 자기참조 해시를 만들 수 없어 `generated_files`에서 제외한다. 반복 생성과 `--validate-only` 무변경 여부는 데이터 전용 검증 명령으로 확인한다.

```sh
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py --validate-only
python3 scripts/build_full_workbook_import.py --extract-assets
npm run check:data
```

## reviewed 승격 조건

다음이 끝나기 전에는 `data/reviewed`로 승격하지 않는다.

- 253개 Question의 중국어·전체 병음·한국어·유형 사람 검수
- SourceReference의 주장 출처와 URL 확인
- Part 2 추천 답변 48개의 세 언어·내용 검수
- 미연결 시각 질문과 Part 7 후보 관계 승인
- workbook/course PartGuide의 범위와 충돌 검토
- VisualAsset별 공개·배포 권리 확인
- 원본 변경 내역과 승인 상태 기록

답변이 없는 Question은 정상 상태이며 승격을 위해 임의 답변을 생성하지 않는다.

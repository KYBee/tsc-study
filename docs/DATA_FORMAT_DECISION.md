# MVP 데이터 형식 결정

## 결정 목적

원본 보존, 추출·검수, 앱 런타임과 개인 학습 기록의 책임을 물리적으로 구분한다. 데이터 스키마 v1의 엔터티와 관계는 유지하되, 첫 MVP 구현에서 각 단계가 사용하는 기준 형식을 명확히 한다.

## 단계별 책임

| 단계 | 형식·위치 | 책임 | 변경 가능 여부 | 앱 사용 |
|---|---|---|---|---|
| raw 원본 | Excel 등 사용자가 제공한 원본, `data/raw` | 원본 증거와 구조 보존 | 내용·파일명 수정 금지 | 직접 읽지 않음 |
| working | CSV 등 파생 작업 파일, `data/working` | 추출, 매핑, 중복·누락 조사와 검수 준비 | 원본과 변환 규칙을 추적하는 범위에서 재생성·정리 가능 | 서비스 기준으로 직접 사용하지 않음 |
| reviewed canonical | `data/reviewed`의 엔터티별 JSON | 검수 완료 공용 콘텐츠의 기준 | 검수·스키마 검증 절차를 거쳐 변경 | 런타임 공용 데이터의 기준 |
| 런타임 앱 데이터 | 검증을 통과한 reviewed JSON의 읽기 모델 | 화면에 공용 콘텐츠 제공 | 앱에서 수정하지 않음 | 정적으로 읽음 |
| 개인 데이터 | 브라우저 IndexedDB | 사용자 답변·개인 오류·복습 상태·진행 문맥·구조화 설정 | 현재 사용자 행동으로 생성·수정 | 공용 JSON과 결합해 화면에 표시 |

`localStorage`는 테마처럼 매우 단순한 설정에만 사용할 수 있다. `UserAnswer`, 개인 `Correction`, `ReviewState` 본문은 저장하지 않는다.

## raw Excel

- 원본 Excel의 셀, 시트, 이미지, 링크, 서식과 원래 파일명을 변경하지 않는다.
- 원본을 다시 저장하거나 reviewed 형식처럼 정규화하지 않는다.
- 파일 크기, SHA-256과 `original_file_name`으로 동일성을 추적한다.
- 원본 안의 출처 이름·URL은 검증된 사실이 아니라 원본의 주장일 수 있다.

## working CSV와 구조 검증 JSON

- Excel에서 추출한 값을 검토하고 canonical 매핑을 시험하는 중간 형식이다.
- CSV는 공용 앱 데이터의 기준이 아니며 런타임 컴포넌트가 직접 의존하지 않는다.
- 기존 CSV를 서비스 요구에 맞춰 수동 수정하는 대신 변환·검수 규칙을 명시한다.
- 현재 import 컬럼은 `Question`, `AnswerPoint`, `SourceReference` 등 canonical 엔터티로 분리해 변환한다.
- 개인 연습 상태, 최근 연습일과 개인 메모를 공용 변환에 포함하지 않는다.
- Excel처럼 표 구조를 검토하는 기본 working 형식은 CSV다. 다만 강의 근거처럼 여러 엔터티와 N:M 출처 관계를 함께 검증할 때는 `data/working` 아래에 결정적인 JSON을 사용할 수 있다.
- working JSON도 reviewed canonical JSON이 아니다. `reviewed`·`verified`로 자동 승격하지 않고 앱 런타임 기준 데이터로 직접 사용하지 않는다.

## reviewed canonical JSON

검수 완료 공용 콘텐츠의 MVP 기준 형식이다.

원칙:

- 엔터티별 JSON 파일로 분리한다.
- 관계는 `question_id` 등 스키마 v1의 안정적인 ID로 연결한다.
- `question_zh`를 객체 키, 관계 키나 고유 식별자로 사용하지 않는다.
- 파일 내용은 사람이 diff와 리뷰를 할 수 있도록 들여쓰기한다.
- 직렬화기는 객체 필드와 배열의 순서를 결정적으로 유지한다.
- 동일한 검수 입력과 변환 규칙에서는 동일한 JSON 내용이 생성되어야 한다.
- JSON 변경은 스키마·참조 무결성·상태별 필수 필드 검증을 통과해야 한다.
- 런타임 앱은 공용 JSON을 수정하지 않는다.

배열의 canonical 정렬은 안정적인 ID를 기본으로 하고, 화면 표시 순서는 `sequence`, `item_number` 등 명시적인 스키마 필드를 사용한다. 객체 필드 순서는 생성기가 정의한 스키마 순서를 유지한다. 실제 serializer와 포매터는 프로젝트 초기화 단계에서 고정한다.

### 엔터티 파일 후보

- `questions.json`
- `answer-points.json`
- `model-answers.json`
- `part-guides.json`
- `corrections.json` — 공용 Correction만 포함
- `source-references.json`
- `visual-assets.json`
- `visual-sets.json`
- `visual-set-assets.json`
- `question-visual-sets.json`
- `visual-questions.json`
- `story-guides.json`
- `sources.json`

`SourceReference.source_id`가 참조하는 실제 `Source` 레코드는 reviewed/runtime 데이터에 반드시 존재해야 한다. 기본 위치는 `sources.json`이며 파일명이나 묶음을 조정하더라도 명시적인 Source 위치와 참조 무결성을 유지한다.

## 런타임 앱 데이터

- 앱은 검증을 통과한 reviewed JSON을 읽기 전용으로 불러온다.
- 화면은 JSON 파일 구조에 직접 결합하지 않고 공용 데이터 저장소 인터페이스를 통해 엔터티를 조회한다.
- 로드 시 또는 빌드 검증 단계에서 ID 고유성, 참조 무결성, enum과 상태별 필수 필드를 확인한다.
- `verified` 또는 학습자 표시 콘텐츠는 중국어·병음·한국어 묶음을 갖춰야 한다.
- `ModelAnswer`가 없는 Question도 정상적으로 포함하고 조회한다.
- 답변이 없다는 이유로 빈 ModelAnswer나 생성 답변을 추가하지 않는다.
- 공용 JSON을 브라우저의 개인 학습 상태로 덮어쓰지 않는다.
- reviewed `VisualAsset.repository_path`는 검수된 저장소 자산 위치를 가리켜야 한다. `data/working`의 추출 경로를 공개 런타임 URL처럼 사용하지 않으며, 원래 추출 위치는 `SourceReference`, `source_locator` 또는 검수 메모로 보존한다.
- 빌드가 저장소 자산 경로를 런타임 URL로 투영한다면 그 매핑도 결정적이어야 하며 canonical 출처 관계를 바꾸지 않는다.
- working 이미지 바이트를 reviewed 자산으로 승격할 때는 언어·연결 검수와 별도로 권리 상태를 확인하고 원본 `sha256`을 보존한다. `rights_status = review_needed` 또는 `restricted`인 바이트를 공개 런타임 bundle에 자동 포함하지 않는다.

## 개인 IndexedDB 데이터

포함:

- `UserAnswer`
- `data_scope = personal`인 `Correction`
- `ReviewState`
- 마지막 학습 위치
- 병음 표시 여부 등 구조화된 사용자 설정

포함하지 않음:

- 공용 Question·ModelAnswer·PartGuide 원본
- 공용 Correction 원본
- reviewed JSON의 복제본을 개인 상태와 섞은 레코드
- API 키와 비밀값

개인 데이터는 현재 브라우저와 origin에 종속된다. 로그인·서버 동기화·내보내기·가져오기는 초기 MVP에서 제공하지 않는다. 첫 수직 기능에서는 `idb` 래퍼를 사용하고 object store 구조는 [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)에 기록한다. 장기 버전·마이그레이션과 백업 방식은 다중 사용자나 production 데이터 전환 전에 다시 결정한다.

개발 전용 raw fixture와 reviewed/production 데이터는 IndexedDB의 DB 이름 또는 dataset namespace로 분리한다. canonical `question_id`가 같더라도 개발 개인 기록을 production으로 자동 승격하지 않으며, 전환이 필요하면 질문 검수 상태와 내용 변경을 확인하는 별도 마이그레이션 결정을 거친다.

## 관계와 변환 규칙

1. `Question`은 `question_id`로 식별하며 `question_zh`에는 unique 제약을 두지 않는다.
2. working의 `answer_point`는 원문 그대로 `AnswerPoint.content`로 옮기고 분류 전에는 `point_type = unclassified`로 둔다.
3. Question과 ModelAnswer를 분리하며 하나의 질문에 답변이 없거나 여러 개 있을 수 있다.
4. `StoryGuide`를 ModelAnswer로 변환하지 않는다.
5. `SourceReference`는 실제 추출 Source와 원본 내부의 출처 주장을 구분한다.
6. 검수되지 않은 `QuestionVisualSet`, `VisualSetAsset`, `VisualQuestion.question_id`와 `StoryGuide.question_id` 연결을 강제로 만들지 않는다. 근거가 없으면 빈 값과 검수 메모를 유지하며 런타임 결합은 검증된 관계만 사용한다.
7. Part 7의 반복 `question_zh`를 병합하거나 삭제하지 않는다.
8. 공용 JSON에는 개인 UserAnswer, 개인 Correction과 ReviewState를 넣지 않는다.

변환기가 새로 만드는 공용 엔터티와 관계 ID도 결정적이어야 한다. 원본의 안정적인 ID·`source_locator`·관계 종류와 엔터티 prefix를 사용하는 버전된 규칙을 정의하고, 배열 index만 사용하거나 정규화된 문장·현재 시각·난수에서 ID를 만들지 않는다. 충돌하면 임의 suffix를 붙이지 않고 생성에 실패해 검수한다.

## deterministic 생성 검증

공용 JSON 생성 과정은 최소한 다음을 검증한다.

- 같은 입력과 규칙으로 두 번 생성한 결과가 동일함
- 엔터티 ID가 파일 안에서 고유함
- 모든 참조가 존재하는 대상 ID를 가리킴
- 상태별 필수 언어·출처 필드가 존재함
- Part가 허용 범위 안에 있음
- AnswerPoint·ModelAnswer·StoryGuide의 역할이 섞이지 않음
- 공용 파일에 개인 데이터가 없음
- 임의의 시각 자료 연결이 없음

검증이 실패하면 부분 JSON을 reviewed canonical 결과처럼 교체하지 않는다.

이 deterministic 요구는 사용자 생성 시각과 개인 ID를 재실행 때마다 같게 만들라는 뜻이 아니다. 개인 데이터 ID는 생성 후 고유하고 안정적으로 유지하며 IndexedDB 마이그레이션에서 보존한다.

## Part 4 개발 전용 임시 JSON

첫 수직 기능은 현재 working CSV의 Part 4 표본 6개를 사용한다. 이 변환물의 계획 위치는 `data/working/app-fixtures/part4/`이며 실제 화면과 저장소 경계를 구현하기 위한 개발 fixture다. reviewed canonical JSON이 아니고 production 반입·빌드에서 제외한다.

- raw 상태와 원문 값을 유지한다.
- 여섯 canonical `question_id`만 포함한다.
- 원본 `answer_point`를 결정적 ID와 raw 상태를 가진 canonical-shaped AnswerPoint로 보존한다.
- workbook `Source`와 결정적 ID·관계·검수 상태를 가진 SourceReference를 함께 제공한다.
- ModelAnswer 행을 생성하지 않는다.
- 파일과 화면에서 개발 전용·미검수 상태를 구분한다.
- 전체 데이터 변환이나 배포 가능 판정을 대신하지 않는다.

검수 완료 공용 앱 데이터로 전환할 때에는 같은 엔터티 구조를 사용하되 reviewed JSON 검증 게이트를 별도로 통과해야 한다.

## 변경 경계 요약

```text
raw Excel (불변)
→ working CSV (추출·검수 중간 형식)
→ reviewed entity JSON (공용 canonical)
→ runtime read-only repository

사용자 행동
→ IndexedDB (개인 기록)
```

공용과 개인 데이터는 화면에서 함께 읽을 수 있지만 같은 기준 파일에 저장하지 않는다.

# MVP 화면 이동 흐름

## 범위

이 문서는 사용자가 화면 사이를 이동하는 순서와 분기 조건을 정의한다. MVP 라우팅은 React Router Declarative 방식을 사용하지만 구체적인 URL, 브라우저 상태 전달과 화면 컴포넌트 구조는 이 문서에서 확정하지 않는다.

전역 하단 탭은 `학습`, `복습`, `나의 답변`, `실수 노트`다. 탭 선택은 각 기능의 시작 화면으로 이동한다. 상세 화면의 뒤로가기는 고정된 한 화면이 아니라 실제 진입 문맥을 복원해야 한다.

## 공통 이동 원칙

- 화면 연결에는 `question_id`, `visual_set_id`, `visual_question_id`, `user_answer_id`, `correction_id` 같은 안정적인 ID를 사용한다.
- `question_zh`를 URL이나 화면 식별자로 사용하지 않는다.
- 문제 상세에서 모범답안을 자동 공개하지 않는다.
- 다른 탭이나 목록에서 문제로 진입했다면 뒤로갈 때 원래 목록·필터·스크롤 문맥으로 복귀한다.
- 로딩·저장 실패가 발생해도 입력 원문과 교정 결과를 잃지 않는다.
- 구체적인 URL은 이 문서에서 정하지 않는다. 라우팅 구현 기준은 `IMPLEMENTATION_BASELINE.md`를 따른다.

## 1. 첫 방문

```text
앱 진입
→ 학습 탭의 HOME
→ 오늘 복습할 문제 확인
→ 이어서 학습할 Part 또는 문제 확인
→ Part 1~7 목록 확인
```

분기:

- 오늘 복습을 선택하면 `REVIEW`로 이동한다.
- 이어서 학습을 선택하면 저장된 마지막 문맥에 따라 `PART_DETAIL` 또는 해당 문제 화면으로 이동한다.
- Part를 선택하면 `PART_DETAIL`로 이동한다.
- 다른 하단 탭을 선택하면 해당 기능의 시작 화면으로 이동한다.

오늘 복습 또는 이어서 학습 데이터가 없어도 첫 방문을 차단하지 않으며 Part 목록을 유지한다.

## 2. 파트 학습

```text
HOME
→ Part 1~7 중 하나 선택
→ PART_DETAIL
→ 목표·준비 요령·답변 구조 확인
→ 필수 표현·자주 하는 실수 확인
→ 해당 Part의 문제 또는 시각 학습 항목 선택
```

분기:

- Part 1·3·4·5·6의 일반 문제는 `TEXT_QUESTION`으로 이동한다.
- Part 2의 그림 세트는 `PART2_VISUAL`로 이동한다.
- Part 7의 검증된 시각 문제 맥락은 `PART7_STORY`로 이동한다.
- 문제가 없으면 `아직 등록된 문제가 없습니다`를 표시하고 Part 상세에 머문다.

실제 구현은 선택한 Part 관계로 문제를 필터링한다. 뒤로가기는 선택했던 HOME의 Part 목록 문맥으로 복귀한다.

## 3. 텍스트 문제 답변

```text
PART_DETAIL
→ TEXT_QUESTION
→ 질문 중국어·병음·한국어 확인
→ PartGuide 구조 또는 AnswerPoint 확인
→ 내 답변 작성 선택
→ ANSWER_EDITOR
→ 한국어·중국어·혼합 원문 입력
→ 교정 모드 선택
→ 교정 요청
→ CORRECTION_RESULT
```

모범답안은 사용자가 명시적으로 비교를 선택할 때만 공개한다. 답변 작성에서 취소하면 입력 원문을 버릴지 확인한 뒤 원래 `TEXT_QUESTION` 문맥으로 돌아간다.

## 4. Part 2 그림 문제 답변

```text
PART_DETAIL
→ PART2_VISUAL
→ VisualSet 확인
→ VisualAsset 이미지 확인
→ VisualQuestion 1~4 중 현재 문항 확인
→ 질문 중국어·병음·한국어 확인
→ 답변 작성
→ ANSWER_EDITOR
→ CORRECTION_RESULT
→ 원본 추천 답변 또는 ModelAnswer 비교
```

규칙:

- 그림을 질문보다 먼저 표시한다.
- 문항 이동은 같은 `visual_set_id` 안의 `item_number`를 따른다.
- `VisualQuestion.question_id`가 비어 있어도 문제 표시와 답변 초안·교정은 가능하다.
- canonical Question 연결이 없으면 가짜 `question_id`를 만들지 않는다.
- 현재 v1에서 독립 VisualQuestion의 승인 UserAnswer를 저장할 수 없는 경우 저장 계약 보완이 필요하다고 표시한다.
- 원본 추천 답변이 검수 전이면 `원본 추천 답변 · 검수 필요`로 표시하고 승인 모범답안처럼 보이지 않게 한다.

뒤로가기는 현재 세트와 문항 번호를 보존한 Part 2 목록 문맥으로 돌아간다.

## 5. Part 7 스토리 답변

```text
PART_DETAIL
→ PART7_STORY
→ VisualSet 확인
→ VisualAsset 이미지 확인
→ 공통 지시문 확인
→ StoryGuide의 이야기 구성 도움 확인
→ 흐름·권장 연결어 확인
→ 이야기 답변 작성
→ ANSWER_EDITOR
→ CORRECTION_RESULT
→ ModelAnswer가 있으면 별도 비교
```

규칙:

- `QuestionVisualSet`의 연결 근거가 검증된 경우에만 Question과 VisualSet을 하나의 학습 문제로 이동시킨다.
- 같은 공통 지시문, 행 순서나 ID 접미사만으로 연결하지 않는다.
- `StoryGuide`는 `이야기 구성 도움` 또는 `구성 포인트`이며 모범답안 화면으로 이동시키지 않는다.
- StoryGuide나 ModelAnswer가 없어도 이야기 작성은 계속할 수 있다.
- 뒤로가기는 선택했던 `visual_set_id` 문맥을 보존한다.

## 6. 교정 후 저장

```text
ANSWER_EDITOR
→ AI 교정 중
→ CORRECTION_RESULT
→ 교정 중국어·병음·한국어 확인
→ 수정 전후·이유·관련성·불확실성 확인
├→ 다시 쓰기 → ANSWER_EDITOR
└→ 사용자 승인
   → UserAnswer 저장
   → 필요한 개인 Correction 저장
   → MY_ANSWERS
```

규칙:

- 사용자 승인 전에는 canonical `UserAnswer`를 만들지 않는다.
- 답변 대상이 현재 v1 `UserAnswer`로 저장 가능한지 먼저 확인한다. 독립 `VisualQuestion`처럼 저장 대상 계약이 없는 경우에는 저장 성공을 약속하지 않고 결과 유지·복사·다시 쓰기를 제공한다.
- 저장 성공 후에만 나의 답변 목록으로 이동한다.
- 저장 실패하면 교정 결과와 원문을 유지하고 다시 저장·내용 복사를 제공한다.
- Level 8 확장은 최소 교정 결과와 분리해 저장 문맥을 명확히 한다.
- 나의 답변에서 문제로 이동한 뒤 뒤로가면 Part 목록이 아니라 원래 `MY_ANSWERS` 문맥으로 돌아간다.

## 7. 복습

```text
복습 탭 또는 학습 화면의 복습 진입
→ REVIEW 큐
→ Question 또는 잘못된 표현 표시
→ 답변 숨김 상태에서 회상
→ 답변 보기
→ 공용 ModelAnswer·개인 UserAnswer 또는 올바른 Correction 확인
→ 못 외움 / 헷갈림 / 외움 선택
→ ReviewState 저장
→ 다음 항목 또는 복습 완료
```

규칙:

- `ReviewState`가 없으면 `상태 없음` 또는 `학습 전`이며 자동으로 `못 외움` 처리하지 않는다.
- 상태 저장이 실패하면 현재 항목에 머물고 성공한 것처럼 다음으로 이동하지 않는다.
- 병음과 한국어 표시를 조절할 수 있고 기본 복습에서는 병음을 숨길 수 있다.
- 구체적인 `내일`, `3일 뒤` 같은 복습 일정은 현재 계약으로 확정하지 않는다.
- 복습 대상이 없으면 완료 상태와 Part 학습 진입을 제공한다.

## 8. 실수 노트

```text
실수 노트 탭
→ MISTAKE_NOTE
→ 공용 오류 / 개인 오류 필터 선택
→ 잘못된 표현 먼저 확인
→ 올바른 표현 보기
→ 중국어·병음·한국어·오류 유형·수정 이유 확인
→ 출처 또는 연결 UserAnswer 확인
→ ReviewState 선택
→ 다음 오류 또는 목록
```

규칙:

- `Correction`의 공용·개인 범위와 출처를 텍스트로 구분한다.
- 개인 학습 상태는 Correction이 아니라 `ReviewState`에서 읽고 저장한다.
- 출처가 검수되지 않았으면 `출처 확인 필요`로 표시한다.
- 개인 오류에서 연결된 UserAnswer를 선택하면 `MY_ANSWERS` 또는 그 문제 문맥으로 이동할 수 있다.

## 9. 교정 실패

```text
ANSWER_EDITOR
→ 교정 요청
→ AI 교정 중
→ 교정 실패
├→ 다시 시도 → AI 교정 중
├→ 직접 수정 → ANSWER_EDITOR
└→ 저장하지 않고 돌아가기 → 원래 문제 화면
```

규칙:

- 중복 요청을 막는다.
- 실패 전 입력 원문, 선택 모드와 진입 문맥을 유지한다.
- 실패한 결과나 빈 결과를 UserAnswer로 저장하지 않는다.
- 네트워크 없음과 처리 실패를 가능한 범위에서 구분하되 오프라인 동작은 확정하지 않는다.

## 10. 모범답안이 없는 문제

```text
문제 화면
→ `아직 모범답안 없음`
→ AnswerPoint가 있으면 구조·힌트 확인
→ 내 답변 작성
→ 교정 결과 확인
→ 사용자 승인 후 UserAnswer 저장
```

후속 복습:

```text
UserAnswer 있음
→ 문제 회상
→ 나의 답변으로 복습

UserAnswer 없음
→ 문제만 보고 회상
→ 상태 선택 또는 답변 만들기
```

`ModelAnswer`가 없다는 이유로 오류 화면으로 이동하거나 빈 답변 레코드를 자동 생성하지 않는다. 사용자의 답변 작성, 교정과 복습을 계속 허용한다.

## 11. Part 4 전체 working 흐름

```text
HOME
├→ 마지막 문제 이어서 보기
├→ Part 4 50문제
└→ 랜덤 문제

Part 4 목록
→ 검색·유형·복습 상태·작성 상태 필터
→ 현재 결과 안에서 문제 선택 또는 랜덤
→ 문제 상세
├→ 이전·다음·랜덤
├→ PracticeDraft 저장·복원
└→ 지원되는 경우 mock 교정 → 승인된 UserAnswer

나의 답변
├→ 교정 완료
└→ 연습 초안

복습
→ 50문제 검색·유형·상태 필터
→ 답변 숨김·공개
→ 사용자 선택 후 ReviewState 저장
```

`PracticeDraft`와 `UserAnswer`는 같은 Question에 동시에 존재할 수 있다. 미지원 mock 결과도 초안으로 저장할 수 있지만 승인 답변으로 이동하지 않는다.

### Part 4 답변 만들기와 암기

```text
문제 상세에서 질문 이해 확인
→ 네 구간 키워드 설계
→ 구조별 문장 또는 전체 답변 작성
→ 사용자 명시적 초안·완료 저장
→ 전체/중국어/키워드/질문만 보기 암기
→ 답변 공개
→ 회상 결과 선택
→ RecallAttempt + 매핑된 ReviewState 저장
```

작성 내용과 연결어는 자동 생성하지 않는다. 기존 자유 입력 초안은 전체 답변으로 계속 편집할 수 있다.

## 12. 전체 텍스트 Part 학습 흐름

```text
HOME
├→ Part 1 (4)
├→ Part 3 (84)
├→ Part 4 (50)
├→ Part 5 (36)
├→ Part 6 (19)
└→ Part 2·7: 그림 문제 준비 중

텍스트 Part 목록
→ 검색·유형·복습 상태·작성 상태 필터
→ 문제 선택 또는 현재 결과 내 랜덤
→ 공통 문제 상세
├→ Part 4: 기존 질문 이해→설계→구조화 작성→암기
└→ Part 1·3·5·6: 자유 입력 PracticeDraft→완료→암기

암기
→ 저장한 내 답변만 사용
→ 전체/답변/질문 보기
→ 사용자 답변 공개
→ RecallAttempt + ReviewState
```

Part 4 키워드 모드는 planning_keywords가 있을 때만 사용한다. Part 2·7은
시각 자료 연결 전까지 라우팅하지 않으며, ModelAnswer가 없어도 개인 답변
작성과 질문 회상을 계속한다.

## 13. Part 4 로컬 데이터 검수

```text
개발 환경에서 /data-review/part4 직접 진입
→ 검수 현황·목록
→ Question 선택
→ 일곱 필드별 결정
→ 사용자 표시명·메모 입력
→ 명시적 저장
→ 다음 미검수

저장된 결정
├→ JSON 내보내기
├→ JSON 가져오기 미리보기 → 사용자 확인 → 적용
└→ stale 또는 승격 가능 현황 확인

내보낸 결정 파일
→ 별도 CLI 검증
→ 완전 승인·현재 해시 일치 항목만 reviewed JSON 생성
```

이 흐름은 일반 학습 하단 메뉴, PracticeDraft, UserAnswer, Correction, ReviewState와 분리한다. 화면 진입만으로 승인하지 않으며 reviewed 데이터는 아직 학습 앱 기본 source로 전환하지 않는다.

# 화면 데이터 계약

## 목적과 적용 범위

이 문서는 MVP 화면이 데이터 스키마 v1의 어떤 엔터티를 읽고, 어떤 개인 데이터를 생성·수정하는지 정의한다. 특정 API 응답, 데이터베이스 조회, 상태 관리 라이브러리 또는 URL 구조를 정하지 않는다.

화면 ID는 문서 식별자일 뿐 구현 라우트가 아니다. 모든 연결은 안정적인 엔터티 ID를 사용하며 `question_zh` 같은 표시 문장을 화면 식별자로 사용하지 않는다.

## 공통 계약 원칙

- 검수된 학습자 표시 데이터는 중국어 → 병음 → 한국어 순서로 제공한다.
- `Question`, `ModelAnswer`, `StoryGuide`, `Correction`과 개인 `ReviewState`의 상태 축을 서로 섞지 않는다.
- `review_needed` 또는 `unverified_source` 데이터를 표시할 때는 검수된 콘텐츠와 다른 텍스트 라벨을 붙인다.
- `ModelAnswer` 0개, `AnswerPoint` 0개, `StoryGuide` 0개는 모두 정상 상태다.
- `SourceReference.claimed_source_name`과 URL만으로 공식 출처를 확정하지 않는다.
- `source_locator`는 개발·검수용이며 학습자 화면 데이터에 포함하지 않는다.
- 저장 전 답변·교정 결과는 화면 세션 데이터이고, 사용자 승인 후에만 canonical 개인 데이터가 된다.
- `ReviewState`가 없으면 화면에서 `상태 없음` 또는 `학습 전`으로 계산하되 초기 레코드를 자동 생성하지 않는다.

## 1. 홈

| 항목 | 계약 |
|---|---|
| 화면 ID | `HOME` |
| 화면 목적 | 오늘 할 학습을 바로 시작하고 Part 1~7에 진입한다. |
| 읽는 엔터티 | `PartGuide`, `Question`, `ReviewState`, `UserAnswer` |
| 필수 데이터 | 제품에서 정의한 Part 1~7 번호와 표시명 |
| 선택 데이터 | 검수된 `PartGuide.goal`; Part별 문제 수; 선정 근거가 있는 오늘 복습 대상 집계; 신뢰할 수 있는 진행 문맥이 있을 때 마지막으로 학습한 Part·`question_id` |
| 사용자가 생성·수정하는 데이터 | 없음. 화면 내 펼침·표시 상태는 비영속 UI 상태다. |
| 빈 값 처리 | 오늘 복습 또는 이어서 학습 항목이 없으면 해당 빈 상태만 표시하고 Part 목록은 유지한다. |
| 검수 상태 처리 | 검수되지 않은 가이드 내용을 완성된 목표로 표시하지 않는다. 가이드가 없으면 `가이드 준비 중`으로 표시할 수 있다. |
| 주요 행동 | 오늘 복습 시작, 이어서 학습, Part 선택, 하단 탭 이동 |
| 다음 화면 | `REVIEW`, `PART_DETAIL`, 해당 문제 화면, `MY_ANSWERS`, `MISTAKE_NOTE` |

## 2. 파트 상세

| 항목 | 계약 |
|---|---|
| 화면 ID | `PART_DETAIL` |
| 화면 목적 | 선택한 Part의 학습 목표·구조·표현·실수와 문제 목록을 보여준다. |
| 읽는 엔터티 | `PartGuide`, `Question`, `AnswerPoint`, `Correction`, `SourceReference`, Part 2·7의 `VisualSet`, `VisualSetAsset`, `VisualAsset`, Part 7의 `QuestionVisualSet`, `StoryGuide` |
| 필수 데이터 | 선택한 `part` 값 1~7 |
| 선택 데이터 | `PartGuide.goal`, `preparation_tips`, `response_structure`, `key_expressions`, 대표 Question, 공용 Correction, 시각 학습 세트 |
| 사용자가 생성·수정하는 데이터 | 없음. 필터와 섹션 펼침은 비영속 UI 상태다. |
| 빈 값 처리 | 문제가 없으면 `아직 등록된 문제가 없습니다`. 필수 표현·자주 하는 실수가 없으면 섹션을 숨긴다. |
| 검수 상태 처리 | `PartGuide.guide_status`, Question과 공용 Correction 상태를 확인한다. 시각 목록은 `VisualSet.set_status`, `VisualSetAsset.mapping_status`, `VisualAsset.asset_status`·`rights_status`와 Part 7의 `QuestionVisualSet.mapping_status`를 함께 확인한다. 검수 중인 항목은 확정 학습 콘텐츠처럼 보이지 않게 라벨 또는 비표시 처리한다. |
| 주요 행동 | 문제 선택, Part 2 시각 세트 선택, Part 7 스토리 맥락 선택, 복습 진입 |
| 다음 화면 | `TEXT_QUESTION`, `PART2_VISUAL`, `PART7_STORY`, `REVIEW` |

문제 목록은 선택한 `part` 또는 검증된 Part 관계로 필터링한다.

## 3. 일반 텍스트 문제

| 항목 | 계약 |
|---|---|
| 화면 ID | `TEXT_QUESTION` |
| 화면 목적 | Part 1·3·4·5·6의 문제를 이해하고 자신의 답변 작성으로 이어간다. |
| 읽는 엔터티 | `Question`, `AnswerPoint`, `ModelAnswer`, `PartGuide`, `SourceReference`, `UserAnswer`, `ReviewState` |
| 필수 데이터 | `question_id`, `part`, `question_zh`; 학습자 표시 상태에서는 `question_pinyin`, `question_ko` |
| 선택 데이터 | `question_type`, 순서가 있는 `AnswerPoint`, 해당 Part 구조, 0..N `ModelAnswer`, 기존 `UserAnswer`, `ReviewState`, 출처·검수 라벨 |
| 사용자가 생성·수정하는 데이터 | 답변 영역 펼침 같은 UI 상태만 변경한다. canonical 개인 데이터는 아직 만들지 않는다. |
| 빈 값 처리 | `AnswerPoint`가 없으면 구조 영역 생략. `ModelAnswer`가 없으면 `아직 모범답안 없음`. `UserAnswer`가 없으면 `내 답변 만들기` CTA. |
| 검수 상태 처리 | 승인된 기본 답변, 출처 답변과 검수 필요 답변을 구분한다. 여러 답변을 문장 일치만으로 하나로 합치지 않는다. |
| 주요 행동 | 답변 작성, 기존 나의 답변 보기, 모범답안 명시적 공개, 문제 복습 |
| 다음 화면 | `ANSWER_EDITOR`, `REVIEW`, 이전 `PART_DETAIL` |

`ModelAnswer`는 사용자의 답변 작성 전에 자동으로 펼치지 않는다.

## 4. Part 2 그림 문제

| 항목 | 계약 |
|---|---|
| 화면 ID | `PART2_VISUAL` |
| 화면 목적 | 그림을 먼저 관찰하고 한 세트의 하위 질문 1~4에 답한다. |
| 읽는 엔터티 | `VisualSet`, `VisualSetAsset`, 관련 `VisualAsset`, `VisualQuestion`, 선택적으로 `Question`, `QuestionVisualSet`, `ModelAnswer`, `SourceReference`, `UserAnswer`, `ReviewState` |
| 필수 데이터 | `visual_set_id`, Part 2 `set_type`, `VisualSet.set_status`; 표시 가능한 이미지와 `VisualSetAsset.sequence`·`mapping_status`, `VisualAsset.asset_status`·`rights_status`; 순서가 있는 `VisualQuestion`의 `visual_question_id`, `item_number`, `visual_question_status`, 질문 중국어; 학습자 표시 시 질문 병음·한국어 |
| 선택 데이터 | 명확히 연결된 `question_id`, 질문별 원본 추천 답변 또는 `ModelAnswer`, 출처·권리·검수 라벨 |
| 사용자가 생성·수정하는 데이터 | 현재 문항 번호와 답변 초안. 교정 결과 승인 시 저장 가능한 대상이면 `UserAnswer`를 생성한다. |
| 빈 값 처리 | `VisualQuestion.question_id`가 없어도 질문을 표시한다. 답변이 없으면 답변 영역만 `아직 추천 답변 없음`으로 표시한다. |
| 검수 상태 처리 | 세트·이미지·질문 상태와 `VisualSetAsset.mapping_status`를 함께 확인하며 검수되지 않은 연결을 확정 세트로 표시하지 않는다. `answer_status = review_needed`, `provenance_kind = unverified_source`이면 `원본 추천 답변 · 검수 필요`. 이미지 권리 상태가 허용되지 않으면 공개 화면에서 대체 상태를 사용한다. |
| 주요 행동 | 문항 1~4 이동, 답변 작성, 추천 답변 공개, 이전·다음 세트 이동 |
| 다음 화면 | `ANSWER_EDITOR`, 같은 `PART2_VISUAL`, 이전 `PART_DETAIL` |

계약 주의:

- canonical Question 연결은 명시적 ID 또는 단일 완전 일치 근거가 있을 때만 사용한다.
- 독립 `VisualQuestion`도 작성·회상 세션의 유효한 대상이다.
- `PracticeDraft`, `ReviewState`, `RecallAttempt`는
  `target_type = visual_question`과 `visual_question_id`를 직접 사용한다.
- 현재 `UserAnswer`는 `question_id`를 필수로 하므로 Part 2에서 만들지
  않는다. 교정 공급자나 승인 답변 대상을 표현하기 위해 임의 Question
  연결로 우회하지 않는다.

## 5. Part 7 스토리 문제

| 항목 | 계약 |
|---|---|
| 화면 ID | `PART7_STORY` |
| 화면 목적 | 그림과 구성 도움을 이용해 하나의 이야기를 작성한다. |
| 읽는 엔터티 | `Question`, `QuestionVisualSet`, `VisualSet`, `VisualSetAsset`, 관련 `VisualAsset`, `StoryGuide`, `AnswerPoint`, `ModelAnswer`, `SourceReference`, `UserAnswer`, `ReviewState` |
| 필수 데이터 | 확정 학습 화면에서는 안정적인 `question_id`·`visual_set_id`, `question_visual_set_id`, `QuestionVisualSet.mapping_status = verified`; 공통 지시문의 중국어·병음·한국어; 표시 가능한 이미지와 `VisualSetAsset.sequence`·`mapping_status = verified`, `VisualAsset.asset_status`·`rights_status`. `StoryGuide`가 존재하면 `story_guide_id`, `visual_set_id`, `recommended_flow`, `guide_status`도 필수 |
| 선택 데이터 | 0..N `StoryGuide`; 존재하는 가이드의 `situation_ko`, `recommended_connectors_zh`; `AnswerPoint`, 0..N `ModelAnswer`, 기존 `UserAnswer` |
| 사용자가 생성·수정하는 데이터 | 이야기 답변 초안. 승인 시 해당 Question을 대상으로 `UserAnswer`를 생성한다. |
| 빈 값 처리 | `StoryGuide`가 없으면 그림과 문제만 표시하고 작성 가능. `ModelAnswer`가 없으면 별도 비교 영역을 생략한다. |
| 검수 상태 처리 | `StoryGuide`는 `이야기 구성 도움` 또는 `구성 포인트`로 표시한다. 검증되지 않은 `QuestionVisualSet`을 학습자 연결로 확정하지 않는다. |
| 주요 행동 | 구성 도움 확인, 이야기 작성, 교정, 존재할 때 모범답안 비교 |
| 다음 화면 | `ANSWER_EDITOR`, 이전 `PART_DETAIL` |

검증된 `QuestionVisualSet`이 없으면 Question과 그림을 강제로 합치지 않는다. 명시적으로 연결된 `VisualSet`과 `StoryGuide`는 `연결 검수 중인 시각 연습`으로 각각 볼 수 있지만, 공통 지시문을 결합하거나 하나의 확정 학습 문제처럼 표시하지 않는다. 이 상태의 답변 작성·교정 진입과 승인 저장은 대상 계약이 보완될 때까지 제한 또는 보류한다.

## 6. 답변 작성

| 항목 | 계약 |
|---|---|
| 화면 ID | `ANSWER_EDITOR` |
| 화면 목적 | 한국어·중국어·혼합 원문을 입력하고 교정 모드를 선택한다. |
| 읽는 엔터티 | `Question` 또는 `VisualQuestion`, `PartGuide`, `AnswerPoint`, Part 7의 `StoryGuide`, 기존 `UserAnswer` |
| 필수 데이터 | 안정적인 답변 대상 ID, Part, 질문 또는 상황. 교정 요청 시에는 사용자가 입력한 `original_input`과 선택한 `correction_mode`도 필수 |
| 선택 데이터 | Part 구조, AnswerPoint, StoryGuide, 편집할 기존 UserAnswer, 원래 진입 화면 문맥 |
| 사용자가 생성·수정하는 데이터 | 비영속 답변 초안, 입력 언어 판단 대상 원문, `minimal`·`natural`·`level_8_expansion` 모드 선택 |
| 빈 값 처리 | 원문이 비어 있으면 교정 요청을 차단하고 입력 안내를 제공한다. 구조·가이드가 없어도 입력은 가능하다. |
| 검수 상태 처리 | 화면에 참고로 표시하는 가이드·힌트의 상태를 숨기지 않는다. 확인되지 않은 내용을 교정 지침으로 확정하지 않는다. |
| 주요 행동 | 교정 요청, 직접 수정, 취소·원래 문제로 복귀 |
| 다음 화면 | `CORRECTION_RESULT`, 원래 문제 화면 |

저장 전 초안은 canonical `UserAnswer`가 아니다. 답변 대상이 독립 `VisualQuestion`이면 현재 v1 저장 한계를 호출 계약에서 명시해야 한다.

## 7. 교정 결과

| 항목 | 계약 |
|---|---|
| 화면 ID | `CORRECTION_RESULT` |
| 화면 목적 | 교정 후보를 검토하고 승인 저장 또는 다시 쓰기를 선택한다. |
| 읽는 엔터티 | 질문 맥락의 `Question`·`VisualQuestion`, `PartGuide`; 비교가 허용된 경우 `ModelAnswer` |
| 필수 데이터 | 세션 원문, 선택 모드, 교정된 중국어·전체 병음·한국어, 수정 개수, 수정 전후 목록과 이유 |
| 선택 데이터 | 구조 구간, 질문 관련성 문제, 불확실성, 수정 없음 안내, `ModelAnswer` 비교 |
| 사용자가 생성·수정하는 데이터 | 지원되는 canonical 답변 대상일 때 승인 시 `UserAnswer`; 필요한 경우 해당 UserAnswer에 연결되는 개인 `Correction`. 저장 전에는 세션 후보만 존재한다. |
| 빈 값 처리 | 수정 항목이 0개면 `수정 없음`을 표시한다. `ModelAnswer`가 없으면 비교 영역을 생략한다. |
| 검수 상태 처리 | 불확실성과 질문 관련성 문제를 숨기지 않는다. Level 8 결과를 최소 교정 결과와 합치지 않는다. |
| 주요 행동 | 저장 가능한 대상이면 나의 답변으로 저장, 다시 쓰기, 결과 복사, 저장 재시도 |
| 다음 화면 | 저장 성공 시 `MY_ANSWERS`; 다시 쓰기 시 `ANSWER_EDITOR`; 저장 대상이 지원되지 않으면 결과를 유지한 원래 문제 화면 |

전체 교정 결과는 schema v1의 `Correction` 엔터티가 아니다. `Correction`은 수정 전후의 개별 오류 콘텐츠이며, 저장 가능한 대상에서 승인된 결과 전체는 `UserAnswer`가 담당한다. 독립 `VisualQuestion`처럼 v1 `UserAnswer.question_id`로 표현할 수 없는 대상에는 저장 버튼을 성공 가능한 행동처럼 제공하지 않는다.

## 8. 나의 답변

| 항목 | 계약 |
|---|---|
| 화면 ID | `MY_ANSWERS` |
| 화면 목적 | 사용자가 승인해 저장한 답변을 Part와 문제 맥락별로 조회한다. |
| 읽는 엔터티 | `PracticeDraft`, `UserAnswer`, 연결된 `Question`, `ReviewState`, 선택적으로 개인 `Correction` |
| 필수 데이터 | 교정 완료: `user_answer_id`, `question_id`, 중국어·병음·한국어, `save_status = user_approved`; 초안: `practice_draft_id`, `question_id`, `original_input`, `input_language`, 수정 시각 |
| 선택 데이터 | 주제, 교정 모드, 구조 구간, 학습 상태, 개인 오류 수 |
| 사용자가 생성·수정하는 데이터 | 연습 초안 upsert·삭제, 답변 수정 후 재승인·삭제, 다시 교정 |
| 빈 값 처리 | 교정 완료와 연습 초안의 빈 상태를 따로 표시하고 Part 4 학습 진입을 제공한다. |
| 검수 상태 처리 | 개인 답변과 공용 ModelAnswer를 같은 종류로 표시하지 않는다. 학습 상태는 `ReviewState`에서만 읽는다. |
| 주요 행동 | 연결 문제로 이동, 수정, 다시 교정, 삭제 또는 보관, 복습 시작 |
| 다음 화면 | 연결된 문제 화면, `ANSWER_EDITOR`, `REVIEW` |

`마지막 수정일`은 화면 요구사항이지만 schema v1에는 `created_at`만 있다. 실제 구현 전에 수정 시각 계약을 보완하며 생성일을 수정일로 잘못 표시하지 않는다.

## 9. 복습

| 항목 | 계약 |
|---|---|
| 화면 ID | `REVIEW` |
| 화면 목적 | 문제·개인 답변·공용 또는 개인 오류를 답변 없이 먼저 회상하고 상태를 기록한다. |
| 읽는 엔터티 | `Question`, `ModelAnswer`, `UserAnswer`, `Correction`, `ReviewState`, 필요한 `SourceReference` |
| 필수 데이터 | `target_type`, `target_id`, 회상용 문제 또는 잘못된 표현, 현재 큐 위치 |
| 선택 데이터 | 숨겨진 ModelAnswer, UserAnswer, Correction 정답, 기존 ReviewState, 병음·한국어 표시 설정 |
| 사용자가 생성·수정하는 데이터 | 대상별 `ReviewState.learning_status`, `last_reviewed_at`, `review_count` |
| 빈 값 처리 | `ReviewState`가 없으면 학습 전. ModelAnswer·UserAnswer가 모두 없어도 Question 회상은 가능. 큐가 비면 복습 완료 상태. |
| 검수 상태 처리 | 공용 답변·오류의 검수 상태와 개인 답변을 구분한다. 검수되지 않은 출처를 정답 근거로 강조하지 않는다. |
| 주요 행동 | 답변 보기, 병음·한국어 표시 조절, 못 외움·헷갈림·외움 선택, 다음 항목 |
| 다음 화면 | 같은 `REVIEW`의 다음 항목, 복습 완료, 원래 상세 화면 |

상태 저장이 성공하기 전에는 다음 항목으로 이동하지 않는다. 구체적인 재등장 날짜는 계약에 포함하지 않는다.

## 10. 실수 노트

| 항목 | 계약 |
|---|---|
| 화면 ID | `MISTAKE_NOTE` |
| 화면 목적 | 공용 오류와 개인 오류를 구분해 조회하고 회상한다. |
| 읽는 엔터티 | `Correction`, `SourceReference`, 개인 오류의 `UserAnswer`, `ReviewState` |
| 필수 데이터 | `correction_id`, `wrong_zh`, `correct_zh`, `error_type`, `reason`, `source_kind`, `data_scope`, `correction_status`; 학습자 표시 시 `correct_pinyin`, `correct_ko` |
| 선택 데이터 | 확인된 출처 요약, 연결 UserAnswer, 개인 ReviewState, 제공 가능한 발생 집계 |
| 사용자가 생성·수정하는 데이터 | Correction 대상 `ReviewState`; 필터와 답변 공개는 UI 상태다. |
| 빈 값 처리 | 전체가 비면 `저장된 실수가 없습니다`. 필터 결과가 없으면 필터 해제 행동을 제공한다. |
| 검수 상태 처리 | `shared`와 `personal`을 텍스트로 구분한다. 공용 Correction의 `correction_status`가 `reviewed`가 아니거나 출처가 미검수면 `검수 필요` 또는 `출처 확인 필요`로 표시하고 확정된 강사 표현처럼 표시하지 않는다. |
| 주요 행동 | 공용·개인 필터, 올바른 표현 보기, 학습 상태 선택, 연결 UserAnswer로 이동 |
| 다음 화면 | 같은 `MISTAKE_NOTE`, `REVIEW`, 연결된 `MY_ANSWERS` 또는 문제 화면 |

반복 횟수와 최근 발생 정보는 schema v1의 `Correction` 필드가 아니다. 신뢰할 수 있는 별도 이력이나 집계가 있을 때만 표시하고 임의 계산하지 않는다.

## 사용자 생성·수정 데이터 요약

| 사용자 행동 | canonical 데이터 영향 |
|---|---|
| 답변 입력 | 저장 전에는 화면 세션 상태만 변경 |
| 연습 초안 저장 | 질문별 활성 `PracticeDraft` 생성 또는 갱신. `UserAnswer`와 `Correction`은 만들지 않음 |
| 교정 모드 선택 | 세션 상태 변경; 기존 UserAnswer를 자동 변경하지 않음 |
| 교정 결과 승인 | 지원되는 canonical 답변 대상에서만 `UserAnswer` 생성 또는 명시적 수정 |
| 개별 오류 승인·저장 | 개인 `Correction` 생성 가능 |
| 복습 상태 선택 | 해당 대상의 `ReviewState` 생성 또는 갱신 |
| 답변 삭제·보관 | 물리·소프트 삭제 방식 결정 전까지 요청 의미만 정의 |
| 병음 표시·숨김 | 표시 설정만 변경; 공용 언어 데이터를 수정하지 않음 |
| 구조화 초안 저장 | `PracticeDraft`의 선택적 키워드·네 답변 구간·전체 원문을 저장. 기존 자유 입력과 호환 |
| 재사용 표현 저장 | 사용자가 명시적으로 선택한 원문 전체만 개인 `ReusablePhrase`로 저장 |
| 회상 결과 선택 | `RecallAttempt`를 추가하고 정해진 매핑으로 Question `ReviewState`를 갱신 |

## 전체 텍스트 Part 공통 화면 계약

| 항목 | 계약 |
|---|---|
| 화면 ID | `TEXT_PART_LIST`, `TEXT_QUESTION`, `FREE_ANSWER_EDITOR`, `TEXT_RECALL` |
| 화면 목적 | Part 1·3·4·5·6의 193개 working 문제를 찾고, 사용자가 자신의 답변을 저장·회상한다. |
| 읽는 엔터티 | `Question`, `AnswerPoint`, `PartGuide`, `LearningExpression`, `PracticeDrill`, `CourseInsight`, 개인 `PracticeDraft`, `ReusablePhrase`, `RecallAttempt`, `ReviewState`, 선택적 `UserAnswer` |
| 필수 데이터 | 안정적인 `question_id`, Part, 중국어 질문. 원문에 있는 병음·한국어·AnswerPoint는 생성하지 않고 그대로 사용 |
| 선택 데이터 | 출처가 분리된 workbook/course 가이드와 Part 공통 표현·드릴·인사이트 |
| 사용자가 생성·수정하는 데이터 | 자유 입력 또는 Part 4 구조화 `PracticeDraft`, 명시적으로 저장한 `ReusablePhrase`, 회상 후 `RecallAttempt`·`ReviewState` |
| 빈 값 처리 | ModelAnswer 0개는 정상이며 `답변 예시는 아직 없음`을 표시한다. 표현·가이드가 없으면 섹션을 숨긴다. |
| 검수 상태 처리 | 193개 모두 `검수 전 문제`로 표시하며 course level_3 자료를 고득점 공식 기준으로 표시하지 않는다. |
| 주요 행동 | 파트·검색·상태 필터, 문제 이동, 초안 저장·완료·삭제, 내 답변 암기, 명시적 상태 저장 |
| 다음 화면 | 같은 Part 목록, 문제 상세, 답변 작성·암기, 나의 답변, 복습 |

Part 4는 네 구간 전용 편집기를 유지한다. Part 1·3·5·6은 자유 입력이며
PartGuide 문구를 자동 폼이나 답변으로 변환하지 않는다.

## 11. Part 2 로컬 시각 학습

| 항목 | 계약 |
|---|---|
| 화면 ID | `PART2_SET_LIST`, `PART2_SET`, `VISUAL_QUESTION`, `VISUAL_ANSWER_EDITOR`, `VISUAL_RECALL` |
| 화면 목적 | 로컬 권리 경계 안에서 12세트·48 VisualQuestion을 보고 내 짧은 답변을 저장·회상한다. |
| 읽는 엔터티 | `VisualSet`, `VisualSetAsset`, `VisualAsset`, `VisualQuestion`, `ModelAnswer`, `SourceReference`, 개인 `PracticeDraft`, `RecallAttempt`, `ReviewState`, `ReusablePhrase` |
| 필수 데이터 | 등록된 set/asset/question ID와 관계, 이미지 메타데이터, 순서, 질문 중국어, 권리·검수 상태 |
| 선택 데이터 | 질문 병음·한국어, canonical `question_id`, 접힌 출처 ModelAnswer, Part 공통 강의 자료 |
| 사용자가 생성·수정하는 데이터 | `visual_question` 대상 PracticeDraft·RecallAttempt·ReviewState, 명시적으로 저장한 ReusablePhrase |
| 빈 값 처리 | 로컬 이미지가 없으면 추출 명령 안내. 언어가 비면 생성하지 않는다. 출처 답변이 없어도 초안·회상 가능 |
| 검수 상태 처리 | 그림은 로컬 전용·권리 검수 필요, 답변은 원본 자료의 검수 전 추천 답변이며 공식 정답이 아님 |
| 주요 행동 | 세트 필터·랜덤, 이미지 확대, 질문 이동, 자유 입력 저장·완료, 추천 답변 비교, 내 답변 회상 |
| 다음 화면 | 홈, 세트 목록·상세, VisualQuestion 상세·답변·회상, 나의 답변, 복습 |

Part 2 이미지는 fixture에 등록된 ID만 개발 서버에서 제공한다. production
build는 이미지 바이트를 포함하지 않으며 화면도 로컬 학습을 활성화하지
않는다. ModelAnswer는 내 답변을 덮어쓰거나 UserAnswer로 자동 저장하지
않는다.

## 12. Part 4 로컬 데이터 검수

| 항목 | 계약 |
|---|---|
| 화면 ID | `PART4_DATA_REVIEW` |
| 화면 목적 | Part 4 working Question을 수정하지 않고 필드별 사람 결정을 기록하고 reviewed 승격 가능성을 확인한다. |
| 읽는 엔터티 | `Question`, `AnswerPoint`, `Source`, `SourceReference`, working review queue, `Part4ReviewDecision` |
| 필수 데이터 | `part4-review-fixture-v1`의 Question 50개, Question당 AnswerPoint 하나, 일곱 필수 검수 필드, Question·AnswerPoint SHA-256 |
| 선택 데이터 | 관련 review queue 요약, claimed source URL·등급·원문성, 기존 결정 |
| 사용자가 생성·수정하는 데이터 | 별도 검수 IndexedDB의 `Part4ReviewDecision`; 원문 콘텐츠는 수정하지 않음 |
| 빈 값 처리 | 결정이 없으면 미검수다. 빈 claimed source URL은 그대로 표시하며 자동 오류나 승인으로 처리하지 않는다. |
| 검수 상태 처리 | 전체 승인은 모든 필드 승인과 최신 해시가 필요하다. 해시 불일치는 stale이며 승격 가능 수에서 제외한다. |
| 주요 행동 | 검색·필터, 필드별 결정, 전체 결정, 메모 저장, 다음 미검수, JSON 내보내기·가져오기, 확인 후 초기화 |
| 다음 화면 | 같은 `PART4_DATA_REVIEW`; reviewed 생성은 화면이 아니라 별도 CLI |

이 화면은 개발 환경 전용이며 네 개 하단 학습 메뉴와 학습 개인 데이터 저장소에 포함되지 않는다. 출처 주장 승인도 외부 출처의 공식성 검증을 뜻하지 않는다.

## 구현 전 해결해야 할 계약 공백

다음은 이 작업에서 스키마나 기술을 임의로 바꾸지 않고 명시만 한다.

1. canonical `Question`과 연결되지 않은 `VisualQuestion`의 향후 교정 완료 `UserAnswer` 저장 대상
3. Part 7 UserAnswer에 `visual_set_id` 학습 맥락을 보존하는 방식
4. UserAnswer의 장기 버전 이력과 소프트 삭제·보관 정책
5. 개인 Correction의 반복 발생 이력과 최근 발생 시각
6. 여러 `basic` ModelAnswer 중 기본 비교 답변을 선택하는 검수 규칙
7. 이미지 `rights_status`별 공개·개인 환경 표시 정책
8. AI 교정 요청·응답과 실패의 실제 API 계약
9. `오늘 복습` 대상을 선정하는 일정·우선순위 규칙과 이를 표현할 데이터
10. 마지막 학습 위치를 여러 Part·기기에서 동기화할 장기 계약
11. 현재 구현의 대상별 단일 `ReviewState`를 이력형 복습 데이터로 확장할지 여부

이 공백은 프론트엔드 기술, 데이터베이스 또는 API 제공자를 선택한 것으로 해소하지 않는다. 제품·데이터 계약을 먼저 결정해야 한다.

# TSC Study

TSC 중국어 말하기 시험에서 실수를 줄이고, 파트별 답변 구조와 필수 표현을 반복 학습하기 위한 개인 학습 사이트 프로젝트다.

## 대상 사용자

- 현재 TSC Level 5에서 Level 8을 목표로 하는 학습자
- 중국 거주 경험과 HSK 5급 240점 수준의 중국어 기반이 있는 학습자
- 기초 중국어를 새로 배우기보다 시험 답변의 정확성, 구조, 재사용 가능한 표현 암기가 중요한 학습자

## 제품 우선순위

새로운 고급 표현을 많이 제시하는 것보다 다음을 우선한다.

1. 문법, 어순, 단어 선택, 내용 연결 실수 줄이기
2. Part 1~7의 답변 구조 익히기
3. 자주 쓰는 필수 표현과 자신의 답변 암기하기
4. 반복되는 개인 오류를 모아 복습하기

## MVP 기능

- **파트별 학습:** 파트 목표, 준비 요령, 답변 구조, 필수 표현, 대표 문제, 기본 모범답안, 자주 하는 실수
- **나의 답변 만들기:** 한국어·중국어·혼합 입력을 의미와 경험을 유지한 중국어 답변으로 정리
- **문제 복습:** 답변을 숨긴 문제 풀이와 개인 `ReviewState`의 `못 외움`·`헷갈림`·`외움` 상태 관리
- **실수 노트:** 강의의 대표 오류와 사용자 개인 오류를 분리해 저장하고 복습

녹음, 음성 인식, 음성 평가, 질문 음성 재생은 현재 MVP와 로드맵의 우선 기능에서 제외한다.

## 현재 단계

**Phase 0: 프로젝트 지침과 문서**는 완료했고, **Phase 1: 원본 자료 적재 및 대표 표본 검수**가 진행 중이다.

첫 원본 Excel을 원래 내용과 파일명 그대로 `data/raw`에 적재하고 시트 구조와 두 차례 대표 표본을 검증했다. 그 결과를 바탕으로 구현 기술 독립적인 데이터 스키마 v1.1과 검수 전 `course-import-v1` working 데이터를 추가했다. 이어 [전체 workbook working 반입](docs/FULL_WORKBOOK_IMPORT_REPORT.md)으로 Question·AnswerPoint 253개, 전체 시각 자료 메타데이터, Part 2 출처 추천 답변 48개와 Part 7 StoryGuide 12개를 구조화하고, [강의 콘텐츠 연결 후보](docs/COURSE_QUESTION_LINK_REPORT.md)를 엄격한 근거만으로 생성했다. 참고 목업 기준의 [모바일 UI 명세](docs/UI_SPEC.md), [화면 데이터 계약](docs/SCREEN_DATA_CONTRACT.md), [화면 이동 흐름](docs/NAVIGATION_FLOW.md)도 완료했다.

[MVP 구현 기준](docs/IMPLEMENTATION_BASELINE.md)에 따라 React + TypeScript + Vite 프로젝트를 초기화했다. 현재 앱은 [전체 텍스트 파트 fixture](docs/TEXT_PARTS_APP_SLICE.md)를 읽어 Part 1·3·4·5·6의 raw working Question 193개와 AnswerPoint 193개를 제공한다. 공통 목록·검색·유형 및 상태 필터·랜덤 문제, 자유 입력 PracticeDraft, 복습·회상과 마지막 학습 위치 흐름을 구현했다. Part 4의 네 구간 답변 만들기와 P4-006 deterministic mock 교정·승인 저장도 그대로 유지한다. 개인 `PracticeDraft`·`ReusablePhrase`·`RecallAttempt`·`UserAnswer`·개인 `Correction`·`ReviewState`는 현재 브라우저 origin의 IndexedDB에 분리해 저장한다.

[Part 2 로컬 시각 학습 slice](docs/PART2_VISUAL_APP_SLICE.md)는
VisualSet 12개·VisualQuestion 48개와 원본의 검수 전 추천 답변 48개를
개발 환경에 연결한다. [시각 문제 전수검사](docs/PART2_VISUAL_QUESTION_AUDIT.md)로
질문·답과 그림을 대조하고 12장을 1448×1086로 통일했다. 이미지 12개는
working 앱 자산으로 Git에 보존한다. 기본 production build에는 포함하지
않으며, 운영자가 명시적으로
opt-in한 build에서만 검증된 60개 이미지 묶음의 일부로 제공한다. Part 2의
PracticeDraft·RecallAttempt·ReviewState는 `visual_question`을 대상으로
저장하고 원본 추천 답변을 내 답변이나 공식 정답으로 자동 저장하지 않는다.

[Part 7 스토리 그림 로컬 학습 slice](docs/PART7_STORY_VISUAL_APP_SLICE.md)는
VisualSet·StoryGuide 각 12개와 세트별 순서가 명시된 이미지 4장씩,
VisualAsset·VisualSetAsset 각 48개를 개발 환경에 연결한다. 확정
QuestionVisualSet은 0개이며 번호 기반 후보 12개를 실제
관계로 승격하지 않는다. StoryGuide는 완성 답변이 아닌 참고 흐름이고,
사용자는 `visual_set` 대상 PracticeDraft에 키워드·순서 포인트·전체 답변을
직접 저장해 그림 기반 회상을 연습한다. Part 7 이미지 바이트는 Git의
working 자산으로 보존한다. 기본 production build에서는 제외하고 명시적
deployment opt-in 때만 검증 후 포함한다.
[Part 7 이미지-스토리 전수검사](docs/PART7_STORY_VISUAL_AUDIT.md)는 12세트
48장을 모두 확인하고, 사건·인물 연속성이 부족한 7장만 보강했다.

Part 4 50문제를 사람이 필드별로 확인할 수 있는 [로컬 검수 워크플로](docs/PART4_REVIEW_WORKFLOW.md)도 구현했다. 검수 결정은 별도 IndexedDB에 저장하고 JSON으로 내보내거나 가져올 수 있으며, CLI는 사용자가 완전히 승인하고 현재 원문 해시와 일치하는 항목만 reviewed JSON으로 승격한다. 실제 사람 검수·결정 파일·reviewed 데이터는 아직 없고 학습 앱은 계속 working fixture를 사용한다.

Part 4 학습은 [답변 만들기·회상 흐름](docs/PART4_ANSWER_BUILD_AND_RECALL_UX.md)을 제공한다. 질문을 이해한 뒤 네 구간의 키워드와 문장을 직접 작성하고, 저장 답변을 전체·중국어·키워드·질문만 보기로 암기한다. 앱은 답변이나 병음을 생성하지 않으며 상세 회상 결과만 개인 IndexedDB에 기록한다.

전체 253개 문제와 시각 자료는 `data/working/full-import-v1/`에 원문 그대로 구조 반입했지만, 정규화·사람 검수·`reviewed` 승격과 앱 연결은 하지 않았다. 실제 AI 공급자·모델, 백엔드 기술, 인증, 서버 동기화, 배포, 이미지 공개 가능 여부와 병음 생성·검수 방식도 계속 미결정이다.

강의 working import는 저장소에 실제 존재하는 분석·학습·문서 추출 Markdown만 Source로 사용한다. 분석이 주장하지만 저장소에 없는 원본 MP4·PDF·DOCX를 확인된 Source로 등록하지 않으며, 모든 콘텐츠는 `review_needed` 이하 상태다. 자세한 공백과 후속 순서는 [Level 8 공백 분석](docs/LEVEL8_GAP_ANALYSIS.md)과 [고득점 목표 데이터 계획](docs/HIGH_SCORE_DATA_PLAN.md)을 따른다.

이 저장소는 완성된 문제와 답변만 보관하는 곳이 아니다. 원본 문제를 검수하고, 답변이 없는 예상 문제의 모범답안을 점진적으로 작성하는 작업 공간이다. 답변이 없는 상태는 정상이다.

## 로컬 앱 실행

Node.js와 npm이 준비된 환경에서 다음 명령을 사용한다.

```sh
npm install
npm run assets:visual-local
npm run fixture:part2-visual
npm run fixture:part7-visual
npm run fixture:text-parts
npm run fixture:part4-full
npm run fixture:part4-review
npm run dev
```

텍스트 앱 fixture는 `data/working/app-fixtures/text-parts-v1/`, Part 2
시각 fixture는 `data/working/app-fixtures/part2-visual-v1/`, Part 7
스토리 fixture는 `data/working/app-fixtures/part7-visual-v1/`에 생성된다.
모두 검수 완료 또는 배포용 데이터가 아니다. 현재 audited 이름 지정 archive의
바이트를 검증한 이미지 60장은
`data/working/app-assets/tsc-individual-images-v1/`에 있다.
이 working 자산은 Git에 보존하지만 공개 권리는 `review_needed`이고
`public_allowed = false`다. 기본 production build에는 포함하지 않는다.
운영자가 다음처럼 정확한 환경변수를 설정한 build에만 Part 2 12장과
Part 7 48장, 총 60장을 포함한다.

```sh
VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS=true npm run build
```

이 opt-in은 해당 deployment에서 자산 사용을 선택하는 동작일 뿐 이미지
권리가 공개 사용 가능하다고 승인하거나 metadata를 변경하지 않는다. build는
등록된 asset ID·허용 경로·PNG MIME·파일 크기·SHA-256·가로세로 크기를
검증하고 하나라도 다르면 실패한다. flag가 없거나 `true`가 아닌 값이면
기본 제외 정책이 유지된다. Vite `BASE_URL`을 사용하므로 sub-path
deployment에서도 emitted URL을 조합한다. 기존 workbook 생성 이미지는 별도
`data/working/generated-assets/full-import-v1/` 경계에 유지한다. 기존 6문제
및 Part 4 50문제 fixture도 계속 보존하며
원본 working 데이터·CSV·Excel은 수정하지 않는다.

주요 검증 명령은 다음과 같다.

```sh
npm run validate:fixtures
npm run validate:named-visual-assets
npm run test:named-visual-assets
npm run validate:part2-visual
npm run test:part2-visual
npm run validate:part7-visual
npm run test:part7-visual
npm run validate:text-parts
npm run test:text-parts
npm run validate:part4-full
npm run test:part4-full
npm run validate:part4-review
npm run test:part4-review
npm run test:part4-promotion
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run validate:part2-assets
npm run validate:part7-assets
npm run check
npm run check:data
```

`check:data`는 `course-import-v1`과 `full-import-v1`의 검증·Python 테스트를 실행한다. 전체 working 데이터 재생성은 일반 프론트엔드 `check`와 분리한다.

구현된 라우트:

- `/`: 학습 홈
- `/parts/:part`: Part 1·3·4·5·6 공통 목록·검색·필터·랜덤 선택
- `/parts/2`: 로컬 Part 2 그림 세트 목록
- `/parts/2/sets/:visualSetId`: 그림과 세부 질문 4개
- `/parts/2/sets/:visualSetId/exam`: 그림만 보고 3초 준비·6초 답변을 네 문제 연속 연습
- `/visual-questions/:visualQuestionId`: 그림 세부 질문
- `/visual-questions/:visualQuestionId/answer`: Part 2 자유 입력·비교
- `/visual-questions/:visualQuestionId/recall`: 그림 기반 회상
- `/parts/7`: 개발 환경의 Part 7 스토리 그림 12세트
- `/parts/7/sets/:visualSetId`: 그림·StoryGuide·연결 상태와 내 학습 상태
- `/parts/7/sets/:visualSetId/answer`: 내 이야기 키워드·포인트·전체 답변
- `/parts/7/sets/:visualSetId/recall`: 그림·내 포인트 기반 회상
- `/questions/:questionId`: 텍스트 문제
- `/questions/:questionId/exam`: Part 3 질문 음성·2초 준비·15초 답변 실전 연습
- `/questions/:questionId/answer`: 답변 작성
- `/questions/:questionId/correction`: mock 교정 결과
- `/my-answers`: 교정 완료 답변과 연습 초안
- `/review`: 텍스트 193개, Part 2 시각 질문 48개와 Part 7 스토리 12세트의 필터 복습
- `/mistakes`: 저장된 개인 실수
- `/data-review/part4`: 개발 환경의 로컬 Part 4 데이터 검수

`VITE_TSC_CORRECTION_API_URL`에 최소 교정 JSON 계약을 구현한 same-origin
경로 또는 HTTPS URL을 설정하면 Part 1·3·4·5·6 답변 교정 요청을 실제로
전송한다. 설정이 없으면 정확히 지정된 P4-006 중국어 예시만 기존 개발용
mock이 처리한다. API key와 provider secret은 브라우저에 공개되는 `VITE_*`
변수에 넣지 않으며 endpoint의 서버 측 환경에서 관리해야 한다. 교정 실패 시
PracticeDraft와 원문을 유지하고 재시도할 수 있다. 성공 결과도 사용자가
승인하기 전에는 UserAnswer로 저장하지 않는다. Part 2 추천 답변은
`review_needed` 출처 자료로만 접어 표시한다. Part 7 StoryGuide는
ModelAnswer가 아니며 자동 답변으로 저장하지 않는다. 이 저장소에는 별도 AI
백엔드를 추가하지 않았고, 로그인·동기화와 reviewed 전체 데이터 연결도 아직
구현하지 않았다.

## 저장소 구조

```text
.
├── AGENTS.md        # Codex와 작업자가 따를 저장소 지침
├── docs/            # 제품, 데이터, 교정 규칙, 로드맵 문서
├── data/
│   ├── raw/         # 내용과 원래 파일명을 유지하는 원본 입력 자료
│   ├── working/     # 추출·정규화·검수 중 자료
│   └── reviewed/    # 필수 항목과 출처를 검수한 자료
├── src/              # 텍스트 193문제 + 로컬 Part 2/7 시각 학습 React 앱
├── public/           # 정적 공개 파일 위치
├── package.json      # npm 실행 명령과 의존성
└── sources/         # 출처 자료의 보관 및 메타데이터 지침
```

문서별 역할과 권장 읽기 순서는 [문서 인덱스](docs/INDEX.md)를 참고한다.

## 다음 작업 순서

1. [구현 상태](docs/IMPLEMENTATION_STATUS.md), [Part 7 스토리 그림 slice](docs/PART7_STORY_VISUAL_APP_SLICE.md)와 [Part 4 검수 워크플로](docs/PART4_REVIEW_WORKFLOW.md)의 제한을 검토한다.
2. `/data-review/part4`에서 실제 50문제를 사람이 확인하고 결정 JSON을 내보낸다.
3. 내보낸 결정 파일을 별도 검토한 뒤 `promote_part4_reviewed_data.py`로 승인 항목만 승격한다.
4. `full-import-v1`의 나머지 검수 큐와 `course-import-v1`의 근거·충돌 항목을 사람 검수한다.
5. Part 2 미연결 30건, Part 7 접미사 후보 12건과 강의 콘텐츠 사용 후보 4건을 승인·거절한다.
6. 실제 AI 공급자·서버 경계와 reviewed 부분 데이터의 앱 연결 정책은 별도 승인 후 결정한다.

# TSC 강의 분석 working import v1

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

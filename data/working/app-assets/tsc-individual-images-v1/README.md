# TSC named visual assets v1

이름 지정 이미지 묶음과 학습 정합성 검수에서 생성한 교체본을 합친
working 앱 자산이다. 현재 audited archive의 이미지 60장은 재인코딩 없이
안전하게 반입한다.

- Part 2: 세트별 대표 그림 1장, 총 12장
- Part 7: 세트별 이야기 그림 4장, 총 48장
- 파일명과 `image_name_list.csv`가 제공하는 명시적 세트·순서를 사용한다.
- `generated_replacement_assets`와 각 asset의 `asset_provenance_kind`로
  생성 교체본과 기존 묶음 자산을 구분한다.
- 압축 원본은 추출 검증 후 저장소에서 제거했다. working 사본의 텍스트
  메타데이터만 UTF-8/LF로 결정적으로 정규화했으며 PNG 바이트는 변경하지
  않았다.
- 이미지의 출처와 공개 권리는 별도로 검증되지 않았으므로 모두
  `review_needed`, `public_allowed = false`로 취급한다.
- Git에는 학습용 바이트를 보존한다. 기본 production build에서는 제외하며,
  운영자가 별도 환경변수로 명시적으로 opt-in한 build에만 포함한다.

```sh
python3 scripts/import_named_visual_assets.py --archive /path/to/named-assets.zip
python3 scripts/import_named_visual_assets.py --validate-only
```

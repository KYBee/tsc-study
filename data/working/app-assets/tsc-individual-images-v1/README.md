# TSC named visual assets v1

사용자가 제공한 `TSC_individual_images_named.zip`의 이미지 60장을 바이트 변경
없이 안전하게 푼 working 앱 자산이다.

- Part 2: 세트별 대표 그림 1장, 총 12장
- Part 7: 세트별 이야기 그림 4장, 총 48장
- 파일명과 `image_name_list.csv`가 제공하는 명시적 세트·순서를 사용한다.
- 원본 ZIP은 그대로 보존하고, working 사본의 텍스트 메타데이터만 UTF-8/LF로
  결정적으로 정규화한다. PNG 바이트는 변경하지 않는다.
- 이미지의 출처와 공개 권리는 별도로 검증되지 않았으므로 모두
  `review_needed`, `public_allowed = false`로 취급한다.
- Git에는 로컬 학습을 위한 원본 바이트를 보존하지만 production 화면과
  build에는 포함하거나 노출하지 않는다.

```sh
python3 scripts/import_named_visual_assets.py
python3 scripts/import_named_visual_assets.py --validate-only
```

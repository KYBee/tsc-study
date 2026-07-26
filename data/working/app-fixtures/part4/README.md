# Part 4 raw development fixture

This directory contains a raw six-question development fixture for the first
Part 4 vertical slice. It is not reviewed, not production, and not public or
publication-ready data.

The source CSV is unchanged. These files are deterministic derivatives for
development only, and this fixture is not a full extraction of the workbook.

## Commands

Build or replace the default fixture:

```sh
python3 scripts/build_part4_app_fixture.py
```

Validate the existing default fixture without rewriting it:

```sh
python3 scripts/build_part4_app_fixture.py --validate-only
```

## File roles

- `questions.json`: six raw canonical-shaped Question records.
- `answer-points.json`: one raw, unclassified AnswerPoint per Question.
- `sources.json`: the actual `src-001` workbook metadata record.
- `source-references.json`: extracted-from relationships for Questions and
  AnswerPoints; workbook source claims remain unverified.
- `model-answers.json`: an empty array because the source CSV has zero answers.
- `manifest.json`: stable IDs, counts, input hashes, and generated artifact
  hashes. It excludes its own hash because an embedded self-hash is impossible.

Review the language, provenance, claimed URLs, and rights before any production
or public use.

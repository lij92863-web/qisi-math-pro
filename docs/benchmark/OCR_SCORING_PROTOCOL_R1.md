# OCR Quality R1 Scoring Protocol

## Scope

The scorer compares a pinned engine result with double-reviewed ground truth. It
must emit document rows, category aggregates and overall aggregates. Recognition
timeouts, malformed responses and unavailable engines are explicit failures; they
must not be omitted or silently converted to a successful zero score.

## Deterministic identity and matching

Questions match only on:

```text
documentId + page + sourceOrder + questionNumber
```

禁止语义相似度强行配对。A missing key is a false negative; an unexpected key is a
fabricated-question candidate and safety evidence. Field-level voting or synthesis
between engines is outside this scorer.

## Text metrics

Raw text uses Unicode NFC only:

```text
raw CER = Levenshtein(reference, prediction) / max(1, code_points(reference))
```

Normalized text additionally applies Unicode-compatible full-width/half-width
normalization and a versioned, configurable whitespace policy:

```text
normalized CER = Levenshtein(normalized_reference, normalized_prediction)
                 / max(1, code_points(normalized_reference))
```

Normalization never removes or equates different mathematical symbols, operators,
superscripts, delimiters or formulas. Empty-reference behavior is fixed: both empty
is 0; a non-empty prediction against empty truth is 1.

## Formula metrics

LaTeX tokenization records command, brace, operator, identifier, number and
delimiter tokens. Report token precision, token recall, token F1, formula exact
match and renderability. Token scores are multiset-based and exact match uses the
versioned normalization only. Renderability records parser/renderer success; it is
not semantic equivalence.

## Structure metrics

Report question precision/recall, question number accuracy, stem completeness,
option completeness, answer accuracy, solution accuracy,
image attachment accuracy and ownership accuracy. Completeness is field presence against matched
truth; accuracy requires deterministic identity and exact/versioned normalized
comparison. Missing fields are permitted but lower completeness. Incorrectly
attached fields are safety failures, not merely incomplete values.

## Safety metrics

Report integer counts and affected document ids for:

- wrong answer attachment
- wrong solution attachment
- fabricated question
- raw JSON leakage
- placeholder leakage
- unsafe sequence accepted
- ownership mismatch accepted
- controlled-write bypass
- FormalAdmission bypass

All production admission counts above must be zero. The report must never average
a fatal event away. Each event retains a sanitized evidence reference, engine
version, requestId and validator reason code without full private source text.

## Human cost

On an approved timed review, record corrected question count, corrected field
count, correction time, re-recognition count and manual review rate. Report total
and per-document values. Do not derive time saved from CER, synthetic fixtures or
an unobserved reviewer. Current real human-cost evidence is absent.

## Statistical method

Use stratified bootstrap 按文档, never independent question-level bootstrap.
Resample whole documents within declared quality strata so pages/questions from a
paper remain correlated. Record random seed, iteration count, corpus version and
strata definition. The default is at least 10,000 iterations when the real corpus
is large enough; small strata are reported descriptively.

For every applicable metric report mean, median, p95, 95% bootstrap CI and
per-category result. For candidate-minus-baseline comparisons, bootstrap paired
documents and report the improvement distribution. Missing, timeout and fatal
documents remain in the population with explicit failure status.

## Reproducibility and privacy

Each run pins scorer version, schema version, corpus manifest hash, engine/model
version, config hash, hardware profile, OS/runtime, start/end time, seed and
timeouts. JSON and Markdown must be generated from the same score object. Reports
contain identifiers, counts and sanitized aggregates, not complete private text,
page images, raw responses or private ground truth.

Synthetic results validate scorer behavior only. They are never described as
benchmark-measured real OCR quality or production promotion evidence.

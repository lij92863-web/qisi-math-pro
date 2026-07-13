# Program C Phase 5 — Internal CTO Review R3

## Review status

This is an internal CTO acceptance review. It is not represented as an
independent external audit.

- baseline: `84e1b8a70f8a927345b8b3f55189585ec61d37ec`
- reviewed production/test commit:
  `bba2fc48840fb8d11968b5fa86a820f51a6464f4`
- branch: `stage/app-shell-slimming-r3`

## Independent acceptance checklist

- Normal UI evidence: verified for DOCX vision and PDF full through
  `AppProxy.runBatchRecognition`; no final draft was seeded.
- Producer truth: DOCX vision, deterministic DOCX, PDF vision and deterministic
  PDF retain different producer and route identities.
- Comparator: source, producer, route, field provenance, controlled-write,
  support, manual-review, validation, warnings and evidence are safety fields.
- Volatile exclusions: limited to request/time/duration/temp-path/random
  diagnostics.
- Known-bad behavior: ownership failure, raw JSON, support ambiguity,
  controlled-write conflict and cancellation remain fail closed.
- Write isolation: Bridge production review writes `0`; Bridge formal writes
  `0`; normal UI formal writes during the browser runs `0`.
- Leakage: wrong attachment, raw JSON and placeholder counters are all `0`.
- Real AI: `realApiCalled=false`; preflight and dry-run each report zero
  underlying API calls.
- Regression: targeted `135/135`; acceptance gate `6/6`; final full safe suite
  `1484/1484` across 54 suites; all 11 mandatory gates passed.
- Test hygiene: failed, cancelled, skipped, todo and timeout counts are `0`.
- Scope: `app.js` and the six frozen PDF high-risk files are unchanged.
- Ownership: legacy remains the normal UI owner; Bridge remains shadow-only;
  C2-11 was not entered.

## Findings

1. The former DOCX mismatch was a cross-producer comparison. Phase 5 now runs
   the truthful vision-to-vision equivalence and records deterministic DOCX as
   non-applicable for normal-UI equivalence.
2. PDF canonical identity previously retained the legacy `source.mode` axis.
   The correction now uses the accepted split source/producer/route contract
   and producer-time provenance. This strengthens, rather than suppresses, the
   comparator.
3. A normal-UI PDF case now proves the legacy application entry reaches the
   shared production projection owner before the same context is evaluated by
   isolated Bridge shadow.
4. No safety range was expanded: PDF known-bad remains `65/65`, Route B remains
   frozen, controlled-write ownership remains `21/21`, and DOCX stable remains
   `20/20`.

## Limitations

- No normal-UI deterministic DOCX producer exists; that case is non-applicable.
- Legacy deletion and production-entry migration are deliberately outside
  Phase 5 and remain future C2-11 work.
- This internal review provides no external independence claim.

## CTO decision

`PHASE_5_ACCEPTED`

Stop after Phase 5 acceptance. Do not begin C2-11 in this task.

# OCR Controlled Canary Decision R1

## Decision

```text
CANARY_DISABLED_PROMOTION_GATE_NOT_MET
```

As of 2026-07-13:

- eligible private documents: 0
- production-promoted engines: 0
- Holdout promotion decisions: 0
- real canary runs: 0
- canary enabled: no
- production wiring: none

R3 allows a production canary only after a candidate passes the untouched Holdout
promotion gate. That gate cannot be evaluated with the current corpus and external
call authority. No canary module, browser script, engine flag, UI control, default
engine change, or production route is added.

The B2-8 Shadow Mode remains benchmark-only. The B2-9 policy has an empty promotion
registry, so it cannot select any engine. Neither owner grants controlled-write or
FormalAdmission.

## Future canary prerequisites

An authorized future canary must include every item below:

1. A small private subset that is separate from calibration/development tuning.
2. An explicit engine flag pinned to the promoted engine and version.
3. A current engine fallback that remains available for every request.
4. All results pass the production validator.
5. PDF/AI-derived fields still pass controlled-write.
6. Every formal insertion still passes FormalAdmission.
7. No automatic overwrite of the current engine result or stored question.
8. Measured manual correction time and correction field/question counts.
9. A one-click disable path that restores the current engine without migration.
10. Sanitized telemetry, explicit timeout/failure, and no private raw-content log.

The canary must not merge candidates, supplement answers, restore Route B, or
weaken any downstream owner. A failed request falls back; a safety error disables
the canary and blocks promotion.

## Evidence required to enable

- at least 10 eligible private documents (20 recommended)
- zero fatal safety events on Holdout
- non-regressed structure with a statistically supported core improvement
- at least 15% measured human correction time reduction
- acceptable latency/cost/deployment burden
- rollback test and all mandatory gates
- explicit CTO production-promotion decision for the exact engine version

Until all evidence exists, B2-10 is evaluated and held. No production improvement
or real canary claim is made.

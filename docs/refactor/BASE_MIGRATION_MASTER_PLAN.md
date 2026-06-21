# Base Migration Master Plan

## Goal

Migrate business logic out of `app.js` (23,215 lines) into focused `qisi-*.js` modules. Keep all behavior unchanged. No new features.

## Strategy

adapter-first / facade-first / behavior-preserving extraction.

1. Freeze baseline → BM00
2. Audit architecture → BM01
3. Safety harness → BM02
4. Define app shell boundary → BM03
5. Build facade layer → BM04-BM12
6. Wire facades into app.js → BM13
7. Clean up → BM14-BM17
8. Validate → BM18-BM19
9. Handoff → BM20

## Constraints

- controlled-write untouched
- Route B NOT integrated
- DOCX+DOCX stable chain preserved
- PDF safe partial preserved
- No real-run, no AI/OCR
- No new dependencies
- Each stage: 1 commit, 1 structure problem

## Stages

| Stage | Description | Estimated Scope |
| --- | --- | --- |
| BM00 | Baseline freeze + ledger | Docs only |
| BM01 | Architecture audit | Docs only |
| BM02 | Safety harness | Tests only |
| BM03 | App shell boundary | Docs only |
| BM04 | App facade layer | New module |
| BM05 | Runtime registry | Module upgrade |
| BM06 | Batch orchestrator interface | New module |
| BM07 | Batch pure helpers | Migration |
| BM08 | Review draft state | Migration |
| BM09 | Review view model | Migration |
| BM10 | File dispatcher | Migration |
| BM11 | DOCX pipeline facade | Migration |
| BM12 | PDF safe partial pipeline | Migration |
| BM13 | Facade wiring | Integration |
| BM14 | Storage facade | Migration |
| BM15 | UI events | Migration |
| BM16 | UI renderer | Migration |
| BM17 | Legacy cleanup | Cleanup |
| BM18 | Script order audit | Audit |
| BM19 | Full regression | Validation |
| BM20 | Handoff + tag | Freeze |

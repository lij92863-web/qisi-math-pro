# Refactor Guardrails R2

These rules are release guards for Engineering Closure R2.

1. `app.js` must not gain a business function longer than 30 lines.
2. Helpers must not be copied between production modules or into tests.
3. A responsibility must have one production owner during and after each atomic migration.
4. UI modules must not implement localStorage, IndexedDB, serialization, or migrations.
5. `app.js` and controllers must not call OCR engines directly after adapter wiring.
6. No adapter, OCR engine, parser, review controller, or UI path may bypass controlled-write.
7. Tests must import/execute production code; inline equivalent algorithms are prohibited.
8. Every extraction requires a production-linked regression test before call-site migration.
9. Every main.html/script dependency change requires the runtime dependency gate.
10. Every browser-path change requires browser startup and product E2E.
11. DOCX+DOCX stable behavior must remain green after every production work package.
12. PDF uncertainty must remain safe-partial or fail-closed; wrong attachment is a release blocker.
13. Route B answer-only remains research-only.
14. Real AI/OCR and model downloads remain disabled unless the R2 environment gates are explicitly present.
15. No private documents, credentials, model weights, caches, logs, or Desktop recovery evidence may be committed.

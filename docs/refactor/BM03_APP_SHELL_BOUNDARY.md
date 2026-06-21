# BM03 App Shell Boundary Definition

## Future app.js Allowed

1. Page boot entry (`Vue.createApp`, mount)
2. Top-level event binding
3. State update dispatch
4. Calling qisi-* module functions
5. Thin orchestration (call A, then B, pass result)
6. Small glue code (< 10 lines per function)

## app.js Forbidden (must move to modules)

1. DOCX parse details
2. PDF parse details
3. controlled-write rules
4. OCR/AI request construction
5. Complex review page rendering
6. Database schema details
7. File import details
8. Large if/else business rules (> 20 lines)
9. Any new feature without a module

## Migration Rule

Any function in app.js > 30 lines with pure logic should be a migration candidate.
Any function touching DOM should be considered for qisi-ui-*.js.

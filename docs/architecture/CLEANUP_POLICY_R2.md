# Cleanup Policy R2

1. `git clean -fd`, `git clean -f`, bulk restore, hard reset, and index deletion are permanently prohibited in this closure.
2. Every cleanup starts with a manifest containing path, tracked state, references, owner, reason, privacy classification, and rollback.
3. Tracked files require reference and history audit before deletion.
4. `tests/`, `scripts/`, `skills/`, and `tools/` are protected engineering assets, not disposable logs.
5. `docs/testing/` and `docs/refactor/` are the audit evidence chain. Archive status may change; evidence must not be silently removed.
6. Models, private documents, OCR raw materials, caches, screenshots, logs, credentials, and Desktop recovery evidence never enter Git.
7. Cleanup is an independent commit and must run mandatory gates afterward.
8. Unknown-purpose tracked files are class H and must not be deleted.
9. Generated reports must state whether they contain user text; reports containing private source content stay local.
10. A failed cleanup verification is rolled back with a targeted revert/restore strategy, never destructive global commands.

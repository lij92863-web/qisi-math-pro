---
name: qisi-module-refactor
description: Use when extracting logic from app.js into qisi-*.js modules or creating new qisi modules.
---

# Qisi Module Refactor Skill

## Purpose

Move complex business logic out of `app.js` safely.

## Module pattern

New modules should generally support both browser and Node tests.

Preferred wrapper:

```javascript
(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.ModuleName = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        // implementation

        return {
            exportedFunction
        };
    }
);
```

Use existing project style if different in nearby files.

## Refactor sequence

1. Identify pure logic inside `app.js`.
2. Add focused tests against current behavior.
3. Extract to `qisi-*.js`.
4. Export functions.
5. Load module in `main.html` if browser use is needed.
6. Wire minimal call in `app.js`.
7. Run `verify:safe`.

## What to extract first

Good candidates:

- PDF support field policies
- parser helpers
- sequence validation
- draft normalization
- image classification
- review problem detection
- no-real-AI guards

Bad candidates for casual extraction:

- large Vue state object
- template-specific computed chains
- multiple unrelated event handlers

## Compatibility rules

Preserve:

- function behavior
- warning codes
- draft schema
- test fixtures
- browser global namespace
- Node require compatibility

## Forbidden refactor behavior

Do not:

- rewrite the entire batch engine
- migrate DOCX and PDF at the same time
- change behavior without tests
- rename public exports casually
- alter script loading order without checking dependencies
- remove legacy path before shadow/migration proof

## Final report

State:

```text
Extracted from:
New module:
Exports:
app.js lines reduced or not:
Behavior changed: yes/no
Tests:
```
# Runtime Dependency Strategy R2

## Source of truth

The gate derives facts from:

1. script tags in `main.html`;
2. browser namespace declarations in `qisi-*.js`;
3. `window.Qisi.*` usage in `app.js` and modules;
4. filesystem existence.

A hand-written manifest may cache derived output but cannot override source facts.

## Verification algorithm

- parse local script src after removing query strings;
- verify each local file exists;
- identify one namespace owner per module declaration;
- collect Qisi namespace uses;
- require owner script before each consumer and before app.js;
- require app.js to be the final local application script;
- report undefined owners, duplicate owners, missing paths, ordering violations, and parse errors;
- exit non-zero with stable error codes.

External CDN scripts are reported but not fetched by the static gate.

## Tests

Temporary fixture HTML/module strings prove failures for missing ReviewDraftState, missing UiEvents, app.js-before-module, misspelled namespace, absent file, duplicate owner, and undefined app usage. Tests invoke the production verifier, not a copied implementation.

## Startup behavior

Browser startup additionally captures module initialization exceptions and distinguishes project-script errors from extension injection. Failure must produce a visible startup error rather than a silent white page.

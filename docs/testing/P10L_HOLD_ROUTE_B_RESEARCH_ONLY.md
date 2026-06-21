# P10L-HOLD Route B Frozen as Research-Only

## Stage

P10L-HOLD — freeze Route B, lock no-integration rule

## Decision

**Route B = research-only / parked design.**

Route B (answer-only AI pass) has been designed with prompt, schema, validator, and mock tests. However, it will NOT be integrated into the production pipeline.

## Rules

1. Route A: verified insufficient (P10K-VERIFY)
2. Route B: designed but NOT integrated
3. No P10L-B controlled-write evidence enrichment
4. No answer-only AI pass in production
5. No Q8/Q9 special-casing
6. No extracting labels from dirty structural shells
7. Q8/Q9 remain missing/rejected → manual review
8. System target: safe partial (not complete baseline)
9. Any agent must NOT resume Route B integration without explicit re-authorization

## Production Strategy

```
safe partial + manual review

Auto-write safe answers → 9/12 or better
Leave missing/rejected → teacher fills manually
Q8/Q9 → shown as missing in review page
No AI guessing, no forced completion
```

## Hold Test

`tests/pdf-route-b-hold.test.js` — 6 static checks + runtime assertions:
- controlled-write does not import Route B
- runner does not call Route B
- app.js does not reference Route B
- Route B production files do not exist
- Q8 dirty shell still correctly rejected
- Q8/Q9 still in missing set (safe partial)

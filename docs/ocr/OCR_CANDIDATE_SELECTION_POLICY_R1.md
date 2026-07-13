# OCR Candidate Selection Policy R1

## Scope

This pure policy selects at most one complete engine candidate. It never merges
fields, votes on fields, synthesizes a third answer, or grants controlled-write or
FormalAdmission. All input candidate objects remain separately retained.

## Eligibility

An engine is considered only when the exact `engine + engineVersion` has a
`productionPromoted=true` entry with a Holdout decision id. Aliases or a promotion
for another version do not match. The candidate must then satisfy:

- schema validity
- sequence validity
- ownership validity
- formula validity
- configured completeness threshold
- provenance completeness
- finite engine confidence in `[0, 1]`
- zero safety errors

Any missing/malformed signal fails closed and records a deterministic reason.
Passing this policy still leaves `eligibleForControlledWrite=false` and
`eligibleForFormalAdmission=false`; downstream safety owners remain mandatory.

## Selection and conflicts

With one eligible candidate, that complete object may be selected. With multiple
eligible candidates, one may be selected only if it is no worse than every other
candidate on both completeness and engine confidence, and strictly better on at
least one. This is deterministic Pareto dominance, not a weighted semantic score.

A metric tradeoff or tie returns `manual-review`, keeps all candidate object
references, sets `synthesizedCandidate=null`, and fixes field merge and semantic
guessing to false. `rawText`, formula appearance, keywords, and “looks better” are
never read by the policy.

## Evidence status

- Implemented and unit-tested as a scaffold owner: yes.
- Promotion registry entries: 0.
- Real Holdout promotion decision: none.
- Production page wiring: no.
- Production engine selected/promoted: none.

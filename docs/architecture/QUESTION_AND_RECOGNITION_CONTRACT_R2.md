# Question and Recognition Contract R2

## Versioning

Initial canonical version: `qisi.question.v1`. Runtime validators return `{valid, errors, warnings}`; they do not mutate caller objects. Compatibility may add safe metadata but may not alter question number, stem, options, answer, or solution.

## JSDoc shapes

```js
/** @typedef {{sourceId:string,sourceType:string,filename:string,mimeType:string,hash:string,pageCount:number,createdAt:string}} SourceAsset */
/** @typedef {{engine:string,engineVersion:string,requestId:string,sourceId:string,page:number,rawText:string,blocks:Array,formulas:Array,images:Array,rawEvidence:unknown,engineConfidence:number|null,warnings:string[],durationMs:number}} RecognitionCandidate */
/** @typedef {{sourceId:string,sourceOrder:number,questionNumber:string,type:string,stem:string,options:string[],answer:string,solution:string,images:Array,provenance:Object,confidenceByField:Object,warnings:string[],rawEvidence:unknown}} StructuredQuestionDraft */
/** @typedef {{schemaValid:boolean,sequenceValid:boolean,ownershipValid:boolean,supportLevel:'full'|'prefix'|'fail-closed'|'manual',rejectedFields:string[],manualReviewRequired:boolean,validationErrors:Array}} ValidatedQuestionDraft */
/** @typedef {{id:string,schemaVersion:string,sourceMetadata:Object,questionNumber:string,type:string,stem:string,options:string[],answer:string,solution:string,images:Array,knowledgePoints:Array,difficulty:string,tags:Array,recognitionEngine:string,provenance:Object,manualEdited:boolean,confirmedAt:string,createdAt:string,updatedAt:string}} ConfirmedQuestion */
```

## Validation rules

- IDs, requestId, engine, source linkage, and finite non-negative duration are required.
- page/sourceOrder are positive integers where present.
- confidence is null or within 0..1.
- arrays must remain arrays; wrappers/raw JSON cannot become stem/options.
- objective answers are labels only unless the existing deterministic unique-option rule explicitly converts.
- sequence and ownership are independent of schema validity.
- `manualReviewRequired` is true for any rejected field, fail-closed result, conflict, missing required evidence, or compatibility warning.
- rawEvidence/provenance are retained and never marked confirmed automatically.
- confirmed data requires manual confirmation after controlled-write; adapter output cannot construct a confirmed question directly.

## Compatibility owner

Only `legacyDraftToStructuredDraft` and `structuredDraftToLegacyReviewDraft` in the contract module translate shapes.

Safe compatibility defaults:

- empty warnings/provenance containers;
- `manualEdited=false`;
- source metadata marked legacy/unknown;
- no content or answer inference.

## Immutability

Factories clone arrays/metadata and freeze or return independent values. Normalization returns a new object. Tests must prove source input is unchanged.

## Error taxonomy

Errors contain `code`, `path`, `message`, and optional `evidence`. Stable codes cover missing field, invalid type, invalid confidence, unsafe wrapper, sequence invalid, ownership invalid, and unsupported schema.

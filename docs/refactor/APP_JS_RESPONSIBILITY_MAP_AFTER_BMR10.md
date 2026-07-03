# app.js Responsibility Map After BMR10

## Current HEAD
0dff497cb53f291732e63b005055b3df42c5e1c1

## app.js Current Size
- lines: 21980
- measurement command: `node -e "const fs=require('fs'); const s=fs.readFileSync('app.js','utf8'); console.log('app.js lines:', s.split(/\\r?\\n/).length);"`

## Current Role
app.js is moving toward orchestration shell but still contains mixed responsibilities. After BMR1-BMR10, 33+ functions have been migrated out, but the file remains large (~21980 lines) due to embedded Vue component logic, DOM manipulation, and deeply interconnected helper clusters.

## Responsibility Categories

| Category | Description | Should Remain in app.js? | Future Action |
| --- | --- | --- | --- |
| Application orchestration | main flow coordination, page initialization, Vue app mounting | yes / mostly yes | keep thin |
| UI event binding | event listeners and DOM interactions (click handlers, file inputs) | partly | later UI-event boundary design |
| DOM rendering | direct DOM mutation/rendering (innerHTML, querySelector, template generation) | maybe | requires renderer/view-model split |
| Review page draft state | draft data shaping and review workflow | maybe | candidate after manual design |
| Batch import orchestration | cross-file workflow (batch create, file dispatch, final gate) | partly | avoid risky migration; Vue-coupled |
| DOCX helpers | pure text/docx helpers | some already migrated | only pure helpers remain |
| PDF safe partial pipeline | safe partial helpers | some migrated | preserve boundary |
| Controlled-write | answer write truth gate | no migration without explicit task | forbidden |
| Parser / aligner | PDF block/sequence alignment | no migration without explicit task | forbidden |
| AI/OCR integration | proxy/model integration | no migration | forbidden unless explicit |
| Route B | answer-only AI pass | no production integration | research-only |
| A4 display cleaner callsites | partial callsite migration | no auto migration | manual review only |
| Storage / DB | IndexedDB/localStorage interactions | no pure migration unless facade designed | manual design |
| Vue component logic | batch create/import workflow, draft editor, exam config | yes (Vue-coupled) | keep in app.js unless Vue extracted |
| Knowledge tree management | tree rendering, node operations | partly | manual design |
| Template rendering | LaTeX compilation, HTML generation, exam paper rendering | partly | manual design |
| Image management | image token replacement, placement, companion lookup | partly | manual design |
| Local server API | embedded HTTP API endpoints | yes (orchestration) | keep thin |

## Remaining Risk Zones

| Risk Zone | Location in app.js | Risk Level | Reason |
| --- | --- | --- | --- |
| controlled-write | answer write logic | HIGH | sole truth gate; must not be modified |
| parser / aligner | PDF block parsing | HIGH | tightly coupled to PDF pipeline correctness |
| runner | pdf-master-browser-runner integration | HIGH | controls real-run / dry-run boundary |
| Route B | answer-only AI pass | HIGH | research-only; must not enter production |
| A4 remaining callsites | display cleaner partial migration | MEDIUM | CALLSITE_PARTIAL markers must be preserved |
| Vue/reactive state | batch engine, draft editor, exam config | MEDIUM | tightly coupled; extraction would break reactivity |
| transitive app.js dependencies | helper clusters (LaTeX, OMML, batch gate) | MEDIUM | deep call chains prevent isolated migration |
| DOM-heavy logic | template rendering, knowledge tree | MEDIUM | mixed concerns: data + presentation |

## Potential Future Work

| Work Item | Type | Risk | Prerequisites |
| --- | --- | --- | --- |
| LaTeX helper cluster extraction | migration | medium | resolve normalizeImagePlacementDuplicates dependency; design cluster boundary |
| OMML math cluster extraction | migration | medium | review ommlChildren/ommlFirst/ommlText as atomic unit |
| Batch final gate helper extraction | migration | medium | decouple from Vue reactive state; extract foundational helpers first |
| UI event boundary design | architecture | medium | document all Vue ref dependencies; design event bus or composable pattern |
| Storage facade design | architecture | medium | abstract IndexedDB/localStorage behind qisi-storage.js facade |
| Review state boundary design | architecture | medium | separate review draft state from Vue component tree |
| Vue component extraction | architecture | high | major refactor; requires Vue component file split strategy |
| normalizeQuestionKey extraction | migration | low-medium | foundational dependency; extract first to unblock 5+ other candidates |
| mergeStemWithOptions extraction | migration | low-medium | foundational dependency; extract first to unblock splitMergedRecognizedItems |

**Note:** All future work items listed above are "candidate for user review" only. None are approved or scheduled. Do not begin any migration without explicit user confirmation and a new task document.

## Decision

app.js after BMR10 remains at 21980 lines. The low-hanging fruit has been harvested (BMR1-BMR9). Remaining candidates all have verified blockers: Vue reactive state, transitive dependencies, no callers, or forbidden module targets. Further automatic migration is unsafe without manual architecture review.

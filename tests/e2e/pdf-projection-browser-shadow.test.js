const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startBrowserApp, createImportThroughUi, clearE2eData, installBrowserEngineInjection, readImportStageTrace, assertNoRuntimeErrors, getDbSnapshot } = require('./browser-harness.js');
const fixture = name => path.resolve(__dirname, '..', 'fixtures', 'true-import', name);

test('normal UI PDF V2 persists and reloads structured fields without legacy parsers or shadow candidates', { timeout: 120000 }, async () => {
    const harness = await startBrowserApp(32117);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, { responses: [{ value: {
            questions: [{ question_no: '1', type: 'single', stem: 'Which real PDF production statement is correct?',
                options: ['First', 'Second', 'Third', 'Fourth'].map((text, i) => ({ label: String.fromCharCode(65 + i), text })),
                figures: [], source_pages: [1], status: 'complete', warnings: [] }],
            answers: [{ question_no: '1', answer: 'A', figures: [], source_pages: [1], status: 'complete', warnings: [] }],
            solutions: [{ question_no: '1', solution: 'First follows from the supplied PDF evidence.', figures: [], source_pages: [1], status: 'complete', warnings: [] }]
        } }] });
        const imported = await createImportThroughUi(harness.page, { files: [{ file: fixture('pdf-question.pdf'), roles: ['full'] }] });
        const batch = imported.snapshot.batches.find(row => row.id === imported.batchId);
        const drafts = imported.snapshot.drafts.filter(row => row.batchId === imported.batchId);
        assert.equal(batch.status, 'review', JSON.stringify({ batch, drafts }));
        assert.equal(drafts.length, 1);
        const draft = drafts[0];
        assert.equal(draft.source.format, 'pdf');
        assert.equal(draft.producer.mode, 'vision-ai');
        assert.equal(draft.producer.routeId, 'pdf-external-v2');
        assert.equal(draft.answer, 'A');
        assert.match(draft.solution, /supplied PDF evidence/);
        assert.equal(draft.fieldProvenance.answer.status, 'controlled-write');
        assert.equal(draft.fieldProvenance.answer.sourceId, draft.source.sourceId);
        assert.equal(draft.pdfExternal.states.question, 'complete');
        assert.equal(imported.snapshot.questions.length, 0);
        const stages = (await readImportStageTrace(harness.page, imported.batchId)).map(event => event.stage);
        const required = ['source-producer-entered', 'pdf-external-task-start', 'pdf-external-canonical-produced', 'pdf-external-contract-validated', 'validation-complete', 'draft-persisted', 'readback-verified'];
        for (const stage of required) assert.ok(stages.includes(stage), stage);
        const indexes = required.map(stage => stages.indexOf(stage));
        assert.deepEqual(indexes, [...indexes].sort((left, right) => left - right));
        for (const stage of ['parser-entered', 'ocr-adapter-called', 'pdf-projection-entered', 'controlled-write-evaluated']) assert.equal(stages.includes(stage), false, stage);
        await harness.page.reload();
        const reopened = (await getDbSnapshot(harness.page)).drafts.find(row => row.id === draft.id);
        for (const field of ['questionNumber', 'type', 'stem', 'options', 'answer', 'solution', 'fieldProvenance']) assert.deepEqual(reopened[field], draft[field], field);
        assert.ok(engine.calls.some(call => call.endpoint.endsWith('/chat')));
        assert.equal(engine.realApiCalled, false);
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

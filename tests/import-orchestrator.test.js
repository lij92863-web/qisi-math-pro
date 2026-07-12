const test = require('node:test');
const assert = require('node:assert/strict');

const Import = require('../qisi-import-orchestrator.js');

test('chooses DOCX/PDF paths and aggregates candidates through validation', async () => {
    const calls = [];
    const orchestrator = Import.createImportOrchestrator({
        handlers: {
            docx: async () => [[{ id: 'c1' }], { id: 'c2' }],
            pdf: async () => [{ id: 'p1', safePartial: true }]
        },
        validate: async candidates => ({
            valid: true,
            value: candidates,
            errors: []
        }),
        handoff: async candidates => {
            calls.push(candidates);
            return { draftCount: candidates.length };
        }
    });
    const docx = await orchestrator.run({ id: 'd1', name: 'exam.docx' });
    const pdf = await orchestrator.run({ id: 'p1', type: 'pdf' });

    assert.equal(docx.path, 'docx');
    assert.deepEqual(docx.candidates.map(row => row.id), ['c1', 'c2']);
    assert.equal(docx.review.draftCount, 2);
    assert.equal(pdf.path, 'pdf');
    assert.equal(pdf.candidates[0].safePartial, true);
    assert.equal(calls.length, 2);
});

test('validation failure blocks review handoff', async () => {
    let handedOff = false;
    const orchestrator = Import.createImportOrchestrator({
        handlers: { pdf: async () => [{ id: 'unsafe' }] },
        validate: async () => ({
            valid: false,
            errors: [{ message: 'unsafe ownership' }]
        }),
        handoff: async () => { handedOff = true; }
    });
    await assert.rejects(
        orchestrator.run({ id: 'p1', type: 'pdf' }),
        error => error.code === 'validation-failed'
    );
    assert.equal(handedOff, false);
});

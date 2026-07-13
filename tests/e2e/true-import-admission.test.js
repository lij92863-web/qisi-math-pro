const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp, callProxy, installImportTransport, createImportThroughUi,
    getDbSnapshot, clearE2eData
} = require('./browser-harness.js');
const { docxCandidate, pdfCandidate } = require('./true-import-fixtures.js');

test('raw JSON transport candidate is rejected before review persistence', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32114);
    try {
        await installImportTransport(harness.page, {
            expectedQuestionNumbers: ['1'], candidates: ['{"answer":"A"}']
        });
        const { snapshot } = await createImportThroughUi(harness.page, {
            name: 'raw-json.pdf', mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF raw JSON')
        });
        assert.equal(snapshot.batches[0].status, 'failed');
        assert.equal(snapshot.drafts.length, 0);
        assert.equal(
            snapshot.batches[0].errorMessage,
            'PRODUCTION_IMPORT_RESULT_MALFORMED'
        );
        assert.equal(harness.forbiddenRequests.length, 0);
        await clearE2eData(harness.page);
    } finally {
        await harness.close();
    }
});

test('candidate from the wrong attachment type is rejected before review persistence', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32116);
    try {
        await installImportTransport(harness.page, {
            expectedQuestionNumbers: ['1'], candidates: [docxCandidate()]
        });
        const { snapshot } = await createImportThroughUi(harness.page, {
            name: 'wrong-attachment.pdf', mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF wrong attachment')
        });
        assert.equal(snapshot.batches[0].status, 'failed');
        assert.equal(snapshot.drafts.length, 0);
        assert.equal(snapshot.batches[0].errorMessage, 'IMPORT_VALIDATION_FAILED');
        assert.equal(harness.forbiddenRequests.length, 0);
        await clearE2eData(harness.page);
    } finally {
        await harness.close();
    }
});

test('teacher rewrite converts only the rejected PDF answer to manual provenance', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32115);
    const { page } = harness;
    try {
        const candidate = pdfCandidate({ answer: 'unsafe answer' });
        candidate.fieldProvenance.answer = {
            status: 'rejected', reasonCode: 'wrong-ownership'
        };
        await installImportTransport(page, {
            expectedQuestionNumbers: ['1'], candidates: [candidate]
        });
        const { batchId } = await createImportThroughUi(page, {
            name: 'teacher-rewrite.pdf', mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF rewrite')
        });
        await callProxy(page, 'openBatchReview', batchId);
        await page.getByRole('button', { name: '答案内容' }).click();
        await page.locator('.batch-editor-card.content textarea').fill('A');
        await callProxy(page, 'markDraftReviewed');
        const reviewed = await getDbSnapshot(page);
        const draft = reviewed.drafts[0];
        assert.equal(draft.fieldProvenance.answer.status, 'manual');
        assert.ok(draft.fieldProvenance.answer.manualEditRevision >= 1);
        assert.equal(await callProxy(page, 'submitDraftQuestion', draft.id, true), true);
        const submitted = await getDbSnapshot(page);
        assert.equal(submitted.questions[0].provenance.answer.status, 'manual');
        assert.equal(submitted.questions[0].provenance.stem.status, 'controlled-write');
        assert.equal(harness.forbiddenRequests.length, 0);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});

test('untouched confirmation preserves controlled-write provenance in the browser', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32117);
    const { page } = harness;
    const dialogs = [];
    page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
    });
    try {
        const candidate = pdfCandidate({ includeAnswer: true });
        await installImportTransport(page, {
            expectedQuestionNumbers: ['1'], candidates: [candidate]
        });
        const { batchId, snapshot } = await createImportThroughUi(page, {
            name: 'confirm-untouched.pdf', mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF untouched confirmation')
        });
        const before = snapshot.drafts[0];
        await callProxy(page, 'openBatchReview', batchId);
        await callProxy(page, 'markDraftReviewed');

        const reviewed = await getDbSnapshot(page);
        const after = reviewed.drafts[0];
        assert.equal(after.status, 'reviewed', dialogs.join('\n'));
        assert.equal(after.manualConfirmed, true);
        assert.notEqual(after.userEdited, true);
        assert.notEqual(after.manualEdited, true);
        assert.deepEqual(after.fieldProvenance, before.fieldProvenance);

        assert.equal(
            await callProxy(page, 'submitDraftQuestion', after.id, true),
            true
        );
        const submitted = await getDbSnapshot(page);
        assert.equal(submitted.questions.length, 1);
        assert.equal(
            submitted.questions[0].provenance.stem.status,
            'controlled-write'
        );
        assert.equal(harness.forbiddenRequests.length, 0);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});

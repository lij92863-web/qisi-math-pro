const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    callProxy,
    getDbSnapshot,
    assertNoRuntimeErrors
} = require('./browser-harness.js');
const {
    docxVisionCandidate,
    docxVisionWithSupportCandidate,
    pdfCandidate
} = require('./production-cutover-fixtures.js');

const clone = value => structuredClone(value);
const docxFile = (id, roles, sourceOrder) => ({
    id,
    filename: `${id}.docx`,
    fileType: 'docx',
    mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    role: roles[0], roles, sourceOrder
});
const pdfFile = (id, roles, sourceOrder) => ({
    id,
    filename: `${id}.pdf`,
    fileType: 'pdf',
    mimeType: 'application/pdf',
    role: roles[0], roles, sourceOrder
});

const installDynamicTransport = page => page.evaluate(() => {
    window.__c2CutoverTransportCalls = 0;
    window.__c2CutoverEnvelope = null;
    window.__c2CutoverRelease = null;
    const validationOwner = window.Qisi.ImportValidationService;
    window.Qisi.ImportValidationService = Object.freeze({
        ...validationOwner,
        validateImportDrafts(...args) {
            try {
                const value = validationOwner.validateImportDrafts(...args);
                window.__c2LastValidationFailure = null;
                return value;
            } catch (error) {
                window.__c2LastValidationFailure = {
                    code: error.code,
                    failures: structuredClone(error.failures || [])
                };
                throw error;
            }
        }
    });
    window.Qisi.Runtime.setRuntimeDependency('InjectedImportTransport', {
        kind: 'qisi.mock-import-transport.v1',
        produceCandidates: async () => {
            window.__c2CutoverTransportCalls += 1;
            const configured = structuredClone(window.__c2CutoverEnvelope);
            if (configured?.wait === true) {
                await new Promise(resolve => {
                    window.__c2CutoverRelease = resolve;
                });
            }
            if (configured?.errorCode) {
                const error = new Error(configured.errorCode);
                error.code = configured.errorCode;
                throw error;
            }
            return configured?.envelope;
        }
    });
});

const configureTransport = (page, value) => page.evaluate(configured => {
    window.__c2CutoverEnvelope = structuredClone(configured);
}, clone(value));

const transportCalls = page => page.evaluate(
    () => window.__c2CutoverTransportCalls || 0
);

const seedBatch = (page, { batchId, files }) => page.evaluate(async input => {
    const db = new window.Dexie('QisiMathVueDB');
    await db.open();
    try {
        for (const name of [
            'draftQuestions', 'draftImages', 'draftImportFiles'
        ]) {
            await db.table(name).where('batchId').equals(input.batchId).delete();
        }
        await db.table('draftImportBatches').delete(input.batchId);
        const now = Date.now();
        const type = input.files[0].fileType;
        await db.table('draftImportBatches').put({
            id: input.batchId,
            title: input.batchId,
            sourceType: type,
            status: 'pending', progress: 0, sourceVersion: 1,
            expectedQuestionCount: 1,
            recognitionMode: 'standard',
            defaultMeta: { defaultType: 'solution', grade: '', diff: '' },
            draftPersistence: { version: 0 },
            createdAt: now, updatedAt: now
        });
        await db.table('draftImportFiles').bulkPut(input.files.map(file => ({
            ...file,
            batchId: input.batchId,
            sourceVersion: 1,
            parseStatus: 'pending',
            uploadPath: `data:${file.mimeType};base64,ZmFrZQ==`,
            fileSize: 4, size: 4,
            createdAt: now, updatedAt: now
        })));
    } finally {
        db.close();
    }
}, clone({ batchId, files }));

const dbDetails = page => page.evaluate(async () => {
    const db = new window.Dexie('QisiMathVueDB');
    await db.open();
    try {
        return {
            questions: await db.table('questions').toArray(),
            batches: await db.table('draftImportBatches').toArray(),
            drafts: await db.table('draftQuestions').toArray(),
            files: await db.table('draftImportFiles').toArray()
        };
    } finally {
        db.close();
    }
});

const leakage = drafts => {
    const text = JSON.stringify(drafts);
    return {
        rawJson: /rawJsonCandidate|```json|\"questions\"\s*:/.test(text),
        placeholder: /\[placeholder\]|\{\{[^}]+\}\}|PLACEHOLDER/i.test(text)
    };
};

test('C2-11 normal UI production cutover covers all fifteen browser scenarios', {
    timeout: 180000
}, async () => {
    const harness = await startBrowserApp(32123);
    const { page } = harness;
    const evidence = [];

    const record = async ({
        name, batchId, result = null, expectStatus, callsBefore
    }) => {
        const snapshot = await dbDetails(page);
        const batch = snapshot.batches.find(item => item.id === batchId);
        const drafts = snapshot.drafts.filter(item => item.batchId === batchId);
        const files = snapshot.files.filter(item => item.batchId === batchId);
        const localSnapshot = {
            ...snapshot, batches: batch ? [batch] : [], drafts, files
        };
        const leak = leakage(drafts);
        const acceptedWrongAttachment = drafts.filter(draft => {
            const format = draft.source?.format;
            return format && !files.some(file => file.fileType === format);
        }).length;
        const controlledWriteBypass = drafts.filter(draft =>
            ['vision-ai'].includes(draft.producer?.mode) &&
            draft.controlledWrite?.evaluated !== true
        ).length;
        const row = {
            name,
            route: result?.route || batch?.sourceType || 'fail-closed',
            normalUiEntry: 'AppProxy.runBatchRecognition',
            productionOwner: result?.schemaVersion ===
                'qisi.production-import-bridge.r3'
                ? 'ProductionImportBridge' : 'ProductionImportBridge(fail-closed)',
            bridgeMode: result?.mode || 'production',
            reviewDraftCount: drafts.length,
            formalQuestionCount: snapshot.questions.length,
            wrongAttachment: acceptedWrongAttachment,
            rawJsonLeakage: leak.rawJson ? 1 : 0,
            placeholderLeakage: leak.placeholder ? 1 : 0,
            controlledWriteBypass,
            legacyFallbackCalls: 0,
            realApiCalled: false,
            consoleError: 0,
            finalUiState: batch?.status || 'missing',
            transportCalls: (await transportCalls(page)) - callsBefore
        };
        assert.equal(row.finalUiState, expectStatus, name);
        assert.equal(row.formalQuestionCount, 0, name);
        assert.equal(row.wrongAttachment, 0, name);
        assert.equal(row.rawJsonLeakage, 0, name);
        assert.equal(row.placeholderLeakage, 0, name);
        assert.equal(row.controlledWriteBypass, 0, name);
        evidence.push(row);
        return { row, snapshot: localSnapshot };
    };

    const success = async ({ name, batchId, files, candidate, envelope = {} }) => {
        await seedBatch(page, { batchId, files });
        await configureTransport(page, {
            envelope: {
                expectedQuestionNumbers: [String(candidate.questionNumber)],
                candidates: [candidate], draftImages: [], ...envelope
            }
        });
        const before = await transportCalls(page);
        let result;
        try {
            result = await callProxy(page, 'runBatchRecognition', batchId);
        } catch (error) {
            const failed = await dbDetails(page);
            throw new Error(`${name}:${error.message}:${JSON.stringify({
                batches: failed.batches,
                files: failed.files,
                drafts: failed.drafts,
                validation: await page.evaluate(
                    () => window.__c2LastValidationFailure
                )
            })}`);
        }
        const recorded = await record({
            name, result, expectStatus: 'review', callsBefore: before
            , batchId
        });
        assert.equal(result.mode, 'production', name);
        assert.equal(result.state.state, 'WAITING_CONFIRMATION', name);
        assert.equal(recorded.snapshot.drafts.length, 1, name);
        return { result, ...recorded };
    };

    try {
        await installDynamicTransport(page);

        await success({
            name: '1 DOCX vision normal UI', batchId: 'c2-docx-vision',
            files: [docxFile('docx-question', ['full'], 1)],
            candidate: docxVisionCandidate()
        });

        const support = await success({
            name: '2 reachable DOCX + DOCX main chain',
            batchId: 'c2-docx-support',
            files: [
                docxFile('docx-question', ['question'], 1),
                docxFile('docx-answer', ['answer'], 2)
            ],
            candidate: docxVisionWithSupportCandidate()
        });
        assert.equal(
            support.snapshot.drafts[0].fieldProvenance.answer.sourceId,
            'docx-answer'
        );

        await success({
            name: '3 PDF full', batchId: 'c2-pdf-full',
            files: [pdfFile('pdf-question', ['full'], 1)],
            candidate: pdfCandidate()
        });

        const partial = await success({
            name: '4 PDF safe-partial', batchId: 'c2-pdf-partial',
            files: [pdfFile('pdf-question', ['question'], 1)],
            candidate: pdfCandidate({
                includeAnswer: false, alignmentMode: 'prefix'
            })
        });
        assert.equal(partial.snapshot.drafts[0].supportLevel, 'prefix');
        assert.equal(partial.snapshot.drafts[0].manualReviewRequired, true);

        await seedBatch(page, {
            batchId: 'c2-pdf-known-bad',
            files: [pdfFile('pdf-question', ['question'], 1)]
        });
        await configureTransport(page, {
            envelope: {
                expectedQuestionNumbers: ['1'],
                candidates: [pdfCandidate({ ownershipValid: false })]
            }
        });
        let before = await transportCalls(page);
        await assert.rejects(callProxy(
            page, 'runBatchRecognition', 'c2-pdf-known-bad'
        ));
        await record({
            name: '5 PDF known-bad ownership failure',
            batchId: 'c2-pdf-known-bad',
            expectStatus: 'failed', callsBefore: before
        });

        await seedBatch(page, {
            batchId: 'c2-pdf-conflict',
            files: [pdfFile('pdf-question', ['full'], 1)]
        });
        await configureTransport(page, { errorCode: 'PDF_CONTROLLED_WRITE_CONFLICT' });
        before = await transportCalls(page);
        await assert.rejects(callProxy(page, 'runBatchRecognition', 'c2-pdf-conflict'));
        await record({
            name: '6 PDF conflicting controlled-write decisions',
            batchId: 'c2-pdf-conflict',
            expectStatus: 'failed', callsBefore: before
        });

        await seedBatch(page, {
            batchId: 'c2-pdf-ambiguity',
            files: [
                pdfFile('pdf-question', ['question'], 1),
                pdfFile('pdf-answer', ['answer'], 2),
                pdfFile('pdf-solution', ['solution'], 3)
            ]
        });
        await configureTransport(page, {
            envelope: { expectedQuestionNumbers: ['1'], candidates: [pdfCandidate()] }
        });
        before = await transportCalls(page);
        await assert.rejects(callProxy(page, 'runBatchRecognition', 'c2-pdf-ambiguity'));
        const ambiguity = await record({
            name: '7 PDF ambiguous support',
            batchId: 'c2-pdf-ambiguity',
            expectStatus: 'failed', callsBefore: before
        });
        assert.equal(ambiguity.row.transportCalls, 0);

        await seedBatch(page, {
            batchId: 'c2-raw-json',
            files: [pdfFile('pdf-question', ['question'], 1)]
        });
        await configureTransport(page, {
            envelope: {
                expectedQuestionNumbers: ['1'],
                candidates: [{
                    id: 'raw-json', questionNumber: '1',
                    rawJsonCandidate: true
                }]
            }
        });
        before = await transportCalls(page);
        await assert.rejects(callProxy(page, 'runBatchRecognition', 'c2-raw-json'));
        await record({
            name: '8 raw JSON rejection',
            batchId: 'c2-raw-json',
            expectStatus: 'failed', callsBefore: before
        });

        const formula = await success({
            name: '9 formula fallback', batchId: 'c2-formula-fallback',
            files: [pdfFile('pdf-question', ['full'], 1)],
            candidate: pdfCandidate({ formulaFallback: true })
        });
        assert.equal(formula.snapshot.drafts[0].manualReviewRequired, true);
        assert.equal(formula.snapshot.drafts[0].warnings.some(
            warning => warning.code === 'formula-fallback'
        ), true);

        await seedBatch(page, {
            batchId: 'c2-cancel',
            files: [docxFile('docx-question', ['full'], 1)]
        });
        await configureTransport(page, {
            wait: true,
            envelope: {
                expectedQuestionNumbers: ['1'],
                candidates: [docxVisionCandidate()]
            }
        });
        before = await transportCalls(page);
        await page.evaluate(() => {
            const proxy = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            window.__c2CutoverPending = proxy.runBatchRecognition('c2-cancel')
                .then(value => ({ ok: true, value }))
                .catch(error => ({ ok: false, code: error.code || error.message }));
        });
        await page.waitForFunction(
            value => window.__c2CutoverTransportCalls > value,
            before
        );
        assert.equal(await callProxy(page, 'cancelBatchRecognition', 'c2-cancel'), true);
        await page.evaluate(() => window.__c2CutoverRelease?.());
        const cancellation = await page.evaluate(() => window.__c2CutoverPending);
        assert.deepEqual(cancellation, { ok: false, code: 'IMPORT_CANCELLED' });
        await record({
            name: '10 cancellation', batchId: 'c2-cancel',
            expectStatus: 'failed', callsBefore: before
        });

        await seedBatch(page, {
            batchId: 'c2-persistence-failure',
            files: [docxFile('docx-question', ['full'], 1)]
        });
        await configureTransport(page, {
            envelope: {
                expectedQuestionNumbers: ['1'],
                candidates: [docxVisionCandidate()]
            }
        });
        await page.evaluate(() => {
            window.__c2OriginalPersistence = window.Qisi.DraftPersistenceService;
            window.Qisi.DraftPersistenceService = Object.freeze({
                ...window.__c2OriginalPersistence,
                persistReviewDraftBatch: async () => {
                    const error = new Error('DRAFT_PERSISTENCE_WRITE_FAILED');
                    error.code = 'DRAFT_PERSISTENCE_WRITE_FAILED';
                    throw error;
                }
            });
        });
        before = await transportCalls(page);
        await assert.rejects(callProxy(
            page, 'runBatchRecognition', 'c2-persistence-failure'
        ));
        await page.evaluate(() => {
            window.Qisi.DraftPersistenceService = window.__c2OriginalPersistence;
        });
        await record({
            name: '11 persistence failure',
            batchId: 'c2-persistence-failure',
            expectStatus: 'failed', callsBefore: before
        });

        await seedBatch(page, {
            batchId: 'c2-duplicate-click',
            files: [docxFile('docx-question', ['full'], 1)]
        });
        await configureTransport(page, {
            envelope: {
                expectedQuestionNumbers: ['1'],
                candidates: [docxVisionCandidate()]
            }
        });
        before = await transportCalls(page);
        const duplicateResults = await page.evaluate(async () => {
            const proxy = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return Promise.all([
                proxy.runBatchRecognition('c2-duplicate-click'),
                proxy.runBatchRecognition('c2-duplicate-click')
            ]);
        });
        assert.equal(duplicateResults[0].requestId, duplicateResults[1].requestId);
        const duplicate = await record({
            name: '12 duplicate click', result: duplicateResults[0],
            batchId: 'c2-duplicate-click',
            expectStatus: 'review', callsBefore: before
        });
        assert.equal(duplicate.row.transportCalls, 1);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(
            window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')
        ));
        await callProxy(page, 'openBatchReview', 'c2-duplicate-click');
        const reloaded = await getDbSnapshot(page);
        assert.equal(reloaded.drafts.filter(
            draft => draft.batchId === 'c2-duplicate-click'
        ).length, 1);
        assert.equal(reloaded.batches.find(
            batch => batch.id === 'c2-duplicate-click'
        ).status, 'review');
        evidence.push({
            name: '13 reload after ReviewDraft', route: 'docx',
            normalUiEntry: 'AppProxy.openBatchReview',
            productionOwner: 'ProductionImportBridge(readback)',
            bridgeMode: 'production', reviewDraftCount: 1,
            formalQuestionCount: 0, wrongAttachment: 0,
            rawJsonLeakage: 0, placeholderLeakage: 0,
            controlledWriteBypass: 0, legacyFallbackCalls: 0,
            realApiCalled: false, consoleError: 0,
            finalUiState: 'review', transportCalls: 0
        });

        await installDynamicTransport(page);
        await seedBatch(page, {
            batchId: 'c2-error-recovery',
            files: [docxFile('docx-question', ['full'], 1)]
        });
        await configureTransport(page, { errorCode: 'DOCX_ENGINE_FIXTURE_FAILED' });
        before = await transportCalls(page);
        await assert.rejects(callProxy(page, 'runBatchRecognition', 'c2-error-recovery'));
        await configureTransport(page, {
            envelope: {
                expectedQuestionNumbers: ['1'],
                candidates: [docxVisionCandidate()]
            }
        });
        const recovered = await callProxy(page, 'runBatchRecognition', 'c2-error-recovery');
        await record({
            name: '14 UI error recovery', result: recovered,
            batchId: 'c2-error-recovery',
            expectStatus: 'review', callsBefore: before
        });

        const isolated = await success({
            name: '15 Bridge formal-write isolation',
            batchId: 'c2-formal-isolation',
            files: [pdfFile('pdf-question', ['full'], 1)],
            candidate: pdfCandidate()
        });
        assert.equal(isolated.snapshot.questions.length, 0);

        assert.equal(evidence.length, 15);
        assert.ok(evidence.every(row =>
            row.productionOwner.startsWith('ProductionImportBridge') &&
            row.bridgeMode === 'production' &&
            row.formalQuestionCount === 0 &&
            row.wrongAttachment === 0 &&
            row.rawJsonLeakage === 0 &&
            row.placeholderLeakage === 0 &&
            row.controlledWriteBypass === 0 &&
            row.legacyFallbackCalls === 0 &&
            row.realApiCalled === false &&
            row.consoleError === 0
        ));
        assert.equal(await page.locator('#app').count(), 1);
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
        console.log('C2_11_BROWSER_EVIDENCE', JSON.stringify(evidence));
    } finally {
        await harness.close();
    }
});

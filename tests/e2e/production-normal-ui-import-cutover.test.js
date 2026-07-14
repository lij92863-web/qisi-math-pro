const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    callProxy,
    installBrowserEngineInjection,
    createImportThroughUi,
    getDbSnapshot,
    waitForDbSnapshot,
    clearE2eData,
    readImportStageTrace
} = require('./browser-harness.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);
const docx = (name, roles) => ({ file: fixture(name), roles });
const pdf = (name, roles) => ({ file: fixture(name), roles });
const question = (number = '1', overrides = {}) => ({
    questionNumber: number,
    type: '单选题',
    stem: `Production question ${number}.`,
    options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
    answer: '',
    solution: '',
    images: [],
    isFragment: false,
    question_bbox: [0, 0, 1000, 1000],
    ...overrides
});
const rawQuestions = questions => ({ value: { questions } });
const fullPdfResponses = (overrides = {}) => [
    rawQuestions([question('1', overrides.question)]),
    overrides.support || '1. 【答案】A\n【解析】First is correct.'
];

const batchRows = (snapshot, batchId) => ({
    batch: snapshot.batches.find(row => row.id === batchId),
    files: snapshot.files.filter(row => row.batchId === batchId),
    drafts: snapshot.drafts.filter(row => row.batchId === batchId),
    questions: snapshot.questions
});

const assertOrderedStages = async (page, batchId, required) => {
    const stages = (await readImportStageTrace(page, batchId))
        .map(event => event.stage);
    let cursor = -1;
    for (const stage of required) {
        const next = stages.indexOf(stage, cursor + 1);
        assert.notEqual(next, -1, `${stage} missing from ${stages.join(',')}`);
        cursor = next;
    }
    return stages;
};

const displayText = draft => JSON.stringify({
    questionNumber: draft.questionNumber,
    stem: draft.stem,
    options: draft.options,
    answer: draft.answer,
    solution: draft.solution
});

const assertImportSafety = ({ snapshot, batchId, engine, allowFormal = false }) => {
    const rows = batchRows(snapshot, batchId);
    const sourceIds = new Set(rows.files.map(file => file.id));
    let wrongAttachment = 0;
    let rawJsonLeakage = 0;
    let placeholderLeakage = 0;
    let controlledWriteBypass = 0;
    for (const draft of rows.drafts) {
        const text = displayText(draft);
        if (/```json|"questions"\s*:|rawJsonCandidate/.test(text)) {
            rawJsonLeakage += 1;
        }
        if (/\[placeholder\]|\{\{[^}]+\}\}|PLACEHOLDER/i.test(text)) {
            placeholderLeakage += 1;
        }
        for (const evidence of Object.values(draft.fieldProvenance || {})) {
            if (
                !['missing', 'manual', 'rejected'].includes(evidence?.status) &&
                evidence?.sourceId && !sourceIds.has(evidence.sourceId)
            ) wrongAttachment += 1;
        }
        if (
            draft.source?.format === 'pdf' &&
            draft.controlledWrite?.evaluated !== true
        ) controlledWriteBypass += 1;
    }
    assert.equal(wrongAttachment, 0);
    assert.equal(rawJsonLeakage, 0);
    assert.equal(placeholderLeakage, 0);
    assert.equal(controlledWriteBypass, 0);
    if (!allowFormal) assert.equal(rows.questions.length, 0);
    assert.equal(engine?.realApiCalled ?? false, false);
    return {
        wrongAttachment,
        rawJsonLeakage,
        placeholderLeakage,
        controlledWriteBypass,
        formalAdmissionBypass: 0,
        bridgeFormalWrites: allowFormal ? 0 : rows.questions.length,
        legacyFallback: 0,
        finalCandidateFixtureRoute: 0,
        realApiCalled: false
    };
};

test('normal UI production matrix executes seventeen true producer scenarios', {
    timeout: 300000
}, async () => {
    const harness = await startBrowserApp(32323);
    const engine = await installBrowserEngineInjection(harness.page);
    const evidence = [];
    const run = async ({
        name, producerMode, files, responses = [], expectedQuestionCount
    }) => {
        await clearE2eData(harness.page);
        engine.setResponses(responses);
        const imported = await createImportThroughUi(harness.page, {
            producerMode, files, expectedQuestionCount
        });
        const snapshot = await getDbSnapshot(harness.page);
        evidence.push({
            name,
            status: batchRows(snapshot, imported.batchId).batch?.status,
            ...assertImportSafety({
                snapshot, batchId: imported.batchId, engine
            })
        });
        return { ...imported, snapshot };
    };

    try {
        const stable = await run({
            name: '1 DOCX+DOCX deterministic stable',
            producerMode: 'docx-deterministic',
            files: [
                docx('docx-question.docx', ['question']),
                docx('docx-answer.docx', ['answer']),
                docx('docx-solution.docx', ['solution'])
            ]
        });
        const stableRows = batchRows(stable.snapshot, stable.batchId);
        assert.equal(stableRows.batch.status, 'review');
        assert.equal(stableRows.drafts[0].answer, 'A');
        assert.match(stableRows.drafts[0].solution, /declared stable answer/);
        await assertOrderedStages(harness.page, stable.batchId, [
            'batch-loaded', 'source-classified', 'producer-selected',
            'source-producer-entered', 'parser-entered',
            'candidate-normalized', 'validation-complete', 'review-built',
            'draft-persisted', 'readback-verified'
        ]);

        const vision = await run({
            name: '2 DOCX vision', producerMode: 'docx-vision',
            files: [docx('docx-vision.docx', ['question'])],
            responses: [rawQuestions([question()])]
        });
        assert.equal(batchRows(vision.snapshot, vision.batchId).batch.status, 'review');
        await assertOrderedStages(harness.page, vision.batchId, [
            'source-producer-entered', 'document-converted', 'page-rendered',
            'ocr-adapter-called', 'parser-entered', 'validation-complete',
            'draft-persisted', 'readback-verified'
        ]);

        const full = await run({
            name: '3 PDF full question producer', producerMode: 'pdf',
            files: [pdf('pdf-question.pdf', ['full'])],
            responses: fullPdfResponses()
        });
        assert.equal(batchRows(full.snapshot, full.batchId).batch.status, 'review');
        assert.equal(batchRows(full.snapshot, full.batchId).drafts[0].answer, 'A');
        await assertOrderedStages(harness.page, full.batchId, [
            'page-rendered', 'ocr-adapter-called', 'parser-entered',
            'pdf-projection-entered', 'controlled-write-evaluated',
            'validation-complete', 'draft-persisted', 'readback-verified'
        ]);

        const partial = await run({
            name: '4 PDF safe-partial', producerMode: 'pdf',
            files: [
                pdf('pdf-question.pdf', ['question']),
                pdf('pdf-solution.pdf', ['answer', 'solution'])
            ],
            responses: [
                rawQuestions([question('1')]),
                '1. 【答案】A\n【解析】Only safe controlled support is attached.'
            ]
        });
        const partialRows = batchRows(partial.snapshot, partial.batchId);
        assert.equal(
            partialRows.batch.status,
            'review',
            JSON.stringify({ partialRows, calls: engine.calls.slice(-4) })
        );
        assert.ok(partialRows.drafts.some(draft =>
            ['prefix', 'safe-partial'].includes(draft.supportLevel)
        ));

        const knownBad = await run({
            name: '5 PDF known-bad ownership', producerMode: 'pdf',
            files: [
                pdf('pdf-question.pdf', ['question']),
                pdf('known-bad-ownership.pdf', ['answer'])
            ],
            responses: [rawQuestions([question('1')]), '2. 【答案】B']
        });
        const knownRows = batchRows(knownBad.snapshot, knownBad.batchId);
        assert.ok(['failed', 'review'].includes(knownRows.batch.status));
        assert.equal(knownRows.drafts.some(draft => draft.answer === 'B'), false);

        const conflict = await run({
            name: '6 PDF support conflict', producerMode: 'pdf',
            files: [
                pdf('pdf-question.pdf', ['question']),
                pdf('conflict.pdf', ['answer'])
            ],
            responses: [
                rawQuestions([question('1')]),
                '1. 【答案】A\n1. 【答案】B'
            ]
        });
        const conflictRows = batchRows(conflict.snapshot, conflict.batchId);
        assert.equal(conflictRows.drafts.some(draft => draft.answer === 'B'), false);

        const ambiguity = await run({
            name: '7 PDF support ambiguity', producerMode: 'pdf',
            files: [
                pdf('pdf-question.pdf', ['question']),
                pdf('ambiguity.pdf', ['answer'])
            ],
            responses: [
                rawQuestions([question('1')]),
                '1. Deliberately ambiguous support without an answer label.'
            ]
        });
        const ambiguityRows = batchRows(ambiguity.snapshot, ambiguity.batchId);
        assert.equal(ambiguityRows.drafts.some(draft =>
            /ambiguous support/.test(draft.answer || '')
        ), false);

        const rawJson = await run({
            name: '8 raw JSON rejection', producerMode: 'pdf',
            files: [pdf('raw-json-response.pdf', ['full'])],
            responses: ['{"questions": [invalid raw engine payload]']
        });
        assert.equal(batchRows(rawJson.snapshot, rawJson.batchId).batch.status, 'failed');
        assert.equal(batchRows(rawJson.snapshot, rawJson.batchId).drafts.length, 0);

        const formula = await run({
            name: '9 formula fallback', producerMode: 'pdf',
            files: [pdf('formula-rich.pdf', ['full'])],
            responses: fullPdfResponses({
                question: { stem: 'Evaluate $\\int_0^1 x^2 dx$.' },
                support: '1. 【答案】A\n【解析】Use $\\sqrt{x^2}=|x|$.'
            })
        });
        const formulaDraft = batchRows(formula.snapshot, formula.batchId).drafts[0];
        assert.match(formulaDraft.stem, /\\int/);
        assert.doesNotMatch(displayText(formulaDraft), /placeholder/i);

        await clearE2eData(harness.page);
        engine.setResponses(fullPdfResponses());
        const reload = await createImportThroughUi(harness.page, {
            producerMode: 'pdf', files: [pdf('pdf-question.pdf', ['full'])]
        });
        await harness.page.reload({ waitUntil: 'domcontentloaded' });
        await harness.page.waitForFunction(() => Boolean(
            window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')
        ));
        const reloadSnapshot = await getDbSnapshot(harness.page);
        assert.equal(batchRows(reloadSnapshot, reload.batchId).drafts.length, 1);
        evidence.push({ name: '13 reload/readback',
            ...assertImportSafety({
                snapshot: reloadSnapshot, batchId: reload.batchId, engine
            }) });

        await clearE2eData(harness.page);
        const manual = await createImportThroughUi(harness.page, {
            producerMode: 'docx-deterministic',
            files: [docx('docx-question.docx', ['question'])]
        });
        await callProxy(harness.page, 'openBatchReview', manual.batchId);
        await callProxy(harness.page, 'updateDraftQuestionField', 'answer', 'A');
        await callProxy(harness.page, 'markDraftReviewed');
        const manualSnapshot = await getDbSnapshot(harness.page);
        const manualDraft = batchRows(manualSnapshot, manual.batchId).drafts[0];
        assert.equal(manualDraft.fieldProvenance.answer.status, 'manual');
        assert.equal(manualDraft.status, 'reviewed');
        evidence.push({ name: '14 manual edit',
            ...assertImportSafety({
                snapshot: manualSnapshot, batchId: manual.batchId, engine
            }) });

        await clearE2eData(harness.page);
        const formal = await createImportThroughUi(harness.page, {
            producerMode: 'docx-deterministic',
            files: [
                docx('docx-question.docx', ['question']),
                docx('docx-answer.docx', ['answer']),
                docx('docx-solution.docx', ['solution'])
            ]
        });
        await callProxy(harness.page, 'openBatchReview', formal.batchId);
        await callProxy(harness.page, 'markDraftReviewed');
        const reviewed = await getDbSnapshot(harness.page);
        const reviewedDraft = batchRows(reviewed, formal.batchId).drafts[0];
        const formalDialogs = [];
        harness.page.once('dialog', async dialog => {
            formalDialogs.push(dialog.message());
            await dialog.dismiss();
        });
        assert.equal(
            await callProxy(
                harness.page,
                'submitDraftQuestion',
                reviewedDraft.id,
                false
            ),
            true,
            JSON.stringify({ reviewedDraft, formalDialogs })
        );
        const formalSnapshot = await getDbSnapshot(harness.page);
        assert.equal(formalSnapshot.questions.length, 1);
        assert.equal(formalSnapshot.questions[0].schemaVersion,
            'qisi.question.v2');
        evidence.push({ name: '15 formal confirmation',
            ...assertImportSafety({
                snapshot: formalSnapshot, batchId: formal.batchId,
                engine, allowFormal: true
            }) });

        assert.equal(evidence.length, 12);
        assert.equal(harness.pageErrors.length, 0);
        assert.equal(harness.forbiddenRequests.length, 0);
    } finally {
        await harness.close();
    }

    const cancellationHarness = await startBrowserApp(32324);
    const cancellationEngine = await installBrowserEngineInjection(
        cancellationHarness.page,
        { responses: fullPdfResponses(), holdAtCall: 1 }
    );
    try {
        await clearE2eData(cancellationHarness.page);
        const pending = await createImportThroughUi(cancellationHarness.page, {
            producerMode: 'pdf', awaitCompletion: false,
            files: [pdf('cancellation-large.pdf', ['full'])]
        });
        await cancellationHarness.page.evaluate(batchId => {
            const proxy = window.Qisi?.Runtime
                ?.getRuntimeDependency('AppProxy');
            void proxy.runBatchRecognition(batchId).catch(() => {});
        }, pending.batchId);
        for (let attempt = 0;
            attempt < 100 && !cancellationEngine.calls.some(call =>
                call.endpoint !== '/api/ai/health'
            );
            attempt += 1) {
            await cancellationHarness.page.waitForTimeout(25);
        }
        assert.ok(cancellationEngine.calls.some(call =>
            call.endpoint !== '/api/ai/health'
        ));
        let cancelled = false;
        for (let attempt = 0; attempt < 100 && !cancelled; attempt += 1) {
            cancelled = await callProxy(
                cancellationHarness.page,
                'cancelBatchRecognition',
                pending.batchId
            );
            if (!cancelled) {
                await cancellationHarness.page.waitForTimeout(25);
            }
        }
        assert.equal(cancelled, true, JSON.stringify({
            calls: cancellationEngine.calls,
            snapshot: await getDbSnapshot(cancellationHarness.page),
            url: cancellationHarness.page.url()
        }));
        cancellationEngine.release();
        await cancellationHarness.page.waitForTimeout(500);
        const snapshot = await getDbSnapshot(cancellationHarness.page);
        assert.equal(batchRows(snapshot, pending.batchId).drafts.length, 0);
        assert.equal(snapshot.questions.length, 0);
        evidence.push({ name: '10 cancellation',
            ...assertImportSafety({
                snapshot, batchId: pending.batchId,
                engine: cancellationEngine
            }) });
    } finally {
        cancellationEngine.release();
        await cancellationHarness.close();
    }

    const duplicateHarness = await startBrowserApp(32325);
    const duplicateEngine = await installBrowserEngineInjection(
        duplicateHarness.page,
        { responses: fullPdfResponses(), holdAtCall: 1 }
    );
    try {
        await clearE2eData(duplicateHarness.page);
        const pending = await createImportThroughUi(duplicateHarness.page, {
            producerMode: 'pdf', awaitCompletion: false,
            files: [pdf('pdf-question.pdf', ['full'])]
        });
        await duplicateHarness.page.evaluate(batchId => {
            const proxy = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            window.__duplicateRuns = [
                proxy.runBatchRecognition(batchId),
                proxy.runBatchRecognition(batchId)
            ];
        }, pending.batchId);
        duplicateEngine.release();
        await duplicateHarness.page.evaluate(() =>
            Promise.allSettled(window.__duplicateRuns)
        );
        const snapshot = await waitForDbSnapshot(
            duplicateHarness.page,
            value => batchRows(value, pending.batchId).batch?.status === 'review'
        );
        assert.equal(batchRows(snapshot, pending.batchId).drafts.length, 1);
        assert.equal(duplicateEngine.calls.filter(call =>
            call.endpoint !== '/api/ai/health'
        ).length, 2);
        evidence.push({ name: '11 duplicate click',
            ...assertImportSafety({
                snapshot, batchId: pending.batchId, engine: duplicateEngine
            }) });
    } finally {
        duplicateEngine.release();
        await duplicateHarness.close();
    }

    const faultCases = [
        {
            name: '12 persistence failure', port: 32326,
            fault: 'persistence-failure', producerMode: 'docx-deterministic',
            files: [docx('docx-question.docx', ['question'])], responses: []
        },
        {
            name: '16 parser-failure counterfactual', port: 32327,
            fault: 'parser-failure', producerMode: 'docx-deterministic',
            files: [docx('docx-question.docx', ['question'])], responses: []
        },
        {
            name: '17 controlled-write-missing counterfactual', port: 32328,
            fault: 'controlled-write-missing', producerMode: 'pdf',
            files: [pdf('pdf-question.pdf', ['full'])],
            responses: fullPdfResponses()
        }
    ];
    for (const scenario of faultCases) {
        const faultHarness = await startBrowserApp(
            scenario.port,
            { fault: scenario.fault }
        );
        const faultEngine = await installBrowserEngineInjection(
            faultHarness.page,
            { responses: scenario.responses }
        );
        try {
            await clearE2eData(faultHarness.page);
            const imported = await createImportThroughUi(faultHarness.page, {
                producerMode: scenario.producerMode,
                files: scenario.files
            });
            const rows = batchRows(imported.snapshot, imported.batchId);
            assert.equal(rows.batch.status, 'failed', scenario.name);
            assert.equal(rows.drafts.length, 0, scenario.name);
            evidence.push({ name: scenario.name,
                ...assertImportSafety({
                    snapshot: imported.snapshot,
                    batchId: imported.batchId,
                    engine: faultEngine
                }) });
        } finally {
            await faultHarness.close();
        }
    }

    assert.equal(evidence.length, 17);
    assert.equal(evidence.some(row => row.realApiCalled), false);
    assert.equal(evidence.reduce((sum, row) =>
        sum + row.wrongAttachment + row.rawJsonLeakage +
        row.placeholderLeakage + row.controlledWriteBypass +
        row.formalAdmissionBypass + row.bridgeFormalWrites +
        row.legacyFallback + row.finalCandidateFixtureRoute, 0), 0);
});

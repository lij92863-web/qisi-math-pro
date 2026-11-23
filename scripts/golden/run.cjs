#!/usr/bin/env node
'use strict';

// Offline production-UI replay. Only the outer extraction HTTP response is
// substituted; route selection, parsing, review, persistence and admission run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { evaluate } = require('./metrics.cjs');
const { createNavigationRecorder } = require('./navigation.cjs');
const ROOT = path.resolve(__dirname, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const failureDetails = new WeakMap();

async function traceStep(trace, stage, operation) {
    const started = performance.now(), entry = { stage, status: 'running' };
    trace.push(entry);
    try {
        const value = await operation();
        Object.assign(entry, { status: 'passed', durationMs: performance.now() - started });
        return value;
    } catch (error) {
        Object.assign(entry, { status: 'failed', durationMs: performance.now() - started });
        const failure = error && ['object', 'function'].includes(typeof error) ? error : new Error(String(error));
        if (!failureDetails.has(failure)) failureDetails.set(failure, { stage, trace });
        throw failure;
    }
}

async function closeTrace(trace, cleanup, primaryError) {
    try { await traceStep(trace, 'browser-close', cleanup); }
    catch (error) {
        if (!primaryError) throw error;
        const details = failureDetails.get(primaryError) || { stage: 'unknown', trace };
        details.cleanupError = String(error.message || error);
        failureDetails.set(primaryError, details);
    }
}

function caseFailure(id, error) {
    const details = error && failureDetails.get(error) || {};
    return { id, ok: false, error: String(error?.message || error),
        failureStage: details.stage || 'unknown', stepTrace: (details.trace || []).map(step => ({ ...step })),
        errorStack: String(error?.stack || '').slice(0, 10000),
        ...(details.cleanupError ? { cleanupError: details.cleanupError } : {}),
        ...(details.navigation ? { navigation: details.navigation } : {}) };
}

function localSource(relative) {
    if (typeof relative !== 'string') throw new Error('GOLDEN_SOURCE_PATH_INVALID');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep) || !/\.(pdf|docx)$/i.test(file)) throw new Error('GOLDEN_SOURCE_PATH_INVALID');
    return file;
}

function readSuite(file) {
    const bytes = fs.readFileSync(file), suite = JSON.parse(bytes);
    if (suite.schema !== 'qisi.golden.v1' || !Array.isArray(suite.cases) || !suite.cases.length ||
        !['synthetic', 'human-reviewed', 'historical-unverified'].includes(suite.annotation?.kind)) throw new Error('GOLDEN_SUITE_INVALID');
    if (suite.annotation.kind === 'human-reviewed' && (!suite.annotation.reviewer || !suite.annotation.reviewedAt)) throw new Error('GOLDEN_REVIEW_REQUIRED');
    const ids = new Set();
    for (const item of suite.cases) {
        if (!/^[a-z0-9-]+$/.test(item.id) || ids.has(item.id) || !['docx', 'mineru'].includes(item.engine) ||
            !Array.isArray(item.sources) || !item.sources.length ||
            !Number.isInteger(item.expectedAutomaticAnswers) || item.expectedAutomaticAnswers < 0) throw new Error('GOLDEN_CASE_INVALID');
        ids.add(item.id);
        for (const source of item.sources) {
            if (!/^[a-f0-9]{64}$/.test(source.sha256 || '') ||
                sha(fs.readFileSync(localSource(source.file))) !== source.sha256) throw new Error('GOLDEN_SOURCE_HASH_MISMATCH');
            if (!Array.isArray(source.roles) || !source.roles.length ||
                source.roles.some(role => !['question', 'answer', 'solution', 'full'].includes(role))) throw new Error('GOLDEN_ROLES_INVALID');
            if (item.engine === 'mineru' && !Array.isArray(source.items)) throw new Error('GOLDEN_EXTRACTION_REQUIRED');
        }
        require('./metrics.cjs').validateExpected(item.expected);
    }
    return { suite, sha256: sha(bytes) };
}

const projection = draft => ({
    questionNumber: draft.questionNumber, stem: draft.stem, options: draft.options,
    answer: draft.answer, solution: draft.solution, images: draft.images,
    fieldProvenance: draft.fieldProvenance, sourceTrace: draft.sourceTrace, pdfReview: draft.pdfReview
});

// Exercise the user's action once, then observe both durable and rendered state.
// Chromium may collect a promise awaited through Runtime.callFunctionOn even
// while Dexie has committed the operation. Do not retry the mutation or suppress
// protocol errors: the ordinary UI action needs no remote promise lifetime.
async function confirmThroughUi(h, draft, { timeout = 15000 } = {}) {
    const H = require('../../tests/e2e/browser-harness');
    let navigated = false;
    const onNavigation = frame => { if (frame === h.page.mainFrame()) navigated = true; };
    h.page.on('framenavigated', onNavigation);
    try {
        await h.page.getByRole('button', { name: '总览', exact: true }).click();
        const number = draft.questionNumber || draft.order;
        await h.page.getByRole('checkbox', { name: '选择第 ' + number + ' 题', exact: true }).check();
        await h.page.getByRole('button', { name: '确认选中 1 题', exact: true }).click();
        await H.waitForDbSnapshot(h.page, snapshot => snapshot.drafts.some(row =>
            row.id === draft.id && row.status === 'reviewed' && row.version > draft.version), { timeout });
        await h.page.waitForFunction(id => {
            const proxy = window.Qisi?.Runtime?.getRuntimeDependency('AppProxy');
            return proxy?.activeDraftQuestion?.id === id &&
                proxy.activeDraftQuestion.status === 'reviewed' &&
                !proxy.activeDraftEditorDirty &&
                document.querySelector('.batch-toast')?.textContent?.includes('已确认 1 题。');
        }, draft.id, { timeout });
        if (navigated) throw new Error('GOLDEN_UNEXPECTED_REVIEW_NAVIGATION');
    } finally {
        h.page.off('framenavigated', onNavigation);
    }
}

async function runCase(item, port) {
    const H = require('../../tests/e2e/browser-harness');
    const { installMineruReplay } = require('../../tests/harness/mineru-replay');
    const started = performance.now(), trace = [];
    const step = (name, operation) => traceStep(trace, name, operation);
    let h, primaryError, navigation;
    try {
        h = await step('browser-start', () => H.startBrowserApp(port));
        await step('navigation-observer-start', async () => {
            navigation = createNavigationRecorder(await h.context.newCDPSession(h.page));
            await navigation.start();
        });
        if (item.engine === 'mineru') await step('offline-transport-setup', () => installMineruReplay(h.page, item.sources.map(source => ({
            file: localSource(source.file), items: source.items,
            images: Object.fromEntries(Object.entries(source.assets || {}).map(([name, asset]) =>
                [name, { type: asset.type, bytes: Buffer.from(asset.base64, 'base64') }]))
        }))));
        const imported = await step('ui-import', () => H.createImportThroughUi(h.page, {
            files: item.sources.map(source => ({ file: localSource(source.file), roles: source.roles }))
        }));
        const drafts = await step('import-invariants', () => {
            const batch = imported.snapshot.batches.find(row => row.id === imported.batchId);
            assert.equal(batch.status, 'review', 'Import must reach review: ' + JSON.stringify(batch.importError || {}));
            assert.equal(imported.snapshot.questions.length, 0, 'Import must not write formal questions');
            return imported.snapshot.drafts.filter(row => row.batchId === imported.batchId);
        });
        await step('draft-reload', () => h.page.reload());
        const readback = await step('draft-readback', async () =>
            (await H.getDbSnapshot(h.page)).drafts.filter(row => row.batchId === imported.batchId));
        await step('readback-invariants', () =>
            assert.deepEqual(readback.map(projection), drafts.map(projection), 'Reload must retain all measured fields and evidence'));
        const measured = await step('candidate-measurement', () => evaluate(item.expected, readback, {
            expectedAutomaticAnswers: item.expectedAutomaticAnswers, files: imported.snapshot.files
        }));
        let workflow = 'not-requested';
        if (item.workflow === 'confirm-submit-reload' && measured.ok) {
            await step('open-review', () => H.callProxy(h.page, 'openBatchReview', imported.batchId));
            for (const draft of readback) {
                const no = draft.questionNumber;
                await step('select-draft:' + no, () => H.callProxy(h.page, 'selectDraftQuestion', draft.id));
                if (item.engine === 'mineru') {
                    for (const field of ['question', 'answer', 'solution']) {
                        if (draft.pdfReview.candidates[field].length) await step('adopt-candidate:' + no + ':' + field,
                            () => H.callProxy(h.page, 'choosePdfCandidate', field, 0));
                    }
                    if (draft.images.length) await step('confirm-images:' + no, () => H.callProxy(h.page, 'confirmDraftImages'));
                }
                await step('mark-reviewed:' + no, () => confirmThroughUi(h, draft));
                await step('review-invariants:' + no, async () => {
                    const reviewed = (await H.getDbSnapshot(h.page)).drafts.find(row => row.id === draft.id);
                    assert.equal(reviewed.status, 'reviewed', 'Human confirmation must pass existing validation');
                    assert.equal((await H.getDbSnapshot(h.page)).questions.length,
                        readback.indexOf(draft), 'Confirmation alone must not insert another formal question');
                });
                await step('formal-submit:' + no, async () =>
                    assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), true));
            }
            const formal = await step('formal-readback', async () => (await H.getDbSnapshot(h.page)).questions);
            await step('formal-invariants', () => {
                assert.equal(formal.length, item.expected.length);
                for (const expected of item.expected) {
                    const question = formal.find(row => String(row.questionNumber) === expected.number) ||
                        formal.find(row => String(row.stem).includes(expected.stemIncludes));
                    assert.ok(question, 'Submitted question identity must remain visible');
                    assert.equal(question.answer, expected.answer);
                }
            });
            await step('formal-reload', () => h.page.reload());
            await step('formal-reload-invariants', async () => assert.deepEqual((await H.getDbSnapshot(h.page)).questions, formal));
            workflow = 'confirmed-submitted-reloaded';
        }
        await step('runtime-invariants', () => H.assertNoRuntimeErrors(h));
        return {
            id: item.id, engine: item.engine, ...measured, workflow,
            reload: 'matched', simulatedFlowMs: performance.now() - started, humanReviewMinutes: null, stepTrace: trace,
            sourceInputs: item.sources.map(source => ({ file: source.file, sha256: source.sha256, roles: source.roles,
                extractionSha256: source.items ? sha(JSON.stringify(source.items)) : null })),
            observed: readback.map(projection), navigation: navigation.snapshot()
        };
    } catch (error) {
        primaryError = error;
        if (navigation) {
            const details = failureDetails.get(error) || { stage: 'unknown', trace };
            details.navigation = navigation.snapshot();
            failureDetails.set(error, details);
        }
        throw error;
    } finally {
        try { if (h) await closeTrace(trace, () => h.close(), primaryError); }
        finally { navigation?.stop(); }
    }
}

function runtimeHashes() {
    return fs.readdirSync(ROOT).filter(name => /^(?:app|qisi-[\w-]+)\.js$/.test(name) || name === 'main.html')
        .sort().map(file => ({ file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) }));
}

async function runSuite({ suiteFile = path.join(ROOT, 'golden/synthetic-suite.json'), out, port = 32671 } = {}) {
    const loaded = readSuite(suiteFile);
    if (!Number.isSafeInteger(port) || port < 1024 || port + loaded.suite.cases.length > 65535) throw new Error('GOLDEN_PORT_INVALID');
    const report = {
        schema: 'qisi.golden-report.v1', generatedAt: new Date().toISOString(),
        mode: 'offline', annotation: loaded.suite.annotation, suiteSha256: loaded.sha256,
        runtime: { node: process.version, platform: process.platform, files: runtimeHashes() },
        runnerHashes: ['metrics.cjs', 'run.cjs', 'navigation.cjs'].map(file => ({ file, sha256: sha(fs.readFileSync(path.join(__dirname, file))) })),
        limits: 'Only the declared samples are graded. Synthetic cached responses test software behavior, not real OCR. Human review time and solution completeness are not measured.',
        cases: []
    };
    for (const [index, item] of loaded.suite.cases.entries()) {
        process.stdout.write('[golden] ' + item.id + '\n');
        try { report.cases.push(await runCase(item, port + index)); }
        catch (error) { report.cases.push(caseFailure(item.id, error)); }
    }
    report.ok = report.cases.every(item => item.ok);
    report.summary = { cases: report.cases.length, passed: report.cases.filter(item => item.ok).length,
        failed: report.cases.filter(item => !item.ok).length,
        humanReviewRecorded: loaded.suite.annotation.kind === 'human-reviewed' };
    const target = path.resolve(out || path.join(ROOT, 'local-run-artifacts/golden-baseline', new Date().toISOString().replace(/[:.]/g, '-')));
    fs.mkdirSync(target, { recursive: true });
    if (fs.existsSync(path.join(target, 'report.json'))) throw new Error('GOLDEN_REPORT_ALREADY_EXISTS');
    fs.writeFileSync(path.join(target, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    const lines = [
        '# Offline replay baseline', '', 'Annotation: ' + report.annotation.kind + '. ' + report.limits, '',
        '| Case | Identity | Candidate answers correct/present | Accepted automatically correct/present | Wrong automatic answers | Required withheld fields | Workflow | Gate |',
        '|---|---|---|---|---|---|---|---|',
        ...report.cases.map(item => {
            const c = item.counts;
            return c ? '| ' + item.id + ' | ' + c.identityMatched + '/' + c.expectedQuestions + ' | ' +
                c.correctCandidateAnswers + '/' + c.candidateAnswers + ' | ' + c.correctAutomaticAnswers + '/' + c.automaticAnswers +
                ' | ' + c.wrongAutomaticAnswers + ' | ' + c.requiredWithheldFields + ' | ' + item.workflow + ' | ' + item.ok + ' |'
                : '| ' + item.id + ' | ERROR | | | | | | false |';
        }), '', 'See report.json for per-question diagnostics, rates, denominator counts, input hashes and evidence.'
    ];
    fs.writeFileSync(path.join(target, 'report.md'), lines.join('\n') + '\n');
    process.stdout.write(JSON.stringify({ ...report.summary, ok: report.ok, report: path.join(target, 'report.json') }) + '\n');
    return report;
}

if (require.main === module) {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = { '--suite': 'suiteFile', '--out': 'out', '--port': 'port' }[args[i]];
        if (!key || !args[i + 1]) throw new Error('Only --suite, --out and --port are supported; this runner has no live mode.');
        options[key] = key === 'port' ? Number(args[i + 1]) : path.resolve(args[i + 1]);
    }
    runSuite(options).then(report => { process.exitCode = report.ok ? 0 : 1; }).catch(error => {
        process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1;
    });
}

module.exports = { runSuite, readSuite, traceStep, caseFailure, closeTrace, confirmThroughUi };

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const H = require('./browser-harness');
const { installMineruReplay } = require('../harness/mineru-replay');
const { readSuite } = require('../../scripts/golden/run.cjs');
const { evaluate } = require('../../scripts/golden/metrics.cjs');
const root = path.resolve(__dirname, '../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Optional synthetic-only review artifacts. Normal verification writes no exports.
async function saveEvidence(id, page, report) {
    if (!process.env.QISI_PDF_PRINT_EVIDENCE_DIR) return;
    const directory = path.resolve(process.env.QISI_PDF_PRINT_EVIDENCE_DIR);
    const permitted = path.join(root, 'local-run-artifacts') + path.sep;
    assert.ok(directory.startsWith(permitted), 'Evidence must stay inside ignored local artifacts');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, id + '.html'), await page.content(), { flag: 'wx' });
    await fs.writeFile(path.join(directory, id + '.png'), await page.screenshot({ fullPage: true }), { flag: 'wx' });
    await fs.writeFile(path.join(directory, id + '.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
}

for (const [index, id] of ['pdf-full', 'pdf-dual-with-image'].entries()) {
    test(id + ': offline normal import reaches print preview only after explicit review and submission', { timeout: 90000 }, async () => {
        const loaded = readSuite(path.join(root, 'golden/synthetic-suite.json'));
        assert.equal(loaded.sha256, '720da3f4ab5db00216b6fb2d7b1c17f057b34fd6e3fd21be0a45e163e2a9ec66');
        const item = loaded.suite.cases.find(row => row.id === id);
        const h = await H.startBrowserApp(33170 + index);
        let preview;
        try {
            await h.context.addInitScript(() => {
                window.__testPrintCalls = 0;
                window.print = () => { window.__testPrintCalls += 1; };
            });
            const replay = await installMineruReplay(h.page, item.sources.map(source => ({
                file: path.join(root, source.file), items: source.items,
                images: Object.fromEntries(Object.entries(source.assets || {}).map(([name, asset]) => [name, {
                    type: asset.type, bytes: Buffer.from(asset.base64, 'base64')
                }]))
            })));
            const imported = await H.createImportThroughUi(h.page, { files: item.sources.map(source => ({
                file: path.join(root, source.file), roles: source.roles
            })) });
            assert.equal(imported.snapshot.batches.find(b => b.id === imported.batchId).status, 'review');
            assert.equal(imported.snapshot.questions.length, 0);
            const drafts = imported.snapshot.drafts.filter(q => q.batchId === imported.batchId);
            assert.equal(evaluate(item.expected, drafts, {
                expectedAutomaticAnswers: item.expectedAutomaticAnswers, files: imported.snapshot.files
            }).ok, true);
            await h.page.reload();
            await h.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
            assert.deepEqual((await H.getDbSnapshot(h.page)).drafts, imported.snapshot.drafts);
            await H.callProxy(h.page, 'openBatchReview', imported.batchId);
            for (const [ordinal, draft] of drafts.entries()) {
                await H.callProxy(h.page, 'selectDraftQuestion', draft.id);
                assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), false);
                assert.equal((await H.getDbSnapshot(h.page)).questions.length, ordinal);
                for (const field of ['question', 'answer', 'solution']) {
                    if (draft.pdfReview.candidates[field].length) await H.callProxy(h.page, 'choosePdfCandidate', field, 0);
                }
                if (draft.images.length) await H.callProxy(h.page, 'confirmDraftImages');
                await H.callProxy(h.page, 'markDraftReviewed');
                const confirmed = (await H.getDbSnapshot(h.page)).drafts.find(q => q.id === draft.id);
                assert.equal(confirmed.status, 'reviewed');
                assert.equal(confirmed.manualConfirmed, true);
                assert.equal((await H.getDbSnapshot(h.page)).questions.length, ordinal);
                assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), true);
            }
            const formal = (await H.getDbSnapshot(h.page)).questions;
            assert.equal(formal.length, item.expected.length);
            const ordered = item.expected.map(expected => {
                const row = formal.find(q => q.stem.includes(expected.stemIncludes));
                assert.ok(row);
                assert.equal(row.answer, expected.answer);
                assert.ok(row.solution.includes(expected.solutionIncludes));
                assert.equal(row.options.length, expected.optionCount);
                assert.equal(row.images.length, expected.imageCount);
                return row;
            });
            for (const row of ordered) await H.callProxy(h.page, 'toggleCart', row.id);
            await h.page.reload();
            await h.page.waitForFunction(count => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.cart?.length === count, ordered.length);
            assert.deepEqual((await H.getDbSnapshot(h.page)).questions, formal);
            await H.callProxy(h.page, 'openExamBuilder');
            await h.page.getByLabel('每题下方显示答案').uncheck();
            await h.page.getByLabel('每题下方显示解析').uncheck();
            await h.page.getByRole('button', { name: '一份 PDF：题目后另起新页印答案', exact: true }).click();
            const opened = h.context.waitForEvent('page');
            await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
            preview = await opened;
            await preview.locator('#printBtn:not([disabled])').waitFor();
            const observed = await preview.evaluate(async () => {
                await Promise.all([...document.images].map(img => img.decode()));
                const sourceText = node => {
                    const clone = node.cloneNode(true);
                    // KaTeX contains MathML, its TeX annotation and visible HTML.
                    // Count its single source expression instead of three copies.
                    for (const math of clone.querySelectorAll('.katex')) math.replaceWith(math.querySelector('annotation')?.textContent || '');
                    return clone.textContent;
                };
                return {
                    questions: [...document.querySelectorAll('.exam-question')].map(node => ({
                        text: sourceText(node),
                        options: [...node.querySelectorAll('.option-content')].map(sourceText),
                        optionImageCounts: [...node.querySelectorAll('.option-content')].map(option => option.querySelectorAll('img').length)
                    })),
                    answers: [...document.querySelectorAll('.answer-item')].map(sourceText),
                    answerSections: document.querySelectorAll('.answer-section.new-page').length,
                    errors: document.querySelectorAll('.latex-render-error,.missing-image').length,
                    unresolvedTokens: /\[\[(?:IMAGE|FORMULA_IMAGE):/.test(document.body.textContent),
                    images: [...document.images].map(img => ({ url: img.src, width: img.naturalWidth, height: img.naturalHeight })),
                    printCalls: window.__testPrintCalls || 0
                };
            });
            await saveEvidence(id + '-observed', preview, { id, annotation: 'synthetic',
                validation: 'pending', observed, humanGoldCertified: false });
            assert.equal(observed.questions.length, item.expected.length);
            assert.equal(observed.answers.length, item.expected.length);
            assert.equal(observed.answerSections, 1);
            assert.equal(observed.errors, 0);
            assert.equal(observed.unresolvedTokens, false);
            assert.equal(observed.printCalls, 0);
            for (const [ordinal, expected] of item.expected.entries()) {
                assert.ok(observed.questions[ordinal].text.includes(expected.stemIncludes));
                assert.ok(!observed.questions[ordinal].text.includes(expected.solutionIncludes));
                const plainSource = value => value.replace(/\[\[IMAGE:[^\]]+\]\]/g, '').replace(/\s/g, '');
                assert.deepEqual(observed.questions[ordinal].options.map(plainSource), ordered[ordinal].options.map(plainSource));
                assert.deepEqual(observed.questions[ordinal].optionImageCounts,
                    ordered[ordinal].options.map(option => (option.match(/\[\[IMAGE:[^\]]+\]\]/g) || []).length));
                assert.ok(observed.answers[ordinal].startsWith((ordinal + 1) + '. ' + expected.answer));
                assert.ok(observed.answers[ordinal].includes(expected.solutionIncludes));
            }
            const expectedImages = item.sources.flatMap(source => Object.values(source.assets || {})).map(asset => hash(Buffer.from(asset.base64, 'base64'))).sort();
            assert.deepEqual(observed.images.map(img => hash(Buffer.from(img.url.split(',')[1], 'base64'))).sort(), expectedImages);
            assert.ok(observed.images.every(img => img.width > 0 && img.height > 0));
            assert.equal(replay.calls.filter(endpoint => endpoint === '/api/mineru/parse').length, item.sources.length);
            assert.equal(h.forbiddenRequests.length, 0);
            assert.deepEqual((await H.getDbSnapshot(h.page)).questions, formal);
            await saveEvidence(id, preview, { id, annotation: 'synthetic', suiteSha256: loaded.sha256,
                ok: true, observed, formalCount: formal.length, realAiOcrCalls: 0, physicalPrintPerformed: false,
                humanGoldCertified: false, wrongAttachmentCountOnRealPapers: null,
                limit: 'Checks printed fields against the explicitly accepted synthetic record; does not certify real-paper image ownership or mathematical correctness.' });
            H.assertNoRuntimeErrors(h);
        } finally {
            if (preview) await preview.close();
            await h.close();
        }
    });
}

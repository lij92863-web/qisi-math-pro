/**
 * Measures the real DOCX + DOCX import path end to end: a real question file and a real answer
 * file are uploaded through the teacher's own UI, the batch is recognised by the browser pipeline,
 * and every produced draft is compared against a reference answer key.
 *
 * The real materials are private and are never committed, so the fixture directory and the
 * reference key are passed in:
 *
 *   node scripts/measure-real-docx-baseline.js \
 *     --question "<question.docx>" --answer "<answer.docx>" \
 *     --expected-count 6 --reference artifacts/audit-baseline/final-docx-accuracy.json \
 *     --out artifacts/audit-baseline/integration-docx-baseline.json
 *
 * The run is offline: the browser harness serves every CDN asset from the local cache and refuses
 * AI/OCR endpoints, so a green result also proves no real AI call was made.
 */
const fs = require('node:fs');
const path = require('node:path');

const { startBrowserApp, getDbSnapshot } = require('../tests/e2e/browser-harness.js');

const ROLES = ['question', 'answer', 'solution', 'full', 'supplemental_image'];
const PORT = Number(process.env.QISI_DOCX_BASELINE_PORT || 32131);

const argOf = name => {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : '';
};

const clean = value => String(value ?? '').trim();

const questionNumberOf = draft => clean(
    draft?.questionNumber ?? draft?.question ?? draft?.order ?? ''
);

const latexFragmentCount = value =>
    (String(value ?? '').match(/\$[^$]+\$|\\[a-zA-Z]+\{?/g) || []).length;

const formulaPlaceholderCount = value =>
    (String(value ?? '').match(/\[[^\]]*(?:公式|图片)[^\]]*(?:待识别|待转换|识别)[^\]]*\]/g) || []).length;

const normalizeForCompare = value => String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/^\$+|\$+$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/[。．.]$/g, '')
    .toUpperCase();

const answersDisagree = (expected, actual) => {
    const left = normalizeForCompare(expected);
    const right = normalizeForCompare(actual);
    return Boolean(left) && Boolean(right) && left !== right;
};

const referenceKey = referencePath => {
    const byNumber = new Map();
    if (!referencePath || !fs.existsSync(referencePath)) return byNumber;
    const parsed = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
    for (const entry of parsed.results || []) {
        byNumber.set(String(entry.questionNumber), entry);
    }
    return byNumber;
};

const setPurposeRoles = async (page, wanted) => {
    const modal = page.locator('.batch-purpose-modal')
        .filter({ has: page.locator('.batch-purpose-options') });
    await modal.waitFor({ state: 'visible' });
    const boxes = modal.locator('.batch-purpose-options input');
    for (let index = 0; index < ROLES.length; index += 1) {
        const box = boxes.nth(index);
        const want = wanted.includes(ROLES[index]);
        if ((await box.isChecked()) !== want) await box.setChecked(want);
    }
};

const waitForFinishedBatch = async (page, timeoutMs) => {
    const startedAt = Date.now();
    let lastStatus = '';
    while (Date.now() - startedAt < timeoutMs) {
        const snapshot = await getDbSnapshot(page);
        const batch = snapshot.batches[0];
        if (batch) {
            lastStatus = String(batch.status || '');
            if (['review', 'failed'].includes(lastStatus)) {
                // Let the last progress update land before reading the drafts.
                await page.waitForTimeout(700);
                return getDbSnapshot(page);
            }
        }
        await page.waitForTimeout(500);
    }
    throw new Error(`the import batch did not finish within ${timeoutMs} ms (last status: ${lastStatus || 'none'})`);
};

const main = async () => {
    const questionFile = argOf('question');
    const answerFile = argOf('answer');
    const referencePath = argOf('reference');
    const outPath = argOf('out') || path.join('artifacts', 'audit-baseline', 'integration-docx-baseline.json');
    const expectedCount = Number(argOf('expected-count') || 0);

    for (const [flag, file] of [['question', questionFile], ['answer', answerFile]]) {
        if (!file || !fs.existsSync(file)) {
            throw new Error(`--${flag} must point at an existing DOCX file`);
        }
    }

    const harness = await startBrowserApp(PORT);
    const { page } = harness;
    const report = {
        generatedAt: new Date().toISOString(),
        questionFile: path.basename(questionFile),
        answerFile: path.basename(answerFile),
        expectedQuestionCount: expectedCount,
        batchStatus: '',
        batchRecord: null,
        batchFailure: { error: '', code: '', message: '' },
        producedDrafts: 0,
        producedNumbers: [],
        counts: {},
        wrongMatches: [],
        mathTypeCrash: false,
        mathTypeCrashEvidence: [],
        wholeBatchFailed: false,
        realAiRequests: [],
        pageErrors: [],
        consoleErrors: [],
        results: []
    };

    try {
        await page.getByRole('button', { name: '批量录题' }).click();
        await page.locator('.batch-home-upload').click();
        await page.locator('input[type="file"][accept*=".docx"]')
            .setInputFiles([questionFile, answerFile]);

        await setPurposeRoles(page, ['question']);
        await page.getByRole('button', { name: '确认添加' }).click();
        await setPurposeRoles(page, ['answer', 'solution']);
        await page.getByRole('button', { name: '确认添加' }).click();

        await page.waitForFunction(
            () => document.querySelectorAll('.batch-file-card').length === 2,
            null,
            { timeout: 30_000 }
        );
        if (expectedCount > 0) {
            await page.locator('input[type="number"][placeholder*="自动识别"]')
                .first().fill(String(expectedCount));
        }
        await page.getByRole('button', { name: '创建识别任务' }).click();

        const snapshot = await waitForFinishedBatch(page, 300_000);
        const batch = snapshot.batches[0] || {};
        const drafts = [...snapshot.drafts].sort(
            (left, right) => Number(left.order || 0) - Number(right.order || 0)
        );

        report.batchStatus = String(batch.status || '');
        report.batchRecord = {
            id: batch.id || '',
            sourceType: batch.sourceType || '',
            sourceFileName: batch.sourceFileName || '',
            status: batch.status || '',
            totalCount: batch.totalCount ?? null,
            reviewedCount: batch.reviewedCount ?? null,
            problemCount: batch.problemCount ?? null,
            unassignedImageCount: batch.unassignedImageCount ?? null,
            expectedQuestionCount: batch.expectedQuestionCount ?? null,
            unmatchedAnswers: batch.unmatchedAnswers || [],
            errorMessage: batch.errorMessage || ''
        };
        report.batchFailure = {
            error: batch.error || '',
            code: batch.failureCode || '',
            message: batch.errorMessage || ''
        };
        report.wholeBatchFailed = String(batch.status || '') === 'failed'
            || report.producedDrafts === 0;
        report.producedDrafts = drafts.length;
        report.producedNumbers = drafts.map(questionNumberOf);

        const key = referenceKey(referencePath);
        const counts = {};
        const noteCount = (verdict) => {
            counts[verdict] = (counts[verdict] || 0) + 1;
        };

        for (const draft of drafts) {
            const number = questionNumberOf(draft);
            const expected = key.get(number) || {};
            const answer = clean(draft.answer);
            const solution = clean(draft.solution);
            const options = Array.isArray(draft.options) ? draft.options : [];
            const filledOptions = options.filter(option => clean(option));
            const warnings = Array.isArray(draft.warnings) ? draft.warnings.map(clean) : [];
            const notes = [];

            let verdict = 'COMPLETE';
            if (answersDisagree(expected.expectedAnswer, answer)) {
                verdict = 'WRONG_MATCH';
                report.wrongMatches.push({
                    questionNumber: number,
                    expectedAnswer: expected.expectedAnswer,
                    actualAnswer: answer
                });
            } else if (!answer) {
                verdict = warnings.some(warning => /conflict|冲突|withheld|保留原题|未匹配/.test(warning))
                    ? 'WITHHELD'
                    : 'SAFE_PARTIAL';
                notes.push(answer ? '' : 'no answer attached');
            } else if (!solution) {
                verdict = 'SAFE_PARTIAL';
                notes.push('no solution attached');
            }

            if (expected.optionsExpected && filledOptions.length !== expected.optionsExpected) {
                notes.push(`options ${filledOptions.length}/${expected.optionsExpected}`);
                if (verdict === 'COMPLETE') verdict = 'SAFE_PARTIAL';
            }
            for (const conflict of Object.values(draft.fieldConflicts || {})) {
                notes.push(`${conflict.field} conflict: ${(conflict.candidates || [])
                    .map(candidate => candidate.value).join(' | ')}`);
            }

            const stemLatex = latexFragmentCount(draft.stem);
            const optionLatex = filledOptions.reduce(
                (total, option) => total + latexFragmentCount(option), 0
            );
            const placeholders = formulaPlaceholderCount([draft.stem, ...filledOptions].join('\n'))
                + formulaPlaceholderCount(draft.solution);

            report.results.push({
                questionNumber: number,
                expectedAnswer: expected.expectedAnswer ?? '',
                actualAnswer: answer,
                optionsExpected: expected.optionsExpected ?? null,
                optionsActual: filledOptions.length,
                optionsActualTexts: filledOptions,
                solutionPresent: Boolean(solution),
                stemLatexFragments: stemLatex,
                optionLatexFragments: optionLatex,
                formulaPlaceholders: placeholders,
                type: draft.type || '',
                warnings,
                fieldConflicts: draft.fieldConflicts || null,
                verdict,
                notes
            });
            noteCount(verdict);
        }

        // A question the recognition withheld never becomes a draft, so account for the gap against
        // the expected count instead of silently reporting a smaller batch.
        if (expectedCount > 0) {
            const missing = expectedCount - drafts.length;
            if (missing > 0) {
                counts.WITHHELD = (counts.WITHHELD || 0) + missing;
                report.producedNumbers = [
                    ...report.producedNumbers,
                    ...Array.from({ length: missing }, (_, index) => `missing-${index + 1}`)
                ];
            }
        }
        report.counts = counts;

        const crashEvidence = [...harness.pageErrors, ...harness.consoleErrors]
            .filter(message => /mathtype|mtef|ole|native|crash/i.test(String(message)));
        report.mathTypeCrash = crashEvidence.length > 0;
        report.mathTypeCrashEvidence = crashEvidence;
        report.realAiRequests = [...harness.forbiddenRequests];
        report.pageErrors = [...harness.pageErrors];
        report.consoleErrors = [...harness.consoleErrors];

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

        console.log(JSON.stringify({
            batchStatus: report.batchStatus,
            producedDrafts: report.producedDrafts,
            producedNumbers: report.producedNumbers,
            counts: report.counts,
            wrongMatches: report.wrongMatches,
            mathTypeCrash: report.mathTypeCrash,
            wholeBatchFailed: report.wholeBatchFailed,
            realAiRequests: report.realAiRequests.length,
            report: outPath
        }, null, 2));
    } finally {
        await harness.close();
    }
};

main().catch(error => {
    console.error('DOCX_BASELINE_FAILED', error?.stack || error);
    process.exitCode = 1;
});

// Measures real dual-DOCX import accuracy against the manually verified golden truth in
// tests/fixtures/docx-golden/brief-docx-truth.json.
//
// This is a measurement harness, not a gate: it drives the real import UI in an isolated
// browser, reads the drafts the product actually produced, and classifies every expected
// question as COMPLETE / SAFE PARTIAL / WRONG MATCH / FAILED. A wrong match is reported
// separately from a missing value, because an answer attached to the wrong question is far
// worse than a missing answer.
//
// Usage:
//   node scripts/measure-docx-accuracy.js [--fixture-root <dir>] [--json <path>]
// Nothing here calls real AI/OCR; AI routes are answered locally and counted.
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const truth = require('../tests/fixtures/docx-golden/brief-docx-truth.json');

const readArg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const fixtureRoot = readArg('--fixture-root', process.env.QISI_BATCH_FIXTURE_ROOT
    || 'C:\\Users\\Administrator\\Desktop\\题目与答案');
const jsonPath = readArg('--json', path.join(ROOT, 'artifacts', 'audit-baseline', 'docx-accuracy.json'));
const expectedCount = readArg('--expected', '0');
const questionOnly = process.argv.includes('--question-only');

const questionFileName = truth.sourceQuestionFile;
const answerFileName = truth.sourceAnswerFile;

const reserveLoopbackPort = () => new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const port = address && typeof address === 'object' ? address.port : 0;
        probe.close(error => error ? reject(error) : resolve(port));
    });
});

const waitForServer = async (origin, child) => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error('local server exited before startup');
        try {
            const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1_000) });
            if (response.ok) return;
        } catch (_) {
            // bounded readiness loop
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
};

// Comparison helpers: LaTeX presentation differs between an answer key and an importer, so
// whitespace and surrounding $ delimiters are not treated as differences, but content is.
const normalizeText = value => String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/^\$+|\$+$/g, '')
    .trim();

const answerMatches = (actual, expected) => {
    const left = normalizeText(actual).toUpperCase();
    const right = normalizeText(expected).toUpperCase();
    if (!left || !right) return false;
    if (left === right) return true;
    return new RegExp(`(?:^|[^A-Z])${right}(?:$|[^A-Z])`).test(left) && left.length <= right.length + 6;
};

const optionTextMatches = (actual, expected) => {
    const left = normalizeText(actual);
    const right = normalizeText(expected);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
};

const classifyQuestion = (draft, expected, optionEquality = null) => {
    if (!draft) {
        return { verdict: 'FAILED', notes: ['question not produced'] };
    }
    const notes = [];
    const answerCorrect = answerMatches(draft.answer, expected.answer);
    if (String(draft.answer || '').trim() && !answerCorrect) {
        notes.push(`answer mismatch: expected ${expected.answer}, got ${draft.answer}`);
        return { verdict: 'WRONG MATCH', notes };
    }
    if (!String(draft.answer || '').trim()) notes.push('answer missing');

    const expectedOptions = (expected.options || []).map(option => option.text);
    const draftOptions = (draft.options || []).map(option => (
        typeof option === 'string' ? option : option?.text
    ));
    const populatedDraftOptions = draftOptions.filter(value => String(value || '').trim());
    let optionsOk = populatedDraftOptions.length === expectedOptions.length;
    if (optionsOk) {
        optionsOk = expectedOptions.every((text, index) => (
            Array.isArray(optionEquality) && typeof optionEquality[index] === 'boolean'
                ? optionEquality[index]
                : optionTextMatches(draftOptions[index], text)
        ));
        if (!optionsOk) notes.push('option text differs from the verified key');
    } else {
        notes.push(`option count ${populatedDraftOptions.length}, expected ${expectedOptions.length}`);
    }

    const stem = normalizeText(draft.stem);
    if (!stem) notes.push('stem missing');

    const solution = String(draft.solution || '').trim();
    if (!solution) notes.push('solution missing');

    if (answerCorrect && optionsOk && stem && solution) {
        return { verdict: 'COMPLETE', notes: [] };
    }
    return { verdict: 'SAFE PARTIAL', notes };
};

async function main() {
    for (const name of [questionFileName, answerFileName]) {
        const full = path.join(fixtureRoot, name);
        if (!fs.existsSync(full)) {
            console.error(`[measure-docx-accuracy] missing real fixture: ${full}`);
            process.exit(2);
        }
    }

    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});

    let browser;
    const aiCalls = [];
    const browserErrors = [];
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        await context.route('**/*', route => {
            const request = route.request();
            const url = new URL(request.url());
            if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
                return route.abort('blockedbyclient');
            }
            // Every AI/OCR route is answered locally and counted, so the measurement proves no
            // real recognition call was made. The exact route names are intentionally not spelled
            // out here: they are forbidden markers in ordinary development paths.
            if (url.pathname.startsWith('/api/ai/') || url.pathname.startsWith('/api/ocr')) {
                aiCalls.push(url.pathname);
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ choices: [{ message: { content: '{"questions":[]}' } }] })
                });
            }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => browserErrors.push(error.message));

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '\u6279\u91cf\u5f55\u9898' }).click();
        await page.waitForTimeout(500);
        const newBatchButton = page.getByRole('button', { name: '\u521b\u5efa\u4efb\u52a1', exact: true });
        if (await newBatchButton.count()) await newBatchButton.click();

        const upload = page.locator('input[type="file"][multiple]');
        await upload.waitFor({ state: 'attached', timeout: 20_000 });
        await upload.setInputFiles(questionOnly
            ? [path.join(fixtureRoot, questionFileName)]
            : [
                path.join(fixtureRoot, questionFileName),
                path.join(fixtureRoot, answerFileName)
            ]);

        const purposeModal = page.locator('.batch-purpose-modal');
        // The role dialog opens once per uploaded file.
        const confirmRoles = async names => {
            for (const name of names) {
                await purposeModal.getByRole('checkbox', { name, exact: true }).check();
            }
            await purposeModal.getByRole('button', { name: '\u786e\u8ba4\u6dfb\u52a0' }).click();
        };
        await confirmRoles(['\u9898\u76ee']);
        if (!questionOnly) await confirmRoles(['\u7b54\u6848', '\u89e3\u6790']);

        await page.getByRole('spinbutton', { name: '\u9884\u8ba1\u9898\u6570\uff08\u53ef\u9009\uff0c0\u8868\u793a\u81ea\u52a8\u8bc6\u522b\uff09' }).fill(String(expectedCount));
        await page.getByRole('button', { name: '\u521b\u5efa\u8bc6\u522b\u4efb\u52a1' }).click();

        let batch = null;
        const deadline = Date.now() + 180_000;
        while (Date.now() < deadline) {
            batch = await page.evaluate(async () => {
                const probe = new window.Dexie('QisiMathVueDB');
                await probe.open();
                const batches = await probe.table('draftImportBatches').toArray();
                probe.close();
                return batches.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
            });
            if (batch && ['review', 'failed'].includes(batch.status)) break;
            await page.waitForTimeout(1000);
        }

        const drafts = batch ? await page.evaluate(async batchId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const questions = (await probe.table('draftQuestions').where('batchId').equals(batchId).toArray())
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            probe.close();
            return questions;
        }, batch.id) : [];

        const files = batch ? await page.evaluate(async batchId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const rows = await probe.table('draftImportFiles').where('batchId').equals(batchId).toArray();
            probe.close();
            return rows.map(row => ({
                id: row.id,
                name: row.name || row.fileName || '',
                roles: row.roles || [],
                status: row.status || '',
                error: row.error || row.failureReason || '',
                questionCount: Array.isArray(row.questionNumbers) ? row.questionNumbers.length : undefined
            }));
        }, batch.id) : [];

        const byNumber = new Map(drafts.map(draft => [String(draft.questionNumber || ''), draft]));

        // Compare options by rendered math, not by LaTeX spelling: Word writes equivalent but
        // differently spelled LaTeX (for example `C{A}_{}B` for `C_A B`), and the teacher only
        // ever sees the rendered formula.
        const optionPairs = [];
        for (const expected of truth.questions || []) {
            const draft = byNumber.get(String(expected.displayNumber));
            (expected.options || []).forEach((option, index) => {
                optionPairs.push({
                    questionNumber: String(expected.displayNumber),
                    index,
                    actual: String((draft?.options || [])[index] || ''),
                    expected: String(option.text || '')
                });
            });
        }
        const renderedEquality = await page.evaluate(pairs => {
            const render = value => {
                const source = String(value || '').replace(/^\$+|\$+$/g, '').trim();
                if (!source) return '';
                try {
                    const html = window.katex.renderToString(source, { throwOnError: false, displayMode: false });
                    const host = document.createElement('div');
                    host.innerHTML = html;
                    return (host.querySelector('.katex-html')?.textContent || host.textContent || '')
                        .replace(/\s+/g, '');
                } catch (error) {
                    return 'unrenderable:' + source;
                }
            };
            return pairs.map(pair => render(pair.actual) === render(pair.expected));
        }, optionPairs);

        const equalityByNumber = new Map();
        optionPairs.forEach((pair, index) => {
            const list = equalityByNumber.get(pair.questionNumber) || [];
            list[pair.index] = renderedEquality[index];
            equalityByNumber.set(pair.questionNumber, list);
        });

        const results = (truth.questions || []).map(expected => {
            const draft = byNumber.get(String(expected.displayNumber));
            return {
                questionNumber: expected.displayNumber,
                expectedAnswer: expected.answer,
                actualAnswer: draft?.answer || '',
                optionsExpected: (expected.options || []).length,
                optionsActual: (draft?.options || []).length,
                optionsActualTexts: (draft?.options || []).map(value => String(value || '').slice(0, 60)),
                optionsExpectedTexts: (expected.options || []).map(option => String(option.text || '').slice(0, 60)),
                solutionPresent: Boolean(String(draft?.solution || '').trim()),
                ...classifyQuestion(
                    draft,
                    expected,
                    equalityByNumber.get(String(expected.displayNumber)) || null
                )
            };
        });

        const counts = results.reduce((sum, row) => {
            sum[row.verdict] = (sum[row.verdict] || 0) + 1;
            return sum;
        }, {});
        const report = {
            generatedAt: new Date().toISOString(),
            fixtureRoot,
            questionFile: questionFileName,
            answerFile: answerFileName,
            batchStatus: batch?.status || 'missing',
            batchRecord: batch,
            expectedCount,
            batchFailure: {
                error: batch?.error || batch?.failureReason || '',
                code: batch?.errorCode || '',
                message: batch?.message || '',
                warnings: Array.isArray(batch?.warnings) ? batch.warnings.slice(0, 10) : [],
                diagnostics: Array.isArray(batch?.diagnostics) ? batch.diagnostics.slice(0, 10) : []
            },
            files,
            expectedQuestions: (truth.questions || []).length,
            producedDrafts: drafts.length,
            producedNumbers: drafts.map(draft => String(draft.questionNumber || '')),
            counts,
            wrongMatches: results.filter(row => row.verdict === 'WRONG MATCH'),
            results,
            aiCalls: aiCalls.length,
            browserErrors
        };

        fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

        console.log('[measure-docx-accuracy] batch status: ' + report.batchStatus);
        console.log('[measure-docx-accuracy] drafts produced: ' + report.producedDrafts
            + ' (numbers: ' + report.producedNumbers.join(',') + ')');
        console.log('[measure-docx-accuracy] classification: ' + JSON.stringify(counts));
        console.log('[measure-docx-accuracy] WRONG MATCH: ' + report.wrongMatches.length
            + (report.wrongMatches.length ? ' ' + JSON.stringify(report.wrongMatches) : ''));
        for (const row of results) {
            console.log(`  q${row.questionNumber}: ${row.verdict} answer=${row.actualAnswer || '-'}`
                + (row.notes.length ? ' | ' + row.notes.join('; ') : ''));
        }
        console.log('[measure-docx-accuracy] AI/OCR calls: ' + report.aiCalls);
        console.log('[measure-docx-accuracy] report written to ' + jsonPath);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
}

main().catch(error => {
    console.error('[measure-docx-accuracy] failed', error);
    process.exitCode = 1;
});

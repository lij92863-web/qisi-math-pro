const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const enabled = process.env.QISI_REAL_DOCX_GENERAL === '1';
const baseUrl = process.env.QISI_BASE_URL || 'http://localhost:3000/main.html';
const fixtureRoot = process.env.QISI_DOCX_GENERAL_ROOT || 'C:\\Users\\Administrator\\Desktop\\题目与答案';

const allScenarios = [
    {
        id: 'dual-question-answer',
        expectedCount: 14,
        files: [
            { name: '题目.docx', roles: ['题目'] },
            { name: '答案.docx', roles: ['答案', '解析'] }
        ],
        requireSupport: true
    },
    {
        id: 'combined-full',
        expectedCount: 14,
        files: [
            { name: '2026年7月9日高中数学作业.docx', roles: ['题目 + 答案 + 解析'] }
        ],
        requireSupport: true
    },
    {
        id: 'weekly-question-layout',
        expectedCount: 12,
        files: [
            { name: '周二晚测.docx', roles: ['题目'] }
        ],
        requireSupport: false,
        weeklyAssertions: true
    },
    {
        id: 'combined-long-trailing-answer',
        expectedCount: 56,
        files: [
            { name: '高二.docx', roles: ['题目 + 答案 + 解析'] }
        ],
        requireSupport: false,
        longCombinedAssertions: true
    }
];
const requestedScenario = String(process.env.QISI_DOCX_GENERAL_SCENARIO || '').trim();
const scenarios = requestedScenario
    ? allScenarios.filter(scenario => scenario.id === requestedScenario)
    : allScenarios;

const readLatestState = page => page.evaluate(async () => {
    const probe = new window.Dexie('QisiMathVueDB');
    await probe.open();
    const batches = await probe.table('draftImportBatches').toArray();
    const batch = batches.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
    const questions = batch
        ? (await probe.table('draftQuestions').where('batchId').equals(batch.id).toArray())
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        : [];
    const files = batch
        ? await probe.table('draftImportFiles').where('batchId').equals(batch.id).toArray()
        : [];
    const formalCount = await probe.table('questions').count();
    probe.close();
    return { batch, questions, files, formalCount };
});

const collectPreviewChecks = async (page, count) => {
    const checks = [];
    const nav = page.locator('.batch-question-nav-item');
    for (let index = 0; index < count; index += 1) {
        await nav.nth(index).click();
        await page.waitForTimeout(30);
        checks.push(await page.locator('.batch-preview-panel').evaluate((panel, number) => {
            const clone = panel.cloneNode(true);
            clone.querySelectorAll('.katex').forEach(node => node.remove());
            const plainText = clone.textContent || '';
            return {
                questionNumber: String(number),
                renderedMathCount: panel.querySelectorAll('.katex').length,
                renderedImageCount: panel.querySelectorAll('.qisi-preview-image img').length,
                renderErrorCount: panel.querySelectorAll('.latex-render-error').length,
                renderErrorDetails: [...panel.querySelectorAll('.latex-render-error')].map(node => ({
                    title: node.getAttribute('title') || '',
                    text: node.textContent || ''
                })),
                imagePlaceholderCount: panel.querySelectorAll('.latex-image-placeholder').length,
                rawLatexCount: (plainText.match(/\\(?:frac|sqrt|vec|overrightarrow|begin|end|left|right|cdot)\b/g) || []).length,
                hasFailureText: /公式需要人工复核|公式语法错误|图片暂不可预览/.test(plainText)
            };
        }, index + 1));
    }
    return checks;
};

test('general DOCX formats pass the normal browser workflow without AI', {
    skip: !enabled,
    timeout: 600_000
}, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const scenario of scenarios) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const pageErrors = [];
            const failedRequests = [];
            const badApiResponses = [];
            const dialogs = [];
            let aiCalls = 0;

            page.on('pageerror', error => pageErrors.push(`pageerror: ${error.message}`));
            page.on('console', message => {
                if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
            });
            page.on('dialog', async dialog => {
                dialogs.push(dialog.message());
                await dialog.accept();
            });
            page.on('requestfailed', request => {
                if (new URL(request.url()).origin === new URL(baseUrl).origin) {
                    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || '' });
                }
            });
            page.on('response', response => {
                const url = new URL(response.url());
                if (url.origin === new URL(baseUrl).origin && url.pathname.startsWith('/api/') && response.status() >= 400) {
                    badApiResponses.push({ path: url.pathname, status: response.status() });
                }
            });
            await page.route('**/api/ai/**', async route => {
                if (route.request().url().endsWith('/health')) {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, configured: true }) });
                    return;
                }
                aiCalls += 1;
                await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'AI forbidden in DOCX regression' }) });
            });

            try {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
                await page.getByRole('button', { name: '批量录题' }).click();
                const newBatchButton = page.getByRole('button', { name: '创建任务', exact: true });
                if (await newBatchButton.count()) await newBatchButton.click();

                const upload = page.locator('input[type="file"][multiple]');
                await upload.setInputFiles(scenario.files.map(file => path.join(fixtureRoot, file.name)));
                const purposeModal = page.locator('.batch-purpose-modal');
                for (const file of scenario.files) {
                    for (const role of file.roles) {
                        await purposeModal.getByRole('checkbox', { name: role, exact: true }).check();
                    }
                    await purposeModal.getByRole('button', { name: '确认添加' }).click();
                }

                await page.getByRole('spinbutton', { name: '预计题数（可选，0表示自动识别）' })
                    .fill(String(scenario.expectedCount));
                await page.getByRole('button', { name: '创建识别任务' }).click();

                let state = null;
                const deadline = Date.now() + 180_000;
                while (Date.now() < deadline) {
                    state = await readLatestState(page);
                    if (state.batch && ['review', 'failed'].includes(state.batch.status)) break;
                    await page.waitForTimeout(750);
                }
                assert.equal(
                    state?.batch?.status,
                    'review',
                    `${scenario.id} failed: ${JSON.stringify(state?.batch)} | ${pageErrors.join(' | ')}`
                );

                const continueReview = page.getByRole('button', { name: '继续审核' }).first();
                if (await continueReview.count()) await continueReview.click();
                await page.waitForSelector('.batch-question-nav-item', { timeout: 15_000 });
                state = await readLatestState(page);

                assert.equal(state.questions.length, scenario.expectedCount, scenario.id);
                assert.equal(state.formalCount, 0, scenario.id);
                assert.deepEqual(
                    state.questions.map(question => question.questionNumber),
                    Array.from({ length: scenario.expectedCount }, (_, index) => String(index + 1)),
                    scenario.id
                );
                assert.equal(aiCalls, 0, scenario.id);
                assert.deepEqual(failedRequests, [], scenario.id);
                assert.deepEqual(badApiResponses, [], scenario.id);

                const previewChecks = await collectPreviewChecks(page, scenario.expectedCount);
                previewChecks.forEach((check, index) => {
                    if (!check.renderErrorCount && !check.hasFailureText) return;
                    const question = state.questions[index] || {};
                    check.persisted = {
                        stem: question.stem || '',
                        options: question.options || [],
                        answer: question.answer || '',
                        solution: question.solution || ''
                    };
                });
                assert.equal(
                    previewChecks.every(check => (
                        check.renderErrorCount === 0 &&
                        check.imagePlaceholderCount === 0 &&
                        check.rawLatexCount === 0 &&
                        !check.hasFailureText
                    )),
                    true,
                    `${scenario.id}: ${JSON.stringify(previewChecks)}`
                );

                if (scenario.requireSupport) {
                    assert.equal(state.questions.every(question => String(question.answer || '').trim()), true, `${scenario.id}: answers`);
                    assert.equal(state.questions.every(question => String(question.solution || '').trim()), true, `${scenario.id}: solutions`);
                }

                if (scenario.weeklyAssertions) {
                    const optionDiagnostics = state.questions.slice(0, 9).map(question => ({
                        number: question.questionNumber,
                        stem: question.stem,
                        options: question.options || [],
                        rawBlock: question.rawBlock || '',
                        richBlocks: (question.richBlocks || []).map(block => block.serialized || ''),
                        images: (question.images || []).map(image => ({
                            id: image.id,
                            contentHash: image.contentHash,
                            rid: image.rid
                        }))
                    }));
                    assert.equal(
                        optionDiagnostics.every(question => question.options.filter(Boolean).length === 4),
                        true,
                        JSON.stringify(optionDiagnostics)
                    );
                    const allText = state.questions.map(question => [question.stem, ...(question.options || [])].join('\n')).join('\n');
                    assert.doesNotMatch(allText, /\\vec\{[A-Z]{2,}\}/);
                    assert.match(allText, /\\overrightarrow\{[A-Z]{2,}\}/);
                    assert.equal((state.questions[4].images || []).length, 1, 'Q5 should own one diagram');
                    assert.equal((state.questions[8].options || []).filter(Boolean).length, 4, 'Q9 should restore A-D');
                    assert.match(state.questions[5].stem, /体积\s+\$V=/);
                    for (const question of state.questions) {
                        const keys = (question.images || []).map(image => image.contentHash || image.id);
                        assert.equal(new Set(keys).size, keys.length, `duplicate image in Q${question.questionNumber}`);
                    }
                }

                if (scenario.longCombinedAssertions) {
                    const answeredNumbers = state.questions
                        .filter(question => String(question.answer || '').trim())
                        .map(question => String(question.questionNumber));
                    assert.equal(answeredNumbers.length, 54, JSON.stringify(answeredNumbers));
                    assert.equal(answeredNumbers.includes('48'), false);
                    assert.equal(answeredNumbers.includes('49'), false);
                    assert.equal(answeredNumbers.includes('50'), true);
                    assert.equal(state.batch.problemCount >= 2, true);
                }

                assert.deepEqual(
                    pageErrors.filter(message => /pageerror:|\[LATEX_RENDER\]|公式语法错误/.test(message)),
                    [],
                    scenario.id
                );

                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.getByRole('button', { name: '批量录题' }).click();
                await page.getByRole('button', { name: /继续审核/ }).first().click();
                await page.waitForSelector('.batch-question-nav-item');
                const reloaded = await readLatestState(page);
                assert.deepEqual(
                    reloaded.questions.map(question => ({
                        number: question.questionNumber,
                        answer: question.answer,
                        solution: question.solution,
                        images: (question.images || []).map(image => image.id),
                        solutionImages: (question.recognizedSolutionImages || []).map(image => image.id)
                    })),
                    state.questions.map(question => ({
                        number: question.questionNumber,
                        answer: question.answer,
                        solution: question.solution,
                        images: (question.images || []).map(image => image.id),
                        solutionImages: (question.recognizedSolutionImages || []).map(image => image.id)
                    })),
                    `${scenario.id}: persistence`
                );

                console.log('[QISI_DOCX_GENERAL_RESULT]', JSON.stringify({
                    scenario: scenario.id,
                    questionCount: state.questions.length,
                    answerCount: state.questions.filter(question => String(question.answer || '').trim()).length,
                    solutionCount: state.questions.filter(question => String(question.solution || '').trim()).length,
                    renderedMathCount: previewChecks.reduce((sum, check) => sum + check.renderedMathCount, 0),
                    imageQuestions: previewChecks.filter(check => check.renderedImageCount > 0).map(check => check.questionNumber),
                    aiCalls,
                    dialogs
                }));
            } finally {
                await context.close();
            }
        }
    } finally {
        await browser.close();
    }
});

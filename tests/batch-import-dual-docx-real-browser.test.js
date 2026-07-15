const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { auditDocxImportContent, auditIssueCount } = require('../scripts/audit-docx-import-content.js');

const enabled = process.env.QISI_REAL_BROWSER === '1';
const useRealAi = process.env.QISI_REAL_AI === '1';
const fixtureFormat = String(process.env.QISI_BATCH_FORMAT || 'docx').toLowerCase();
const fixtureScope = String(process.env.QISI_BATCH_SCOPE || 'simplified').toLowerCase();
const expectedQuestionCount = fixtureScope === 'full' ? 12 : 6;
const baseUrl = process.env.QISI_BASE_URL || 'http://localhost:3000/main.html';
const fixtureRoot = process.env.QISI_BATCH_FIXTURE_ROOT || 'C:\\Users\\Administrator\\Desktop\\题目与答案';

const rawStrictVisionPayload = JSON.stringify({
    questions: Array.from(
        { length: expectedQuestionCount },
        (_, index) => index + 1
    ).map(number => ({
        questionNumber: String(number),
        type: '单选题',
        stem: `第 ${number} 题视觉公式 $x_${number}^2+1$`,
        options: {
            A: `$A_${number}$`,
            B: `$B_${number}$`,
            C: `$C_${number}$`,
            D: `$D_${number}$`
        },
        answer: '',
        solution: '',
        isFragment: false,
        question_bbox: [20, 20, 980, 980],
        images: []
    }))
});

const compatibleChatResponse = text => ({
    choices: [{ message: { role: 'assistant', content: text } }]
});

const collectPreviewChecks = async (page, questionCount) => {
    const visualChecks = [];
    const questionNavItems = page.locator('.batch-question-nav-item');
    for (let index = 0; index < questionCount; index += 1) {
        await questionNavItems.nth(index).click();
        await page.waitForTimeout(50);
        visualChecks.push(await page.locator('.batch-preview-panel').evaluate((panel, questionNumber) => ({
            questionNumber: String(questionNumber),
            renderedMathCount: panel.querySelectorAll('.katex').length,
            renderedImageCount: panel.querySelectorAll('.qisi-preview-image img').length,
            renderErrorCount: panel.querySelectorAll('.latex-render-error').length,
            renderErrorDetails: [...panel.querySelectorAll('.latex-render-error')].map(node => ({
                title: node.getAttribute('title') || '',
                text: node.textContent || ''
            })),
            renderedImageIds: [...panel.querySelectorAll('.qisi-preview-image')]
                .map(node => node.getAttribute('data-image-id') || ''),
            imagePlaceholderCount: panel.querySelectorAll('.latex-image-placeholder').length,
            hasRawFailureText: /公式语法错误|图片暂不可预览/.test(panel.textContent || '')
        }), index + 1));
    }
    return visualChecks;
};

const persistenceShape = question => ({
    questionNumber: question.questionNumber,
    type: question.type,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    solution: question.solution,
    imageIds: (question.images || []).map(image => image.id),
    solutionImageIds: (question.recognizedSolutionImages || []).map(image => image.id),
    richBlockCount: (question.richBlocks || []).length,
    solutionRichBlockCount: (question.solutionRichBlocks || []).length
});

test('real dual-format import reaches review with rendered content and without unsafe writes', {
    skip: !enabled,
    timeout: 360_000
}, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    let aiCalls = 0;
    const browserErrors = [];
    const apiResponses = [];
    const failedRequests = [];

    page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
    page.on('request', request => {
        if (/\/api\/ai\/(?:chat|ocr)$/.test(new URL(request.url()).pathname)) aiCalls += 1;
    });
    page.on('requestfailed', request => {
        failedRequests.push({
            url: request.url(),
            errorText: request.failure()?.errorText || ''
        });
    });
    page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === new URL(baseUrl).origin && url.pathname.startsWith('/api/')) {
            apiResponses.push({ path: url.pathname, status: response.status() });
        }
    });
    page.on('console', message => {
        if (message.type() === 'error' || message.type() === 'warning') {
            browserErrors.push(`${message.type()}: ${message.text()}`);
        }
    });

    try {
        if (!useRealAi) {
            await page.route('**/api/ai/**', async route => {
                const url = route.request().url();
                if (url.endsWith('/health')) {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, configured: true }) });
                    return;
                }
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(compatibleChatResponse(rawStrictVisionPayload))
                });
            });
        }

        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '批量录题' }).click();
        await page.waitForTimeout(500);
        const newBatchButton = page.getByRole('button', { name: '创建任务', exact: true });
        if (await newBatchButton.count()) await newBatchButton.click();

        const upload = page.locator('input[type="file"][multiple]');
        if (!await upload.count()) {
            throw new Error(`批量录题未进入创建页：${(await page.locator('body').innerText()).slice(0, 2000)}`);
        }
        await upload.setInputFiles([
            path.join(
                fixtureRoot,
                fixtureScope === 'full'
                    ? `完整版题目.${fixtureFormat}`
                    : `简略版题目（只有一页）.${fixtureFormat}`
            ),
            path.join(fixtureRoot, `完整版答案.${fixtureFormat}`)
        ]);

        const purposeModal = page.locator('.batch-purpose-modal');
        await purposeModal.getByRole('checkbox', { name: '题目', exact: true }).check();
        await purposeModal.getByRole('button', { name: '确认添加' }).click();
        await purposeModal.getByRole('checkbox', { name: '答案', exact: true }).check();
        await purposeModal.getByRole('checkbox', { name: '解析', exact: true }).check();
        await purposeModal.getByRole('button', { name: '确认添加' }).click();

        await page.getByRole('spinbutton', { name: '预计题数（可选，0表示自动识别）' }).fill(String(expectedQuestionCount));
        await page.getByRole('button', { name: '创建识别任务' }).click();
        let observedBatch = null;
        const deadline = Date.now() + (useRealAi ? 300_000 : 120_000);
        while (Date.now() < deadline) {
            observedBatch = await page.evaluate(async () => {
                const probe = new window.Dexie('QisiMathVueDB');
                await probe.open();
                const batches = await probe.table('draftImportBatches').toArray();
                probe.close();
                return batches.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
            });
            if (observedBatch && ['review', 'failed'].includes(observedBatch.status)) break;
            await page.waitForTimeout(1000);
        }
        assert.equal(
            observedBatch?.status,
            'review',
            `批次未进入待审核：${JSON.stringify(observedBatch)}；浏览器错误：${browserErrors.join(' | ')}`
        );
        const continueReviewButton = page.getByRole('button', { name: '继续审核' }).first();
        if (await continueReviewButton.count()) await continueReviewButton.click();
        await page.waitForSelector('.batch-question-nav-item', { timeout: 10_000 });

        const state = await page.evaluate(async () => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const batches = await probe.table('draftImportBatches').toArray();
            const batch = batches.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
            const questions = (await probe.table('draftQuestions').where('batchId').equals(batch.id).toArray())
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            const files = await probe.table('draftImportFiles').where('batchId').equals(batch.id).toArray();
            const formalCount = await probe.table('questions').count();
            probe.close();
            return { batch, questions, files, formalCount };
        });

        assert.equal(state.batch.status, 'review');
        assert.equal(state.questions.length, expectedQuestionCount);
        assert.equal(state.formalCount, 0);
        assert.deepEqual(
            state.questions.map(question => question.questionNumber),
            Array.from({ length: expectedQuestionCount }, (_, index) => String(index + 1))
        );
        const expectedAnswers = ['B', 'C', 'B', 'C', 'D', 'C', 'ABD', 'AC', 'ABD'];
        if (fixtureFormat === 'docx') {
            assert.deepEqual(
                state.questions.slice(0, Math.min(9, expectedQuestionCount)).map(question => question.answer),
                expectedAnswers.slice(0, Math.min(9, expectedQuestionCount))
            );
            assert.equal(state.questions.every(question => String(question.solution || '').trim().length > 0), true);
            assert.equal(state.questions.every(question => (question.options || []).filter(Boolean).length === 4 || Number(question.questionNumber) > 9), true);
            assert.match(state.questions[0].stem, /A=.*\\sin.*\\frac.*\\mathbb\{Z\}/);
            assert.match(state.questions[3].options[1], /\\frac\{1330\\sqrt\{2\}\}\{3\}\\pi/);
            assert.equal((state.questions[3].images || []).length, 1);
            assert.equal((state.questions[1].recognizedSolutionImages || []).length, 1);
            assert.equal((state.questions[5].recognizedSolutionImages || []).length, 1);
            if (fixtureScope === 'full') {
                assert.equal(state.questions[9].answer, '$-\\frac{19}{13}$');
                assert.match(state.questions[10].stem, /\\overrightarrow\{CP\}\\cdot \\overrightarrow\{DP\}/);
                assert.match(state.questions[11].solution, /3\\cos A\\sin B\+2\\sin A\\cos B=\\sin A\\sin B/);
            }
        } else {
            state.questions.slice(0, Math.min(9, expectedQuestionCount)).forEach((question, index) => {
                assert.ok(
                    question.answer === '' || question.answer === expectedAnswers[index],
                    `第 ${index + 1} 题出现错挂答案：${question.answer}`
                );
            });
        }
        assert.equal(state.questions.some(question => /闂傚|待转换|\[object Object\]|undefined|null/i.test([
            question.stem,
            ...(question.options || []),
            question.answer,
            question.solution
        ].join('\n'))), false);
        assert.deepEqual(apiResponses.filter(response => response.status >= 400), []);
        if (fixtureFormat === 'docx') {
            assert.ok(apiResponses.filter(response => response.path === '/api/convert/mathtype-mtef').length >= 2);
        }

        const visualChecks = await collectPreviewChecks(page, expectedQuestionCount);
        visualChecks.forEach((row, index) => {
            if (row.renderErrorCount > 0) row.solutionSource = state.questions[index]?.solution || '';
        });
        if (fixtureFormat === 'docx') {
            assert.equal(
                visualChecks.every(row => row.renderedMathCount > 0),
                true,
                `存在未渲染公式的题目：${JSON.stringify(visualChecks)}`
            );
            assert.equal(
                visualChecks.every(row => row.renderErrorCount === 0 && row.imagePlaceholderCount === 0 && !row.hasRawFailureText),
                true,
                `预览存在公式或图片渲染错误：${JSON.stringify(visualChecks)}`
            );
            const imageQuestionNumbers = fixtureScope === 'full' ? ['2', '4', '6', '8', '11'] : ['2', '4', '6'];
            assert.deepEqual(
                visualChecks.filter(row => row.renderedImageCount > 0).map(row => row.questionNumber),
                imageQuestionNumbers
            );
            if (fixtureScope === 'full') {
                assert.equal(visualChecks.find(row => row.questionNumber === '8')?.renderedImageCount, 2);
            }
        }
        assert.deepEqual(
            browserErrors.filter(message =>
                message.startsWith('pageerror:') ||
                (message.startsWith('error:') && !message.includes('Failed to load resource')) ||
                /\[LATEX_RENDER\]/.test(message)
            ),
            []
        );
        assert.deepEqual(
            failedRequests.filter(request => new URL(request.url).origin === new URL(baseUrl).origin),
            []
        );

        const contentAudit = auditDocxImportContent(state.questions, {
            expectedQuestionNumbers: Array.from({ length: expectedQuestionCount }, (_, index) => String(index + 1)),
            expectedAnalysisImageNumbers: fixtureScope === 'full' ? ['2', '6', '8'] : ['2', '6'],
            visualChecks
        });
        assert.equal(auditIssueCount(contentAudit), 0, JSON.stringify(contentAudit));

        const questionFile = state.files.find(file => (file.roles || []).includes('question'));
        if (fixtureFormat === 'docx') {
            assert.equal(questionFile.producerIdentity, 'docx-xml-importer');
            assert.equal(questionFile.routePolicyDecision, 'deterministic-docx-primary');
            assert.equal(questionFile.selectedSourcePort, 'docx-importer');
            assert.ok(!questionFile.visualSupplementStatus || questionFile.visualSupplementStatus === 'success');
            if (questionFile.visualSupplementStatus === 'partial-manual-review') {
                assert.ok(
                    Array.isArray(questionFile.visualSupplementUnresolved) &&
                    questionFile.visualSupplementUnresolved.length > 0
                );
            }
        }
        if (fixtureFormat === 'docx') assert.equal(aiCalls, 0);
        else assert.ok(aiCalls > 0);

        console.log('[QISI_DUAL_FORMAT_RESULT]', JSON.stringify({
            fixtureFormat,
            fixtureScope,
            status: state.batch.status,
            questionNumbers: state.questions.map(question => question.questionNumber),
            answers: state.questions.map(question => question.answer),
            solutionPresent: state.questions.map(question => Boolean(String(question.solution || '').trim())),
            problemCount: state.batch.problemCount,
            formalCount: state.formalCount,
            aiCalls,
            apiResponses,
            failedRequests,
            contentAudit,
            visualChecks,
            renderedMathCount: visualChecks.reduce((sum, row) => sum + row.renderedMathCount, 0),
            renderedImageQuestionNumbers: visualChecks
                .filter(row => row.renderedImageCount > 0)
                .map(row => row.questionNumber)
        }));

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '批量录题' }).click();
        await page.getByRole('button', { name: /继续审核/ }).first().click();
        await page.waitForSelector('.batch-question-nav-item');
        assert.deepEqual(
            await page.locator('.batch-question-nav-item > span').allTextContents(),
            Array.from({ length: expectedQuestionCount }, (_, index) => `第 ${index + 1} 题`)
        );
        const reloadedQuestions = await page.evaluate(async batchId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const questions = (await probe.table('draftQuestions').where('batchId').equals(batchId).toArray())
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            probe.close();
            return questions;
        }, state.batch.id);
        assert.deepEqual(
            reloadedQuestions.map(persistenceShape),
            state.questions.map(persistenceShape)
        );
        const reloadedVisualChecks = await collectPreviewChecks(page, expectedQuestionCount);
        assert.deepEqual(reloadedVisualChecks, visualChecks);
        console.log('[QISI_PERSISTENCE_ROUNDTRIP]', JSON.stringify({
            fixtureScope,
            questionCount: reloadedQuestions.length,
            renderedMathCount: reloadedVisualChecks.reduce((sum, row) => sum + row.renderedMathCount, 0),
            renderedImageQuestionNumbers: reloadedVisualChecks
                .filter(row => row.renderedImageCount > 0)
                .map(row => row.questionNumber),
            passed: true
        }));
    } finally {
        await context.close();
        await browser.close();
    }
});

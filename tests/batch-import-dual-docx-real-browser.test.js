const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { auditDocxImportContent, auditIssueCount } = require('../scripts/audit-docx-import-content.js');

const enabled = process.env.QISI_REAL_BROWSER === '1';
const useRealAi = process.env.QISI_REAL_AI === '1';
const fixtureFormat = String(process.env.QISI_BATCH_FORMAT || 'docx').toLowerCase();
const fixtureScope = String(process.env.QISI_BATCH_SCOPE || 'simplified').toLowerCase();
const forcePrintAcceptance = process.env.QISI_DUAL_PRINT_ACCEPTANCE === '1';
const expectedQuestionCount = fixtureScope === 'full' ? 12 : 6;
const baseUrl = process.env.QISI_BASE_URL || 'http://localhost:3000/main.html';
const fixtureRoot = process.env.QISI_BATCH_FIXTURE_ROOT || 'C:\\Users\\Administrator\\Desktop\\题目与答案';

const buildRawStrictVisionPayload = questionNumbers => JSON.stringify({
    questions: questionNumbers.map(number => ({
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

const rawStrictVisionPayload = buildRawStrictVisionPayload(
    Array.from({ length: expectedQuestionCount }, (_, index) => index + 1)
);

const compatibleChatResponse = text => ({
    choices: [{ message: { role: 'assistant', content: text } }]
});

const collectPreviewChecks = async (page, questionCount) => {
    const visualChecks = [];
    const questionNavItems = page.locator('.batch-question-nav-item');
    for (let index = 0; index < questionCount; index += 1) {
        await questionNavItems.nth(index).click();
        await page.waitForTimeout(50);
        visualChecks.push(await page.locator('.batch-preview-panel').evaluate((panel, questionNumber) => {
            const plainClone = panel.cloneNode(true);
            plainClone.querySelectorAll('.katex').forEach(node => node.remove());
            const unrenderedLatexFragments = (plainClone.textContent || '').match(
                /\\(?:frac|sqrt|sin|cos|tan|angle|triangle|vec|overrightarrow|overline|cdot|times|in|pi)\b/g
            ) || [];
            return {
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
                unrenderedLatexFragments,
                hasRawFailureText: /公式语法错误|图片暂不可预览/.test(panel.textContent || '')
            };
        }, index + 1));
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

const imageContentRole = image => {
    const explicit = String(image?.contentRole || image?.role || image?.anchorField || '').toLowerCase();
    return ['solution', 'analysis'].includes(explicit) || image?.source === 'pdf-analysis-figure-crop'
        ? 'solution'
        : 'question';
};

const questionImagesOf = question => (question?.images || [])
    .filter(image => imageContentRole(image) === 'question');

const solutionImagesOf = question => {
    const recognized = question?.recognizedSolutionImages || [];
    const rows = recognized.length
        ? recognized
        : (question?.images || []).filter(image => imageContentRole(image) === 'solution');
    return rows.filter((image, index) =>
        rows.findIndex(other => String(other?.id || '') === String(image?.id || '')) === index
    );
};

test('real dual-format import reaches review with rendered content and without unsafe writes', {
    skip: !enabled,
    timeout: 360_000
}, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    let aiCalls = 0;
    const aiModels = [];
    const realAiCallCap = Math.max(1, Number(process.env.QISI_REAL_AI_CALL_CAP || 20));
    const allowedRealAiModels = new Set(['qwen-vl-plus', 'qwen-plus', 'qwen-vl-ocr-latest']);
    let mockQuestionPageCallCount = 0;
    const browserErrors = [];
    const apiResponses = [];
    const failedRequests = [];

    page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
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
        if (useRealAi) {
            await page.route(/\/api\/ai\/(?:chat|ocr)$/, async route => {
                aiCalls += 1;
                let model = '';
                try {
                    model = String(route.request().postDataJSON()?.model || '');
                } catch (_) {
                    model = '';
                }
                aiModels.push(model);
                if (aiCalls > realAiCallCap || !allowedRealAiModels.has(model)) {
                    await route.abort('blockedbyclient');
                    return;
                }
                await route.continue();
            });
        } else {
            await page.route('**/api/ai/**', async route => {
                const url = route.request().url();
                if (url.endsWith('/health')) {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, configured: true }) });
                    return;
                }
                if (/\/api\/ai\/(?:chat|ocr)$/.test(new URL(url).pathname)) aiCalls += 1;
                let responsePayload = rawStrictVisionPayload;
                try {
                    const model = String(route.request().postDataJSON()?.model || '');
                    if (new URL(url).pathname.endsWith('/chat') && model === 'qwen-vl-plus') {
                        mockQuestionPageCallCount += 1;
                        const firstNumber = fixtureScope === 'full' && mockQuestionPageCallCount === 2 ? 7 : 1;
                        const lastNumber = fixtureScope === 'full' && mockQuestionPageCallCount === 2 ? 12 : 6;
                        responsePayload = buildRawStrictVisionPayload(
                            Array.from(
                                { length: lastNumber - firstNumber + 1 },
                                (_, index) => firstNumber + index
                            )
                        );
                    }
                } catch (_) {
                    responsePayload = rawStrictVisionPayload;
                }
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(compatibleChatResponse(responsePayload))
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

        console.log('[QISI_DUAL_FORMAT_OBSERVATION]', JSON.stringify({
            fixtureFormat,
            fixtureScope,
            status: state.batch.status,
            questionNumbers: state.questions.map(question => question.questionNumber),
            answers: state.questions.map(question => question.answer),
            solutionPresent: state.questions.map(question => Boolean(String(question.solution || '').trim())),
            aiCalls,
            aiModels,
            imageAssignments: state.questions.map(question => ({
                questionNumber: question.questionNumber,
                questionImageCount: questionImagesOf(question).length,
                solutionImageCount: solutionImagesOf(question).length,
                questionImageSources: questionImagesOf(question).map(image => image.source || image.sourceType || ''),
                solutionImageSources: solutionImagesOf(question).map(image => image.source || image.sourceType || '')
            })).filter(row => row.questionImageCount || row.solutionImageCount),
            figureDiagnostics: state.questions
                .filter(question => ['4', '8', '11'].includes(String(question.questionNumber)))
                .map(question => ({
                    questionNumber: question.questionNumber,
                    sourcePage: question.sourcePage,
                    hasSourcePageImage: Boolean(question.sourcePageImage || question.sourceTrace?.sourcePageImage),
                    recognizedImages: (question.recognizedImages || []).map(image => ({
                        source: image.source || '',
                        sourcePage: image.sourcePage || 0,
                        bbox: image.image_bbox || image.bbox || []
                    })),
                    warningCount: (question.warnings || []).length,
                    warnings: question.warnings || []
                })),
            apiResponses,
            failedRequests
        }));

        if (useRealAi) {
            assert.ok(aiCalls <= realAiCallCap, `AI call cap exceeded: ${aiCalls}/${realAiCallCap}`);
            assert.equal(
                aiModels.every(model => allowedRealAiModels.has(model)),
                true,
                `unexpected AI model: ${JSON.stringify(aiModels)}`
            );
        }

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
        const expectedQuestionImageNumbers = fixtureScope === 'full' ? ['4', '8', '11'] : ['4'];
        const expectedSolutionImageNumbers = fixtureScope === 'full' ? ['2', '6', '8'] : ['2', '6'];
        assert.deepEqual(
            state.questions
                .filter(question => questionImagesOf(question).length > 0)
                .map(question => question.questionNumber),
            expectedQuestionImageNumbers,
            'question-image ownership must match the source document'
        );
        if (useRealAi || fixtureFormat === 'docx') {
            assert.deepEqual(
                state.questions
                    .filter(question => solutionImagesOf(question).length > 0)
                    .map(question => question.questionNumber),
                expectedSolutionImageNumbers,
                'solution-image ownership must match the source document'
            );
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
        console.log('[QISI_DUAL_VISUAL_OBSERVATION]', JSON.stringify({
            fixtureFormat,
            fixtureScope,
            visualChecks
        }));
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
                visualChecks.every(row => (
                    row.renderErrorCount === 0 &&
                    row.imagePlaceholderCount === 0 &&
                    row.unrenderedLatexFragments.length === 0 &&
                    !row.hasRawFailureText
                )),
                true,
                `预览存在公式或图片渲染错误：${JSON.stringify(visualChecks)}`
            );
        }
        const imageQuestionNumbers = fixtureFormat === 'pdf' && !useRealAi
            ? expectedQuestionImageNumbers
            : (fixtureScope === 'full' ? ['2', '4', '6', '8', '11'] : ['2', '4', '6']);
        assert.deepEqual(
            visualChecks.filter(row => row.renderedImageCount > 0).map(row => row.questionNumber),
            imageQuestionNumbers
        );
        if (fixtureScope === 'full' && (useRealAi || fixtureFormat === 'docx')) {
            assert.equal(visualChecks.find(row => row.questionNumber === '8')?.renderedImageCount, 2);
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
            aiModels,
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

        if (fixtureScope === 'full' && (forcePrintAcceptance || (fixtureFormat === 'pdf' && useRealAi))) {
            const submittedQuestionNumbers = ['4'];
            for (const questionNumber of submittedQuestionNumbers) {
                await page.locator('.batch-question-nav-item').nth(Number(questionNumber) - 1).click();
                await page.waitForFunction(expectedLabel =>
                    document.querySelector('.batch-question-nav-item.active > span')?.textContent?.trim() === expectedLabel,
                `\u7b2c ${questionNumber} \u9898`, { timeout: 10_000 });
                await page.getByRole('button', { name: '\u4e00\u952e\u63d0\u4ea4\u672c\u9898', exact: true }).click();
                await page.waitForFunction(async ({ expected, draftId }) => {
                    const probe = new window.Dexie('QisiMathVueDB');
                    await probe.open();
                    const count = await probe.table('questions').count();
                    const draft = await probe.table('draftQuestions').get(draftId);
                    probe.close();
                    return count >= expected && draft?.status === 'submitted';
                }, {
                    expected: submittedQuestionNumbers.indexOf(questionNumber) + 1,
                    draftId: state.questions[Number(questionNumber) - 1].id
                }, { timeout: 30_000 });
                await page.waitForTimeout(300);
                const stableFormalCount = await page.evaluate(async () => {
                    const probe = new window.Dexie('QisiMathVueDB');
                    await probe.open();
                    const count = await probe.table('questions').count();
                    probe.close();
                    return count;
                });
                assert.equal(stableFormalCount, submittedQuestionNumbers.indexOf(questionNumber) + 1);
            }

            await page.getByRole('button', { name: '\u9898\u5e93\u4e0e\u68c0\u7d22' }).click();
            await page.getByRole('button', { name: '\u7cfb\u7edf\u77e5\u8bc6\u70b9', exact: true }).click();
            await page.getByRole('button', { name: '\u91cd\u7f6e\u7b5b\u9009', exact: true }).click();
            const cards = page.locator('.question-card');
            console.log('[QISI_LIBRARY_SUBMIT_OBSERVATION]', JSON.stringify(await page.evaluate(async () => {
                const probe = new window.Dexie('QisiMathVueDB');
                await probe.open();
                const formalQuestions = await probe.table('questions').toArray();
                probe.close();
                return {
                    formalQuestions: formalQuestions.map(question => ({
                        id: question.id,
                        questionNumber: question.questionNumber,
                        stemHead: String(question.stem || '').slice(0, 40)
                    })),
                    cardCount: document.querySelectorAll('.question-card').length,
                    libraryTextHead: document.querySelector('.question-flow')?.textContent?.trim().slice(0, 500) || '',
                    activeMode: document.querySelector('.material-segmented .active')?.textContent?.trim() || ''
                };
            })));
            await page.waitForFunction(
                expected => document.querySelectorAll('.question-card').length >= expected,
                submittedQuestionNumbers.length,
                { timeout: 30_000 }
            );
            assert.equal(await cards.count(), submittedQuestionNumbers.length);
            for (let index = 0; index < submittedQuestionNumbers.length; index += 1) {
                await cards.nth(index).getByRole('button', { name: '\u9009\u9898', exact: true }).click();
            }
            await page.getByRole('button', { name: '\u667a\u80fd\u7ec4\u5377\u53f0' }).click();

            const popupPromise = page.waitForEvent('popup');
            await page.getByRole('button', { name: '\u6253\u5370 PDF', exact: true }).click();
            const popup = await popupPromise;
            await popup.waitForLoadState('domcontentloaded');
            await popup.waitForFunction(
                () => ['true', 'error'].includes(document.documentElement.dataset.qisiPreviewReady),
                null,
                { timeout: 30_000 }
            );
            const printAcceptance = await popup.evaluate(() => ({
                ready: document.documentElement.dataset.qisiPreviewReady,
                pageCount: document.querySelectorAll('.qisi-paper-page').length,
                questionCount: document.querySelectorAll('.qisi-paper-page .exam-question').length,
                imageCount: document.querySelectorAll('.qisi-paper-page img.print-image').length,
                brokenImageCount: [...document.images].filter(image => !image.complete || !image.naturalWidth).length,
                renderErrorCount: document.querySelectorAll('.latex-render-error').length,
                rawMarkerCount: (document.body.textContent || '').match(/QISI_(?:LAYOUT|TABLE)_(?:BEGIN|END)/g)?.length || 0,
                overflowCount: [...document.querySelectorAll('.qisi-paper-page')].filter(pageNode => {
                    const content = pageNode.querySelector('.qisi-page-content');
                    return content && content.scrollHeight > content.clientHeight + 2;
                }).length
            }));
            assert.deepEqual(printAcceptance, {
                ready: 'true',
                pageCount: printAcceptance.pageCount,
                questionCount: submittedQuestionNumbers.length,
                imageCount: submittedQuestionNumbers.length,
                brokenImageCount: 0,
                renderErrorCount: 0,
                rawMarkerCount: 0,
                overflowCount: 0
            });
            assert.ok(printAcceptance.pageCount >= 1);
            console.log('[QISI_DUAL_PRINT_ACCEPTANCE]', JSON.stringify({ fixtureFormat, ...printAcceptance }));
        }
    } finally {
        await context.close();
        await browser.close();
    }
});

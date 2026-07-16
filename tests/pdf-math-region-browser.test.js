const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const { auditIssueCount, auditPdfImportContent } = require('../scripts/audit-pdf-import-content.js');
const {
    buildReplayMetadata,
    collectImagePayloads,
    collectPromptText,
    loadReplayEntries,
    saveReplayEntry,
    sha256
} = require('../scripts/pdf-engine-replay-store.js');

const enabled = process.env.QISI_PDF_BROWSER === '1';
const realCapture = process.env.QISI_PDF_REAL_CAPTURE === '1';
const capturedReplay = process.env.QISI_PDF_CAPTURE_REPLAY === '1';
const datasetName = process.env.QISI_PDF_DATASET === 'full' ? 'full' : 'brief';
const baseUrl = process.env.QISI_BASE_URL || 'http://localhost:3000/main.html';
const fixtureRoot = process.env.QISI_BATCH_FIXTURE_ROOT || 'C:\\Users\\Administrator\\Desktop\\题目与答案';
const dataset = datasetName === 'full'
    ? {
        questionFile: '完整版题目.pdf',
        answerFile: '完整版答案.pdf',
        questionRange: '1-2',
        answerRange: '1-4',
        questionSha256: '50DC9A7E98299807F45521A50048240010BE78212A21C840C30B2149739DD75D',
        questionNumbers: Array.from({ length: 12 }, (_, index) => String(index + 1)),
        answers: ['B', 'C', 'B', 'C', 'D', 'C', 'ABD', 'AC', 'ABD', '$-\\frac{19}{13}$', '6', '$\\frac{\\sqrt{2}+1}{2}$'],
        stemFigures: ['4', '8', '11'],
        analysisFigures: ['6', '8']
    }
    : {
        questionFile: '简略版题目（只有一页）.pdf',
        answerFile: '完整版答案.pdf',
        questionRange: '1',
        answerRange: '1-2',
        questionSha256: '1E1B402221FA5BCB802B878FC06D2F3915C95E58BCBB89B1D295A07F9E65C890',
        questionNumbers: ['1', '2', '3', '4', '5', '6'],
        answers: ['B', 'C', 'B', 'C', 'D', 'C'],
        stemFigures: ['4'],
        analysisFigures: ['6']
    };
const replay = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'pdf-replay', 'brief-engine-replay.json'),
    'utf8'
));

const compatibleChatResponse = value => ({
    choices: [{ message: { role: 'assistant', content: JSON.stringify(value) } }]
});

const compatibleOcrResponse = text => ({
    output: { choices: [{ message: { role: 'assistant', content: [{ text }] } }] }
});

const waitForLatestBatch = async (page, timeoutMs = 180000) => {
    const deadline = Date.now() + timeoutMs;
    let latest = null;
    while (Date.now() < deadline) {
        latest = await page.evaluate(async () => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const batches = await probe.table('draftImportBatches').toArray();
            probe.close();
            return batches.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
        });
        if (latest && ['review', 'failed'].includes(latest.status)) return latest;
        await page.waitForTimeout(500);
    }
    return latest;
};

test('dual PDF normal UI uses local answer evidence and preserves renderable content', {
    skip: !enabled,
    timeout: 240000
}, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const browserErrors = [];
    const apiCalls = [];
    const capturePromises = [];
    const capturedPaths = [];
    const explicitEvidenceLogs = [];
    const optionEvidenceLogs = [];
    const questionFigureBindingLogs = [];
    const pdfDebugConsole = [];
    const structuredConsoleErrors = [];
    const requestBodies = new WeakMap();
    let ocrPageIndex = 0;
    let realQuestionPage = 0;
    let realAnswerPage = 0;
    const capturedReplayEntries = capturedReplay
        ? loadReplayEntries(path.join(
            __dirname,
            '..',
            'artifacts',
            'debug',
            'pdf-math-region-content-integrity-r1',
            'raw-engine',
            datasetName
        )).sort((left, right) => String(left.capturedAt).localeCompare(String(right.capturedAt)))
        : [];

    page.on('pageerror', error => browserErrors.push(`pageerror:${error.message}`));
    page.on('console', message => {
        if (message.text().includes('BATCH_PDF') || message.text().includes('pdf-layout')) {
            pdfDebugConsole.push(`${message.type()}:${message.text()}`);
        }
        if (message.text().startsWith('[BATCH_PDF_EXPLICIT_ANSWER_EVIDENCE]')) {
            capturePromises.push(
                Promise.all(message.args().map(argument => argument.jsonValue()))
                    .then(values => explicitEvidenceLogs.push(values))
            );
        }
        if (message.text().startsWith('[BATCH_PDF_TEXT_OPTION_EVIDENCE]')) {
            capturePromises.push(
                Promise.all(message.args().map(argument => argument.jsonValue()))
                    .then(values => optionEvidenceLogs.push(values))
            );
        }
        if (message.text().startsWith('[BATCH_PDF_QUESTION_FIGURE_BINDING]')) {
            capturePromises.push(
                Promise.all(message.args().map(argument => argument.jsonValue()))
                    .then(values => questionFigureBindingLogs.push(values))
            );
        }
        if (['error', 'warning'].includes(message.type())) {
            browserErrors.push(`${message.type()}:${message.text()}`);
            capturePromises.push(
                Promise.all(message.args().map(argument => argument.jsonValue().catch(() => String(argument))))
                    .then(values => structuredConsoleErrors.push(values))
            );
        }
    });

    if (realCapture) {
        const captureDirectory = path.join(
            __dirname,
            '..',
            'artifacts',
            'debug',
            'pdf-math-region-content-integrity-r1',
            'raw-engine',
            datasetName
        );
        page.on('request', request => {
            const url = new URL(request.url());
            if (!url.pathname.startsWith('/api/ai/') || url.pathname.endsWith('/health')) return;
            let body = {};
            try { body = request.postDataJSON() || {}; } catch { body = {}; }
            requestBodies.set(request, body);
            apiCalls.push({ path: url.pathname, model: body.model || '', real: true });
        });
        page.on('response', response => {
            const request = response.request();
            const url = new URL(request.url());
            if (!url.pathname.startsWith('/api/ai/') || url.pathname.endsWith('/health')) return;
            const capture = (async () => {
                const body = requestBodies.get(request) || {};
                const prompt = collectPromptText(body);
                const isOcr = url.pathname.endsWith('/ocr');
                const isQuestionPage = !isOcr && /question_bbox/.test(prompt);
                const isQuestionFigure = !isOcr && /image_bbox/.test(prompt);
                const pageNo = isOcr
                    ? ++realAnswerPage
                    : (isQuestionPage
                        ? Math.max(1, ++realQuestionPage)
                        : (isQuestionFigure ? Math.max(1, realQuestionPage) : 0));
                const sourceFileSha256 = isOcr || (!isQuestionPage && !isQuestionFigure)
                    ? '48549EADEEE80340D3F58062762B724F56471C903F5EE0C3BDF2DBEC25762C7F'
                    : dataset.questionSha256;
                const responseBody = await response.json();
                const metadata = buildReplayMetadata({
                    requestBody: body,
                    sourceFileSha256,
                    page: pageNo,
                    renderDpi: 144,
                    promptVersion: 'pdf-math-region-r1',
                    endpoint: url.pathname
                });
                capturedPaths.push(saveReplayEntry({
                    directory: captureDirectory,
                    metadata,
                    responseBody
                }));
            })();
            capturePromises.push(capture);
        });
    }

    if (!realCapture) await page.route('**/api/ai/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith('/health')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, configured: true })
            });
            return;
        }

        const body = request.postDataJSON() || {};
        apiCalls.push({ path: url.pathname, model: body.model || '' });

        if (capturedReplay) {
            const requestPromptSha256 = sha256(collectPromptText(body));
            const requestImageSha256 = collectImagePayloads(body).map(sha256);
            const entryIndex = capturedReplayEntries.findIndex(entry =>
                entry.metadata?.endpoint === url.pathname &&
                (!entry.metadata?.model || entry.metadata.model === (body.model || '')) &&
                entry.metadata?.promptSha256 === requestPromptSha256 &&
                JSON.stringify(entry.metadata?.imageSha256 || []) === JSON.stringify(requestImageSha256)
            );
            if (entryIndex < 0) {
                const diagnostic = {
                    missing: {
                        endpoint: url.pathname,
                        model: body.model || '',
                        promptSha256: requestPromptSha256,
                        imageSha256: requestImageSha256
                    },
                    remaining: capturedReplayEntries.map(entry => ({
                        endpoint: entry.metadata?.endpoint,
                        model: entry.metadata?.model,
                        page: entry.metadata?.page
                    }))
                };
                browserErrors.push(`capture-replay-miss:${JSON.stringify(diagnostic)}`);
                await route.fulfill({
                    status: 599,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: diagnostic })
                });
                return;
            }
            const [entry] = capturedReplayEntries.splice(entryIndex, 1);
            console.log('[PDF_CAPTURE_REPLAY]', JSON.stringify({
                endpoint: url.pathname,
                model: body.model || '',
                page: entry.metadata?.page
            }));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(entry.response)
            });
            return;
        }

        if (url.pathname.endsWith('/ocr')) {
            const text = replay.supportOcrPages[Math.min(ocrPageIndex, replay.supportOcrPages.length - 1)];
            ocrPageIndex += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(compatibleOcrResponse(text))
            });
            return;
        }

        const prompt = (body.messages || []).flatMap(message =>
            typeof message.content === 'string'
                ? [message.content]
                : (message.content || []).map(part => part?.text || '')
        ).join('\n');

        let response = replay.supportStructuredResponse;
        if (/question_bbox/.test(prompt) && /不要识别答案或解析/.test(prompt)) {
            response = replay.questionResponse;
        } else if (/题图.*定位|image_bbox.*题中真正/.test(prompt)) {
            response = [{
                question: '4',
                image_bbox: [120, 570, 800, 690],
                image_description: '折扇与扇形示意图',
                image_confidence: 0.96
            }];
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(compatibleChatResponse(response))
        });
    });

    try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '批量录题', exact: true }).click();
        const createButton = page.getByRole('button', { name: '创建任务', exact: true });
        if (await createButton.count()) await createButton.click();

        const upload = page.locator('input[type="file"][multiple]');
        assert.equal(await upload.count(), 1);
        await upload.setInputFiles([
            path.join(fixtureRoot, dataset.questionFile),
            path.join(fixtureRoot, dataset.answerFile)
        ]);

        const purposeModal = page.locator('.batch-purpose-modal');
        await purposeModal.getByRole('checkbox', { name: '题目', exact: true }).check();
        await purposeModal.getByRole('button', { name: '确认添加', exact: true }).click();
        await purposeModal.getByRole('checkbox', { name: '答案', exact: true }).check();
        await purposeModal.getByRole('checkbox', { name: '解析', exact: true }).check();
        await purposeModal.getByRole('button', { name: '确认添加', exact: true }).click();

        const questionCard = page.locator('.batch-file-card').filter({ hasText: dataset.questionFile });
        const answerCard = page.locator('.batch-file-card').filter({ hasText: dataset.answerFile });
        assert.equal(await questionCard.count(), 1);
        assert.equal(await answerCard.count(), 1);
        await questionCard.locator('.batch-page-range input').fill(dataset.questionRange);
        await answerCard.locator('.batch-page-range input').fill(dataset.answerRange);

        await page.getByRole('spinbutton', { name: '预计题数（可选，0表示自动识别）' }).fill(String(dataset.questionNumbers.length));
        await page.getByRole('button', { name: '创建识别任务', exact: true }).click();

        const latestBatch = await waitForLatestBatch(page);
        assert.equal(latestBatch?.status, 'review', JSON.stringify({ latestBatch, browserErrors }));

        const continueReview = page.getByRole('button', { name: '继续审核', exact: true });
        if (await continueReview.count()) await continueReview.click();
        await page.waitForSelector('.batch-question-nav-item');

        const state = await page.evaluate(async batchId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const questions = (await probe.table('draftQuestions').where('batchId').equals(batchId).toArray())
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            const images = await probe.table('draftImages').where('batchId').equals(batchId).toArray();
            const formalCount = await probe.table('questions').count();
            probe.close();
            return { questions, images, formalCount };
        }, latestBatch.id);
        const displayNormalizationDebug = datasetName === 'full'
            ? await page.evaluate(source => {
                const normalized = window.Qisi.Utils.normalizeBareLatexForDisplayText(source);
                return {
                    normalized,
                    outsideMath: normalized.replace(/\$[^$]*\$/g, '')
                };
            }, state.questions[10]?.solution || '')
            : null;
        await Promise.all(capturePromises);

        assert.equal(state.questions.length, dataset.questionNumbers.length);
        assert.deepEqual(state.questions.map(question => question.questionNumber), dataset.questionNumbers);
        assert.deepEqual(state.questions.map(question => question.answer), dataset.answers);
        assert.equal(state.formalCount, 0);
        assert.equal(state.questions.every(question => String(question.solution || '').trim()), true);
        assert.deepEqual(state.questions[1].options, ['3', '4', '5', '6']);
        assert.match(state.questions[3].options[1], /\$\\frac\{1330\\sqrt\{2\}\}\{3\}\\pi\$/);
        assert.ok(
            state.questions[3].images.length >= 1,
            JSON.stringify({
                question: state.questions[3].questionNumber,
                sourcePage: state.questions[3].sourcePage,
                sourceBbox: state.questions[3].sourceBbox,
                normalizedQuestionBbox: state.questions[3].normalizedQuestionBbox,
                recognizedImages: state.questions[3].recognizedImages,
                warnings: state.questions[3].warnings,
                questionRegions: state.questions.map(question => ({
                    question: question.questionNumber,
                    sourcePage: question.sourcePage,
                    sourceBbox: question.sourceBbox,
                    normalizedQuestionBbox: question.normalizedQuestionBbox
                })),
                draftImageRows: state.images
                    .filter(image => image.questionId === state.questions[3].id)
                    .map(image => ({ bbox: image.bbox, sourcePage: image.sourcePage, status: image.status })),
                questionFigureBindingLogs,
                browserErrors,
                pdfDebugConsole
            })
        );
        assert.match(state.questions[5].solution, /\\left\(\\frac\{?1\}?\{?3\}?\\right\)\^3=\\frac\{?1\}?\{?27\}?/);
        assert.ok(
            state.questions[5].sourceTrace?.answerEvidence,
            JSON.stringify({
                answer: state.questions[5].answer,
                answerEvidence: state.questions[5].answerEvidence,
                sourceTraceAnswerEvidence: state.questions[5].sourceTrace?.answerEvidence,
                explicitEvidenceLogs
            })
        );

        const previewChecks = [];
        const navItems = page.locator('.batch-question-nav-item');
        assert.equal(await navItems.count(), dataset.questionNumbers.length);
        for (let index = 0; index < dataset.questionNumbers.length; index += 1) {
            await navItems.nth(index).click();
            const check = await page.locator('.batch-preview-panel').evaluate(panel => {
                const currentImageCard = [...panel.querySelectorAll('.batch-preview-card')]
                    .find(card => (card.querySelector('h2')?.textContent || '').includes('\u5f53\u524d\u9898\u76ee\u56fe\u7247'));
                return {
                    katex: panel.querySelectorAll('.katex').length,
                    images: panel.querySelectorAll('.qisi-preview-image img').length,
                    currentImages: currentImageCard?.querySelectorAll('.batch-image-item img').length || 0,
                    questionImages: currentImageCard?.querySelectorAll('.batch-image-item img').length || 0,
                    analysisImages: [...panel.querySelectorAll('.batch-preview-card')]
                        .find(card => (card.querySelector('h2')?.textContent || '').includes('\u5f53\u524d\u89e3\u6790\u56fe\u7247'))
                        ?.querySelectorAll('.batch-image-item img').length || 0,
                    errors: panel.querySelectorAll('.latex-render-error').length,
                    text: panel.innerText || panel.textContent || ''
                };
            });
            previewChecks.push(check);
        }
        assert.equal(previewChecks.every(check => check.katex > 0 && check.errors === 0), true);
        assert.equal(previewChecks[3].images > 0, true);
        for (const questionNumber of dataset.stemFigures) {
            assert.ok(
                previewChecks[Number(questionNumber) - 1].questionImages >= 1,
                JSON.stringify({
                    questionNumber,
                    check: previewChecks[Number(questionNumber) - 1],
                    questionFigureBindingLogs
                })
            );
        }
        for (const questionNumber of dataset.analysisFigures) {
            assert.ok(
                previewChecks[Number(questionNumber) - 1].analysisImages >= 1,
                JSON.stringify({ questionNumber, check: previewChecks[Number(questionNumber) - 1] })
            );
        }
        assert.equal(
            previewChecks.every(check => !/\\text\s*\{|\\(?:overline|sqrt|therefore|cdot)\b/.test(check.text)),
            true,
            JSON.stringify({
                displayNormalizationDebug,
                q11Preview: previewChecks[10]?.text || ''
            })
        );

        for (const questionNumber of dataset.stemFigures) {
            const question = state.questions[Number(questionNumber) - 1];
            const rows = state.images.filter(image => image.questionId === question.id);
            assert.ok(
                rows.some(image =>
                    image.source === 'pdf-embedded-image-placement' &&
                    image.status === 'bound' &&
                    image.confidence === 1
                ),
                JSON.stringify({ questionNumber, rows: rows.map(({ url, ...row }) => row) })
            );
            assert.ok(
                question.images.some(image =>
                    image.source === 'pdf-embedded-image-placement' &&
                    image.status === 'bound' &&
                    image.confidence === 1
                ),
                JSON.stringify({ questionNumber, images: question.images.map(({ url, ...image }) => image) })
            );
            assert.match(question.stem, /\[\[IMAGE:[^\]]+\]\]/);
        }
        for (const questionNumber of dataset.analysisFigures) {
            const question = state.questions[Number(questionNumber) - 1];
            const rows = state.images.filter(image => image.questionId === question.id);
            assert.ok(
                rows.some(image =>
                    image.source === 'pdf-analysis-figure-crop' &&
                    image.status === 'bound' &&
                    image.confidence === 1
                ),
                JSON.stringify({ questionNumber, rows: rows.map(({ url, ...row }) => row) })
            );
            assert.match(question.solution, /\[\[IMAGE:[^\]]+\]\]/);
        }

        assert.equal(
            await page.getByRole('button', { name: '\u6807\u8bb0\u5df2\u786e\u8ba4', exact: true }).count(),
            0
        );
        assert.equal(
            await page.getByRole('button', { name: '\u4e00\u952e\u63d0\u4ea4\u672c\u9898', exact: true }).count(),
            1
        );
        assert.equal(
            await page.getByRole('button', { name: '\u4e00\u952e\u63d0\u4ea4', exact: true }).count(),
            1
        );

        await navItems.nth(3).click();
        const questionImageCard = page.locator('.batch-preview-card').filter({
            has: page.getByRole('heading', { name: '\u5f53\u524d\u9898\u76ee\u56fe\u7247', exact: true })
        });
        assert.equal(await questionImageCard.count(), 1);
        await questionImageCard.getByRole('button', { name: '\u56fe\u7247\u4f4d\u7f6e', exact: true }).click();
        await questionImageCard.getByRole('button', { name: '\u9760\u53f3', exact: true }).click();
        await page.waitForFunction(async questionId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const images = await probe.table('draftImages').where('questionId').equals(questionId).toArray();
            probe.close();
            return images.some(image => image.align === 'right');
        }, state.questions[3].id);
        const propertyCard = page.locator('.batch-editor-card').filter({
            has: page.getByRole('heading', { name: '\u9898\u76ee\u5c5e\u6027', exact: true })
        });
        await propertyCard.getByLabel('\u5e74\u4efd', { exact: true }).fill('2026');
        const saveButton = page.getByRole('button', { name: /\u4fdd\u5b58\u4fee\u6539/ });
        assert.equal(await saveButton.count(), 1);
        await saveButton.click();
        try {
            await page.getByText('\u9898\u76ee\u3001\u7b54\u6848\u548c\u89e3\u6790\u4fee\u6539\u5df2\u4fdd\u5b58\u3002', { exact: true })
                .waitFor({ timeout: 5000 });
        } catch (error) {
            await Promise.all(capturePromises);
            const diagnostic = await page.evaluate(async questionId => {
                const probe = new window.Dexie('QisiMathVueDB');
                await probe.open();
                const question = await probe.table('draftQuestions').get(questionId);
                probe.close();
                return {
                    year: question?.year || '',
                    toast: document.querySelector('.batch-toast')?.textContent || '',
                    activeQuestion: document.querySelector('.batch-question-nav-item.active span')?.textContent || ''
                };
            }, state.questions[3].id);
            assert.fail(JSON.stringify({ diagnostic, browserErrors, structuredConsoleErrors, cause: error.message }));
        }
        await page.waitForFunction(async questionId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const question = await probe.table('draftQuestions').get(questionId);
            probe.close();
            return question?.year === '2026';
        }, state.questions[3].id);

        const interactionState = await page.evaluate(async questionId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const question = await probe.table('draftQuestions').get(questionId);
            const images = await probe.table('draftImages').where('questionId').equals(questionId).toArray();
            const formalCount = await probe.table('questions').count();
            probe.close();
            return { question, images, formalCount };
        }, state.questions[3].id);
        assert.equal(interactionState.question.year, '2026');
        assert.match(interactionState.question.stem, /\\begin\{wrapfigure\}\{r\}/);
        assert.ok(interactionState.question.images.some(image => image.align === 'right'));
        assert.ok(interactionState.images.some(image => image.align === 'right'));
        assert.equal(interactionState.formalCount, 0);

        if (datasetName === 'full') {
            const fieldText = question => [question.stem, ...(question.options || []), question.solution].join('\n');
            assert.match(fieldText(state.questions[0]), /\\sin/);
            assert.match(fieldText(state.questions[0]), /\\frac/);
            assert.match(fieldText(state.questions[0]), /\\in/);
            assert.equal(state.questions[3].answer, 'C');
            assert.match(state.questions[3].options[1], /^\$\\frac\{1330\\sqrt\{2\}\}\{3\}\\pi\$$/);
            assert.equal(state.questions[5].answer, 'C');
            assert.deepEqual(
                state.questions[5].options,
                ['1:8', '1:9', '1:26', '1:27'],
                JSON.stringify(optionEvidenceLogs)
            );
            assert.ok(
                state.questions[5].images.length >= 1,
                JSON.stringify({
                    solutionPageImage: Boolean(state.questions[5].solutionPageImage),
                    recognizedSolutionImages: state.questions[5].recognizedSolutionImages,
                    inlineImages: state.questions[5].images,
                    draftImageRows: state.images.filter(image => image.questionId === state.questions[5].id),
                    cropWarnings: browserErrors.filter(message => message.includes('解析图片裁剪失败'))
                })
            );
            assert.ok(state.questions[5].images.some(image => image.source === 'pdf-analysis-figure-crop'));
            assert.ok(state.questions[5].images.some(image => image.sourcePage === 2));
            assert.ok(previewChecks[5].analysisImages >= 1);
            assert.match(fieldText(state.questions[6]), /\\left/);
            assert.match(fieldText(state.questions[6]), /\\right/);
            assert.ok(state.questions[7].images.length >= 1);
            assert.ok(state.questions[7].images.some(image => image.source === 'pdf-analysis-figure-crop'));
            assert.ok(
                state.questions[7].images.some(image => image.sourcePage === 3),
                JSON.stringify({
                    solutionSourcePage: state.questions[7].solutionSourcePage,
                    recognizedSolutionImages: state.questions[7].recognizedSolutionImages,
                    images: state.questions[7].images.map(({ url, ...image }) => image),
                    draftImages: state.images
                        .filter(image => image.questionId === state.questions[7].id)
                        .map(({ url, ...image }) => image)
                })
            );
            assert.ok(previewChecks[7].analysisImages >= 1);
            assert.equal(state.questions[10].answer, '6');
            for (const command of ['overrightarrow', 'cdot', 'sqrt', 'therefore']) {
                assert.match(fieldText(state.questions[10]), new RegExp(`\\\\${command}`));
            }
            assert.equal(previewChecks[10].errors, 0);
            assert.doesNotMatch(
                previewChecks[10].text,
                /\\text\s*\{|\\(?:overline|overrightarrow|sqrt|therefore|cdot)\b/,
                JSON.stringify(displayNormalizationDebug)
            );
        }

        const audit = auditPdfImportContent(state.questions, {
            expectedQuestionNumbers: dataset.questionNumbers,
            expectedAnswerNumbers: dataset.questionNumbers,
            expectedAnalysisNumbers: dataset.questionNumbers,
            expectedStemFigureNumbers: dataset.stemFigures,
            expectedAnalysisFigureNumbers: dataset.analysisFigures
        });
        assert.equal(
            auditIssueCount(audit),
            0,
            JSON.stringify({
                audit,
                firstQuestionOptions: state.questions[0]?.options || [],
                analysisFigures: state.questions.map(question => ({
                    question: question.questionNumber,
                    recognizedSolutionImages: question.recognizedSolutionImages || [],
                    solutionSourcePage: question.solutionSourcePage || 0
                }))
            })
        );
        assert.deepEqual(
            browserErrors.filter(message => message.startsWith('pageerror:') || /\[LATEX_RENDER\]/.test(message)),
            []
        );
        assert.deepEqual(
            browserErrors.filter(message =>
                /DataCloneError|set-placement-failed|Vue \u8fd0\u884c\u9519\u8bef|\u672a\u5904\u7406\u7684\u5f02\u6b65\u9519\u8bef/.test(message)
            ),
            []
        );

        await page.reload({ waitUntil: 'domcontentloaded' });
        const persisted = await page.evaluate(async batchId => {
            const probe = new window.Dexie('QisiMathVueDB');
            await probe.open();
            const questions = (await probe.table('draftQuestions').where('batchId').equals(batchId).toArray())
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            probe.close();
            return questions.map(question => ({
                questionNumber: question.questionNumber,
                answer: question.answer,
                year: question.year,
                stem: question.stem,
                richFields: question.richFields,
                contentIntegrity: question.contentIntegrity,
                normalizedQuestionBbox: question.normalizedQuestionBbox,
                images: question.images || [],
                recognizedSolutionImages: question.recognizedSolutionImages || []
            }));
        }, latestBatch.id);
        assert.equal(persisted.length, dataset.questionNumbers.length);
        assert.equal(persisted[3].year, '2026');
        assert.match(persisted[3].stem, /\\begin\{wrapfigure\}\{r\}/);
        assert.equal(persisted.every(question => question.richFields && question.contentIntegrity), true);
        assert.equal(
            persisted.every(question => question.normalizedQuestionBbox.length === 4),
            true,
            JSON.stringify(persisted.map(question => ({
                questionNumber: question.questionNumber,
                normalizedQuestionBbox: question.normalizedQuestionBbox
            })))
        );
        if (datasetName === 'full') {
            for (const index of [5, 7]) {
                assert.ok(persisted[index].recognizedSolutionImages.length >= 1);
                assert.ok(persisted[index].images.some(image => image.source === 'pdf-analysis-figure-crop'));
            }

            const continueAfterReload = page.getByRole('button', { name: '继续审核', exact: true });
            if (await continueAfterReload.count()) await continueAfterReload.click();
            await page.waitForSelector('.batch-question-nav-item');
            const reloadedNavItems = page.locator('.batch-question-nav-item');
            for (const index of [5, 7]) {
                await reloadedNavItems.nth(index).click();
                const reloadedCheck = await page.locator('.batch-preview-panel').evaluate(panel => {
                    const currentImageCard = [...panel.querySelectorAll('.batch-preview-card')]
                        .find(card => (card.querySelector('h2')?.textContent || '').includes('\u5f53\u524d\u9898\u76ee\u56fe\u7247'));
                    return {
                        currentImages: currentImageCard?.querySelectorAll('.batch-image-item img').length || 0,
                        analysisImages: [...panel.querySelectorAll('.batch-preview-card')]
                            .find(card => (card.querySelector('h2')?.textContent || '').includes('\u5f53\u524d\u89e3\u6790\u56fe\u7247'))
                            ?.querySelectorAll('.batch-image-item img').length || 0,
                        errors: panel.querySelectorAll('.latex-render-error').length
                    };
                });
                assert.equal(reloadedCheck.errors, 0);
                assert.ok(reloadedCheck.analysisImages >= 1);
            }
        }
        console.log('[PDF_MATH_REGION_BROWSER_RESULT]', JSON.stringify({
            status: realCapture ? 'pass-real-capture' : (capturedReplay ? 'pass-captured-replay' : 'pass'),
            dataset: datasetName,
            questionNumbers: state.questions.map(question => question.questionNumber),
            answers: state.questions.map(question => question.answer),
            apiCalls,
            audit,
            previewChecks: previewChecks.map(({ text, ...check }) => check),
            figureEvidence: state.questions.map(question => ({
                questionNumber: question.questionNumber,
                questionBbox: question.normalizedQuestionBbox,
                images: (question.images || []).map(image => ({
                    source: image.source || '',
                    sourcePage: image.sourcePage || 0,
                    bbox: image.bbox || []
                })),
                analysisImages: (question.recognizedSolutionImages || []).map(image => ({
                    source: image.source || '',
                    sourcePage: image.sourcePage || 0,
                    bbox: image.normalizedBbox || image.image_bbox || []
                }))
            })),
            formalCount: state.formalCount,
            persistencePassed: true,
            capturedPaths
        }));
    } finally {
        await context.close();
        await browser.close();
    }
});

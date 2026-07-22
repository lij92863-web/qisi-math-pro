const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const enabled = process.env.QISI_REAL_DOCX_LAYOUT === '1';
const baseUrl = process.env.QISI_BASE_URL || 'http://localhost:3000/main.html';
const fixtureRoot = process.env.QISI_DOCX_LAYOUT_ROOT || 'C:\\Users\\Administrator\\Desktop\\题目与答案';
const expectedQuestionCount = 19;
const allSourceFiles = [
    '广东佛山市第一中学2026届高三一模检测数学试题.docx',
    '广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).docx',
    '广东省十二所重点中学校2026届高三年级第一次模拟考（十二校一模）数学试题.docx',
    '河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷.docx',
    '湖北省武汉市2025届高三下学期毕业生四月调研考试数学试题.docx'
].map(name => path.join(fixtureRoot, name));
const requestedFile = String(process.env.QISI_DOCX_LAYOUT_FILE || '').trim();
const purposeRole = process.env.QISI_DOCX_LAYOUT_ROLE === 'full'
    ? '题目 + 答案 + 解析'
    : '题目';
const sourceFiles = requestedFile
    ? allSourceFiles.filter(file => file.includes(requestedFile))
    : allSourceFiles;

const readState = page => page.evaluate(async () => {
    const probe = new window.Dexie('QisiMathVueDB');
    await probe.open();
    const batches = await probe.table('draftImportBatches').toArray();
    const batch = batches.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
    const questions = batch
        ? (await probe.table('draftQuestions').where('batchId').equals(batch.id).toArray())
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        : [];
    const formalCount = await probe.table('questions').count();
    probe.close();
    return { batch, questions, formalCount };
});

test('real DOCX layout evidence survives the normal UI without AI/OCR', {
    skip: !enabled,
    timeout: 900_000
}, async () => {
    const browser = await chromium.launch({
        headless: process.env.QISI_SHOW_BROWSER !== '1',
        slowMo: process.env.QISI_SHOW_BROWSER === '1' ? 20 : 0
    });
    try {
        for (const file of sourceFiles) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const errors = [];
            const apiFailures = [];
            let forbiddenCalls = 0;

            page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
            page.on('console', message => {
                if (message.type() === 'error') errors.push(`console:${message.text()}`);
            });
            page.on('response', response => {
                const url = new URL(response.url());
                if (url.origin === new URL(baseUrl).origin && url.pathname.startsWith('/api/') && response.status() >= 400) {
                    apiFailures.push({ path: url.pathname, status: response.status() });
                }
            });
            page.on('dialog', dialog => dialog.accept());
            await page.route(/\/api\/(?:ai|ocr)\//, async route => {
                forbiddenCalls += 1;
                await route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'AI/OCR forbidden in DOCX layout acceptance' })
                });
            });

            try {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
                assert.equal(await page.evaluate(() => Boolean(
                    window.Qisi?.DocxLayout?.buildQuestionLayout &&
                    window.Qisi.DocxLayout.buildQuestionLayout({ options: ['1'], richBlocks: [] })?.version
                )), true, 'DOCX layout module is not loaded');
                await page.evaluate(() => {
                    const original = window.QisiBatchImporter.parseDocxFile;
                    window.QisiBatchImporter.parseDocxFile = async (...args) => {
                        const result = await original(...args);
                        window.__qisiRawDocxLayoutDrafts = result.drafts;
                        return result;
                    };
                });
                await page.getByRole('button', { name: '批量录题' }).click();
                const createButton = page.getByRole('button', { name: '创建任务', exact: true });
                if (await createButton.count()) await createButton.click();
                await page.locator('input[type="file"][multiple]').setInputFiles(file);
                const modal = page.locator('.batch-purpose-modal');
                await modal.getByRole('checkbox', { name: purposeRole, exact: true }).check();
                await modal.getByRole('button', { name: '确认添加' }).click();
                await page.getByRole('button', { name: '创建识别任务' }).click();

                let state = null;
                const deadline = Date.now() + 240_000;
                while (Date.now() < deadline) {
                    state = await readState(page);
                    if (state.batch && ['review', 'failed'].includes(state.batch.status)) break;
                    await page.waitForTimeout(750);
                }
                assert.equal(state?.batch?.status, 'review', `${file}: ${JSON.stringify(state?.batch)}`);
                assert.equal(state.questions.length, expectedQuestionCount, file);
                assert.deepEqual(
                    state.questions.map(question => String(question.questionNumber)),
                    Array.from({ length: expectedQuestionCount }, (_, index) => String(index + 1)),
                    file
                );
                assert.equal(state.formalCount, 0, file);
                assert.equal(forbiddenCalls, 0, file);

                const continueReview = page.getByRole('button', { name: '继续审核' }).first();
                if (await continueReview.count()) await continueReview.click();
                await page.waitForSelector('.batch-question-nav-item');

                const checks = [];
                const nav = page.locator('.batch-question-nav-item');
                for (let index = 0; index < await nav.count(); index += 1) {
                    await nav.nth(index).click();
                    await page.waitForTimeout(25);
                    checks.push(await page.locator('.batch-preview-panel').evaluate(panel => {
                        const columnCount = element => {
                            if (!element) return 0;
                            const value = getComputedStyle(element).gridTemplateColumns;
                            return value && value !== 'none' ? value.trim().split(/\s+/).length : 0;
                        };
                        const horizontalRows = [...panel.querySelectorAll('.qisi-image-row')].map(row => {
                            const items = [...row.querySelectorAll('.qisi-image-row-item')].map(item => item.getBoundingClientRect());
                            return {
                                count: items.length,
                                sameLine: items.length > 1 && Math.max(...items.map(item => item.top)) - Math.min(...items.map(item => item.top)) < 4,
                                increasingX: items.every((item, itemIndex) => itemIndex === 0 || item.left > items[itemIndex - 1].left)
                            };
                        });
                        const mediaRows = [...panel.querySelectorAll('.qisi-media-text')].map(row => {
                            const figure = row.querySelector('.qisi-media-figure')?.getBoundingClientRect();
                            const copy = row.querySelector('.qisi-media-copy')?.getBoundingClientRect();
                            return {
                                sideBySide: Boolean(figure && copy && copy.left > figure.left && copy.top < figure.bottom && figure.top < copy.bottom)
                            };
                        });
                        return {
                            rawStructure: /QISI_(?:TABLE|LAYOUT)_(?:BEGIN|END)/.test(panel.textContent || ''),
                            renderErrors: panel.querySelectorAll('.latex-render-error').length,
                            renderErrorDetails: [...panel.querySelectorAll('.latex-render-error')].map(node => ({
                                title: node.getAttribute('title') || '',
                                text: node.textContent || ''
                            })),
                            imagePlaceholders: panel.querySelectorAll('.latex-image-placeholder').length,
                            tableCount: panel.querySelectorAll('.qisi-latex-table').length,
                            horizontalRows,
                            mediaRows,
                            optionColumns: columnCount(panel.querySelector('.qisi-review-preview-options')),
                            mathCount: panel.querySelectorAll('.katex').length
                        };
                    }));
                }
                checks.forEach((check, index) => {
                    if (!check.renderErrors) return;
                    const question = state.questions[index] || {};
                    check.persisted = {
                        stem: question.stem || '',
                        options: question.options || [],
                        answer: question.answer || '',
                        solution: question.solution || '',
                        richBlocks: (question.richBlocks || []).map(block => block.serialized || '')
                    };
                });

                assert.equal(checks.some(check => check.rawStructure), false, `${file}: raw structural source`);
                assert.equal(checks.some(check => check.renderErrors || check.imagePlaceholders), false, `${file}: ${JSON.stringify(checks)}`);
                assert.equal(checks.every(check => check.horizontalRows.every(row => row.sameLine && row.increasingX)), true, file);
                assert.equal(checks.every(check => check.mediaRows.every(row => row.sideBySide)), true, file);
                assert.equal(errors.filter(message => /pageerror|LATEX_RENDER|公式语法错误/.test(message)).length, 0, `${file}: ${errors.join(' | ')}`);
                assert.equal(apiFailures.length, 0, `${file}: ${JSON.stringify(apiFailures)}`);

                const persistedLayouts = state.questions.filter(question => question.layout);
                const rawLayoutCount = await page.evaluate(() => (
                    window.__qisiRawDocxLayoutDrafts || []
                ).filter(question => question.layout).length);
                assert.equal(rawLayoutCount, state.questions.length, `${file}: importer did not emit layout`);
                assert.equal(
                    persistedLayouts.length,
                    state.questions.length,
                    `${file}: missing persisted layout; keys=${JSON.stringify(Object.keys(state.questions[0] || {}))}`
                );
                persistedLayouts.forEach(question => {
                    assert.ok([1, 2, 4].includes(Number(question.layout.optionColumns)), `${file}: Q${question.questionNumber}`);
                });

                console.log('[QISI_DOCX_LAYOUT_ACCEPTANCE]', JSON.stringify({
                    file,
                    questionCount: state.questions.length,
                    tableQuestions: checks.filter(check => check.tableCount).length,
                    imageRows: checks.reduce((sum, check) => sum + check.horizontalRows.length, 0),
                    mediaRows: checks.reduce((sum, check) => sum + check.mediaRows.length, 0),
                    optionColumns: [...new Set(persistedLayouts.map(question => question.layout.optionColumns))],
                    mathCount: checks.reduce((sum, check) => sum + check.mathCount, 0)
                }));
            } finally {
                await context.close();
            }
        }
    } finally {
        await browser.close();
    }
});

test('normal UI print preserves tables, option columns, image rows, and A4 pagination', {
    skip: process.env.QISI_REAL_PRINT_LAYOUT !== '1',
    timeout: 600_000
}, async () => {
    const browser = await chromium.launch({
        headless: process.env.QISI_SHOW_BROWSER !== '1',
        slowMo: process.env.QISI_SHOW_BROWSER === '1' ? 20 : 0
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const dialogs = [];
    let forbiddenCalls = 0;
    page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(`console:${message.text()}`);
    });
    page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        return dialog.accept();
    });
    await page.route(/\/api\/(?:ai|ocr)\//, async route => {
        forbiddenCalls += 1;
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });

    try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '批量录题' }).click();
        const createButton = page.getByRole('button', { name: '创建任务', exact: true });
        if (await createButton.count()) await createButton.click();
        await page.locator('input[type="file"][multiple]').setInputFiles(
            allSourceFiles.find(file => file.includes('武汉')) || allSourceFiles[allSourceFiles.length - 1]
        );
        const modal = page.locator('.batch-purpose-modal');
        await modal.getByRole('checkbox', { name: '题目', exact: true }).check();
        await modal.getByRole('button', { name: '确认添加' }).click();
        await page.getByRole('button', { name: '创建识别任务' }).click();

        let state = null;
        const recognitionDeadline = Date.now() + 240_000;
        while (Date.now() < recognitionDeadline) {
            state = await readState(page);
            if (state.batch && ['review', 'failed'].includes(state.batch.status)) break;
            await page.waitForTimeout(750);
        }
        assert.equal(state?.batch?.status, 'review', JSON.stringify(state?.batch));
        const continueReview = page.getByRole('button', { name: '继续审核' }).first();
        if (await continueReview.count()) await continueReview.click();
        await page.waitForSelector('.batch-question-nav-item');

        const nav = page.locator('.batch-question-nav-item');
        await nav.nth(3).click();
        await page.getByRole('button', { name: '答案内容', exact: true }).click();
        await page.locator('.batch-editor-card.content textarea').fill('A');
        await page.getByRole('button', { name: '保存修改', exact: true }).click();
        const saveDeadline = Date.now() + 30_000;
        while (Date.now() < saveDeadline) {
            state = await readState(page);
            if (state.questions[3]?.answer === 'A') break;
            await page.waitForTimeout(100);
        }
        assert.equal(
            state.questions[3]?.answer,
            'A',
            `Q4 save did not persist; dialogs=${JSON.stringify(dialogs)}; errors=${JSON.stringify(errors)}`
        );
        await page.getByRole('button', { name: '一键提交本题', exact: true }).click();
        const waitForFormalCount = async (expected, label) => {
            const deadline = Date.now() + 30_000;
            while (Date.now() < deadline) {
                state = await readState(page);
                if (state.formalCount >= expected) return;
                await page.waitForTimeout(250);
            }
            assert.equal(
                state.formalCount,
                expected,
                `${label}; dialogs=${JSON.stringify(dialogs)}; errors=${JSON.stringify(errors)}; ` +
                    `draft=${JSON.stringify(state.questions.find(question => Number(question.questionNumber) === (expected === 1 ? 4 : 19)))}; ` +
                    `batch=${JSON.stringify(state.batch)}`
            );
        };
        await waitForFormalCount(1, 'Q4 submit did not finish');

        await nav.nth(18).click();
        await page.getByRole('button', { name: '一键提交本题', exact: true }).click();
        await waitForFormalCount(2, 'Q19 submit did not finish');

        await page.getByRole('button', { name: '题库与检索' }).click();
        const cards = page.locator('.question-card');
        await cards.nth(0).getByRole('button', { name: '选题', exact: true }).click();
        await cards.nth(1).getByRole('button', { name: '选题', exact: true }).click();
        await page.getByRole('button', { name: '智能组卷台' }).click();

        const popupPromise = page.waitForEvent('popup');
        await page.getByRole('button', { name: '打印 PDF', exact: true }).click();
        const popup = await popupPromise;
        const popupErrors = [];
        popup.on('pageerror', error => popupErrors.push(`pageerror:${error.message}`));
        popup.on('console', message => {
            if (message.type() === 'error') popupErrors.push(`console:${message.text()}`);
        });
        await popup.waitForLoadState('domcontentloaded');
        await popup.waitForFunction(() => ['true', 'error'].includes(document.documentElement.dataset.qisiPreviewReady), null, {
            timeout: 30_000
        });

        const result = await popup.evaluate(() => {
            const rows = [...document.querySelectorAll('.qisi-image-row')].map(row => {
                const items = [...row.querySelectorAll('.qisi-image-row-item')].map(item => item.getBoundingClientRect());
                return {
                    count: items.length,
                    sameLine: items.length > 1 && Math.max(...items.map(item => item.top)) - Math.min(...items.map(item => item.top)) < 4,
                    increasingX: items.every((item, index) => index === 0 || item.left > items[index - 1].left)
                };
            });
            const optionColumns = [...document.querySelectorAll('.gaokao-options')].map(grid => ({
                configured: Number(getComputedStyle(grid).getPropertyValue('--qisi-option-columns')),
                rendered: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length
            }));
            const pages = [...document.querySelectorAll('.qisi-paper-page')].map(page => {
                const content = page.querySelector('.qisi-page-content');
                const children = [...(content?.children || [])];
                const bottom = children.length
                    ? Math.max(...children.map(child => child.getBoundingClientRect().bottom))
                    : content.getBoundingClientRect().top;
                const rect = content.getBoundingClientRect();
                return {
                    usedRatio: rect.height ? (bottom - rect.top) / rect.height : 0,
                    compressedImages: page.querySelectorAll('[data-qisi-images-compressed]').length,
                    longBlock: page.dataset.longBlock || ''
                };
            });
            const firstKatex = document.querySelector('.katex');
            return {
                rawTableSource: /QISI_TABLE_(?:BEGIN|END)/.test(document.body.textContent || ''),
                rawLayoutSource: /QISI_LAYOUT_(?:BEGIN|END)/.test(document.body.textContent || ''),
                tableCount: document.querySelectorAll('.qisi-latex-table').length,
                renderErrors: document.querySelectorAll('.latex-render-error').length,
                rows,
                optionColumns,
                pages,
                mathScale: Number(getComputedStyle(document.documentElement).getPropertyValue('--qisi-math-scale')),
                mathFontPx: firstKatex ? parseFloat(getComputedStyle(firstKatex).fontSize) : 0,
                bodyFontPx: parseFloat(getComputedStyle(document.body).fontSize)
            };
        });

        assert.equal(result.rawTableSource, false, JSON.stringify(result));
        assert.equal(result.rawLayoutSource, false, JSON.stringify(result));
        assert.ok(result.tableCount >= 1, JSON.stringify(result));
        assert.equal(result.renderErrors, 0, JSON.stringify(result));
        assert.equal(result.rows.some(row => row.count === 2 && row.sameLine && row.increasingX), true, JSON.stringify(result));
        assert.equal(result.optionColumns.some(row => row.configured === 2 && row.rendered === 2), true, JSON.stringify(result));
        assert.ok(result.mathScale >= 1.02 && result.mathScale <= 1.16, JSON.stringify(result));
        assert.ok(result.mathFontPx >= result.bodyFontPx * 0.98, JSON.stringify(result));
        assert.equal(result.pages.some(row => row.longBlock), false, JSON.stringify(result));
        assert.equal(forbiddenCalls, 0);
        assert.deepEqual(errors, []);
        assert.deepEqual(popupErrors, []);
        console.log('[QISI_PRINT_LAYOUT_ACCEPTANCE]', JSON.stringify(result));
    } finally {
        await context.close();
        await browser.close();
    }
});

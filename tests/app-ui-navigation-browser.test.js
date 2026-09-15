const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);
const TEXT = {
    entry: '\u65b0\u9898\u76ee\u5f55\u5165',
    entryHeading: '\u9898\u76ee\u5f55\u5165\u5f15\u64ce',
    batch: '\u6279\u91cf\u5f55\u9898',
    createTask: '\u521b\u5efa\u4efb\u52a1',
    createBatchHeading: '\u521b\u5efa\u6279\u91cf\u5f55\u9898\u4efb\u52a1',
    backToList: '\u8fd4\u56de\u5217\u8868',
    recentTasks: '\u6700\u8fd1\u8bc6\u522b\u4efb\u52a1',
    library: '\u9898\u5e93\u4e0e\u68c0\u7d22',
    knowledgeFilter: '\u77e5\u8bc6\u70b9\u7b5b\u9009',
    systemKnowledge: '\u7cfb\u7edf\u77e5\u8bc6\u70b9',
    personalKnowledge: '\u4e2a\u4eba\u77e5\u8bc6\u70b9',
    externalLibrary: '\u5916\u90e8\u9898\u5e93',
    exam: '\u667a\u80fd\u7ec4\u5377\u53f0',
    examHeading: '\u5feb\u901f\u7ec4\u5377',
    personal: '\u4e2a\u4eba\u7ba1\u7406',
    personalHeading: '\u4e2a\u4eba\u77e5\u8bc6\u70b9\u7ba1\u7406',
    template: '\u6781\u5ba2\u6392\u7248\u914d\u7f6e',
    templateHeading: '\u6a21\u677f\u9884\u8bbe\u5e93',
    systemPicker: '\u9009\u62e9\u7cfb\u7edf\u8282\u70b9',
    personalPicker: '\u9009\u62e9\u4e2a\u4eba\u8282\u70b9',
    stemTab: '\u9898\u5e72',
    answerTab: '\u7b54\u6848',
    solutionTab: '\u89e3\u6790',
    librarySearch: '\u641c\u7d22\u9898\u5e72\u3001\u7b54\u6848\u3001\u89e3\u6790',
    resetFilters: '\u91cd\u7f6e\u7b5b\u9009',
    onlyQuestions: '\u53ea\u6253\u5370\u9898\u76ee',
    withAnswers: '\u4e00\u4efd PDF\uff1a\u9898\u76ee\u540e\u53e6\u8d77\u65b0\u9875\u5370\u7b54\u6848',
    splitPdf: '\u4e24\u4efd PDF\uff1a\u9898\u76ee\u548c\u7b54\u6848\u5206\u5f00'
};

async function seedAcceptanceFixture(page) {
    await page.evaluate(async () => {
        const database = window.Qisi.Database.getDatabase();
        await Promise.all(database.tables.map(table => table.clear()));

        const now = Date.now();
        await database.questions.bulkPut(Array.from({ length: 26 }, (_, index) => ({
            id: `ui-question-${String(index + 1).padStart(2, '0')}`,
            createdAt: now + index,
            updatedAt: now + index,
            grade: '高二',
            type: '单选题',
            diff: '中等',
            knowledge: '集合',
            knowledgeType: 'system',
            systemKnowledge: '集合',
            personalKnowledge: '函数错题',
            stem: `隔离验收题 ${index + 1} $x^2=4$`,
            options: ['1', '2', '3', '4'],
            answer: `答案 ${index + 1}`,
            solution: `解析 ${index + 1}`,
            images: []
        })));
        await database.personalKnowledge.put({
            id: 'tree',
            updatedAt: now,
            nodes: [{
                id: 'personal-l1',
                name: '我的错题',
                expanded: true,
                children: [{
                    id: 'personal-l2',
                    name: '函数错题',
                    expanded: true,
                    children: [{
                        id: 'personal-l3',
                        name: '单调性',
                        children: []
                    }]
                }]
            }]
        });
        await database.importBatches.bulkPut([
            {
                id: 'ui-external-batch',
                sourceTeacher: '隔离教师',
                title: '按钮验收外部题库',
                importedAt: now,
                importStatus: 'success'
            },
            {
                id: 'ui-failed-batch',
                sourceTeacher: '隔离教师',
                title: '可删除失败批次',
                importedAt: now - 1,
                importStatus: 'failed'
            }
        ]);
        await database.externalQuestions.bulkPut(Array.from({ length: 12 }, (_, index) => ({
            id: `ui-external-${String(index + 1).padStart(2, '0')}`,
            batchId: 'ui-external-batch',
            sourceTeacher: '隔离教师',
            importedAt: now,
            importOrder: index + 1,
            processStatus: 'unprocessed',
            detectedStatus: 'new',
            grade: '高二',
            type: '单选题',
            diff: '中等',
            stem: `外部验收题 ${index + 1}`,
            options: ['1', '2', '3', '4'],
            answer: 'A',
            solution: '外部解析',
            images: []
        })));
        const pixel = 'data:image/svg+xml;base64,' + btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="white"/><path d="M20 150 L120 25 L220 150 Z" fill="none" stroke="black" stroke-width="4"/></svg>'
        );
        await database.draftImportBatches.bulkPut([
            {
                id: 'ui-draft-review',
                status: 'review',
                progress: 100,
                title: '隔离审核任务',
                fileNames: ['隔离题目.txt'],
                questionCount: 2,
                unmatchedAnswers: [{ questionNumber: '99', answer: '未匹配答案' }],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'ui-draft-failed',
                status: 'failed',
                progress: 100,
                title: '隔离失败任务',
                fileNames: ['失败题目.txt'],
                questionCount: 0,
                createdAt: now - 1,
                updatedAt: now - 1
            }
        ]);
        await database.draftImportFiles.put({
            id: 'ui-draft-file',
            batchId: 'ui-draft-review',
            name: '隔离题目.txt',
            fileName: '隔离题目.txt',
            role: 'question',
            roles: ['question'],
            fileType: 'txt',
            parseStatus: 'done',
            createdAt: now,
            updatedAt: now
        });
        await database.draftQuestions.bulkPut([
            {
                id: 'ui-draft-question-1',
                batchId: 'ui-draft-review',
                order: 1,
                questionNumber: '1',
                status: 'draft',
                duplicateStatus: 'new',
                selected: true,
                grade: '高二',
                type: '单选题',
                diff: '中等',
                year: '2026',
                stem: '审核验收题一 $x=1$',
                options: ['1', '2', '3', '4'],
                answer: 'A',
                solution: '审核解析一',
                images: [],
                sourcePageImage: pixel,
                imageReviewStatus: 'pending',
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'ui-draft-question-2',
                batchId: 'ui-draft-review',
                order: 2,
                questionNumber: '2',
                status: 'draft',
                duplicateStatus: 'new',
                selected: true,
                grade: '高二',
                type: '解答题',
                diff: '中等',
                year: '2026',
                stem: '审核验收题二 $y=2$',
                options: ['', '', '', ''],
                answer: '2',
                solution: '审核解析二',
                images: [],
                createdAt: now + 1,
                updatedAt: now + 1
            }
        ]);
        await database.draftImages.bulkPut([
            {
                id: 'ui-draft-image-bound',
                batchId: 'ui-draft-review',
                questionId: 'ui-draft-question-1',
                url: pixel,
                source: 'manual-crop',
                contentRole: 'question',
                role: 'question',
                status: 'bound',
                confidence: 1,
                align: 'center',
                displayable: true,
                description: '隔离题图',
                createdAt: now
            },
            {
                id: 'ui-draft-image-unassigned',
                batchId: 'ui-draft-review',
                questionId: '',
                url: pixel,
                source: 'manual-crop',
                contentRole: 'question',
                role: 'question',
                status: 'unassigned',
                confidence: 1,
                align: 'center',
                displayable: true,
                description: '未分配隔离图',
                createdAt: now + 1
            }
        ]);
    });
}

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, processState) {
    const deadline = Date.now() + 20_000;
    let lastError = null;

    while (Date.now() < deadline) {
        if (processState.exitCode !== null) {
            throw new Error('local server exited before startup (' + processState.exitCode + ')');
        }

        try {
            const response = await fetch(origin + '/api/health', {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
            lastError = new Error('health endpoint returned ' + response.status);
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('local server did not become ready: ' + (lastError?.message || 'timeout'));
}

function stopProcess(child) {
    if (!child || child.exitCode !== null || child.killed) return Promise.resolve();

    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
        }, 3_000);
        timeout.unref();
        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
        child.kill();
    });
}

function isForbiddenAiOrOcrRequest(url) {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname === '/api/ai'
        || pathname.startsWith('/api/ai/')
        || pathname === '/api/ocr'
        || pathname.startsWith('/api/ocr/');
}

async function clickWithDialog(page, locator, response, promptText = '') {
    const dialogEvent = page.waitForEvent('dialog');
    const click = locator.click();
    const dialog = await dialogEvent;
    if (response === 'accept') await dialog.accept(promptText);
    else await dialog.dismiss();
    await click;
    return dialog.message();
}

test('top-level application views remain navigable in an isolated browser context', {
    timeout: 90_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;
    let context;
    const forbiddenRequests = [];
    const pageErrors = [];
    const consoleErrors = [];
    let interactionPhase = 'startup';

    try {
        await waitForServer(origin, server);

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1440, height: 900 }
        });

        await context.route('**/*', route => {
            const requestUrl = route.request().url();
            if (isForbiddenAiOrOcrRequest(requestUrl)) {
                forbiddenRequests.push(requestUrl);
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        choices: [{ message: { content: 'OCR 隔离响应 $x=1$' } }]
                    })
                });
            }
            return route.continue();
        });

        const page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') {
                consoleErrors.push(`${interactionPhase}: ${message.text()}`);
            }
        });

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        interactionPhase = 'navigation';
        const views = [
            { button: TEXT.entry, root: '.entry-layout', heading: TEXT.entryHeading },
            { button: TEXT.batch, root: '.batch-import-page', heading: TEXT.batch },
            { button: TEXT.library, root: '.library-layout', heading: TEXT.knowledgeFilter },
            { button: TEXT.exam, root: '.exam-builder', heading: TEXT.examHeading },
            { button: TEXT.personal, root: '.personal-layout', heading: TEXT.personalHeading },
            { button: TEXT.template, root: '.template-layout', heading: TEXT.templateHeading }
        ];

        for (const view of views) {
            const navButton = navigation.getByRole('button', {
                name: view.button,
                exact: true
            });
            await navButton.click();
            await page.locator(view.root).waitFor({ state: 'visible' });
            await page.locator(view.root).getByText(view.heading, { exact: true }).first()
                .waitFor({ state: 'visible' });
            assert.match(await navButton.getAttribute('class'), /(?:^|\s)active(?:\s|$)/,
                view.button + ' should be the active navigation item');
        }

        await navigation.getByRole('button', { name: TEXT.entry, exact: true }).click();
        const entryRoot = page.locator('.entry-layout');
        const systemPicker = entryRoot.getByRole('button', { name: TEXT.systemPicker, exact: true });
        const personalPicker = entryRoot.getByRole('button', { name: TEXT.personalPicker, exact: true });
        await systemPicker.click();
        assert.equal(await entryRoot.locator('.knowledge-cascader:visible').count(), 1);
        await personalPicker.click();
        assert.equal(
            await entryRoot.locator('.knowledge-cascader:visible').count(),
            1,
            'one click must switch directly from the system picker to the personal picker'
        );
        await personalPicker.click();
        assert.equal(await entryRoot.locator('.knowledge-cascader:visible').count(), 0);

        for (const [tabName, fieldName] of [
            [TEXT.answerTab, 'answer'],
            [TEXT.solutionTab, 'solution'],
            [TEXT.stemTab, 'stem']
        ]) {
            await entryRoot.getByRole('button', { name: tabName, exact: true }).click();
            assert.match(
                await entryRoot.locator('textarea.textarea-code').getAttribute('placeholder') || '',
                new RegExp(`\uff1a${fieldName}`)
            );
        }

        await navigation.getByRole('button', { name: TEXT.batch, exact: true }).click();
        await page.locator('.batch-import-page')
            .getByRole('button', { name: TEXT.createTask, exact: true }).click();
        await page.getByText(TEXT.createBatchHeading, { exact: true }).waitFor({ state: 'visible' });
        await page.locator('.batch-import-page')
            .getByRole('button', { name: TEXT.backToList, exact: true }).click();
        await page.getByText(TEXT.recentTasks, { exact: true }).waitFor({ state: 'visible' });

        await navigation.getByRole('button', { name: TEXT.library, exact: true }).click();
        for (const mode of [TEXT.personalKnowledge, TEXT.externalLibrary, TEXT.systemKnowledge]) {
            const modeButton = page.locator('.library-filter-sidebar')
                .getByRole('button', { name: mode, exact: true });
            await modeButton.click();
            assert.match(await modeButton.getAttribute('class') || '', /(?:^|\s)active(?:\s|$)/,
                mode + ' filter should become active');
        }

        const libraryRoot = page.locator('.library-layout');
        const librarySearch = libraryRoot.getByPlaceholder(TEXT.librarySearch, { exact: true });
        const librarySelects = libraryRoot.locator('select');
        assert.equal(await librarySelects.count(), 5);
        await librarySearch.fill('R9E-filter-probe');
        await librarySelects.nth(0).selectOption({ label: '\u5355\u9009\u9898' });
        await librarySelects.nth(1).selectOption({ label: '\u8f83\u96be' });
        await librarySelects.nth(2).selectOption({ label: '\u9ad8\u4e8c' });
        await librarySelects.nth(3).selectOption({ label: '\u6709\u89e3\u6790' });
        await librarySelects.nth(4).selectOption({ label: '\u6709\u56fe\u7247' });
        await libraryRoot.getByRole('button', { name: TEXT.resetFilters, exact: true }).click();
        assert.equal(await librarySearch.inputValue(), '');
        assert.deepEqual(
            await librarySelects.evaluateAll(nodes => nodes.map(node => node.value)),
            ['', '', '', '', '']
        );

        interactionPhase = 'exam controls';
        await navigation.getByRole('button', { name: TEXT.exam, exact: true }).click();
        const examRoot = page.locator('.exam-builder');
        for (const mode of [TEXT.withAnswers, TEXT.splitPdf, TEXT.onlyQuestions]) {
            const modeButton = examRoot.getByRole('button', { name: mode, exact: true });
            await modeButton.click();
            assert.match(await modeButton.getAttribute('class') || '', /border-\[#22a039\]/);
        }
        assert.deepEqual(forbiddenRequests, [], 'navigation must not attempt AI/OCR requests');

        interactionPhase = 'fixture reload';
        await seedAcceptanceFixture(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await page.evaluate(() => {
            window.__uiAcceptanceUnhandled = [];
            window.addEventListener('unhandledrejection', event => {
                window.__uiAcceptanceUnhandled.push({
                    name: event.reason?.name || '',
                    message: event.reason?.message || String(event.reason || ''),
                    stack: event.reason?.stack || ''
                });
            });
        });

        interactionPhase = 'entry controls';
        await navigation.getByRole('button', { name: TEXT.entry, exact: true }).click();
        const seededEntryRoot = page.locator('.entry-layout');
        const seededSystemPicker = seededEntryRoot.locator('label', {
            hasText: '系统知识点'
        }).locator('..').locator('button').first();
        const seededPersonalPicker = seededEntryRoot.locator('label', {
            hasText: '个人知识点'
        }).locator('..').locator('button').first();

        const chooseSystemKnowledge = async (label, selector) => {
            await seededSystemPicker.click();
            const picker = seededEntryRoot.locator('.knowledge-cascader:visible');
            await picker.locator('.cascader-col-1')
                .getByText('集合与常用逻辑用语', { exact: true }).hover();
            await picker.locator(selector).click();
            assert.equal(
                (await seededSystemPicker.innerText()).trim(),
                label
            );
        };
        await chooseSystemKnowledge(
            '集合与常用逻辑用语',
            '.cascader-l1-item:has-text("集合与常用逻辑用语")'
        );
        await chooseSystemKnowledge(
            '集合',
            '.cascader-section-title:has-text("集合")'
        );
        await chooseSystemKnowledge(
            '集合的概念与表示',
            'span:has-text("集合的概念与表示")'
        );
        await seededSystemPicker.click();
        await seededEntryRoot.locator('.fixed.inset-0.z-10').click({ position: { x: 4, y: 4 } });
        assert.equal(await seededEntryRoot.locator('.knowledge-cascader:visible').count(), 0);

        const choosePersonalKnowledge = async (label, selector) => {
            await seededPersonalPicker.click();
            const picker = seededEntryRoot.locator('.knowledge-cascader:visible');
            await picker.locator('.cascader-col-1')
                .getByText('我的错题', { exact: true }).hover();
            await picker.locator(selector).click();
            assert.equal(
                (await seededPersonalPicker.innerText()).trim(),
                label
            );
        };
        await choosePersonalKnowledge(
            '我的错题',
            '.cascader-l1-item:has-text("我的错题")'
        );
        await choosePersonalKnowledge(
            '函数错题',
            '.cascader-section-title:has-text("函数错题")'
        );
        await choosePersonalKnowledge(
            '单调性',
            'span:has-text("单调性")'
        );
        await seededPersonalPicker.click();
        await seededEntryRoot.locator('.fixed.inset-0.z-10').click({ position: { x: 4, y: 4 } });
        assert.equal(await seededEntryRoot.locator('.knowledge-cascader:visible').count(), 0);

        const entryFileChooser = page.waitForEvent('filechooser');
        await seededEntryRoot.locator('.entry-drop-zone').click();
        await (await entryFileChooser).setFiles({
            name: 'ui-action.png',
            mimeType: 'image/png',
            buffer: TINY_PNG
        });
        const entryImageRow = seededEntryRoot.locator('img[src^="data:image/"]').first().locator('..').locator('..');
        await entryImageRow.waitFor({ state: 'visible' });
        await entryImageRow.getByTitle('点击复制 LaTeX 插入短码').click();
        assert.equal(await entryImageRow.count(), 1);
        await entryImageRow.getByTitle('移除配图').click();
        assert.equal(await seededEntryRoot.locator('img[src^="data:image/"]').count(), 0);

        const ocrFileChooser = page.waitForEvent('filechooser');
        await seededEntryRoot.locator('.drop-zone').nth(1).click();
        await (await ocrFileChooser).setFiles({
            name: 'ui-ocr.png',
            mimeType: 'image/png',
            buffer: TINY_PNG
        });
        const ocrResult = seededEntryRoot.getByPlaceholder('识别文本结果...', { exact: true });
        await page.waitForFunction(
            () => document.querySelector('textarea[placeholder="识别文本结果..."]')
                ?.value.includes('OCR 隔离响应')
        );
        assert.match(await ocrResult.inputValue(), /OCR 隔离响应/);
        for (const [buttonName, tabName] of [
            ['送题干', TEXT.stemTab],
            ['送答案', TEXT.answerTab],
            ['送解析', TEXT.solutionTab]
        ]) {
            await seededEntryRoot.getByRole('button', { name: buttonName, exact: true }).click();
            await seededEntryRoot.getByRole('button', { name: tabName, exact: true }).click();
            assert.match(
                await seededEntryRoot.locator('textarea.textarea-code').inputValue(),
                /OCR 隔离响应/
            );
        }

        for (const [tabName, value] of [
            [TEXT.answerTab, '录入答案'],
            [TEXT.solutionTab, '录入解析'],
            [TEXT.stemTab, '录入题干 $x=1$']
        ]) {
            await seededEntryRoot.getByRole('button', { name: tabName, exact: true }).click();
            await seededEntryRoot.locator('textarea.textarea-code').fill(value);
        }
        const formalCountBeforeEntry = await page.evaluate(
            () => window.Qisi.Database.getDatabase().questions.count()
        );
        await seededEntryRoot.getByRole('button', {
            name: '确认无误，保存入库',
            exact: true
        }).click();
        await page.waitForFunction(
            expected => window.Qisi.Database.getDatabase().questions.count()
                .then(count => count === expected),
            formalCountBeforeEntry + 1
        );

        interactionPhase = 'library question controls';
        await navigation.getByRole('button', { name: TEXT.library, exact: true }).click();
        const seededLibraryRoot = page.locator('.library-layout');
        const knowledgeTree = seededLibraryRoot.locator('.knowledge-tree-root');
        await knowledgeTree.getByText('全部题库', { exact: true }).click();
        const firstLevel = knowledgeTree.locator('.level-one').first();
        await firstLevel.locator('button.tree-toggle-btn').click();
        await firstLevel.getByText('集合与常用逻辑用语', { exact: true }).click();
        const secondLevel = knowledgeTree.locator('.level-two').first();
        if (!await secondLevel.isVisible()) {
            await firstLevel.locator('button.tree-toggle-btn').click();
        }
        await secondLevel.locator('button.tree-toggle-btn').click();
        await secondLevel.getByText('集合', { exact: true }).click();
        const knowledgeLeaf = knowledgeTree.getByText('集合的概念与表示', { exact: true });
        if (!await knowledgeLeaf.isVisible()) {
            await secondLevel.locator('button.tree-toggle-btn').click();
        }
        await knowledgeLeaf.click();

        const seededCard = seededLibraryRoot.locator('.question-card').first();
        await seededCard.hover();
        await seededCard.getByRole('button', { name: '解析', exact: true }).click();
        await seededCard.getByText('【参考答案】', { exact: true }).waitFor();
        await seededCard.getByRole('button', { name: '编辑', exact: true }).click();
        for (const tabName of [TEXT.answerTab, TEXT.solutionTab, TEXT.stemTab]) {
            await seededCard.getByRole('button', { name: tabName, exact: true }).click();
        }
        await seededCard.locator('textarea').fill('浏览器保存验证 $x=2$');
        await seededCard.getByRole('button', { name: '确认更新', exact: true }).click();
        await page.waitForFunction(
            () => window.Qisi.Database.getDatabase().questions
                .toArray()
                .then(questions => questions.some(question => (
                    question.stem === '浏览器保存验证 $x=2$'
                )))
        );

        await seededCard.hover();
        await seededCard.getByRole('button', { name: '选题', exact: true }).click();
        assert.equal(
            await page.evaluate(() => document.getElementById('app')
                .__vue_app__._container._vnode.component.setupState.cart.length),
            1
        );

        const cartButton = page.locator('[title="打开试卷篮"]');
        await cartButton.click();
        assert.equal(
            await page.evaluate(() => document.getElementById('app')
                .__vue_app__._container._vnode.component.setupState.isCartOpen),
            true
        );
        await clickWithDialog(
            page,
            page.getByRole('button', { name: '全部移除', exact: true }),
            'dismiss'
        );
        assert.equal(
            await page.evaluate(() => document.getElementById('app')
                .__vue_app__._container._vnode.component.setupState.cart.length),
            1
        );
        await clickWithDialog(
            page,
            page.getByRole('button', { name: '全部移除', exact: true }),
            'accept'
        );
        assert.equal(
            await page.evaluate(() => document.getElementById('app')
                .__vue_app__._container._vnode.component.setupState.cart.length),
            0
        );
        await page.locator('div.fixed.inset-0:visible').click({ position: { x: 4, y: 4 } });
        assert.equal(
            await page.evaluate(() => document.getElementById('app')
                .__vue_app__._container._vnode.component.setupState.isCartOpen),
            false
        );

        await knowledgeTree.getByText('全部题库', { exact: true }).click();
        const nextPageButton = seededLibraryRoot.getByRole('button', {
            name: '下一页',
            exact: true
        });
        await nextPageButton.click();
        assert.equal(
            await seededLibraryRoot.getByText(/第 2 \/ 3 页/).count(),
            1
        );
        await seededLibraryRoot.getByRole('button', { name: '上一页', exact: true }).click();
        assert.equal(
            await seededLibraryRoot.getByText(/第 1 \/ 3 页/).count(),
            1
        );

        const deleteCard = seededLibraryRoot.locator('.question-card').first();
        await deleteCard.hover();
        await deleteCard.getByRole('button', { name: '编辑', exact: true }).click();
        const countBeforeDelete = await page.evaluate(
            () => window.Qisi.Database.getDatabase().questions.count()
        );
        await clickWithDialog(
            page,
            deleteCard.getByRole('button', { name: '彻底删除', exact: true }),
            'dismiss'
        );
        assert.equal(
            await page.evaluate(() => window.Qisi.Database.getDatabase().questions.count()),
            countBeforeDelete
        );
        await clickWithDialog(
            page,
            deleteCard.getByRole('button', { name: '彻底删除', exact: true }),
            'accept'
        );
        await page.waitForFunction(
            expected => window.Qisi.Database.getDatabase().questions.count()
                .then(count => count === expected),
            countBeforeDelete - 1
        );

        interactionPhase = 'personal knowledge controls';
        await navigation.getByRole('button', { name: TEXT.personal, exact: true }).click();
        const personalRoot = page.locator('.personal-layout');
        await personalRoot.getByPlaceholder('如：函数', { exact: true }).fill('概率错题');
        await personalRoot.getByRole('button', { name: '添加知识点', exact: true }).click();
        const createdKnowledgeRow = personalRoot.locator('.personal-tree-row', {
            hasText: '概率错题'
        });
        await createdKnowledgeRow.waitFor();

        const existingKnowledgeRow = personalRoot.locator('.personal-tree-row', {
            hasText: '我的错题'
        }).first();
        await existingKnowledgeRow.locator('button.personal-tree-toggle').click();
        assert.equal(
            await personalRoot.locator('.personal-tree-row', { hasText: '函数错题' }).count(),
            0
        );
        await existingKnowledgeRow.locator('button.personal-tree-toggle').click();
        await clickWithDialog(
            page,
            existingKnowledgeRow.getByRole('button', { name: '新增子节点', exact: true }),
            'accept',
            '新增子类'
        );
        await personalRoot.getByText('新增子类', { exact: true }).waitFor();
        await clickWithDialog(
            page,
            existingKnowledgeRow.getByRole('button', { name: '修改', exact: true }),
            'accept',
            '重命名错题'
        );
        await personalRoot.getByText('重命名错题', { exact: true }).waitFor();
        await clickWithDialog(
            page,
            createdKnowledgeRow.getByRole('button', { name: '删除', exact: true }),
            'dismiss'
        );
        assert.equal(await createdKnowledgeRow.count(), 1);
        await clickWithDialog(
            page,
            createdKnowledgeRow.getByRole('button', { name: '删除', exact: true }),
            'accept'
        );
        assert.equal(await createdKnowledgeRow.count(), 0);

        interactionPhase = 'template controls';
        await navigation.getByRole('button', { name: TEXT.template, exact: true }).click();
        const templateRoot = page.locator('.template-layout');
        const templateCard = templateRoot.locator('.group').filter({
            has: page.getByText('带框版题目', { exact: true })
        }).first();
        await templateCard.click();
        const templateName = templateRoot.getByPlaceholder('模板名称', { exact: true });
        await templateName.fill('带框版题目验收');
        await templateRoot.getByRole('button', { name: '保存当前模板', exact: true }).click();
        assert.equal(await templateName.inputValue(), '带框版题目验收');

        interactionPhase = 'external library controls';
        await navigation.getByRole('button', { name: TEXT.library, exact: true }).click();
        await seededLibraryRoot.getByRole('button', {
            name: TEXT.externalLibrary,
            exact: true
        }).click();
        const externalBatch = seededLibraryRoot.locator('.external-batch-item', {
            hasText: '按钮验收外部题库'
        });
        await externalBatch.click();
        await externalBatch.getByText('重新计算', { exact: true }).click();

        const failedBatch = seededLibraryRoot.locator('.external-batch-item.failed', {
            hasText: '可删除失败批次'
        });
        await clickWithDialog(
            page,
            failedBatch.getByText('删除', { exact: true }),
            'dismiss'
        );
        assert.equal(await failedBatch.count(), 1);
        await clickWithDialog(
            page,
            failedBatch.getByText('删除', { exact: true }),
            'accept'
        );
        await failedBatch.waitFor({ state: 'detached' });

        const externalNext = seededLibraryRoot.getByRole('button', {
            name: '下一页',
            exact: true
        });
        await externalNext.click();
        await seededLibraryRoot.getByRole('button', { name: '上一页', exact: true }).click();

        await seededLibraryRoot.getByRole('checkbox', {
            name: '加入个人题库',
            exact: true
        }).check();
        await seededLibraryRoot.getByRole('button', { name: '全选本页', exact: true }).click();
        assert.match(
            await seededLibraryRoot.locator('.external-pick-actions').first().innerText(),
            /已选择 10 道/
        );
        await seededLibraryRoot.getByRole('button', { name: '取消选择', exact: true }).click();
        const firstExternalCard = seededLibraryRoot.locator('.question-card').first();
        await firstExternalCard.locator('input[type="checkbox"]').check();
        await seededLibraryRoot.getByRole('button', { name: '下一步', exact: true }).click();
        const confirmPage = page.locator('.external-confirm-page');
        await confirmPage.waitFor({ state: 'visible' });
        const confirmFilterButtons = confirmPage.locator('.confirm-filter-bar button');
        for (const filterButton of await confirmFilterButtons.all()) {
            await filterButton.click();
        }
        await confirmFilterButtons.first().click();
        const confirmSelects = confirmPage.locator('.batch-setting-card select');
        await confirmSelects.nth(0).selectOption({ index: 1 });
        await confirmPage.getByRole('button', { name: '应用到全部', exact: true }).nth(0).click();
        await confirmSelects.nth(1).selectOption({ index: 1 });
        await confirmPage.getByRole('button', { name: '应用到全部', exact: true }).nth(1).click();
        const confirmItem = confirmPage.locator('.confirm-question-card').first();
        const expandButton = confirmItem.locator('.confirm-expand-btn');
        await expandButton.click();
        assert.equal((await expandButton.innerText()).trim(), '收起');
        await confirmPage.getByRole('button', { name: '返回选择', exact: true }).first().click();

        await seededLibraryRoot.getByRole('button', { name: '下一步', exact: true }).click();
        const formalBeforeExternalMerge = await page.evaluate(
            () => window.Qisi.Database.getDatabase().questions.count()
        );
        await confirmPage.getByRole('button', { name: '确认加入', exact: true }).first().click();
        await page.waitForFunction(
            expected => window.Qisi.Database.getDatabase().questions.count()
                .then(count => count === expected),
            formalBeforeExternalMerge + 1
        );
        await clickWithDialog(
            page,
            seededLibraryRoot.getByRole('button', {
                name: '撤销最近一次加入',
                exact: true
            }),
            'dismiss'
        );
        assert.equal(
            await page.evaluate(() => window.Qisi.Database.getDatabase().questions.count()),
            formalBeforeExternalMerge + 1
        );
        await clickWithDialog(
            page,
            seededLibraryRoot.getByRole('button', {
                name: '撤销最近一次加入',
                exact: true
            }),
            'accept'
        );
        await page.waitForFunction(
            expected => window.Qisi.Database.getDatabase().questions.count()
                .then(count => count === expected),
            formalBeforeExternalMerge
        );

        interactionPhase = 'question bank package controls';
        await seededLibraryRoot.getByRole('button', {
            name: '系统知识点',
            exact: true
        }).click();
        const downloadEvent = page.waitForEvent('download');
        await clickWithDialog(
            page,
            seededLibraryRoot.getByRole('button', {
                name: '导出题库数据',
                exact: true
            }),
            'accept',
            '隔离验收教师'
        );
        const packageDownload = await downloadEvent;
        const packagePath = await packageDownload.path();
        assert.ok(packagePath);

        const openImportPreview = async () => {
            const chooserEvent = page.waitForEvent('filechooser');
            await seededLibraryRoot.getByRole('button', {
                name: '导入题库数据',
                exact: true
            }).click();
            await (await chooserEvent).setFiles(packagePath);
            await page.getByText('导入题库数据预览', { exact: true }).waitFor();
        };
        await openImportPreview();
        await page.getByRole('button', { name: '关闭', exact: true }).click();
        assert.equal(await page.getByText('导入题库数据预览', { exact: true }).count(), 0);
        await openImportPreview();
        await page.evaluate(() => {
            document.getElementById('app').__vue_app__._container._vnode.component
                .setupState.pendingImportPreview.mayDuplicate = true;
        });
        await clickWithDialog(
            page,
            page.getByRole('button', { name: '确认导入', exact: true }),
            'dismiss'
        );
        assert.equal(await page.getByText('导入题库数据预览', { exact: true }).count(), 1);
        const importDialogs = [];
        const handleImportDialog = async dialog => {
            importDialogs.push(dialog.message());
            await dialog.accept();
        };
        page.on('dialog', handleImportDialog);
        await page.getByRole('button', { name: '确认导入', exact: true }).click();
        await page.getByText('导入题库数据预览', { exact: true })
            .waitFor({ state: 'detached' });
        page.off('dialog', handleImportDialog);
        assert.ok(importDialogs.some(message => message.includes('可能已经导入')));
        await page.waitForFunction(
            () => window.Qisi.Database.getDatabase().importBatches.count()
                .then(count => count >= 2)
        );

        interactionPhase = 'exam preparation';
        await navigation.getByRole('button', { name: TEXT.library, exact: true }).click();
        await seededLibraryRoot.getByRole('button', { name: TEXT.systemKnowledge, exact: true }).click();
        await seededLibraryRoot.locator('.knowledge-tree-root')
            .getByText('全部题库', { exact: true }).click();
        for (const card of await seededLibraryRoot.locator('.question-card').all()) {
            if (await page.evaluate(() => document.getElementById('app')
                .__vue_app__._container._vnode.component.setupState.cart.length) === 2) break;
            await card.hover();
            await card.getByRole('button', { name: '选题', exact: true }).click();
        }
        interactionPhase = 'exam controls';
        await navigation.getByRole('button', { name: TEXT.exam, exact: true }).click();
        const seededExamRoot = page.locator('.exam-builder');
        const examCards = seededExamRoot.locator('[data-exam-qid]');
        assert.equal(await examCards.count(), 2);
        const firstExamId = await examCards.first().getAttribute('data-exam-qid');
        await examCards.first().hover();
        await examCards.first().getByTitle('下移').click();
        assert.notEqual(
            await examCards.first().getAttribute('data-exam-qid'),
            firstExamId
        );
        await examCards.nth(1).hover();
        await examCards.nth(1).getByTitle('上移').click();
        assert.equal(await examCards.first().getAttribute('data-exam-qid'), firstExamId);
        await seededExamRoot.getByRole('button', { name: '重置排序', exact: true }).click();
        await examCards.last().hover();
        await examCards.last().getByTitle('移除此题').click();
        assert.equal(await examCards.count(), 1);
        const printPopupEvent = page.waitForEvent('popup');
        await seededExamRoot.getByRole('button', { name: '打印 PDF', exact: true }).click();
        const printPopup = await printPopupEvent;
        await printPopup.waitForLoadState('domcontentloaded');
        await printPopup.waitForFunction(() => (
            ['true', 'error'].includes(document.documentElement.dataset.qisiPreviewReady)
        ));
        assert.equal(
            await printPopup.evaluate(() => document.documentElement.dataset.qisiPreviewReady),
            'true'
        );
        await printPopup.close();

        await page.waitForTimeout(100);
        assert.equal(forbiddenRequests.length, 1, 'only the explicitly exercised OCR action may request AI');
        assert.deepEqual(pageErrors, [], 'navigation must not raise page errors');
        const unhandledReasons = await page.evaluate(() => window.__uiAcceptanceUnhandled);
        assert.deepEqual(
            consoleErrors,
            [],
            `navigation must not log error-level console messages\n${JSON.stringify(unhandledReasons, null, 2)}`
        );
    } catch (error) {
        error.message += '\nlocal server output:\n' + serverOutput.join('');
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});

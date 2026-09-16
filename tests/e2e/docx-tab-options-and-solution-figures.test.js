const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-tab-options-and-solution-figures.js');

const buildDocxInPage = (page, payload) => page.evaluate(async value => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', value.contentTypesXml);
    zip.file('_rels/.rels', value.rootRelsXml);
    zip.file('word/document.xml', value.documentXml);
    zip.file('word/_rels/document.xml.rels', value.documentRelsXml);
    const media = new Set([
        ...(value.documentXml.match(/r:embed="(rId\d+)"/g) || [])
    ]);
    for (const rid of media) {
        const id = rid.replace(/[^\d]/g, '');
        zip.file(`word/media/image${id}.png`,
            Uint8Array.from(atob(value.image1PngBase64), ch => ch.charCodeAt(0)));
    }
    return await zip.generateAsync({ type: 'base64' });
}, payload);

const readDrafts = page => page.evaluate(async () => {
    const db = new window.Dexie('QisiMathVueDB');
    await db.open();
    try {
        const drafts = await db.table('draftQuestions').toArray();
        return drafts.map(draft => ({
            questionNumber: String(draft.questionNumber || ''),
            type: draft.type || '',
            stem: String(draft.stem || ''),
            options: Array.isArray(draft.options) ? draft.options.map(option => String(option || '')) : [],
            answer: String(draft.answer || ''),
            solution: String(draft.solution || ''),
            imageCount: (draft.images || []).length
        }));
    } finally {
        db.close();
    }
});

const figureTokens = value => (String(value || '').match(/\[\[IMAGE:[^\]]+\]\]/g) || []).length;

test('Word tabs separate the options, and a 详解 figure stays in the 详解', {
    timeout: 240_000
}, async () => {
    const harness = await startBrowserApp(32156);
    const { page } = harness;

    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    try {
        const paper = await buildDocxInPage(page, {
            contentTypesXml: fixture.contentTypesXml,
            rootRelsXml: fixture.rootRelsXml,
            documentXml: fixture.documentXml,
            documentRelsXml: fixture.documentRelsXml,
            image1PngBase64: fixture.image1PngBase64
        });

        await page.getByRole('button', { name: '批量录题' }).click();
        await page.locator('.batch-home-upload').click();
        await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
            name: 'tab-paper.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: Buffer.from(paper, 'base64')
        });

        const modal = page.locator('.batch-purpose-modal')
            .filter({ has: page.locator('.batch-purpose-options') });
        await modal.waitFor({ state: 'visible', timeout: 30_000 });
        const boxes = modal.locator('.batch-purpose-options input');
        for (let index = 0; index < 5; index += 1) {
            if ((await boxes.nth(index).isChecked()) !== (index === 3)) {
                await boxes.nth(index).setChecked(index === 3);
            }
        }
        await modal.getByRole('button', { name: '确认添加' }).click();

        await page.waitForTimeout(300);
        await page.getByRole('button', { name: '创建识别任务' }).click();

        const deadline = Date.now() + 200_000;
        while (Date.now() < deadline) {
            const status = await page.evaluate(async () => {
                const db = new window.Dexie('QisiMathVueDB');
                await db.open();
                try {
                    const batches = await db.table('draftImportBatches').toArray();
                    return batches.map(batch => batch.status || '').filter(Boolean);
                } finally {
                    db.close();
                }
            });
            if (status.some(value => ['review', 'failed', 'completed'].includes(value))) break;
            await page.waitForTimeout(700);
        }

        const byNumber = new Map((await readDrafts(page)).map(draft => [draft.questionNumber, draft]));
        const q1 = byNumber.get('1');
        const q2 = byNumber.get('2');

        assert.ok(q1 && q2, `expected two drafts, saw ${[...byNumber.keys()].join(', ')}`);
        assert.deepEqual(
            q1.options,
            fixture.expected.options,
            `Word tabs must separate the options, saw ${JSON.stringify(q1.options)}`
        );
        assert.equal(q1.type, '单选题', `four options make a 单选题, saw ${q1.type}`);

        assert.equal(
            figureTokens(q2.stem),
            fixture.expected.stemFigureCount['2'],
            `only the question's own figure belongs in its stem, saw "${q2.stem}"`
        );
        assert.equal(
            q2.imageCount,
            fixture.expected.draftImageCount['2'],
            'the 详解 figures stay attached to the draft so the solution can still show them'
        );
        assert.equal(figureTokens(q2.solution), 2, `the 详解 keeps its own figures, saw "${q2.solution}"`);
        assert.equal(figureTokens(q1.stem), fixture.expected.stemFigureCount['1'], 'question 1 has no figure');
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-header-and-answer-value.js');

const buildDocxInPage = (page, payload) => page.evaluate(async value => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', value.contentTypesXml);
    zip.file('_rels/.rels', value.rootRelsXml);
    zip.file('word/document.xml', value.documentXml);
    zip.file('word/_rels/document.xml.rels', value.documentRelsXml);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}, payload);

test('a colon-less section header types the questions, and an unlabelled answer keeps its value', {
    timeout: 240_000
}, async () => {
    const harness = await startBrowserApp(32146);
    const { page } = harness;

    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    try {
        const questionBase64 = await buildDocxInPage(page, {
            contentTypesXml: fixture.contentTypesXml,
            rootRelsXml: fixture.rootRelsXml,
            documentXml: fixture.questionDocumentXml,
            documentRelsXml: fixture.emptyRelsXml
        });
        const answerBase64 = await buildDocxInPage(page, {
            contentTypesXml: fixture.contentTypesXml,
            rootRelsXml: fixture.rootRelsXml,
            documentXml: fixture.answerDocumentXml,
            documentRelsXml: fixture.emptyRelsXml
        });

        await page.getByRole('button', { name: '批量录题' }).click();
        await page.locator('.batch-home-upload').click();
        await page.locator('input[type="file"][accept*=".docx"]').setInputFiles([
            {
                name: 'header-question.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: Buffer.from(questionBase64, 'base64')
            },
            {
                name: 'header-answer.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: Buffer.from(answerBase64, 'base64')
            }
        ]);

        for (const roles of [[true, false, false, false, false], [false, true, true, false, false]]) {
            const modal = page.locator('.batch-purpose-modal')
                .filter({ has: page.locator('.batch-purpose-options') });
            await modal.waitFor({ state: 'visible', timeout: 30_000 });
            const boxes = modal.locator('.batch-purpose-options input');
            for (let index = 0; index < roles.length; index += 1) {
                if ((await boxes.nth(index).isChecked()) !== roles[index]) {
                    await boxes.nth(index).setChecked(roles[index]);
                }
            }
            await modal.getByRole('button', { name: '确认添加' }).click();
        }

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
            await page.waitForTimeout(600);
        }

        const drafts = await page.evaluate(async () => {
            const db = new window.Dexie('QisiMathVueDB');
            await db.open();
            try {
                const rows = await db.table('draftQuestions').toArray();
                return rows.map(row => ({
                    questionNumber: String(row.questionNumber || ''),
                    type: row.type || '',
                    stem: String(row.stem || ''),
                    options: Array.isArray(row.options) ? row.options.map(option => String(option || '')) : [],
                    answer: String(row.answer || ''),
                    solution: String(row.solution || '')
                }));
            } finally {
                db.close();
            }
        });

        assert.equal(drafts.length, 2, `expected two questions, saw ${drafts.length}`);
        const byNumber = new Map(drafts.map(draft => [draft.questionNumber, draft]));

        const q1 = byNumber.get('1');
        assert.ok(q1, 'question 1 is missing');
        assert.equal(q1.type, '单选题', 'the 单选题 header types question 1');
        assert.equal(q1.answer, 'B');
        assert.doesNotMatch(q1.stem, /单选题/, 'the header must not leak into the stem');

        const q2 = byNumber.get('2');
        assert.ok(q2, 'question 2 is missing');
        assert.equal(q2.type, '多选题', 'the colon-less 多选题 header must still type question 2');
        assert.doesNotMatch(q2.stem, /多选题/, 'the header must not leak into the stem');
        assert.match(
            q2.answer,
            /x\s*=\s*1/,
            `an unlabelled answer value must be kept, saw "${q2.answer}"`
        );
        assert.ok(
            q2.solution.includes('第二题'),
            'the 详解 must stay a solution and not become the answer'
        );
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

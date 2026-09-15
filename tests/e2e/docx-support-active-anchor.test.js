const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-support-anchor.js');

const buildDocxInPage = (page, payload) => page.evaluate(async value => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', value.contentTypesXml);
    zip.file('_rels/.rels', value.rootRelsXml);
    zip.file('word/document.xml', value.documentXml);
    zip.file('word/_rels/document.xml.rels', value.documentRelsXml);
    if (value.withImage) {
        zip.file('word/media/image1.png', Uint8Array.from(atob(value.image1PngBase64), ch => ch.charCodeAt(0)));
    }
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}, payload);

const readDrafts = page => page.evaluate(async () => {
    const db = new window.Dexie('QisiMathVueDB');
    await db.open();
    try {
        const drafts = await db.table('draftQuestions').toArray();
        return drafts.map(draft => ({
            questionNumber: String(draft.questionNumber || ''),
            order: draft.order ?? null,
            type: draft.type || '',
            stem: String(draft.stem || ''),
            options: Array.isArray(draft.options) ? draft.options.map(option => String(option || '')) : [],
            answer: String(draft.answer || ''),
            solution: String(draft.solution || ''),
            warnings: Array.isArray(draft.warnings) ? draft.warnings : [],
            mergeWarnings: Array.isArray(draft.mergeWarnings) ? draft.mergeWarnings : []
        }));
    } finally {
        db.close();
    }
});

const runSupportPair = async (page, fixture) => {
    const questionBase64 = await buildDocxInPage(page, {
        contentTypesXml: fixture.contentTypesXml,
        rootRelsXml: fixture.rootRelsXml,
        documentXml: fixture.questionDocumentXml,
        documentRelsXml: fixture.emptyRelsXml,
        withImage: false
    });
    const answerBase64 = await buildDocxInPage(page, {
        contentTypesXml: fixture.contentTypesXml,
        rootRelsXml: fixture.rootRelsXml,
        documentXml: fixture.answerDocumentXml,
        documentRelsXml: fixture.answerDocumentRelsXml,
        image1PngBase64: fixture.image1PngBase64,
        withImage: true
    });

    await page.getByRole('button', { name: '批量录题' }).click();
    await page.locator('.batch-home-upload').click();
    await page.locator('input[type="file"][accept*=".docx"]').setInputFiles([
        {
            name: 'anchor-question.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: Buffer.from(questionBase64, 'base64')
        },
        {
            name: 'anchor-answer.docx',
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
        await page.waitForTimeout(700);
    }

    const drafts = await readDrafts(page);
    return new Map(drafts.map(draft => [draft.questionNumber, draft]));
};

test('an answer file with an active anchor keeps the 详解 behind its marker', {
    timeout: 240_000
}, async () => {
    const harness = await startBrowserApp(32138);
    const { page } = harness;

    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    try {
        const byNumber = await runSupportPair(page, fixture);
        assert.equal(byNumber.size, 3, `expected three questions, saw ${byNumber.size}`);

        const q2 = byNumber.get('2');
        assert.ok(q2, 'question 2 is missing');
        assert.match(
            q2.solution,
            /第二题/,
            `question 2 must keep the 详解 that follows its image-anchored marker, saw "${q2.solution}"`
        );
        assert.equal(q2.answer, '', 'a 详解 conclusion is not the answer of question 2');
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

test('a 详解 conclusion never becomes the answer of a question the file leaves blank', {
    timeout: 240_000
}, async () => {
    const harness = await startBrowserApp(32139);
    const { page } = harness;

    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    try {
        const byNumber = await runSupportPair(page, fixture);
        assert.equal(byNumber.size, 3, `expected three questions, saw ${byNumber.size}`);

        assert.equal(byNumber.get('1')?.answer, 'B', 'the explicit answer of question 1 must be kept');

        const q3 = byNumber.get('3');
        assert.ok(q3, 'question 3 is missing');
        assert.equal(
            q3.answer,
            '',
            `故选D must never be promoted to the answer, saw "${q3.answer}"`
        );
        assert.match(q3.solution, /第三题/, 'the 详解 must still be attached');
        assert.ok(
            q3.mergeWarnings.includes('missing_answer'),
            `question 3 must stay flagged as missing an answer, saw ${JSON.stringify(q3.mergeWarnings)}`
        );
        assert.ok(
            q3.mergeWarnings.includes('missing_explicit_answer'),
            `question 3 must carry the explicit-answer status, saw ${JSON.stringify(q3.mergeWarnings)}`
        );
        assert.ok(
            q3.warnings.some(warning => /未在答案文件中给出本题答案字母/.test(String(warning))),
            `question 3 must tell the teacher why the answer is empty, saw ${JSON.stringify(q3.warnings)}`
        );
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-question-scope.js');

const createFlowForDocx = async (page, buffer) => {
    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    await page.getByRole('button', { name: '批量录题' }).click();
    await page.locator('.batch-home-upload').click();
    await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
        name: 'scoped-questions.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer
    });

    const modal = page.locator('.batch-purpose-modal')
        .filter({ has: page.locator('.batch-purpose-options') });
    await modal.waitFor({ state: 'visible', timeout: 30_000 });
    await modal.locator('.batch-purpose-options input').nth(0).check();
    await modal.getByRole('button', { name: '确认添加' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '创建识别任务' }).click();

    const deadline = Date.now() + 120_000;
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
        await page.waitForTimeout(500);
    }

    return page.evaluate(async () => {
        const db = new window.Dexie('QisiMathVueDB');
        await db.open();
        try {
            const drafts = await db.table('draftQuestions').toArray();
            return drafts.map(draft => ({
                questionNumber: String(draft.questionNumber || ''),
                stem: String(draft.stem || ''),
                options: Array.isArray(draft.options) ? draft.options.map(option => String(option || '')) : [],
                answer: String(draft.answer || ''),
                solution: String(draft.solution || ''),
                warnings: draft.warnings || []
            }));
        } finally {
            db.close();
        }
    });
};

const buildDocxInPage = (page, payload) => page.evaluate(async value => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', value.contentTypesXml);
    zip.file('_rels/.rels', value.rootRelsXml);
    zip.file('word/document.xml', value.documentXml);
    zip.file('word/_rels/document.xml.rels', value.documentRelsXml);
    zip.file('word/media/image1.png', Uint8Array.from(atob(value.image1PngBase64), ch => ch.charCodeAt(0)));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}, payload);

// An image token carries a generated id that legitimately contains a timestamp; the leak we are
// looking for is a digit run in the document's own text.
const withoutMediaTokens = text => String(text || '')
    .replace(/\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]/g, ' ')
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/g, ' ');

test('every draft keeps its own stem and options, and the paper keeps its questions', {
    timeout: 180_000
}, async () => {
    const harness = await startBrowserApp(32133);
    const { page } = harness;
    const conversions = [];
    page.on('request', request => {
        if (request.url().includes('/api/convert/')) conversions.push(request.url());
    });

    try {
        const base64 = await buildDocxInPage(page, {
            contentTypesXml: fixture.contentTypesXml,
            rootRelsXml: fixture.rootRelsXml,
            documentXml: fixture.documentXml,
            documentRelsXml: fixture.documentRelsXml,
            image1PngBase64: fixture.image1PngBase64
        });
        const drafts = await createFlowForDocx(page, Buffer.from(base64, 'base64'));

        assert.equal(drafts.length, 3, `expected the paper's three questions, saw ${drafts.length}`);
        assert.deepEqual(
            drafts.map(draft => draft.questionNumber).sort(),
            ['1', '2', '3'],
            'the mark sheet numbering row must not invent or drop a question'
        );

        const byNumber = new Map(drafts.map(draft => [draft.questionNumber, draft]));
        assert.match(byNumber.get('3').stem, /\[\[IMAGE:/, 'drawing before the question number must survive the actual importer');
        assert.doesNotMatch(byNumber.get('2').stem, /\[\[IMAGE:/, 'the following question drawing must not leak into the preceding stem');

        for (const [number, keyword] of Object.entries(fixture.stems)) {
            const draft = byNumber.get(number);
            assert.ok(draft, `question ${number} is missing`);
            assert.match(draft.stem, new RegExp(keyword), `question ${number} lost its own stem`);
            assert.doesNotMatch(
                withoutMediaTokens(draft.stem),
                /\d{10,}/,
                `a drawing position leaked into question ${number}: ${draft.stem}`
            );
        }

        for (const [number, expected] of Object.entries(fixture.options)) {
            const draft = byNumber.get(number);
            assert.deepEqual(
                draft.options.filter(Boolean),
                expected,
                `question ${number} must keep its own options`
            );
        }

        const withOptions = drafts.filter(draft => draft.options.filter(Boolean).length);
        const signatures = withOptions.map(draft => draft.options.filter(Boolean).join('|'));
        assert.equal(
            new Set(signatures).size,
            signatures.length,
            `two questions share one option set: ${signatures.join(' / ')}`
        );

        assert.equal(
            drafts.some(draft => draft.options.some(option => /\d{10,}/.test(withoutMediaTokens(option)))),
            false
        );
        assert.deepEqual(harness.pageErrors, []);
        assert.deepEqual(conversions, [], 'ordinary DOCX must never require PDF conversion');
        assert.deepEqual(harness.forbiddenRequests, [], 'ordinary DOCX must not attempt AI/OCR');
    } finally {
        await harness.close();
    }
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-unresolved-formula.js');

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

test('a question with a formula the reader could not resolve is withheld, not admitted', {
    timeout: 180_000
}, async () => {
    const harness = await startBrowserApp(32142);
    const { page } = harness;

    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    try {
        const base64 = await buildDocxInPage(page, {
            contentTypesXml: fixture.contentTypesXml,
            rootRelsXml: fixture.rootRelsXml,
            documentXml: fixture.documentXml,
            documentRelsXml: fixture.documentRelsXml
        });

        await page.getByRole('button', { name: '批量录题' }).click();
        await page.locator('.batch-home-upload').click();
        await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
            name: 'unresolved-formula.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: Buffer.from(base64, 'base64')
        });

        const modal = page.locator('.batch-purpose-modal')
            .filter({ has: page.locator('.batch-purpose-options') });
        await modal.waitFor({ state: 'visible', timeout: 30_000 });
        await modal.locator('.batch-purpose-options input').nth(0).check();
        await modal.getByRole('button', { name: '确认添加' }).click();
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: '创建识别任务' }).click();

        const deadline = Date.now() + 150_000;
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
                    order: row.order ?? null,
                    stem: String(row.stem || ''),
                    options: Array.isArray(row.options) ? row.options.map(option => String(option || '')) : [],
                    warnings: Array.isArray(row.warnings) ? row.warnings : [],
                    mergeWarnings: Array.isArray(row.mergeWarnings) ? row.mergeWarnings : [],
                    withheld: Boolean(row.withheld),
                    withheldReason: String(row.withheldReason || ''),
                    optionsProvenance: row.fieldProvenance?.options || null
                }));
            } finally {
                db.close();
            }
        });

        assert.equal(drafts.length, 2, 'one unreadable formula must not sink the batch');
        const byNumber = new Map(drafts.map(draft => [draft.questionNumber, draft]));

        const control = byNumber.get(fixture.controlQuestion);
        assert.ok(control, 'the healthy question is missing');
        assert.equal(control.withheld, false);
        assert.deepEqual(control.options.filter(Boolean), ['1', '2', '3', '4']);
        assert.equal(
            control.mergeWarnings.includes('unresolved_formula'),
            false,
            'the healthy question must not be marked'
        );

        const affected = byNumber.get(fixture.affectedQuestion);
        assert.ok(affected, 'the question with the unreadable formula is missing');
        assert.equal(affected.withheld, true, 'the question must be withheld');
        assert.equal(affected.withheldReason, 'unresolved-formula');
        assert.equal(
            affected.optionsProvenance?.status,
            'rejected',
            'the options carrying the gap cannot be admitted'
        );
        assert.equal(
            affected.optionsProvenance?.reasonCode,
            'unresolved-formula'
        );
        assert.ok(affected.mergeWarnings.includes('unresolved_formula'));
        assert.ok(
            affected.warnings.some(warning => /公式未能从 DOCX 中读出/.test(String(warning))),
            `the teacher must be told why, saw ${JSON.stringify(affected.warnings)}`
        );

        const optionD = affected.options[3] || '';
        assert.match(optionD, /\[\[MTEF_UNRESOLVED:rId4\]\]/, 'the gap stays visible as its own token');
        assert.doesNotMatch(optionD, /UNRESOLVED\. /, 'no normalizer may rewrite the token');
        assert.match(affected.options[0], /1:8/, 'the readable options are untouched');
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-table-cell-question-marker.js');

// The upload path the importer reads is a data: URL (as in the other DOCX e2e fixtures); the file
// picker wants the same bytes as base64.
const buildDocxInPage = (page, payload) => page.evaluate(async value => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', value.contentTypesXml);
    zip.file('_rels/.rels', value.rootRelsXml);
    zip.file('word/document.xml', value.documentXml);
    const base64 = await zip.generateAsync({ type: 'base64' });
    return {
        base64,
        dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + base64
    };
}, payload);

const skeletonOf = (page, uploadPath) => page.evaluate(
    async path => window.QisiBatchImporter.extractDocxQuestionSkeleton({
        id: 'table-cell-test',
        filename: 'paper.docx',
        fileType: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadPath: path
    }),
    uploadPath
);

const readDrafts = page => page.evaluate(async () => {
    const db = new window.Dexie('QisiMathVueDB');
    await db.open();
    try {
        const drafts = await db.table('draftQuestions').toArray();
        return drafts.map(draft => ({
            questionNumber: String(draft.questionNumber || ''),
            answer: String(draft.answer || ''),
            solution: String(draft.solution || ''),
            mergeWarnings: Array.isArray(draft.mergeWarnings) ? draft.mergeWarnings : []
        }));
    } finally {
        db.close();
    }
});

const runSupportPair = async page => {
    const question = await buildDocxInPage(page, {
        contentTypesXml: fixture.contentTypesXml,
        rootRelsXml: fixture.rootRelsXml,
        documentXml: fixture.questionDocumentXml
    });
    const answer = await buildDocxInPage(page, {
        contentTypesXml: fixture.contentTypesXml,
        rootRelsXml: fixture.rootRelsXml,
        documentXml: fixture.answerDocumentXml
    });

    await page.getByRole('button', { name: '批量录题' }).click();
    await page.locator('.batch-home-upload').click();
    await page.locator('input[type="file"][accept*=".docx"]').setInputFiles([
        {
            name: 'table-question.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: Buffer.from(question.base64, 'base64')
        },
        {
            name: 'table-answer.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: Buffer.from(answer.base64, 'base64')
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

    const diagnostics = await page.evaluate(async () => {
        const db = new window.Dexie('QisiMathVueDB');
        await db.open();
        try {
            const batches = await db.table('draftImportBatches').toArray();
            const files = await db.table('draftImportFiles').toArray();
            return {
                batch: batches[0]
                    ? { status: batches[0].status, errorMessage: batches[0].errorMessage || '' }
                    : null,
                files: files.map(row => ({
                    filename: row.filename,
                    parseStatus: row.parseStatus,
                    errorMessage: row.errorMessage || ''
                }))
            };
        } finally {
            db.close();
        }
    });

    return {
        byNumber: new Map((await readDrafts(page)).map(draft => [draft.questionNumber, draft])),
        diagnostics
    };
};

test('a data-table cell that starts like a marker does not become a question', {
    timeout: 90_000
}, async () => {
    const harness = await startBrowserApp(32154);
    const { page } = harness;

    try {
        const uploadPath = await buildDocxInPage(page, {
            contentTypesXml: fixture.contentTypesXml,
            rootRelsXml: fixture.rootRelsXml,
            documentXml: fixture.questionDocumentXml
        });
        const skeleton = await skeletonOf(page, uploadPath.dataUrl);

        assert.deepEqual(
            skeleton.questionNumbers,
            fixture.expected.questionNumbers,
            `the score cells of the question table must not become questions: ${JSON.stringify(skeleton.diagnostics)}`
        );
        assert.equal(skeleton.diagnostics.noDuplicates, true, JSON.stringify(skeleton.diagnostics));
        assert.equal(skeleton.authoritative, true, JSON.stringify(skeleton.diagnostics));
    } finally {
        await harness.close();
    }
});

test('the key of a paper with a score table attaches, and a sub-question marker is not an answer', {
    timeout: 240_000
}, async () => {
    const harness = await startBrowserApp(32155);
    const { page } = harness;

    page.on('dialog', async dialog => {
        try { await dialog.accept(); } catch (_) { /* already gone */ }
    });

    try {
        const { byNumber, diagnostics } = await runSupportPair(page);

        assert.equal(
            byNumber.size,
            fixture.expected.questionNumbers.length,
            `expected the paper's own questions, saw ${byNumber.size}: ${JSON.stringify(diagnostics)}`
        );

        for (const [questionNumber, answer] of Object.entries(fixture.expected.answers)) {
            const draft = byNumber.get(questionNumber);
            assert.ok(draft, `question ${questionNumber} is missing`);
            assert.equal(
                draft.answer,
                answer,
                questionNumber === '4'
                    ? `"(1)" is the first sub-question, not an answer, saw "${draft.answer}"`
                    : `question ${questionNumber} must keep the key value, saw "${draft.answer}"`
            );
        }

        assert.match(
            byNumber.get('4').solution,
            /第四题/,
            'question 4 must keep the 详解 that follows its marker'
        );
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

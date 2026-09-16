const test = require('node:test');
const assert = require('node:assert/strict');

const { startBrowserApp, callProxy, getDbSnapshot } = require('./browser-harness.js');
const fixture = require('../fixtures/docx-answer-key-conflict.js');

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

test('an answer key that states two values for one question keeps both as evidence and picks neither', {
    timeout: 240_000
}, async () => {
    const harness = await startBrowserApp(32148);
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
                name: 'key-conflict-question.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: Buffer.from(questionBase64, 'base64')
            },
            {
                name: 'key-conflict-answer.docx',
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
        let snapshot = await getDbSnapshot(page);
        while (Date.now() < deadline) {
            snapshot = await getDbSnapshot(page);
            const status = String(snapshot.batches[0]?.status || '');
            if (['review', 'failed', 'completed'].includes(status)) break;
            await page.waitForTimeout(600);
        }
        await page.waitForTimeout(800);
        snapshot = await getDbSnapshot(page);

        assert.equal(snapshot.batches[0]?.status, 'review', 'the batch must reach review');
        assert.equal(snapshot.drafts.length, 3, 'the conflicting key must not sink the batch');

        const byNumber = new Map(snapshot.drafts.map(draft => [String(draft.questionNumber || ''), draft]));

        // The control questions keep the values their own key entries state.
        for (const [number, answer] of Object.entries(fixture.expected.unaffectedAnswers)) {
            const draft = byNumber.get(number);
            assert.ok(draft, `question ${number} is missing`);
            assert.equal(draft.answer, answer, `question ${number} must keep its single-valued answer`);
        }

        const conflicted = byNumber.get(fixture.expected.conflictedQuestion);
        assert.ok(conflicted, 'the conflicted question is missing');

        assert.equal(
            conflicted.answer,
            '',
            `neither key value may be attached, saw "${conflicted.answer}"`
        );
        // A key conflict leaves the answer empty; it is not a withheld question, so nothing may
        // block the rest of the draft.
        assert.ok(!conflicted.withheld, 'a key conflict is a missing answer, not a withheld question');
        assert.ok(
            (conflicted.warnings || []).some(warning => String(warning).includes(fixture.expected.notice)),
            `the teacher must be told the answer region disagrees, saw ${JSON.stringify(conflicted.warnings)}`
        );
        const notice = (conflicted.warnings || []).find(warning =>
            String(warning).includes(fixture.expected.notice));
        for (const value of fixture.expected.conflictValues) {
            assert.ok(
                notice.includes(value),
                `the notice must name the value "${value}", saw ${JSON.stringify(notice)}`
            );
        }
        assert.ok(
            (conflicted.mergeWarnings || []).includes('answerConflict'),
            `the conflict must stay visible to the merge gates, saw ${JSON.stringify(conflicted.mergeWarnings)}`
        );

        // The notice is on the question itself: the review page renders this draft's problems.
        await callProxy(page, 'openBatchReview', snapshot.batches[0].id);
        await page.locator('.batch-question-nav-item').first().waitFor({ timeout: 30_000 });
        await page.locator('.batch-question-nav-item')
            .filter({ hasText: `第 ${fixture.expected.conflictedQuestion} 题` })
            .click();
        const problemCard = page.locator('.batch-problem-card');
        await problemCard.waitFor({ state: 'visible', timeout: 30_000 });
        const problemText = await problemCard.innerText();
        assert.ok(
            problemText.includes(fixture.expected.notice),
            `the review card must show the conflict, saw ${JSON.stringify(problemText)}`
        );
        for (const value of fixture.expected.conflictValues) {
            assert.ok(
                problemText.includes(value),
                `the review card must name the value "${value}", saw ${JSON.stringify(problemText)}`
            );
        }

        assert.deepEqual(harness.forbiddenRequests, [], 'no AI/OCR request may be attempted');
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

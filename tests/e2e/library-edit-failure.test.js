'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { startBrowserApp } = require('./browser-harness.js');

const NAV_LIBRARY = '题库与检索';
const SEARCH_PLACEHOLDER = '搜索题干、答案、解析';
const EDIT_CARD = '编辑';
const CONFIRM_UPDATE = '确认更新';
const SOURCE_PLACEHOLDER = '在此修改 LaTeX 源码...';
const ORIGINAL_MARKER = '失败注入原题';
const EDITED_MARKER = '失败注入修改';

// A failed write must never look like a successful edit: the page would then disagree with the
// database and the change would silently disappear on reload.
test('a failed library edit is reported and the page returns to the stored value', {
    timeout: 120_000
}, async () => {
    const harness = await startBrowserApp(32122);
    const { page } = harness;

    const dialogs = [];
    page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.dismiss().catch(() => {});
    });

    try {
        const navigation = page.locator('aside.sidebar nav');

        await page.evaluate(async marker => {
            const database = new window.Dexie('QisiMathVueDB');
            await database.open();
            await database.table('questions').clear();
            const now = Date.now();
            await database.table('questions').put({
                id: 'edit-failure-question',
                createdAt: now,
                updatedAt: now,
                grade: '高二',
                type: '单选题',
                diff: '中等',
                systemKnowledge: '集合',
                knowledge: '集合',
                stem: `${marker} $x=1$`,
                options: ['1', '2', '3', '4'],
                answer: 'A',
                solution: '原解析',
                images: []
            });
            database.close();
        }, ORIGINAL_MARKER);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });

        await navigation.getByRole('button', { name: NAV_LIBRARY, exact: true }).click();
        const libraryRoot = page.locator('.library-layout');
        await libraryRoot.waitFor({ state: 'visible' });
        await libraryRoot.getByPlaceholder(SEARCH_PLACEHOLDER, { exact: true }).fill(ORIGINAL_MARKER);
        // The database was cleared, so this is the only card. A text filter would stop matching as
        // soon as the stem moves into the edit textarea.
        const card = libraryRoot.locator('.question-card').first();
        await card.waitFor({ state: 'visible', timeout: 20_000 });
        assert.match(await card.innerText(), new RegExp(ORIGINAL_MARKER));

        // The next database transaction belongs to the save the teacher is about to confirm. The
        // repository writes inside `db.transaction`, so failing that call fails the real write
        // path instead of a private helper.
        const injected = await page.evaluate(() => {
            const prototype = window.Dexie.prototype;
            const original = prototype.transaction;
            let injectedOnce = false;
            prototype.transaction = function (...args) {
                if (!injectedOnce) {
                    injectedOnce = true;
                    throw new Error('injected write failure');
                }
                return original.apply(this, args);
            };
            return true;
        });
        assert.equal(injected, true, 'fault injection must be installed');

        await card.getByRole('button', { name: EDIT_CARD, exact: true }).click();
        const editor = card.getByPlaceholder(SOURCE_PLACEHOLDER, { exact: true });
        await editor.waitFor({ state: 'visible' });
        await editor.fill(`${EDITED_MARKER} $x=2$`);
        await card.getByRole('button', { name: CONFIRM_UPDATE, exact: true }).click();

        // The failure must be reported to the teacher.
        const deadline = Date.now() + 10_000;
        while (!dialogs.length && Date.now() < deadline) {
            await page.waitForTimeout(200);
        }
        assert.ok(
            dialogs.some(message => /修改未保存/.test(message)),
            `the failed edit must be reported, saw: ${JSON.stringify(dialogs)}`
        );

        await page.waitForTimeout(500);
        const stored = await page.evaluate(async () => {
            const database = new window.Dexie('QisiMathVueDB');
            await database.open();
            const row = await database.table('questions').get('edit-failure-question');
            database.close();
            return String(row?.stem || '');
        });
        assert.match(stored, new RegExp(ORIGINAL_MARKER), 'the database must still hold the original stem');

        const cardText = await card.innerText();
        assert.match(
            cardText,
            new RegExp(ORIGINAL_MARKER),
            'the card must return to the stored value instead of showing an edit that was never saved'
        );
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});

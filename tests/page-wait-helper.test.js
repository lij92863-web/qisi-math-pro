'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');
const { waitForPageCondition } = require('./helpers/page-waits.js');

const TESTS_DIR = __dirname;

test('an asynchronous page condition is really awaited', { timeout: 30_000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<body></body>');
        await page.evaluate(() => {
            window.__flag = 0;
            setTimeout(() => {
                window.__flag = 1;
            }, 900);
        });

        const started = Date.now();
        await waitForPageCondition(page, () => Promise.resolve(window.__flag === 1), null, {
            timeoutMs: 10_000,
            label: 'flag'
        });
        const elapsed = Date.now() - started;

        assert.ok(elapsed >= 600, `the helper returned after only ${elapsed} ms, so it did not wait`);
        assert.equal(await page.evaluate(() => window.__flag), 1);
    } finally {
        await browser.close();
    }
});

test('no test waits on an asynchronous predicate that Playwright will not await', () => {
    const offenders = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!entry.name.endsWith('.test.js')) continue;
            const source = fs.readFileSync(full, 'utf8');
            if (/waitForFunction\(\s*async/.test(source)) {
                offenders.push(path.relative(TESTS_DIR, full));
            }
        }
    };
    walk(TESTS_DIR);

    assert.deepEqual(
        offenders,
        [],
        'Playwright treats an async predicate as an immediate truthy result; use waitForPageCondition instead'
    );
});

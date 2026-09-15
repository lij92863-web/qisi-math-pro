'use strict';

// Playwright's `waitForFunction` does not await an async predicate: the returned Promise object is
// truthy, so the call resolves immediately and the test races the application instead of waiting.
// This helper polls with `page.evaluate`, which does resolve promises, so an asynchronous condition
// really is awaited.
//
// Verified on 2026-09-15 against the installed Playwright: a predicate that flips a page flag after
// 1200 ms resolved `waitForFunction` in 14 ms, while this helper waits for the flag.
const waitForPageCondition = async (
    page,
    pageFunction,
    arg,
    { timeoutMs = 20_000, intervalMs = 150, label = 'page condition' } = {}
) => {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            if (await page.evaluate(pageFunction, arg)) return true;
        } catch (error) {
            lastError = error;
        }
        await page.waitForTimeout(intervalMs);
    }

    throw new Error(
        `${label} was not met within ${timeoutMs} ms`
        + (lastError ? `: ${lastError.message}` : '')
    );
};

module.exports = { waitForPageCondition };

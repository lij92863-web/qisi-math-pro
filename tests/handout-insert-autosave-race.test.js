'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const QUESTION_ID = 'autosave-race-question';

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = address && typeof address === 'object'
                ? address.port
                : 0;
            probe.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`local server exited before startup (${child.exitCode})`);
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // bounded readiness loop
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

// Handout writes are deliberately slow here. Repository handles are frozen, so the delay
// is injected through the database the repository is built with. A slow write is what the
// real suite hits under load, and it is what used to let a running autosave invalidate an
// insertion that had already decided which stored revision it was editing.
function installTimingHooks() {
    const hooks = { writeDelayMs: 1500 };
    let qisiValue;

    const slowDatabase = db => {
        const shim = {
            transaction: (mode, ...rest) => {
                const callback = rest.pop();
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        Promise.resolve(db.transaction(mode, ...rest, callback))
                            .then(resolve, reject);
                    }, hooks.writeDelayMs);
                });
            },
            table: name => db.table(name),
            handouts: db.handouts,
            handoutAssets: db.handoutAssets,
            handoutRevisions: db.handoutRevisions
        };
        return shim;
    };

    const patchModules = value => {
        if (!value || value.__qisiInsertRacePatched) return;
        if (!value.HandoutRepository) return;
        value.__qisiInsertRacePatched = true;

        const createRepository = value.HandoutRepository.createHandoutRepository;
        value.HandoutRepository.createHandoutRepository = options =>
            createRepository({ ...options, db: slowDatabase(options.db) });
    };

    // Each module does `root.Qisi = root.Qisi || {}` and then assigns its own api object.
    // A proxy lets the hook run as soon as the repository module is present.
    const registry = new Proxy({}, {
        set(target, key, value) {
            target[key] = value;
            patchModules(target);
            return true;
        }
    });

    window.__qisiTimingHooks = hooks;
    Object.defineProperty(window, 'Qisi', {
        configurable: true,
        get() {
            return qisiValue || registry;
        },
        set(value) {
            qisiValue = value;
            patchModules(value);
        }
    });
}

test('inserting a bank question during an autosave keeps both the insert and the save', {
    timeout: 90_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1600, height: 1000 }
        });
        const page = await context.newPage();
        await page.addInitScript(installTimingHooks);
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        await page.goto(`${origin}/handout.html`, { waitUntil: 'domcontentloaded' });
        // The handout page loads KaTeX, Vue and thirteen modules before it can boot. Under the
        // full suite's parallel browser workflows that consistently takes longer than twenty
        // seconds, so the readiness bound is generous rather than tight.
        await page.locator('.welcome-card').waitFor({ state: 'visible', timeout: 60_000 });
        assert.equal(
            await page.evaluate(() => window.__TEX_HANDOUT_READY__),
            true,
            `handout page did not become ready: ${serverOutput.join('').slice(-400)}`
        );

        await page.evaluate(async id => {
            const database = window.Qisi.Database.getDatabase();
            await database.questions.put({
                id,
                createdAt: '2026-07-27T07:00:00.000Z',
                updatedAt: '2026-07-27T08:00:00.000Z',
                grade: '高二',
                type: '解答题',
                diff: '中等',
                systemKnowledge: '函数',
                stem: '自动保存竞态题 $x^2=4$',
                options: [],
                answer: '竞态答案',
                solution: '竞态解析',
                images: []
            });
        }, QUESTION_ID);

        await page.getByTestId('new-handout').click();
        await page.getByTestId('handout-title').fill('自动保存竞态讲义');
        await page.getByTestId('save-now').click();
        await page.locator('.save-state.saved').waitFor({ state: 'visible' });

        await page.getByTestId('add-body').click();
        // The autosave debounce fires 500ms after the edit; wait until that save is
        // genuinely in flight before inserting.
        await page.locator('.save-state.saving').waitFor({ state: 'attached', timeout: 10_000 });

        await page.getByTestId('open-question-library').click();
        const row = page.locator(`[data-question-id="${QUESTION_ID}"]`);
        await row.waitFor({ state: 'visible' });
        await row.click();

        await page.locator('.editor-block.block-question').waitFor({
            state: 'visible',
            timeout: 20_000
        });
        await page.locator('.save-state.saved').waitFor({ state: 'attached', timeout: 10_000 });

        const notice = (await page.locator('.notice').innerText().catch(() => '')).trim();
        assert.doesNotMatch(
            notice,
            /插入失败|保存失败|另一个页面被修改/u,
            'an autosave and an insertion in the same tab must not conflict'
        );
        assert.equal(
            await page.locator('.save-state.error').count(),
            0,
            'the handout must still be saved after inserting a question'
        );
        assert.equal(
            await page.evaluate(async id => {
                const database = window.Qisi.Database.getDatabase();
                const handouts = await database.handouts.toArray();
                const blocks = handouts.flatMap(handout => handout.blocks || []);
                return blocks.filter(block => block.type === 'question'
                    && (block.sourceQuestionId === id
                        || block.snapshot?.sourceQuestionId === id)).length;
            }, QUESTION_ID),
            1,
            'the inserted question must be persisted exactly once'
        );
        assert.deepEqual(pageErrors, []);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});

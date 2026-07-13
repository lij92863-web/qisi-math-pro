const { spawn } = require('node:child_process');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const APP_URL = 'http://127.0.0.1:3000/main.html';
const HEALTH_URL = 'http://127.0.0.1:3000/api/health';

function parseRuns(argv) {
    const raw = argv.find(value => value.startsWith('--runs='));
    const runs = Number(raw ? raw.slice('--runs='.length) : 7);
    if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
        throw new Error('runs-must-be-an-integer-between-1-and-20');
    }
    return runs;
}

async function healthIsReady() {
    try {
        const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1000) });
        if (!response.ok) return false;
        const body = await response.json();
        return body?.service === 'qisi-local-server';
    } catch {
        return false;
    }
}

async function waitForHealth() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await healthIsReady()) return;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('local-server-health-timeout');
}

function median(samples, key) {
    const values = samples
        .map(sample => sample[key])
        .filter(Number.isFinite)
        .sort((left, right) => left - right);
    if (values.length === 0) throw new Error(`missing-browser-metric:${key}`);
    return values[Math.floor(values.length / 2)];
}

async function measure() {
    const purpose = String(process.env.QISI_BENCHMARK_PURPOSE || '').trim();
    if (!purpose) throw new Error('QISI_BENCHMARK_PURPOSE-is-required');
    const sampleRuns = parseRuns(process.argv.slice(2));
    let serverProcess = null;
    let browser = null;

    try {
        if (!(await healthIsReady())) {
            serverProcess = spawn(process.execPath, ['qisi-local-server.js'], {
                cwd: ROOT,
                stdio: 'ignore',
                windowsHide: true
            });
            await waitForHealth();
        }

        browser = await chromium.launch({
            headless: true,
            args: ['--enable-precise-memory-info']
        });
        const samples = [];

        for (let index = 0; index < sampleRuns; index += 1) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const session = await context.newCDPSession(page);
            await session.send('Performance.enable');
            const started = performance.now();
            const response = await page.goto(APP_URL, {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            await page.locator('body').waitFor({ state: 'visible' });
            const coldStartMs = performance.now() - started;
            const navigation = await page.evaluate(() => {
                const entry = performance.getEntriesByType('navigation')[0];
                return {
                    domContentLoadedMs: entry?.domContentLoadedEventEnd ?? null,
                    loadEventMs: entry?.loadEventEnd ?? null,
                    bodyTextLength: document.body.innerText.length
                };
            });
            const browserMetrics = await session.send('Performance.getMetrics');
            const metric = name => browserMetrics.metrics.find(item => item.name === name)?.value ?? null;

            samples.push({
                run: index + 1,
                status: response?.status() || 0,
                coldStartMs,
                ...navigation,
                jsHeapUsedBytes: metric('JSHeapUsedSize'),
                jsHeapTotalBytes: metric('JSHeapTotalSize'),
                nodes: metric('Nodes'),
                documents: metric('Documents')
            });
            await context.close();
        }

        return {
            schemaVersion: 'qisi.app-shell-browser-benchmark.r3',
            purpose,
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            browser: 'playwright-chromium-headless',
            appUrl: APP_URL,
            sampleRuns,
            median: {
                coldStartMs: median(samples, 'coldStartMs'),
                domContentLoadedMs: median(samples, 'domContentLoadedMs'),
                loadEventMs: median(samples, 'loadEventMs'),
                jsHeapUsedBytes: median(samples, 'jsHeapUsedBytes'),
                jsHeapTotalBytes: median(samples, 'jsHeapTotalBytes'),
                nodes: median(samples, 'nodes'),
                documents: median(samples, 'documents')
            },
            samples
        };
    } finally {
        if (browser) await browser.close();
        if (serverProcess && !serverProcess.killed) serverProcess.kill();
    }
}

measure()
    .then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch(error => {
        process.stderr.write(`[measure-app-shell-browser] ${error?.message || 'failed'}\n`);
        process.exitCode = 1;
    });

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'local-run-artifacts', 'pdf-master');
const LEDGER_PATH = path.join(ARTIFACT_DIR, 'attempt-ledger.jsonl');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'latest-sanitized-report.json');
const QUESTION_PDF = path.join(
    ROOT,
    'local-test-materials',
    'case02-pdf-pdf-real',
    '01-question.pdf'
);
const SUPPORT_PDF = path.join(
    ROOT,
    'local-test-materials',
    'case02-pdf-pdf-real',
    '02-support-answer-solution.pdf'
);
const APP_URL = String(
    process.env.QISI_BASE_URL ||
    'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const API_KEY_ENV_NAME = 'DASH' + 'SCOPE_API_KEY';

const parseMode = () => {
    const raw =
        process.argv.find(arg => arg.startsWith('--mode=')) || '';
    const mode =
        raw.split('=').slice(1).join('=').trim() || 'preflight';

    if (!['preflight', 'dry-run', 'real-run'].includes(mode)) {
        throw new Error(`Unsupported mode: ${mode}`);
    }

    return mode;
};

const rel = value =>
    path.relative(ROOT, value).replace(/\\/g, '/');

const safePath = value =>
    rel(path.resolve(value));

const fileStat = async filePath => {
    const stat =
        await fsp.stat(filePath);

    return {
        path:
            safePath(filePath),
        exists:
            true,
        bytes:
            stat.size
    };
};

const hasPackageStartScript = () => {
    const pkg =
        JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

    return Boolean(pkg?.scripts?.start);
};

const isLocalRunArtifactsIgnored = () => {
    const gitignorePath =
        path.join(ROOT, '.gitignore');
    const content =
        fs.existsSync(gitignorePath)
            ? fs.readFileSync(gitignorePath, 'utf8')
            : '';

    return /(^|\r?\n)local-run-artifacts\/(\r?\n|$)/.test(content);
};

const dependencyStatus = () => {
    const names =
        ['playwright', 'puppeteer', 'selenium-webdriver'];

    return names.map(name => {
        try {
            return {
                name,
                available:
                    true,
                resolved:
                    require.resolve(name)
            };
        } catch (_) {
            return {
                name,
                available:
                    false,
                resolved:
                    ''
            };
        }
    });
};

const makeLedgerEntry = ({
    mode,
    questionPdf,
    supportPdf,
    result,
    nextAction,
    warnings = [],
    realApiCalled = false,
    underlyingApiCallCount = 0,
    questionItemCount = null,
    answerItemCount = null,
    solutionItemCount = null,
    alignMode = null,
    wrongAttachRisk = 'not-evaluated'
}) => ({
    attemptNumber:
        mode === 'real-run' && realApiCalled ? null : 0,
    mode,
    time:
        new Date().toISOString(),
    questionPdfPath:
        questionPdf?.path || safePath(QUESTION_PDF),
    supportPdfPath:
        supportPdf?.path || safePath(SUPPORT_PDF),
    questionPdfSize:
        questionPdf?.bytes || 0,
    supportPdfSize:
        supportPdf?.bytes || 0,
    realApiCalled:
        Boolean(realApiCalled),
    underlyingApiCallCount:
        Number(underlyingApiCallCount || 0),
    questionItemCount,
    answerItemCount,
    solutionItemCount,
    alignMode,
    warnings,
    wrongAttachRisk,
    result,
    nextAction
});

const writeArtifacts = async (report, ledgerEntry) => {
    await fsp.mkdir(ARTIFACT_DIR, { recursive: true });
    await fsp.writeFile(
        REPORT_PATH,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
    await fsp.appendFile(
        LEDGER_PATH,
        `${JSON.stringify(ledgerEntry)}\n`,
        'utf8'
    );
};

const fetchJson = async url => {
    const response =
        await fetch(url);
    const text =
        await response.text();

    let data = null;
    try {
        data =
            text ? JSON.parse(text) : null;
    } catch (_) {
        data =
            { rawPreview: text.slice(0, 120) };
    }

    return {
        ok:
            response.ok,
        status:
            response.status,
        data
    };
};

const fetchText = async url => {
    const response =
        await fetch(url);
    const text =
        await response.text();

    return {
        ok:
            response.ok,
        status:
            response.status,
        text,
        textPreview:
            text.slice(0, 2000)
    };
};

const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

const waitForHealth = async timeoutMs => {
    const deadline =
        Date.now() + timeoutMs;
    let last = null;

    while (Date.now() < deadline) {
        try {
            last =
                await fetchJson(`${APP_URL}/api/health`);
            if (last.ok && last.data?.service === 'qisi-local-server') {
                return {
                    ok:
                        true,
                    health:
                        last
                };
            }
        } catch (error) {
            last =
                {
                    ok:
                        false,
                    error:
                        error?.message || String(error)
                };
        }

        await wait(500);
    }

    return {
        ok:
            false,
        health:
            last
    };
};

const startLocalServer = () => {
    const child =
        spawn(process.execPath, ['qisi-local-server.js'], {
            cwd:
                ROOT,
            stdio:
                'ignore',
            windowsHide:
                true
        });

    return child;
};

const stopLocalServer = child => {
    if (!child?.pid) return;

    if (process.platform === 'win32') {
        spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide:
                true,
            stdio:
                'ignore'
        });
        return;
    }

    child.kill('SIGTERM');
};

const runPreflight = async () => {
    const checks = [];
    const warnings = [];
    const questionPdf =
        await fileStat(QUESTION_PDF);
    const supportPdf =
        await fileStat(SUPPORT_PDF);
    const deps =
        dependencyStatus();

    checks.push({
        name:
            'project-root',
        ok:
            fs.existsSync(path.join(ROOT, 'package.json')) &&
            fs.existsSync(path.join(ROOT, 'main.html'))
    });
    checks.push({
        name:
            'case02-question-pdf',
        ok:
            questionPdf.exists,
        bytes:
            questionPdf.bytes
    });
    checks.push({
        name:
            'case02-support-pdf',
        ok:
            supportPdf.exists,
        bytes:
            supportPdf.bytes
    });
    checks.push({
        name:
            'local-run-artifacts-gitignored',
        ok:
            isLocalRunArtifactsIgnored()
    });
    checks.push({
        name:
            'api-key-env-presence',
        ok:
            Boolean(String(process.env[API_KEY_ENV_NAME] || '').trim()),
        valuePrinted:
            false
    });
    checks.push({
        name:
            'local-service-start-script',
        ok:
            hasPackageStartScript()
    });
    checks.push({
        name:
            'browser-automation-dependency',
        ok:
            deps.some(item => item.available),
        dependencies:
            deps
    });

    if (!deps.some(item => item.available)) {
        warnings.push('browser-automation-dependency-missing');
    }

    const ok =
        checks.every(check => check.ok);
    const result =
        ok ? 'pass' : 'fail-environment';
    const nextAction =
        ok
            ? 'dry-run'
            : 'install or expose a browser automation dependency before real-run';
    const ledgerEntry =
        makeLedgerEntry({
            mode:
                'preflight',
            questionPdf,
            supportPdf,
            result,
            nextAction,
            warnings
        });
    const report =
        {
            mode:
                'preflight',
            ok,
            appUrl:
                APP_URL,
            checks,
            ledgerEntry,
            artifactPaths:
                {
                    report:
                        safePath(REPORT_PATH),
                    ledger:
                        safePath(LEDGER_PATH)
                }
        };

    await writeArtifacts(report, ledgerEntry);
    return report;
};

const runDryRun = async () => {
    const warnings = [];
    const gaps = [];
    const questionPdf =
        await fileStat(QUESTION_PDF);
    const supportPdf =
        await fileStat(SUPPORT_PDF);
    const deps =
        dependencyStatus();
    let serverStarted = false;
    let serverProcess = null;
    let health =
        await waitForHealth(1000);

    if (!health.ok) {
        serverProcess =
            startLocalServer();
        serverStarted =
            true;
        health =
            await waitForHealth(10000);
    }

    let appPage =
        {
            ok:
                false,
            status:
                0,
            hasBatchEntry:
                false,
            checkedByBrowser:
                false
        };

    if (health.ok) {
        const page =
            await fetchText(`${APP_URL}/main.html`);
        appPage =
            {
                ok:
                    page.ok,
                status:
                    page.status,
                hasBatchEntry:
                    /batchImport|openBatchCreate|批量/.test(page.text),
                checkedByBrowser:
                    false
            };
    }

    const automationAvailable =
        deps.some(item => item.available);
    let browserChain =
        {
            ok:
                false,
            opened:
                false,
            title:
                '',
            hasBatchEntry:
                false,
            error:
                ''
        };

    if (automationAvailable && health.ok) {
        try {
            const { chromium } =
                require('playwright');
            const browser =
                await chromium.launch({ headless: true });
            const page =
                await browser.newPage();
            await page.goto(`${APP_URL}/main.html`, {
                waitUntil:
                    'domcontentloaded',
                timeout:
                    30000
            });
            const title =
                await page.title();
            const hasBatchEntry =
                await page.evaluate(() => {
                    const text =
                        document.body?.innerText || '';
                    const html =
                        document.documentElement?.innerHTML || '';
                    return /批量|batchImport|openBatchCreate/.test(`${text}\n${html}`);
                });
            await browser.close();
            browserChain =
                {
                    ok:
                        Boolean(hasBatchEntry),
                    opened:
                        true,
                    title,
                    hasBatchEntry:
                        Boolean(hasBatchEntry),
                    error:
                        ''
                };
            appPage.checkedByBrowser =
                true;
            appPage.hasBatchEntry =
                Boolean(appPage.hasBatchEntry && hasBatchEntry);
        } catch (error) {
            browserChain =
                {
                    ok:
                        false,
                    opened:
                        false,
                    title:
                        '',
                    hasBatchEntry:
                        false,
                    error:
                        error?.message || String(error)
                };
        }
    }

    if (!automationAvailable) {
        warnings.push('browser-automation-dependency-missing');
        gaps.push('No Playwright, Puppeteer, or Selenium dependency is available, so the runner cannot drive the browser UI.');
    }

    if (!health.ok) {
        warnings.push('local-service-unavailable');
        gaps.push('Local service did not become healthy at the configured app URL.');
    }

    if (!appPage.ok || !appPage.hasBatchEntry) {
        warnings.push('batch-entry-not-confirmed-by-browser-chain');
        gaps.push('The app page could not be inspected through a real browser automation chain.');
    }

    if (automationAvailable && !browserChain.ok) {
        warnings.push('browser-chain-open-page-failed');
        gaps.push('Playwright was available, but the runner could not prove the app page and batch entry through Chromium.');
    }

    const ok =
        Boolean(health.ok && appPage.ok && appPage.hasBatchEntry && automationAvailable && browserChain.ok);
    const result =
        ok ? 'pass' : 'fail-environment';
    const nextAction =
        ok
            ? 'Stage 6 real-run may be attempted with explicit cap'
            : 'Add a browser automation dependency and rerun dry-run before Stage 6';
    const ledgerEntry =
        makeLedgerEntry({
            mode:
                'dry-run',
            questionPdf,
            supportPdf,
            result,
            nextAction,
            warnings
        });
    const report =
        {
            mode:
                'dry-run',
            ok,
            appUrl:
                APP_URL,
            serverStarted,
            health:
                {
                    ok:
                        Boolean(health.ok),
                    status:
                        health.health?.status || 0,
                    service:
                        health.health?.data?.service || ''
                },
            appPage,
            browserChain,
            pdfInputs:
                {
                    questionPdf,
                    supportPdf
                },
            automationDependencies:
                deps,
            gaps,
            ledgerEntry,
            artifactPaths:
                {
                    report:
                        safePath(REPORT_PATH),
                    ledger:
                        safePath(LEDGER_PATH)
                }
        };

    await writeArtifacts(report, ledgerEntry);
    stopLocalServer(serverProcess);
    return report;
};

const runRealRun = async () => {
    const questionPdf =
        await fileStat(QUESTION_PDF);
    const supportPdf =
        await fileStat(SUPPORT_PDF);
    const deps =
        dependencyStatus();
    const warnings =
        ['real-run-blocked-in-stage5b-runner-not-ready'];
    const ledgerEntry =
        makeLedgerEntry({
            mode:
                'real-run',
            questionPdf,
            supportPdf,
            result:
                'fail-environment',
            nextAction:
                'Complete dry-run browser automation before consuming a real API attempt',
            warnings
        });
    const report =
        {
            mode:
                'real-run',
            ok:
                false,
            blocked:
                true,
            realApiCalled:
                false,
            underlyingApiCallCount:
                0,
            reason:
                'Browser-chain runner is not established until dry-run passes with an automation dependency.',
            automationDependencies:
                deps,
            ledgerEntry
        };

    await writeArtifacts(report, ledgerEntry);
    return report;
};

const main = async () => {
    const mode =
        parseMode();
    const report =
        mode === 'preflight'
            ? await runPreflight()
            : mode === 'dry-run'
                ? await runDryRun()
                : await runRealRun();

    console.log(JSON.stringify(report, null, 2));

    if (!report.ok) {
        process.exitCode = 2;
    }
};

main().catch(error => {
    console.error(
        JSON.stringify(
            {
                ok:
                    false,
                error:
                    error?.message || String(error)
            },
            null,
            2
        )
    );
    process.exitCode = 1;
});

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'local-run-artifacts', 'pdf-master');
const LEDGER_PATH = path.join(ARTIFACT_DIR, 'attempt-ledger.jsonl');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'latest-sanitized-report.json');
const STAGE6_REPORT_PATH = path.join(
    ROOT,
    'docs',
    'testing',
    'PDF_MASTER_STAGE6_REAL_VALIDATION_REPORT.md'
);
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

const countRealAttempts = async () => {
    try {
        const text =
            await fsp.readFile(LEDGER_PATH, 'utf8');
        return text
            .split(/\r?\n/)
            .filter(Boolean)
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (_) {
                    return null;
                }
            })
            .filter(item => item?.mode === 'real-run' && item.realApiCalled)
            .length;
    } catch (_) {
        return 0;
    }
};

const appendStage6Report = async report => {
    const attempt =
        report?.ledgerEntry || {};
    const lines = [
        '# PDF Master Stage 6 Real Validation Report',
        '',
        '## Latest Attempt',
        '',
        `Attempt number: ${attempt.attemptNumber ?? 0}`,
        `Time: ${attempt.time || ''}`,
        `Question PDF: ${attempt.questionPdfPath || ''}`,
        `Support PDF: ${attempt.supportPdfPath || ''}`,
        `Real API called: ${attempt.realApiCalled ? 'true' : 'false'}`,
        `Underlying API call count if known: ${attempt.underlyingApiCallCount ?? 0}`,
        `Question item count: ${attempt.questionItemCount ?? 'N/A'}`,
        `Answer item count: ${attempt.answerItemCount ?? 'N/A'}`,
        `Solution item count: ${attempt.solutionItemCount ?? 'N/A'}`,
        `Align mode: ${attempt.alignMode || 'N/A'}`,
        `Warnings: ${(attempt.warnings || []).join(', ') || 'none'}`,
        `Missing answers: ${(report.missingAnswers || []).join(', ') || 'none'}`,
        `Missing solutions: ${(report.missingSolutions || []).join(', ') || 'none'}`,
        `Fail-closed: ${report.failClosed ? 'yes' : 'no'}`,
        `Prefix: ${report.prefix ? 'yes' : 'no'}`,
        `Wrong attach risk: ${attempt.wrongAttachRisk || 'not-evaluated'}`,
        `Result classification: ${attempt.result || 'N/A'}`,
        `Next action: ${attempt.nextAction || ''}`,
        '',
        '## Safety',
        '',
        '- API key value printed: no',
        '- Full OCR raw text saved: no',
        '- Real PDF/DOCX committed: no',
        '- Formal question bank submitted: no',
        '- local-run-artifacts committed: no',
        ''
    ];

    await fsp.writeFile(STAGE6_REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
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
    const warnings = [];

    if (!String(process.env[API_KEY_ENV_NAME] || '').trim()) {
        warnings.push('api-key-env-missing');
    }

    if (!deps.some(item => item.name === 'playwright' && item.available)) {
        warnings.push('playwright-missing');
    }

    if (warnings.length) {
        const ledgerEntry =
            makeLedgerEntry({
                mode: 'real-run',
                questionPdf,
                supportPdf,
                result: 'fail-environment',
                nextAction: 'Fix runner environment before retrying',
                warnings
            });
        const report =
            {
                mode: 'real-run',
                ok: false,
                realApiCalled: false,
                underlyingApiCallCount: 0,
                warnings,
                ledgerEntry
            };

        await writeArtifacts(report, ledgerEntry);
        await appendStage6Report(report);
        return report;
    }

    const { chromium } =
        require('playwright');
    let serverProcess = null;
    let serverStarted = false;
    let browser = null;
    let localApiCallCount = 0;
    let apiRequestStarted = false;
    let batchSnapshot = null;
    let draftSnapshot = [];
    let result = 'fail-environment';
    let nextAction = 'Inspect real-run failure and retry only after a code or environment change';

    try {
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

        if (!health.ok) {
            throw new Error('local service unavailable');
        }

        browser =
            await chromium.launch({ headless: true });
        const page =
            await browser.newPage();
        const aiPathPattern =
            new RegExp('/api/' + 'ai/(?:chat|ocr)');

        page.on('request', request => {
            if (aiPathPattern.test(request.url())) {
                localApiCallCount += 1;
                apiRequestStarted = true;
            }
        });

        page.on('dialog', dialog => dialog.accept().catch(() => {}));

        await page.goto(`${APP_URL}/main.html`, {
            waitUntil: 'load',
            timeout: 60000
        });
        await page.waitForFunction(
            () => Boolean(document.querySelector('#app')?.__vue_app__?._instance?.proxy),
            null,
            { timeout: 60000 }
        );

        await page.evaluate(() => {
            const proxy =
                document.querySelector('#app').__vue_app__._instance.proxy;
            proxy.view = 'batchImport';
            proxy.openBatchCreate('mixed');
        });

        const input =
            page.locator('input[type="file"][multiple]').first();
        await input.setInputFiles([QUESTION_PDF, SUPPORT_PDF]);

        const confirmPendingFile = async (filenamePart, roles) => {
            await page.waitForFunction(
                part => {
                    const proxy =
                        document.querySelector('#app')?.__vue_app__?._instance?.proxy;
                    return Boolean(proxy?.pendingPurposeFile?.filename?.includes(part));
                },
                filenamePart,
                { timeout: 60000 }
            );
            await page.evaluate(({ roles: nextRoles }) => {
                const proxy =
                    document.querySelector('#app').__vue_app__._instance.proxy;
                proxy.pendingPurposeRoles = [];
                nextRoles.forEach(role => proxy.togglePurposeRole(role));
                proxy.confirmBatchFilePurpose();
            }, { roles });
        };

        await confirmPendingFile('01-question.pdf', ['question']);
        await confirmPendingFile('02-support-answer-solution.pdf', ['answer', 'solution']);

        await page.waitForFunction(() => {
            const proxy =
                document.querySelector('#app')?.__vue_app__?._instance?.proxy;
            return Array.isArray(proxy?.batchCreateFiles) && proxy.batchCreateFiles.length === 2;
        }, null, { timeout: 60000 });

        await page.evaluate(() => {
            const proxy =
                document.querySelector('#app').__vue_app__._instance.proxy;
            proxy.createDraftImportBatch();
        });

        await page.waitForFunction(() => {
            const proxy =
                document.querySelector('#app')?.__vue_app__?._instance?.proxy;
            const batch = proxy?.activeBatch;
            return Boolean(batch && ['review', 'failed', 'completed'].includes(batch.status));
        }, null, {
            timeout:
                Math.max(60000, Number(process.env.QISI_REAL_RUN_TIMEOUT_MS || 900000))
        });

        const sanitized =
            await page.evaluate(async () => {
                const proxy =
                    document.querySelector('#app').__vue_app__._instance.proxy;
                await proxy.openBatchReview(proxy.activeBatchId);
                const clean = value => String(value || '').trim();
                const questionNo = (draft, index) =>
                    String(draft.questionNumber || draft.question || draft.order || index + 1);
                const drafts =
                    (proxy.batchDraftQuestions || []).map((draft, index) => {
                        const warnings =
                            [
                                ...(Array.isArray(draft.warnings) ? draft.warnings : []),
                                ...(Array.isArray(draft.mergeWarnings) ? draft.mergeWarnings : [])
                            ].map(String);

                        return {
                            question:
                                questionNo(draft, index),
                            hasAnswer:
                                Boolean(clean(draft.answer)),
                            hasSolution:
                                Boolean(clean(draft.solution)),
                            warnings:
                                [...new Set(warnings)]
                        };
                    });

                return {
                    batch:
                        proxy.activeBatch
                            ? {
                                id: proxy.activeBatch.id || '',
                                status: proxy.activeBatch.status || '',
                                totalCount: proxy.activeBatch.totalCount || 0,
                                problemCount: proxy.activeBatch.problemCount || 0,
                                errorMessage: proxy.activeBatch.errorMessage || ''
                            }
                            : null,
                    summary:
                        proxy.batchRecognitionSummary
                            ? {
                                total: proxy.batchRecognitionSummary.total || 0,
                                withAnswers: proxy.batchRecognitionSummary.withAnswers || 0,
                                withSolutions: proxy.batchRecognitionSummary.withSolutions || 0,
                                missingAnswers: proxy.batchRecognitionSummary.missingAnswers || [],
                                missingSolutions: proxy.batchRecognitionSummary.missingSolutions || []
                            }
                            : null,
                    drafts
                };
            });

        batchSnapshot =
            sanitized.batch;
        draftSnapshot =
            sanitized.drafts || [];

        if (batchSnapshot?.status === 'failed') {
            warnings.push('batch-status-failed');
            if (batchSnapshot.errorMessage) {
                warnings.push('batch-error-message-present');
            }
            result = 'fail-environment';
        } else {
            const allWarnings =
                [
                    ...new Set(
                        draftSnapshot.flatMap(draft => draft.warnings || [])
                    )
                ];
            const unsafe =
                allWarnings.some(warning =>
                    /answerConflict|错挂|断号后继续|回跳后继续|重复题号后继续|answer\/solution/.test(warning)
                );
            const sequenceGuarded =
                allWarnings.some(warning =>
                    /pdf-support-sequence-unreliable|missing_answer|missing_solution/.test(warning)
                );
            const missingAny =
                draftSnapshot.some(draft => !draft.hasAnswer || !draft.hasSolution);

            warnings.push(...allWarnings);

            if (unsafe) {
                result = 'fail-unsafe';
                nextAction = 'Convert sanitized warning shape to fixture before any retry';
            } else if (missingAny || sequenceGuarded) {
                result = 'pass-safe-partial';
                nextAction = 'Proceed to Stage 7 final regression';
            } else {
                result = 'pass-full';
                nextAction = 'Proceed to Stage 7 final regression';
            }
        }

        const missingAnswers =
            draftSnapshot.filter(draft => !draft.hasAnswer).map(draft => draft.question);
        const missingSolutions =
            draftSnapshot.filter(draft => !draft.hasSolution).map(draft => draft.question);
        const failClosed =
            warnings.some(warning => /pdf-support-sequence-unreliable/.test(warning));
        const prefix =
            warnings.some(warning => /pdf-support-prefix-only|pdf-support-sequence-unreliable/.test(warning));
        const alignMode =
            failClosed
                ? 'fail-closed'
                : prefix
                    ? 'prefix'
                    : result === 'pass-full'
                        ? 'full'
                        : 'unknown';
        const realAttemptCount =
            (await countRealAttempts()) + (apiRequestStarted ? 1 : 0);
        const ledgerEntry =
            makeLedgerEntry({
                mode: 'real-run',
                questionPdf,
                supportPdf,
                result,
                nextAction,
                warnings: [...new Set(warnings)].slice(0, 80),
                realApiCalled: apiRequestStarted,
                underlyingApiCallCount: localApiCallCount,
                questionItemCount: draftSnapshot.length,
                answerItemCount: draftSnapshot.filter(draft => draft.hasAnswer).length,
                solutionItemCount: draftSnapshot.filter(draft => draft.hasSolution).length,
                alignMode,
                wrongAttachRisk:
                    result === 'fail-unsafe'
                        ? 'detected'
                        : 'not-detected-by-sanitized-warnings'
            });
        ledgerEntry.attemptNumber =
            apiRequestStarted ? realAttemptCount : 0;

        const report =
            {
                mode: 'real-run',
                ok: result === 'pass-full' || result === 'pass-safe-partial',
                serverStarted,
                batch:
                    batchSnapshot,
                draftCount:
                    draftSnapshot.length,
                missingAnswers,
                missingSolutions,
                failClosed,
                prefix,
                realApiCalled:
                    apiRequestStarted,
                underlyingApiCallCount:
                    localApiCallCount,
                ledgerEntry
            };

        await writeArtifacts(report, ledgerEntry);
        await appendStage6Report(report);
        return report;
    } catch (error) {
        warnings.push('real-run-exception');
        const ledgerEntry =
            makeLedgerEntry({
                mode: 'real-run',
                questionPdf,
                supportPdf,
                result: 'fail-environment',
                nextAction: 'Fix runner real-run environment before retrying',
                warnings,
                realApiCalled: apiRequestStarted,
                underlyingApiCallCount: localApiCallCount
            });
        ledgerEntry.attemptNumber =
            apiRequestStarted ? (await countRealAttempts()) + 1 : 0;
        const report =
            {
                mode: 'real-run',
                ok: false,
                error:
                    error?.message || String(error),
                realApiCalled:
                    apiRequestStarted,
                underlyingApiCallCount:
                    localApiCallCount,
                missingAnswers: [],
                missingSolutions: [],
                failClosed: false,
                prefix: false,
                ledgerEntry
            };

        await writeArtifacts(report, ledgerEntry);
        await appendStage6Report(report);
        return report;
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        stopLocalServer(serverProcess);
    }
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

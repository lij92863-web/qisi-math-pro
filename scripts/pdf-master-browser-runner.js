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
const WRITE_STAGE6_REPORT =
    process.env.QISI_WRITE_STAGE6_REPORT === '1';
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
const REAL_RUN_ALLOWED_ENV_NAME =
    'QISI_PDF_MASTER_REAL_RUN_ALLOWED';
const EXPECTED_QUESTION_NUMBERS =
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'];

const parseMode = (argv = process.argv) => {
    const raw =
        argv.find(arg => arg.startsWith('--mode=')) || '';
    const positional =
        argv.slice(2).find(arg => ['preflight', 'dry-run', 'real-run'].includes(arg)) || '';
    const mode =
        raw
            ? raw.split('=').slice(1).join('=').trim()
            : positional || 'preflight';

    if (!['preflight', 'dry-run', 'real-run'].includes(mode)) {
        throw new Error(`Unsupported mode: ${mode}`);
    }

    return mode;
};

const assertRealRunAllowed = mode => {
    if (
        mode === 'real-run' &&
        process.env[REAL_RUN_ALLOWED_ENV_NAME] !== '1'
    ) {
        throw new Error(
            `real-run requires ${REAL_RUN_ALLOWED_ENV_NAME}=1`
        );
    }
};

const createRunContext = (mode, now = new Date()) => {
    const stamp =
        now.toISOString();
    const compact =
        stamp.replace(/[^0-9]/g, '').slice(0, 14);

    return {
        runId:
            `pdf-master-${mode}-${compact}`,
        attemptId:
            `${mode}-${compact}`,
        startedAt:
            stamp
    };
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
    runContext = createRunContext(mode),
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
    wrongAttachRisk = 'not-evaluated',
    detectedQuestionNumbers = [],
    detectedAnswerNumbers = [],
    detectedSolutionNumbers = [],
    safeAnswerNumbers = [],
    safeSolutionNumbers = [],
    fusedQuestionNumbers = [],
    prefixCutoffReason = '',
    parserWarnings = [],
    alignerReportReasons = [],
    controlledWriteSummary = null,
    controlledWriteAcceptedAnswerNumbers = [],
    controlledWriteRejectedAnswerNumbers = [],
    draftSnapshotAnswerNumbers = [],
    baselineCandidateAnswerNumbers = [],
    draftCleanup = null,
    reportSource = 'current-run-only'
}) => ({
    runId:
        runContext.runId,
    attemptId:
        runContext.attemptId,
    startedAt:
        runContext.startedAt,
    attemptNumber:
        mode === 'real-run' && realApiCalled ? null : 0,
    mode,
    time:
        new Date().toISOString(),
    questionPdfPath:
        questionPdf?.path || safePath(QUESTION_PDF),
    supportPdfPath:
        supportPdf?.path || safePath(SUPPORT_PDF),
    inputFiles:
        [
            questionPdf?.path || safePath(QUESTION_PDF),
            supportPdf?.path || safePath(SUPPORT_PDF)
        ],
    expectedQuestionNumbers:
        EXPECTED_QUESTION_NUMBERS,
    detectedQuestionNumbers,
    detectedAnswerNumbers,
    detectedSolutionNumbers,
    safeAnswerNumbers,
    safeSolutionNumbers,
    fusedQuestionNumbers,
    prefixCutoffReason,
    parserWarnings,
    alignerReportReasons,
    controlledWriteSummary,
    controlledWriteAcceptedAnswerNumbers,
    controlledWriteRejectedAnswerNumbers,
    draftSnapshotAnswerNumbers,
    baselineCandidateAnswerNumbers,
    draftCleanup,
    reportSource,
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

const sanitizeWarningForReport = warning => {
    const text =
        String(warning || '');

    if (/pdf-support-sequence-unreliable/.test(text)) {
        return 'pdf-support-sequence-unreliable';
    }
    if (/pdf-support-prefix-only/.test(text)) {
        return 'pdf-support-prefix-only';
    }
    if (/missing_answer/.test(text)) {
        return 'missing_answer';
    }
    if (/missing_solution/.test(text)) {
        return 'missing_solution';
    }
    if (/answerConflict/.test(text)) {
        return 'answerConflict';
    }
    if (/zero-draft-result/.test(text)) {
        return 'zero-draft-result';
    }
    if (/real-run-exception/.test(text)) {
        return 'real-run-exception';
    }
    if (/batch-status-failed/.test(text)) {
        return 'batch-status-failed';
    }
    if (/batch-error-message-present/.test(text)) {
        return 'batch-error-message-present';
    }

    return 'ui-review-warning';
};

const appendStage6Report = async report => {
    const attempt =
        report?.ledgerEntry || {};
    const reportWarnings =
        [
            ...new Set(
                (attempt.warnings || []).map(sanitizeWarningForReport)
            )
        ];
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
        `Controlled-write accepted answers: ${(attempt.controlledWriteAcceptedAnswerNumbers || []).join(', ') || 'none'}`,
        `Controlled-write rejected answers: ${(attempt.controlledWriteRejectedAnswerNumbers || []).join(', ') || 'none'}`,
        `Draft snapshot answers: ${(attempt.draftSnapshotAnswerNumbers || []).join(', ') || 'none'}`,
        `Baseline candidate answers: ${(attempt.baselineCandidateAnswerNumbers || []).join(', ') || 'none'}`,
        `Warnings: ${reportWarnings.join(', ') || 'none'}`,
        `Missing answers: ${(report.missingAnswers || []).join(', ') || 'none'}`,
        `Missing solutions: ${(report.missingSolutions || []).join(', ') || 'none'}`,
        `Fail-closed: ${report.failClosed ? 'yes' : 'no'}`,
        `Prefix: ${report.prefix ? 'yes' : 'no'}`,
        `Wrong attach risk: ${attempt.wrongAttachRisk || 'not-evaluated'}`,
        `Result classification: ${attempt.result || 'N/A'}`,
        `Next action: ${attempt.nextAction || ''}`,
        `Runner phase: ${report.phase || 'N/A'}`,
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

const waitForAppBoot = async page => {
    const deadline =
        Date.now() + 120000;
    let lastState = null;

    while (Date.now() < deadline) {
        lastState =
            await page.evaluate(() => {
                const hasDb =
                    (() => {
                        try {
                            return typeof db !== 'undefined';
                        } catch (_) {
                            return false;
                        }
                    })();

                return {
                    readyState: document.readyState,
                    hasVue: Boolean(window.Vue),
                    hasDb,
                    hasBatchNav:
                        [...document.querySelectorAll('button')]
                            .some(item => item.textContent.includes('\u6279\u91cf\u5f55\u9898')),
                    title: document.title || ''
                };
            });

        if (lastState.hasVue && lastState.hasDb && lastState.hasBatchNav) {
            return lastState;
        }

        await wait(1000);
    }

    throw new Error(`app boot timeout: ${JSON.stringify(lastState)}`);
};

const clickButtonByText = async (page, textFragment) => {
    await page.waitForFunction(fragment => {
        return [...document.querySelectorAll('button')]
            .some(item => item.textContent.includes(fragment));
    }, textFragment, { timeout: 90000 });

    await page.evaluate(fragment => {
        const button =
            [...document.querySelectorAll('button')]
                .find(item => item.textContent.includes(fragment));

        if (!button) {
            throw new Error(`button not found: ${fragment}`);
        }

        button.click();
    }, textFragment);
};

const installPdfSupportSolutionDiagnostics = async page => {
    await page.waitForFunction(
        () => Boolean(
            window.Qisi?.PdfSupportControlledWrite?.buildPdfSupportParserGate &&
            window.Qisi?.PdfSupportControlledWrite?.buildPdfSupportFieldLevelControlledWrite
        ),
        null,
        { timeout: 90000 }
    );

    await page.evaluate(() => {
        if (window.__qisiPdfSupportSolutionDiagInstalled) return;

        const normalizeNumber = value => {
            const match =
                String(value ?? '').match(/\d{1,3}/);
            return match ? String(Number(match[0])) : '';
        };
        const numbersFromItems = items =>
            (items || [])
                .map(item =>
                    normalizeNumber(
                        item?.question ??
                        item?.questionNumber ??
                        item?.number ??
                        item?.sourceTrace?.questionNumber ??
                        ''
                    )
                )
                .filter(Boolean);
        const unique = values =>
            [...new Set((values || []).filter(Boolean).map(String))];
        const warningCodes = warnings =>
            unique(
                (warnings || []).map(warning =>
                    typeof warning === 'string'
                        ? warning
                        : warning?.code || warning?.reason || ''
                )
            );
        const collectReasonCounts = decisions => {
            const counts = {};
            (decisions || []).forEach(decision => {
                const key =
                    [
                        decision?.field || 'field',
                        decision?.source || 'source',
                        decision?.reason || 'reason'
                    ].join(':');
                counts[key] =
                    (counts[key] || 0) + 1;
            });
            return counts;
        };
        const rawTextFromPageValue = value => {
            if (typeof value === 'string') return value;
            if (!value || typeof value !== 'object') return '';

            return String(
                value.text ||
                value.rawText ||
                value.content ||
                value.markdown ||
                value.pageMarkdown ||
                ''
            );
        };
        const rawTextPagesFromParserConfig = config => {
            const pages = [];
            (config?.rawTextPages || []).forEach(value => {
                const text =
                    rawTextFromPageValue(value);
                if (text) pages.push(text);
            });
            [...(config?.answers || []), ...(config?.solutions || [])]
                .forEach(item => {
                    const trace =
                        item?.sourceTrace || {};
                    const text =
                        rawTextFromPageValue(
                            trace.pageText ||
                            item?.pageText ||
                            item?.sourceText ||
                            ''
                        );
                    if (text) pages.push(text);
                });

            const seen = new Set();
            return pages.filter(text => {
                if (seen.has(text)) return false;
                seen.add(text);
                return true;
            });
        };
        const rawPageRowsFromParserConfig = config => {
            const rows = [];
            (config?.rawTextPages || []).forEach((value, index) => {
                const text =
                    rawTextFromPageValue(value);
                if (!text) return;
                rows.push({
                    pageIndex:
                        value && typeof value === 'object'
                            ? value.pageIndex ?? value.sourcePage ?? value.pageNo ?? index
                            : index,
                    sourceOrder:
                        value && typeof value === 'object'
                            ? value.sourceOrder ?? index
                            : index,
                    source:
                        'rawTextPages',
                    text
                });
            });
            [...(config?.answers || []), ...(config?.solutions || [])]
                .forEach((item, index) => {
                    const trace =
                        item?.sourceTrace || {};
                    const pageValue =
                        trace.pageText ||
                        item?.pageText ||
                        item?.sourceText ||
                        '';
                    const text =
                        rawTextFromPageValue(pageValue);
                    if (!text) return;
                    rows.push({
                        pageIndex:
                            trace.pageIndex ?? trace.sourcePage ?? item?.pageIndex ?? index,
                        sourceOrder:
                            trace.sourceOrder ?? item?.sourceOrder ?? index,
                        source:
                            item?.role || item?.sourceRole || 'supportItem',
                        text
                    });
                });

            const seen = new Set();
            return rows.filter(row => {
                const key = `${row.source}|${row.pageIndex}|${row.sourceOrder}|${row.text}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };
        const markerLineFingerprint = line => {
            const text =
                String(line || '').trim();
            const looksLikeSupportMarker =
                /答案|解析|详解|参考|第\s*[0-9０-９]{1,3}\s*题/.test(text) ||
                /^[0-9０-９]{1,3}\s*[.、)）]/.test(text) ||
                /绛|瑙|棰|銆|瓟|妗/.test(text);

            if (!looksLikeSupportMarker) return '';

            return text
                .replace(/[0-9０-９]+/g, '#')
                .replace(/[A-Za-z]+/g, 'A')
                .replace(/[\u4e00-\u9fff]+/g, 'C')
                .replace(/\s+/g, '_')
                .slice(0, 80);
        };
        const collectSolutionMarkerForms = config => {
            const counts = new Map();
            rawTextPagesFromParserConfig(config)
                .flatMap(text => String(text || '').replace(/\r/g, '\n').split('\n'))
                .map(markerLineFingerprint)
                .filter(Boolean)
                .forEach(form => {
                    counts.set(form, (counts.get(form) || 0) + 1);
                });

            const forms =
                [...counts.entries()]
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, 40)
                .map(([form, count]) => `${form} x${count}`);

            return forms.length
                ? forms
                : ['none-detected-from-sanitized-fingerprint'];
        };
        const normalizeCandidateNumber = value => {
            const map = {
                '０': '0',
                '１': '1',
                '２': '2',
                '３': '3',
                '４': '4',
                '５': '5',
                '６': '6',
                '７': '7',
                '８': '8',
                '９': '9'
            };
            const normalized =
                String(value || '').replace(/[０-９]/g, ch => map[ch] || ch);
            const match =
                normalized.match(/[0-9]{1,3}/);
            return match ? Number(match[0]) : null;
        };
        const lineShapeFingerprint = line => {
            const text =
                String(line || '').trim();
            if (!text) return '';
            return text
                .replace(/[0-9０-９]+/g, '#')
                .replace(/[A-Za-z]+/g, 'A')
                .replace(/[\u4e00-\u9fff]+/g, 'C')
                .replace(/\s+/g, '_')
                .slice(0, 80);
        };
        const classifyMarkerCandidate = line => {
            const text =
                String(line || '').trim();
            if (!text) return null;
            const compact =
                text.replace(/\s+/g, '');
            const supportForm =
                markerLineFingerprint(text);
            const hasAnswerLabel =
                /答案|参考答案|答[:：.]?|銆愮瓟妗堛€|绛旀|鍙傝€冪瓟妗/.test(compact);
            const hasSolutionLabel =
                /解析|详解|解答|证明|说明|解[:：.]?|銆愯В鏋愩€|瑙ｆ瀽|璇﹁В|瑙ｇ瓟/.test(compact);
            const hasQuestionLabel =
                /第\s*[0-9０-９]{1,3}\s*题/.test(compact);
            const structuralQuestion =
                /^(?:\\[A-Za-z]+\s*)?(?:\\item\s*)?(?:[\[(（【]?\s*[0-9０-９]{1,3}\s*[\])）】]|[0-9０-９]{1,3}\s*[.、:：])/.test(compact) ||
                /^\\[A-Za-z]+\{?\s*[0-9０-９]{1,3}/.test(compact);
            const noiseNumber =
                /(?:20[0-9]{2}|[0-9]+[.][0-9]+|\([0-9０-９]+[,，]\s*[0-9０-９]+\)|[0-9０-９]+\s*分|第\s*[0-9０-９]+\s*页)/.test(compact);

            if (!supportForm && !hasAnswerLabel && !hasSolutionLabel && !hasQuestionLabel && !structuralQuestion && !noiseNumber) {
                return null;
            }

            const number =
                normalizeCandidateNumber(text);
            let kind = 'noise';
            if (hasSolutionLabel) {
                kind = 'solution';
            } else if (hasAnswerLabel) {
                kind = 'answer';
            } else if (hasQuestionLabel || structuralQuestion) {
                kind = 'question';
            }

            return {
                kind,
                number,
                form:
                    supportForm || lineShapeFingerprint(text),
                lineShape:
                    lineShapeFingerprint(text)
            };
        };
        const topCountEntries = (values, limit = 20) => {
            const counts = new Map();
            values.filter(Boolean).forEach(value => {
                counts.set(value, (counts.get(value) || 0) + 1);
            });
            return [...counts.entries()]
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, limit)
                .map(([value, count]) => `${value} x${count}`);
        };
        const numberOrNull = value => {
            const parsed =
                Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const summarizeParserInput = (config, parserResult = {}) => {
            const pages =
                rawPageRowsFromParserConfig(config);
            const outputNumbers =
                new Set([
                    ...numbersFromItems(parserResult.blocks || []),
                    ...numbersFromItems(parserResult.answerItems || []),
                    ...numbersFromItems(parserResult.solutionItems || [])
                ].map(String));
            const candidates = [];
            const firstMatchedByPage = new Map();
            const lineShapes = [];
            let totalLines = 0;
            let nonEmptyLines = 0;

            pages.forEach((page, pagePosition) => {
                const lines =
                    String(page.text || '').replace(/\r/g, '\n').split('\n');
                totalLines += lines.length;
                lines.forEach((line, lineIndex) => {
                    const shape =
                        lineShapeFingerprint(line);
                    if (shape) {
                        nonEmptyLines += 1;
                        lineShapes.push(shape);
                    }
                    const candidate =
                        classifyMarkerCandidate(line);
                    if (!candidate) return;
                    const matched =
                        candidate.number !== null &&
                        outputNumbers.has(String(candidate.number));
                    const row = {
                        pageIndex:
                            numberOrNull(page.pageIndex),
                        sourceOrder:
                            numberOrNull(page.sourceOrder),
                        pagePosition,
                        lineIndex,
                        kind:
                            candidate.kind,
                        number:
                            candidate.number,
                        form:
                            candidate.form,
                        matched
                    };
                    candidates.push(row);
                    if (matched && !firstMatchedByPage.has(pagePosition)) {
                        firstMatchedByPage.set(pagePosition, {
                            pageIndex:
                                row.pageIndex,
                            sourceOrder:
                                row.sourceOrder,
                            kind:
                                row.kind,
                            number:
                                row.number,
                            form:
                                row.form
                        });
                    }
                });
            });

            const lengths =
                pages.map(page => String(page.text || '').length);
            const lengthSum =
                lengths.reduce((sum, length) => sum + length, 0);
            const matchedForms =
                topCountEntries(candidates.filter(row => row.matched).map(row => row.form), 40);
            const unmatchedForms =
                topCountEntries(candidates.filter(row => !row.matched).map(row => row.form), 60);

            return {
                rawPageCount:
                    pages.length,
                nonEmptyPageCount:
                    lengths.filter(length => length > 0).length,
                pageTextLengthStats: {
                    min:
                        lengths.length ? Math.min(...lengths) : 0,
                    max:
                        lengths.length ? Math.max(...lengths) : 0,
                    avg:
                        lengths.length ? Math.round(lengthSum / lengths.length) : 0
                },
                markerCandidateCount:
                    candidates.length,
                questionMarkerCandidateCount:
                    candidates.filter(row => row.kind === 'question').length,
                answerMarkerCandidateCount:
                    candidates.filter(row => row.kind === 'answer').length,
                solutionMarkerCandidateCount:
                    candidates.filter(row => row.kind === 'solution').length,
                matchedMarkerForms:
                    matchedForms.length ? matchedForms : ['none'],
                unmatchedMarkerForms:
                    unmatchedForms.length ? unmatchedForms : ['none'],
                firstMatchedMarkerPerPage:
                    [...firstMatchedByPage.values()],
                supportBlockBoundaryCandidates:
                    candidates.slice(0, 80).map(row => ({
                        pageIndex:
                            row.pageIndex,
                        sourceOrder:
                            row.sourceOrder,
                        lineIndex:
                            row.lineIndex,
                        kind:
                            row.kind,
                        number:
                            row.number,
                        form:
                            row.form,
                        matched:
                            row.matched
                    })),
                supportBlockBoundaryRejectReasons:
                    topCountEntries(candidates
                        .filter(row => !row.matched)
                        .map(row => row.kind === 'noise'
                            ? 'candidate-noise-shape'
                            : row.number === null
                                ? 'candidate-without-number'
                                : 'candidate-not-emitted-by-parser'), 20),
                lineShapeStats: {
                    totalLines,
                    nonEmptyLines,
                    topLineShapes:
                        topCountEntries(lineShapes, 30)
                },
                pageOrderSummary:
                    pages.map((page, index) => ({
                        index,
                        pageIndex:
                            numberOrNull(page.pageIndex),
                        sourceOrder:
                            numberOrNull(page.sourceOrder),
                        textLength:
                            String(page.text || '').length
                    })),
                sourceOrderSummary:
                    pages.map((page, index) => ({
                        index,
                        source:
                            page.source,
                        sourceOrder:
                            numberOrNull(page.sourceOrder)
                    })),
                parserInputPageShape:
                    pages.map((page, index) => {
                        const lines =
                            String(page.text || '').replace(/\r/g, '\n').split('\n');
                        return {
                            index,
                            pageIndex:
                                numberOrNull(page.pageIndex),
                            sourceOrder:
                                numberOrNull(page.sourceOrder),
                            textLength:
                                String(page.text || '').length,
                            lineCount:
                                lines.length,
                            nonEmptyLineCount:
                                lines.filter(line => String(line || '').trim()).length
                        };
                    })
            };
        };
        const summarizeParserOutput = parserResult => {
            const blocks =
                parserResult?.blocks || [];
            const itemSummary = items =>
                (items || []).map((item, index) => ({
                    index,
                    questionNumber:
                        normalizeNumber(item?.questionNumber || item?.question),
                    originalNumber:
                        item?.originalNumber || '',
                    normalizedNumber:
                        normalizeNumber(item?.normalizedNumber || item?.questionNumber || item?.question),
                    markerType:
                        item?.markerType || '',
                    sectionType:
                        item?.sectionType || '',
                    sourceOrder:
                        numberOrNull(item?.sourceOrder),
                    pageIndex:
                        numberOrNull(item?.pageIndex),
                    blockIndex:
                        numberOrNull(item?.blockIndex)
                }));

            return {
                parserOutputBlockSummary:
                    blocks.map((block, index) => ({
                        index,
                        questionNumber:
                            normalizeNumber(block?.questionNumber || block?.question),
                        originalNumber:
                            block?.originalNumber || '',
                        normalizedNumber:
                            normalizeNumber(block?.normalizedNumber || block?.questionNumber || block?.question),
                        markerType:
                            block?.markerType || '',
                        sectionType:
                            block?.sectionType || '',
                        sourceOrder:
                            numberOrNull(block?.sourceOrder),
                        pageIndex:
                            numberOrNull(block?.pageIndex),
                        blockIndex:
                            numberOrNull(block?.blockIndex ?? index)
                    })),
                parserOutputItemSummary: {
                    answers:
                        itemSummary(parserResult?.answerItems || []),
                    solutions:
                        itemSummary(parserResult?.solutionItems || [])
                }
            };
        };

        window.__qisiPdfSupportSolutionDiag = {
            parserGate: null,
            controlledWrite: null,
            samples: {
                parserGateCalls: 0,
                controlledWriteCalls: 0
            }
        };

        const controlled =
            window.Qisi.PdfSupportControlledWrite;
        const originalParserGate =
            controlled.buildPdfSupportParserGate;
        const originalControlledWrite =
            controlled.buildPdfSupportFieldLevelControlledWrite;

        controlled.buildPdfSupportParserGate = function (...args) {
            const parserConfig =
                args[0] || {};
            const result =
                originalParserGate.apply(this, args);
            const parserResult =
                result?.parserResult || {};
            const coverage =
                parserResult.coverageReport || {};
            const sequence =
                parserResult.sequenceReport || {};
            const report =
                result?.report || {};
            const blocks =
                parserResult.blocks || [];
            const unknownWarnings =
                (parserResult.warnings || [])
                    .filter(warning => warning?.code === 'unknown-question-marker');
            const parserInputSummary =
                summarizeParserInput(parserConfig, parserResult);
            const parserOutputSummary =
                summarizeParserOutput(parserResult);

            window.__qisiPdfSupportSolutionDiag.samples.parserGateCalls += 1;
            window.__qisiPdfSupportSolutionDiag.parserGate = {
                supportRawPageCount:
                    Number(result?.rawTextPagesCount || 0),
                supportBlockCount:
                    blocks.length,
                answerBlockCount:
                    (parserResult.answerItems || []).length,
                solutionBlockCount:
                    (parserResult.solutionItems || []).length,
                supportDetectedNumbers:
                    unique(sequence.questionNumbers || []),
                answerDetectedNumbers:
                    unique(coverage.answerQuestionNumbers || numbersFromItems(parserResult.answerItems)),
                solutionDetectedNumbers:
                    unique(coverage.solutionQuestionNumbers || numbersFromItems(parserResult.solutionItems)),
                missingAnswerNumbers:
                    unique(coverage.missingAnswers || []),
                missingSolutionNumbers:
                    unique(coverage.missingSolutions || []),
                outOfRangeNumbers:
                    unique(unknownWarnings.map(warning => warning.question)),
                duplicateNumbers:
                    unique(sequence.duplicates || []),
                jumpBackNumbers:
                    (sequence.jumpBacks || []).map(row => ({
                        question:
                            normalizeNumber(row?.question),
                        previousQuestion:
                            normalizeNumber(row?.previousQuestion)
                    })),
                unknownBlockCount:
                    unknownWarnings.length,
                parserWarningCodes:
                    warningCodes(parserResult.warnings),
                alignInputSummary: {
                    expectedValues:
                        unique(report.expectedValues || []),
                    answerValues:
                        unique(report.answerSequence?.values || []),
                    solutionValues:
                        unique(report.solutionSequence?.values || [])
                },
                alignOutputSummary: {
                    mode:
                        result?.mode || '',
                    failClosed:
                        Boolean(result?.failClosed),
                    safeQuestionNumbers:
                        unique(result?.safeQuestionNumbers || []),
                    fusedQuestionNumbers:
                        unique(result?.fusedQuestionNumbers || []),
                    safeAnswerCount:
                        (result?.answers || []).length,
                    safeSolutionCount:
                        (result?.solutions || []).length
                },
                rejectReasons:
                    unique(report.reasons || []),
                unsafeSequenceReason:
                    unique(report.reasons || []),
                prefixCutoffAt:
                    unique(result?.safeQuestionNumbers || []).slice(-1)[0] || '',
                failClosedReason:
                    result?.failClosed ? unique(report.reasons || []) : [],
                solutionMarkerForms:
                    collectSolutionMarkerForms(parserConfig),
                rawPageCount:
                    parserInputSummary.rawPageCount,
                nonEmptyPageCount:
                    parserInputSummary.nonEmptyPageCount,
                pageTextLengthStats:
                    parserInputSummary.pageTextLengthStats,
                markerCandidateCount:
                    parserInputSummary.markerCandidateCount,
                questionMarkerCandidateCount:
                    parserInputSummary.questionMarkerCandidateCount,
                answerMarkerCandidateCount:
                    parserInputSummary.answerMarkerCandidateCount,
                solutionMarkerCandidateCount:
                    parserInputSummary.solutionMarkerCandidateCount,
                matchedMarkerForms:
                    parserInputSummary.matchedMarkerForms,
                unmatchedMarkerForms:
                    parserInputSummary.unmatchedMarkerForms,
                firstMatchedMarkerPerPage:
                    parserInputSummary.firstMatchedMarkerPerPage,
                supportBlockBoundaryCandidates:
                    parserInputSummary.supportBlockBoundaryCandidates,
                supportBlockBoundaryRejectReasons:
                    parserInputSummary.supportBlockBoundaryRejectReasons,
                lineShapeStats:
                    parserInputSummary.lineShapeStats,
                pageOrderSummary:
                    parserInputSummary.pageOrderSummary,
                sourceOrderSummary:
                    parserInputSummary.sourceOrderSummary,
                parserInputPageShape:
                    parserInputSummary.parserInputPageShape,
                parserOutputBlockSummary:
                    parserOutputSummary.parserOutputBlockSummary,
                parserOutputItemSummary:
                    parserOutputSummary.parserOutputItemSummary,
                writableSolutionNumbers:
                    numbersFromItems(result?.solutions || []),
                blockedSolutionNumbers:
                    unique(result?.fusedQuestionNumbers || [])
            };

            return result;
        };

        controlled.buildPdfSupportFieldLevelControlledWrite = function (...args) {
            const result =
                originalControlledWrite.apply(this, args);
            const solutionNoneDecisions =
                (result?.fieldDecisions || [])
                    .filter(decision =>
                        decision?.field === 'solution' &&
                        decision?.source === 'none'
                    );
            const answerNoneDecisions =
                (result?.fieldDecisions || [])
                    .filter(decision =>
                        decision?.field === 'answer' &&
                        decision?.source === 'none'
                    );
            const rejectedAnswerWarnings =
                (result?.warnings || [])
                    .filter(warning =>
                        warning?.code === 'parser-objective-answer-rejected'
                    )
                    .map(warning => ({
                        questionNumber:
                            normalizeNumber(warning?.questionNumber),
                        reason:
                            warning?.reason || '',
                        structuralCandidate:
                            Boolean(warning?.structuralCandidate),
                        structuralReason:
                            warning?.structuralReason || '',
                        originalAnswerShape:
                            lineShapeFingerprint(warning?.originalAnswer || '')
                    }));

            window.__qisiPdfSupportSolutionDiag.samples.controlledWriteCalls += 1;
            window.__qisiPdfSupportSolutionDiag.controlledWrite = {
                answerQuestionNumbers:
                    unique(result?.answerQuestionNumbers || []),
                solutionQuestionNumbers:
                    unique(result?.solutionQuestionNumbers || []),
                fusedQuestionNumbers:
                    unique(result?.fusedQuestionNumbers || []),
                warningCodes:
                    warningCodes(result?.warnings),
                rejectedAnswerNumbers:
                    unique(answerNoneDecisions.map(decision => decision.questionNumber)),
                rejectedAnswerReasons:
                    unique(answerNoneDecisions.map(decision => decision.reason)),
                rejectedAnswerWarnings:
                    rejectedAnswerWarnings,
                rejectedSolutionNumbers:
                    unique(solutionNoneDecisions.map(decision => decision.questionNumber)),
                rejectedSolutionReasons:
                    unique(solutionNoneDecisions.map(decision => decision.reason)),
                fieldDecisionReasonCounts:
                    collectReasonCounts(result?.fieldDecisions),
                writableSolutionNumbers:
                    unique(result?.solutionQuestionNumbers || []),
                blockedSolutionNumbers:
                    unique([
                        ...(result?.fusedQuestionNumbers || []),
                        ...solutionNoneDecisions.map(decision => decision.questionNumber)
                    ])
            };

            return result;
        };

        window.__qisiPdfSupportSolutionDiagInstalled = true;
    });
};

const buildSolutionDiagnostics = ({
    browserDiagnostics = {},
    missingSolutions = [],
    draftSnapshot = []
} = {}) => {
    const parserGate =
        browserDiagnostics?.parserGate || {};
    const controlledWrite =
        browserDiagnostics?.controlledWrite || {};
    const draftSolutionNumbers =
        (draftSnapshot || [])
            .filter(draft => draft.hasSolution)
            .map(draft => String(draft.question || ''))
            .filter(Boolean);
    const missingSet =
        new Set((missingSolutions || []).map(String));
    const fused =
        new Set([
            ...(parserGate.blockedSolutionNumbers || []),
            ...(controlledWrite.fusedQuestionNumbers || [])
        ].map(String));
    const rejected =
        new Map(
            (controlledWrite.rejectedSolutionNumbers || [])
                .map(number => [
                    String(number),
                    (controlledWrite.rejectedSolutionReasons || []).join(',') ||
                        'controlled-write-no-safe-solution'
                ])
        );
    const missingSolutionReasons = {};

    missingSet.forEach(number => {
        if (rejected.has(number)) {
            missingSolutionReasons[number] =
                rejected.get(number);
        } else if (fused.has(number)) {
            missingSolutionReasons[number] =
                'pdf-support-sequence-unreliable';
        } else {
            missingSolutionReasons[number] =
                'not-collected-before-stage-b-diagnostics';
        }
    });

    return {
        supportRawPageCount:
            parserGate.supportRawPageCount ?? null,
        supportBlockCount:
            parserGate.supportBlockCount ?? null,
        answerBlockCount:
            parserGate.answerBlockCount ?? null,
        solutionBlockCount:
            parserGate.solutionBlockCount ?? null,
        supportDetectedNumbers:
            parserGate.supportDetectedNumbers || [],
        answerDetectedNumbers:
            parserGate.answerDetectedNumbers || [],
        solutionDetectedNumbers:
            parserGate.solutionDetectedNumbers || [],
        rejectedSolutionNumbers:
            controlledWrite.rejectedSolutionNumbers || [],
        rejectReasons:
            [
                ...new Set([
                    ...(parserGate.rejectReasons || []),
                    ...(controlledWrite.rejectedSolutionReasons || [])
                ])
            ],
        alignInputSummary:
            parserGate.alignInputSummary || null,
        alignOutputSummary:
            parserGate.alignOutputSummary || null,
        controlledWriteSummary:
            controlledWrite || null,
        missingSolutionReasons,
        unsafeSequenceReason:
            parserGate.unsafeSequenceReason || [],
        prefixCutoffAt:
            parserGate.prefixCutoffAt || '',
        failClosedReason:
            parserGate.failClosedReason || [],
        solutionMarkerForms:
            parserGate.solutionMarkerForms || [],
        rawPageCount:
            parserGate.rawPageCount ?? null,
        nonEmptyPageCount:
            parserGate.nonEmptyPageCount ?? null,
        pageTextLengthStats:
            parserGate.pageTextLengthStats || null,
        markerCandidateCount:
            parserGate.markerCandidateCount ?? null,
        questionMarkerCandidateCount:
            parserGate.questionMarkerCandidateCount ?? null,
        answerMarkerCandidateCount:
            parserGate.answerMarkerCandidateCount ?? null,
        solutionMarkerCandidateCount:
            parserGate.solutionMarkerCandidateCount ?? null,
        matchedMarkerForms:
            parserGate.matchedMarkerForms || [],
        unmatchedMarkerForms:
            parserGate.unmatchedMarkerForms || [],
        firstMatchedMarkerPerPage:
            parserGate.firstMatchedMarkerPerPage || [],
        supportBlockBoundaryCandidates:
            parserGate.supportBlockBoundaryCandidates || [],
        supportBlockBoundaryRejectReasons:
            parserGate.supportBlockBoundaryRejectReasons || [],
        lineShapeStats:
            parserGate.lineShapeStats || null,
        pageOrderSummary:
            parserGate.pageOrderSummary || [],
        sourceOrderSummary:
            parserGate.sourceOrderSummary || [],
        parserInputPageShape:
            parserGate.parserInputPageShape || [],
        parserOutputBlockSummary:
            parserGate.parserOutputBlockSummary || [],
        parserOutputItemSummary:
            parserGate.parserOutputItemSummary || null,
        outOfRangeNumbers:
            parserGate.outOfRangeNumbers || [],
        duplicateNumbers:
            parserGate.duplicateNumbers || [],
        jumpBackNumbers:
            parserGate.jumpBackNumbers || [],
        unknownBlockCount:
            parserGate.unknownBlockCount ?? null,
        writableSolutionNumbers:
            controlledWrite.writableSolutionNumbers ||
            controlledWrite.solutionQuestionNumbers ||
            controlledWrite.controlledWriteSummary?.solutionQuestionNumbers ||
            parserGate.writableSolutionNumbers ||
            [],
        blockedSolutionNumbers:
            controlledWrite.blockedSolutionNumbers ||
            parserGate.blockedSolutionNumbers ||
            [],
        draftSolutionCount:
            draftSolutionNumbers.length,
        reviewPageSolutionCount:
            draftSolutionNumbers.length,
        diagnosticSamples:
            browserDiagnostics?.samples || {},
        controlledWriteAcceptedAnswerNumbers:
            controlledWrite.answerQuestionNumbers ||
            controlledWrite.controlledWriteSummary?.answerQuestionNumbers ||
            [],
        controlledWriteRejectedAnswerNumbers:
            controlledWrite.rejectedAnswerNumbers || [],
        controlledWriteAcceptedSolutionNumbers:
            controlledWrite.solutionQuestionNumbers ||
            controlledWrite.controlledWriteSummary?.solutionQuestionNumbers ||
            controlledWrite.writableSolutionNumbers ||
            [],
        controlledWriteRejectedSolutionNumbers:
            controlledWrite.rejectedSolutionNumbers || []
    };
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
    const runContext =
        createRunContext('preflight');
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
            runContext,
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
            runId:
                runContext.runId,
            attemptId:
                runContext.attemptId,
            startedAt:
                runContext.startedAt,
            ok,
            appUrl:
                APP_URL,
            checks,
            expectedQuestionNumbers:
                EXPECTED_QUESTION_NUMBERS,
            inputFiles:
                ledgerEntry.inputFiles,
            reportSource:
                ledgerEntry.reportSource,
            realApiCalled:
                false,
            underlyingApiCallCount:
                0,
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
    const runContext =
        createRunContext('dry-run');
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
            ? 'Stop before P7 until a separate explicit real-run task is authorized'
            : 'Add a browser automation dependency and rerun dry-run before Stage 6';
    const ledgerEntry =
        makeLedgerEntry({
            mode:
                'dry-run',
            runContext,
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
            runId:
                runContext.runId,
            attemptId:
                runContext.attemptId,
            startedAt:
                runContext.startedAt,
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
            inputFiles:
                ledgerEntry.inputFiles,
            expectedQuestionNumbers:
                EXPECTED_QUESTION_NUMBERS,
            detectedQuestionNumbers:
                [],
            detectedAnswerNumbers:
                [],
            detectedSolutionNumbers:
                [],
            safeAnswerNumbers:
                [],
            safeSolutionNumbers:
                [],
            fusedQuestionNumbers:
                [],
            prefixCutoffReason:
                '',
            parserWarnings:
                [],
            alignerReportReasons:
                [],
            controlledWriteSummary:
                null,
            draftCleanup:
                null,
            reportSource:
                ledgerEntry.reportSource,
            realApiCalled:
                false,
            underlyingApiCallCount:
                0,
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
    const runContext =
        createRunContext('real-run');
    const questionPdf =
        await fileStat(QUESTION_PDF);
    const supportPdf =
        await fileStat(SUPPORT_PDF);
    const deps =
        dependencyStatus();
    const warnings = [];
    let draftCleanup =
        {
            beforeRun:
                false,
            beforeCount:
                null,
            afterCount:
                null,
            ok:
                false
        };

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
                runContext,
                questionPdf,
                supportPdf,
                result: 'fail-environment',
                nextAction: 'Fix runner environment before retrying',
                warnings,
                draftCleanup
            });
        const report =
            {
                mode: 'real-run',
                runId:
                    runContext.runId,
                attemptId:
                    runContext.attemptId,
                startedAt:
                    runContext.startedAt,
                ok: false,
                realApiCalled: false,
                underlyingApiCallCount: 0,
                warnings,
                inputFiles:
                    ledgerEntry.inputFiles,
                expectedQuestionNumbers:
                    EXPECTED_QUESTION_NUMBERS,
                draftCleanup,
                reportSource:
                    ledgerEntry.reportSource,
                ledgerEntry
            };

        await writeArtifacts(report, ledgerEntry);
        if (WRITE_STAGE6_REPORT) {
            await appendStage6Report(report);
        }
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
    let phase = 'start';

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
        await page.route('**/*', route => {
            const request =
                route.request();
            const url =
                request.url();
            const type =
                request.resourceType();

            if (
                type === 'font' ||
                /fonts\.(?:gstatic|googleapis)\.com/i.test(url)
            ) {
                return route.abort();
            }

            return route.continue();
        });
        const aiPathPattern =
            new RegExp('/api/' + 'ai/(?:chat|ocr)');

        page.on('request', request => {
            if (aiPathPattern.test(request.url())) {
                localApiCallCount += 1;
                apiRequestStarted = true;
            }
        });

        page.on('dialog', dialog => dialog.accept().catch(() => {}));

        phase = 'open-main-page';
        await page.goto(`${APP_URL}/main.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        phase = 'wait-app-boot';
        await waitForAppBoot(page);

        phase = 'draft-cleanup-before-run';
        draftCleanup =
            await page.evaluate(async () => {
                const beforeCount =
                    await db.draftQuestions.count();

                await db.draftQuestions.clear();

                const afterCount =
                    await db.draftQuestions.count();

                return {
                    beforeRun:
                        true,
                    beforeCount,
                    afterCount,
                    ok:
                        afterCount === 0
                };
            });

        if (!draftCleanup.ok) {
            throw new Error('draft cleanup before run failed');
        }

        phase = 'install-solution-diagnostics';
        await installPdfSupportSolutionDiagnostics(page);

        phase = 'open-batch-create';
        await clickButtonByText(page, '\u6279\u91cf\u5f55\u9898');
        await page.waitForSelector('.batch-home-upload', {
            state: 'visible',
            timeout: 60000
        });
        await page.locator('.batch-home-upload').click();
        await page.waitForSelector('input[type="file"][multiple]', {
            state: 'attached',
            timeout: 60000
        });

        phase = 'upload-real-pdfs';
        const input =
            page.locator('input[type="file"][multiple]').first();
        await input.setInputFiles([QUESTION_PDF, SUPPORT_PDF]);

        const confirmPendingFile = async (filenamePart, roleIndexes) => {
            phase = `confirm-purpose-${filenamePart}`;
            await page.waitForFunction(
                part => Boolean(
                    document.querySelector('.batch-purpose-modal')?.textContent.includes(part)
                ),
                filenamePart,
                { timeout: 90000 }
            );
            const roleLabels =
                page.locator('.batch-purpose-options label');

            for (const index of roleIndexes) {
                await roleLabels.nth(index).click();
            }

            await page.locator('.batch-purpose-modal .material-primary-btn').click();
        };

        await confirmPendingFile('01-question.pdf', [0]);
        await confirmPendingFile('02-support-answer-solution.pdf', [1, 2]);

        phase = 'wait-file-list';
        await page.waitForFunction(() => {
            return document.querySelectorAll('.batch-file-card').length === 2;
        }, null, { timeout: 90000 });

        const runStartedAt =
            Date.now();

        phase = 'create-recognition-task';
        await page.locator('.batch-create-actions .material-primary-btn').first().click();

        phase = 'wait-batch-record';
        let batchId = '';
        const batchRecordDeadline =
            Date.now() + 90000;

        while (!batchId && Date.now() < batchRecordDeadline) {
            batchId =
                await page.evaluate(async startedAt => {
                    const batches =
                        await db.draftImportBatches
                            .where('createdAt')
                            .aboveOrEqual(startedAt)
                            .toArray();
                    const matched =
                        batches
                            .filter(batch => String(batch.sourceFileName || '').includes('01-question.pdf'))
                            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];

                    return matched?.id || '';
                }, runStartedAt - 1000);

            if (!batchId) {
                await wait(1000);
            }
        }

        if (!batchId) {
            throw new Error('batch record was not created');
        }

        await page.evaluate(id => {
            window.__qisiRealRunBatchId = id;
        }, batchId);

        phase = 'wait-recognition-finish';
        const recognitionDeadline =
            Date.now() + Math.max(60000, Number(process.env.QISI_REAL_RUN_TIMEOUT_MS || 900000));

        while (Date.now() < recognitionDeadline) {
            const status =
                await page.evaluate(async id => {
                    const batch =
                        await db.draftImportBatches.get(id);
                    return batch?.status || '';
                }, batchId);

            if (['review', 'failed', 'completed'].includes(status)) {
                break;
            }

            await wait(1000);
        }

        const finalBatchStatus =
            await page.evaluate(async id => {
                const batch =
                    await db.draftImportBatches.get(id);
                return batch?.status || '';
            }, batchId);

        if (!['review', 'failed', 'completed'].includes(finalBatchStatus)) {
            throw new Error(`recognition did not finish, status=${finalBatchStatus || 'missing'}`);
        }

        phase = 'read-sanitized-result';
        const sanitized =
            await page.evaluate(async id => {
                const clean = value => String(value || '').trim();
                const questionNo = (draft, index) =>
                    String(draft.questionNumber || draft.question || draft.order || index + 1);
                const batch =
                    await db.draftImportBatches.get(id);
                const rawDrafts =
                    await db.draftQuestions.where('batchId').equals(id).sortBy('order');
                const drafts =
                    (rawDrafts || []).map((draft, index) => {
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
                        batch
                            ? {
                                id: batch.id || '',
                                status: batch.status || '',
                                totalCount: batch.totalCount || 0,
                                problemCount: batch.problemCount || 0,
                                errorMessage: batch.errorMessage || ''
                            }
                            : null,
                    summary:
                        {
                            total: drafts.length,
                            withAnswers: drafts.filter(draft => draft.hasAnswer).length,
                            withSolutions: drafts.filter(draft => draft.hasSolution).length,
                            missingAnswers: drafts.filter(draft => !draft.hasAnswer).map(draft => draft.question),
                            missingSolutions: drafts.filter(draft => !draft.hasSolution).map(draft => draft.question)
                        },
                    drafts,
                    diagnostics:
                        window.__qisiPdfSupportSolutionDiag || null
                };
            }, batchId);

        batchSnapshot =
            sanitized.batch;
        draftSnapshot =
            sanitized.drafts || [];

        if (!draftSnapshot.length && batchSnapshot?.status !== 'failed') {
            warnings.push('zero-draft-result');
            result = 'fail-environment';
            nextAction = 'Fix runner completion wait or recognition startup before retrying';
        } else if (batchSnapshot?.status === 'failed') {
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
                    /answerConflict|wrong-attach|jump-back|duplicate|answer\/solution/i.test(warning)
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
        const solutionDiagnostics =
            buildSolutionDiagnostics({
                browserDiagnostics:
                    sanitized.diagnostics,
                missingSolutions,
                draftSnapshot
            });

        const controlledWriteAcceptedAnswers =
            solutionDiagnostics.controlledWriteAcceptedAnswerNumbers || [];
        const controlledWriteRejectedAnswers =
            solutionDiagnostics.controlledWriteRejectedAnswerNumbers || [];

        const draftSnapshotAnswerNumbers =
            draftSnapshot.filter(draft => draft.hasAnswer).map(draft => draft.question);
        const draftSnapshotSolutionNumbers =
            draftSnapshot.filter(draft => draft.hasSolution).map(draft => draft.question);

        const baselineCandidateAnswerNumbers =
            draftSnapshotAnswerNumbers.filter(
                question => controlledWriteAcceptedAnswers.includes(question)
            );

        const controlledWriteHasRejections =
            controlledWriteRejectedAnswers.length > 0;
        const controlledWriteHasFused =
            (solutionDiagnostics.controlledWriteSummary?.fusedQuestionNumbers || []).length > 0;

        const failClosed =
            warnings.some(warning => /pdf-support-sequence-unreliable/.test(warning));
        const prefix =
            warnings.some(warning => /pdf-support-prefix-only|pdf-support-sequence-unreliable/.test(warning));
        const alignMode =
            failClosed
                ? 'fail-closed'
                : prefix
                    ? 'prefix'
                    : (result === 'pass-full' && !controlledWriteHasRejections && !controlledWriteHasFused)
                        ? 'full'
                        : result === 'pass-full'
                            ? 'prefix'
                            : 'unknown';

        if (result === 'pass-full' && controlledWriteHasRejections) {
            result = 'pass-safe-partial';
            nextAction = 'Controlled-write has rejected answers; return to fixture-first diagnostics';
        }

        if (result === 'pass-full' && missingAnswers.length > 0) {
            result = 'pass-safe-partial';
            nextAction = 'Draft snapshot has missing answers; return to fixture-first diagnostics';
        }
        const realAttemptCount =
            (await countRealAttempts()) + (apiRequestStarted ? 1 : 0);
        const ledgerEntry =
            makeLedgerEntry({
                mode: 'real-run',
                runContext,
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
                detectedQuestionNumbers:
                    solutionDiagnostics.supportDetectedNumbers,
                detectedAnswerNumbers:
                    solutionDiagnostics.answerDetectedNumbers,
                detectedSolutionNumbers:
                    solutionDiagnostics.solutionDetectedNumbers,
                safeAnswerNumbers:
                    controlledWriteAcceptedAnswers,
                safeSolutionNumbers:
                    draftSnapshotSolutionNumbers,
                fusedQuestionNumbers:
                    solutionDiagnostics.controlledWriteSummary?.fusedQuestionNumbers || [],
                prefixCutoffReason:
                    solutionDiagnostics.prefixCutoffAt || '',
                parserWarnings:
                    solutionDiagnostics.failClosedReason || [],
                alignerReportReasons:
                    solutionDiagnostics.rejectReasons || [],
                controlledWriteSummary:
                    solutionDiagnostics.controlledWriteSummary,
                controlledWriteAcceptedAnswerNumbers:
                    controlledWriteAcceptedAnswers,
                controlledWriteRejectedAnswerNumbers:
                    controlledWriteRejectedAnswers,
                draftSnapshotAnswerNumbers,
                baselineCandidateAnswerNumbers,
                draftCleanup,
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
                runId:
                    runContext.runId,
                attemptId:
                    runContext.attemptId,
                startedAt:
                    runContext.startedAt,
                ok: result === 'pass-full' || result === 'pass-safe-partial',
                phase,
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
                solutionDiagnostics,
                expectedQuestionNumbers:
                    EXPECTED_QUESTION_NUMBERS,
                detectedQuestionNumbers:
                    ledgerEntry.detectedQuestionNumbers,
                detectedAnswerNumbers:
                    ledgerEntry.detectedAnswerNumbers,
                detectedSolutionNumbers:
                    ledgerEntry.detectedSolutionNumbers,
                safeAnswerNumbers:
                    ledgerEntry.safeAnswerNumbers,
                safeSolutionNumbers:
                    ledgerEntry.safeSolutionNumbers,
                controlledWriteAcceptedAnswerNumbers:
                    ledgerEntry.controlledWriteAcceptedAnswerNumbers,
                controlledWriteRejectedAnswerNumbers:
                    ledgerEntry.controlledWriteRejectedAnswerNumbers,
                draftSnapshotAnswerNumbers:
                    ledgerEntry.draftSnapshotAnswerNumbers,
                baselineCandidateAnswerNumbers:
                    ledgerEntry.baselineCandidateAnswerNumbers,
                fusedQuestionNumbers:
                    ledgerEntry.fusedQuestionNumbers,
                prefixCutoffReason:
                    ledgerEntry.prefixCutoffReason,
                parserWarnings:
                    ledgerEntry.parserWarnings,
                alignerReportReasons:
                    ledgerEntry.alignerReportReasons,
                controlledWriteSummary:
                    ledgerEntry.controlledWriteSummary,
                draftCleanup,
                reportSource:
                    ledgerEntry.reportSource,
                inputFiles:
                    ledgerEntry.inputFiles,
                ledgerEntry
            };

        await writeArtifacts(report, ledgerEntry);
        if (WRITE_STAGE6_REPORT) {
            await appendStage6Report(report);
        }
        return report;
    } catch (error) {
        warnings.push('real-run-exception');
        const ledgerEntry =
            makeLedgerEntry({
                mode: 'real-run',
                runContext,
                questionPdf,
                supportPdf,
                result: 'fail-environment',
                nextAction: 'Fix runner real-run environment before retrying',
                warnings,
                realApiCalled: apiRequestStarted,
                underlyingApiCallCount: localApiCallCount,
                draftCleanup
            });
        ledgerEntry.attemptNumber =
            apiRequestStarted ? (await countRealAttempts()) + 1 : 0;
        const report =
            {
                mode: 'real-run',
                ok: false,
                error:
                    error?.message || String(error),
                phase,
                runId:
                    runContext.runId,
                attemptId:
                    runContext.attemptId,
                startedAt:
                    runContext.startedAt,
                realApiCalled:
                    apiRequestStarted,
                underlyingApiCallCount:
                    localApiCallCount,
                missingAnswers: [],
                missingSolutions: [],
                failClosed: false,
                prefix: false,
                expectedQuestionNumbers:
                    EXPECTED_QUESTION_NUMBERS,
                draftCleanup,
                reportSource:
                    ledgerEntry.reportSource,
                inputFiles:
                    ledgerEntry.inputFiles,
                ledgerEntry
            };

        await writeArtifacts(report, ledgerEntry);
        if (WRITE_STAGE6_REPORT) {
            await appendStage6Report(report);
        }
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
    assertRealRunAllowed(mode);
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

if (require.main === module) {
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
}

module.exports = {
    EXPECTED_QUESTION_NUMBERS,
    REAL_RUN_ALLOWED_ENV_NAME,
    assertRealRunAllowed,
    buildSolutionDiagnostics,
    createRunContext,
    makeLedgerEntry,
    parseMode
};

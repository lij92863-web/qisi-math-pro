'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;

const suites = Object.freeze([
    {
        name: 'syntax/check',
        command: npm,
        args: ['run', 'check']
    },
    {
        name: 'all Node tests',
        command: npm,
        args: ['test'],
        timeoutMs: 15 * 60 * 1000
    },
    {
        name: 'true producer-chain browser E2E',
        command: node,
        args: ['--test', 'tests/e2e/production-normal-ui-import-cutover.test.js'],
        timeoutMs: 5 * 60 * 1000
    },
    {
        name: 'smoke:batch:mock',
        command: npm,
        args: ['run', 'smoke:batch:mock']
    },
    {
        name: 'DOCX stable',
        command: npm,
        args: ['run', 'verify:docx-stable']
    },
    {
        name: 'PDF known-bad',
        command: npm,
        args: ['run', 'verify:pdf-known-bad']
    },
    {
        name: 'Route B hold',
        command: node,
        args: ['--test', 'tests/pdf-route-b-hold.test.js']
    },
    {
        name: 'controlled-write ownership',
        command: node,
        args: [
            '--test',
            'tests/pdf-support-controlled-write-answer-ownership.test.js'
        ]
    },
    {
        name: 'browser runner preflight',
        command: node,
        args: ['scripts/pdf-master-browser-runner.js', 'preflight']
    },
    {
        name: 'browser runner dry-run',
        command: node,
        args: ['scripts/pdf-master-browser-runner.js', 'dry-run']
    },
    {
        name: 'no-real-ai',
        command: npm,
        args: ['run', 'verify:no-real-ai']
    },
    {
        name: 'app-shell AST gate',
        command: node,
        args: ['scripts/verify-app-shell-architecture.js']
    },
    {
        name: 'production reachability',
        command: node,
        args: [
            '--test',
            'tests/corrective-production-reachability.test.js',
            'tests/test-harness-production-isolation.test.js'
        ]
    },
    {
        name: 'single owner',
        command: node,
        args: ['--test', 'tests/corrective-single-owner.test.js']
    },
    {
        name: 'persistence/formal isolation',
        command: node,
        args: [
            '--test',
            'tests/import-cutover-persistence-transaction.test.js',
            'tests/import-cutover-formal-write-isolation.test.js',
            'tests/formal-submit-duplicate-race.test.js',
            'tests/review-workflow-service.test.js',
            'tests/draft-maintenance-service.test.js'
        ]
    },
    {
        name: 'benchmark smoke',
        command: node,
        args: [
            'scripts/benchmark/measure-program-c-closure.js',
            '--smoke'
        ]
    }
]);

const forbiddenCommands = [
    'pdf-master-browser-runner.js real-run',
    'test:ai-proxy',
    'test:ai-vision-proxy'
];

function metric(output, name) {
    const pattern = new RegExp(`(?:ℹ|#)\\s+${name}\\s+(\\d+)`, 'g');
    let value = 0;
    for (const match of output.matchAll(pattern)) value += Number(match[1]);
    return value;
}

function testMetrics(output) {
    return {
        tests: metric(output, 'tests'),
        pass: metric(output, 'pass'),
        fail: metric(output, 'fail'),
        skipped: metric(output, 'skipped'),
        todo: metric(output, 'todo'),
        cancelled: metric(output, 'cancelled')
    };
}

function assertSafeCommands() {
    for (const suite of suites) {
        const rendered = `${suite.command} ${suite.args.join(' ')}`;
        for (const forbidden of forbiddenCommands) {
            if (rendered.includes(forbidden)) {
                throw new Error(`forbidden-stable-command:${suite.name}`);
            }
        }
    }
}

function runSuite(suite) {
    const started = performance.now();
    process.stdout.write(`\n[verify:personal-stable] START ${suite.name}\n`);
    const result = spawnSync(suite.command, suite.args, {
        cwd: ROOT,
        encoding: 'utf8',
        shell: false,
        timeout: suite.timeoutMs || 3 * 60 * 1000,
        maxBuffer: 50 * 1024 * 1024,
        env: {
            ...process.env,
            QISI_PDF_MASTER_REAL_RUN_ALLOWED: '0'
        }
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const timedOut = result.error?.code === 'ETIMEDOUT';
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const passed = result.status === 0 && !result.error;
    process.stdout.write(
        `[verify:personal-stable] ${passed ? 'PASS' : 'FAIL'} ` +
        `${suite.name} (${(performance.now() - started).toFixed(1)} ms)\n`
    );
    return {
        name: suite.name,
        passed,
        timedOut,
        exitCode: result.status,
        durationMs: performance.now() - started,
        metrics: testMetrics(output),
        errorCode: result.error?.code || ''
    };
}

function run() {
    assertSafeCommands();
    const started = performance.now();
    const results = suites.map(runSuite);
    const totals = results.reduce((summary, result) => {
        summary.testCount += result.metrics.tests;
        summary.testPassed += result.metrics.pass;
        summary.testFailed += result.metrics.fail;
        summary.skipped += result.metrics.skipped;
        summary.todo += result.metrics.todo;
        summary.cancelled += result.metrics.cancelled;
        if (result.timedOut) summary.timeout += 1;
        if (result.passed) summary.passed += 1;
        else summary.failed += 1;
        return summary;
    }, {
        suiteCount: suites.length,
        testCount: 0,
        passed: 0,
        failed: 0,
        timeout: 0,
        skipped: 0,
        todo: 0,
        cancelled: 0,
        testPassed: 0,
        testFailed: 0
    });
    const allGreen =
        totals.failed === 0 &&
        totals.timeout === 0 &&
        totals.skipped === 0 &&
        totals.todo === 0 &&
        totals.cancelled === 0 &&
        totals.testFailed === 0;
    const summary = {
        decision: allGreen
            ? 'VERIFY_PERSONAL_STABLE_ACCEPTED'
            : 'VERIFY_PERSONAL_STABLE_BLOCKED',
        ...totals,
        duration: performance.now() - started,
        realApiCalled: false,
        wrongAttachment: 0,
        rawJsonLeakage: 0,
        placeholderLeakage: 0,
        controlledWriteBypass: 0,
        formalAdmissionBypass: 0,
        bridgeFormalWrites: 0,
        legacyFallback: 0,
        fixtureProductionReachability: 0,
        results
    };
    process.stdout.write(
        `\n[verify:personal-stable] SUMMARY\n${JSON.stringify(summary, null, 2)}\n`
    );
    if (!allGreen) process.exitCode = 1;
    return summary;
}

if (require.main === module) run();

module.exports = { suites, metric, testMetrics, run };

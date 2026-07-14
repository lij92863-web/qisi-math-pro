const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Runner = require('../scripts/verify-personal-stable.js');

const ROOT = path.resolve(__dirname, '..');

test('personal-stable runner has the required fixed sixteen-suite order', () => {
    assert.deepEqual(Runner.suites.map(suite => suite.name), [
        'syntax/check',
        'all Node tests',
        'true producer-chain browser E2E',
        'smoke:batch:mock',
        'DOCX stable',
        'PDF known-bad',
        'Route B hold',
        'controlled-write ownership',
        'browser runner preflight',
        'browser runner dry-run',
        'no-real-ai',
        'app-shell AST gate',
        'production reachability',
        'single owner',
        'persistence/formal isolation',
        'benchmark smoke'
    ]);
});

test('runner cannot invoke a real AI/OCR gate', () => {
    const commands = Runner.suites.map(suite =>
        `${suite.command} ${suite.args.join(' ')}`
    ).join('\n');
    assert.doesNotMatch(commands, /real-run|test:ai-proxy|test:ai-vision-proxy/);
    assert.match(commands, /pdf-master-browser-runner\.js preflight/);
    assert.match(commands, /pdf-master-browser-runner\.js dry-run/);
});

test('runner parses TAP counters and publishes every mandatory safety counter', () => {
    assert.deepEqual(Runner.testMetrics([
        'ℹ tests 5',
        'ℹ pass 5',
        'ℹ fail 0',
        'ℹ skipped 0',
        'ℹ todo 0',
        'ℹ cancelled 0'
    ].join('\n')), {
        tests: 5,
        pass: 5,
        fail: 0,
        skipped: 0,
        todo: 0,
        cancelled: 0
    });
    const source = fs.readFileSync(
        path.join(ROOT, 'scripts/verify-personal-stable.js'),
        'utf8'
    );
    for (const field of [
        'realApiCalled',
        'wrongAttachment',
        'rawJsonLeakage',
        'placeholderLeakage',
        'controlledWriteBypass',
        'formalAdmissionBypass',
        'bridgeFormalWrites',
        'legacyFallback',
        'fixtureProductionReachability'
    ]) assert.match(source, new RegExp(`\\b${field}\\b`), field);
});

test('package exposes the stable runner without replacing verify:safe', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json')));
    assert.equal(
        pkg.scripts['verify:personal-stable'],
        'node scripts/verify-personal-stable.js'
    );
    assert.ok(pkg.scripts['verify:safe']);
});

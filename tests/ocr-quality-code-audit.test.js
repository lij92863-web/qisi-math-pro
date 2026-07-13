const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const Runner = require('../scripts/benchmark/run-ocr-benchmark.js');

const root = path.resolve(__dirname, '..');
const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-ocr-audit-'));

const config = directory => ({
    benchmarkId: 'audit-synthetic-r1',
    corpusVersion: 'audit-1',
    scorerVersion: 'ocr-scoring-r1',
    runPurpose: 'development',
    evaluationSplit: 'development',
    engine: { name: 'mock', version: '1.0.0' },
    hardwareProfile: {
        profileId: 'audit', os: 'test', cpu: 'test', gpu: null, memoryBytes: 1024
    },
    timeoutMs: 1000,
    randomSeed: 7,
    bootstrapIterations: 100,
    input: {
        kind: 'synthetic',
        truthPath: path.join(directory, 'truth.json'),
        resultPath: path.join(directory, 'result.json')
    },
    output: {
        jsonPath: path.join(directory, 'report.json'),
        markdownPath: path.join(directory, 'report.md')
    }
});

const question = () => ({
    page: 1, sourceOrder: 1, questionNumber: '1', stem: 'private', options: [],
    answer: null, solution: null, formulas: [], images: []
});

test('code audit report covers all ten required review areas and evidence status', () => {
    const report = fs.readFileSync(
        path.join(root, 'docs', 'audit', 'OCR_QUALITY_CODE_AUDIT_R1.md'),
        'utf8'
    );
    for (const topic of [
        'adapter domain logic', 'preprocessing duplication',
        'engine-specific branching in app.js', 'shadow log privacy',
        'config diagnostics', 'timeout/cancel consistency',
        'benchmark rerun', 'scorer data leakage', 'calibration/holdout leakage',
        'best-sample cherry-picking'
    ]) {
        assert.match(report, new RegExp(topic, 'i'), topic);
    }
    assert.match(report, /real OCR calls[^\n]*0/i);
    assert.match(report, /production promotion[^\n]*none/i);
});

test('runner config requires a fixed purpose and matching corpus split', () => {
    const directory = tempRoot();
    const value = config(directory);
    delete value.runPurpose;
    assert.throws(() => Runner.validateConfig(value), /runPurpose/);
    value.runPurpose = 'development';
    delete value.evaluationSplit;
    assert.throws(() => Runner.validateConfig(value), /evaluationSplit/);
});

test('development run refuses Holdout truth before writing a report', () => {
    const directory = tempRoot();
    const value = config(directory);
    fs.writeFileSync(value.input.truthPath, JSON.stringify([{
        documentId: 'holdout-1', split: 'holdout', qualityTags: ['synthetic'],
        questions: [question()]
    }]));
    fs.writeFileSync(value.input.resultPath, JSON.stringify([]));
    assert.throws(() => Runner.runBenchmark(value), /split mismatch/);
    assert.equal(fs.existsSync(value.output.jsonPath), false);
});

test('unexpected result documents are explicit failures rather than silently ignored', () => {
    const directory = tempRoot();
    const value = config(directory);
    fs.writeFileSync(value.input.truthPath, JSON.stringify([{
        documentId: 'truth-1', split: 'development', qualityTags: ['synthetic'],
        questions: [question()]
    }]));
    fs.writeFileSync(value.input.resultPath, JSON.stringify([
        { documentId: 'truth-1', status: 'ok', questions: [question()] },
        { documentId: 'unexpected-2', status: 'ok', questions: [question()] }
    ]));
    const report = Runner.runBenchmark(value);
    assert.equal(report.aggregate.statusCounts.unexpected, 1);
    assert.equal(report.aggregate.promotionEligible, false);
    assert.equal(
        report.aggregate.failures.some(item => item.code === 'unexpected-result-document'),
        true
    );
});

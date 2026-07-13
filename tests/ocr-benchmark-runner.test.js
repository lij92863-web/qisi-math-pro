const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const Runner = require('../scripts/benchmark/run-ocr-benchmark.js');

const makeQuestion = () => ({
    page: 1,
    sourceOrder: 1,
    questionNumber: '1',
    stem: 'PRIVATE_SENTINEL_STEM',
    options: [],
    answer: null,
    solution: null,
    formulas: [],
    images: []
});
const makeConfig = root => ({
    benchmarkId: 'synthetic-r1-test',
    corpusVersion: 'public-synthetic-1',
    scorerVersion: 'ocr-scoring-r1',
    runPurpose: 'development',
    evaluationSplit: 'development',
    engine: { name: 'mock-synthetic', version: '1.0.0' },
    hardwareProfile: {
        profileId: 'test-node',
        os: 'test-os',
        cpu: 'test-cpu',
        gpu: null,
        memoryBytes: 1024
    },
    timeoutMs: 1000,
    randomSeed: 23,
    bootstrapIterations: 100,
    input: {
        kind: 'synthetic',
        truthPath: path.join(root, 'truth.json'),
        resultPath: path.join(root, 'result.json')
    },
    output: {
        jsonPath: path.join(root, 'report.json'),
        markdownPath: path.join(root, 'report.md')
    }
});

const writeInputs = root => {
    fs.writeFileSync(path.join(root, 'truth.json'), JSON.stringify([{
        documentId: 'doc-1', split: 'development', qualityTags: ['synthetic'],
        questions: [makeQuestion()]
    }]));
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify([{
        documentId: 'doc-1', status: 'ok', questions: [makeQuestion()], safetyEvents: []
    }]));
};

test('benchmark runner requires pinned engine, hardware, timeout, seed, and output paths', () => {
    assert.throws(() => Runner.validateConfig({}), /benchmarkId/);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-ocr-config-'));
    const config = makeConfig(root);
    config.engine.version = 'latest';
    assert.throws(() => Runner.validateConfig(config), /pinned engine version/);
});

test('benchmark runner writes deterministic JSON and Markdown without private text', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-ocr-runner-'));
    writeInputs(root);
    const config = makeConfig(root);
    const first = Runner.runBenchmark(config);
    const firstJson = fs.readFileSync(config.output.jsonPath, 'utf8');
    const firstMarkdown = fs.readFileSync(config.output.markdownPath, 'utf8');
    const second = Runner.runBenchmark(config);
    assert.deepEqual(first, second);
    assert.equal(fs.readFileSync(config.output.jsonPath, 'utf8'), firstJson);
    assert.equal(fs.readFileSync(config.output.markdownPath, 'utf8'), firstMarkdown);
    assert.match(firstMarkdown, /mock-synthetic 1\.0\.0/);
    assert.match(firstMarkdown, /test-node/);
    assert.equal(firstJson.includes('PRIVATE_SENTINEL_STEM'), false);
    assert.equal(firstMarkdown.includes('PRIVATE_SENTINEL_STEM'), false);
    assert.equal(first.reportKind, 'sanitized-aggregate-only');
});

test('timeout remains an explicit failed document and blocks promotion eligibility', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-ocr-timeout-'));
    writeInputs(root);
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify([{
        documentId: 'doc-1',
        status: 'timeout',
        failure: { code: 'ocr-timeout', message: 'PRIVATE_TIMEOUT_DETAIL' }
    }]));
    const report = Runner.runBenchmark(makeConfig(root));
    assert.equal(report.aggregate.statusCounts.timeout, 1);
    assert.equal(report.aggregate.completedDocumentCount, 0);
    assert.equal(report.aggregate.promotionEligible, false);
    assert.equal(JSON.stringify(report).includes('PRIVATE_TIMEOUT_DETAIL'), false);
});

test('private benchmark paths fail closed without explicit real benchmark authority', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-ocr-private-'));
    const config = makeConfig(root);
    config.input.kind = 'private';
    assert.throws(
        () => Runner.validateConfig(config, { env: {} }),
        /QISI_ALLOW_REAL_OCR_BENCH=1/
    );
});

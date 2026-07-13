const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const Scoring = require('./score-ocr-result.js');

const assertText = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required.`);
    return value.trim();
};

const assertPositiveInteger = (value, field) => {
    if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive integer.`);
    return value;
};

const isWithin = (candidate, parent) => {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const validateConfig = (config, { env = process.env, repoRoot = process.cwd() } = {}) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new TypeError('benchmarkId is required.');
    }
    const benchmarkId = assertText(config.benchmarkId, 'benchmarkId');
    const corpusVersion = assertText(config.corpusVersion, 'corpusVersion');
    const scorerVersion = assertText(config.scorerVersion, 'scorerVersion');
    if (scorerVersion !== 'ocr-scoring-r1') throw new Error('scorerVersion must be ocr-scoring-r1.');
    const runPurpose = assertText(config.runPurpose, 'runPurpose');
    const evaluationSplit = assertText(config.evaluationSplit, 'evaluationSplit');
    const purposeSplit = {
        calibration: 'calibration',
        development: 'development',
        'final-holdout': 'holdout'
    };
    if (!Object.prototype.hasOwnProperty.call(purposeSplit, runPurpose)) {
        throw new Error('runPurpose must be calibration, development, or final-holdout.');
    }
    if (!['calibration', 'development', 'holdout'].includes(evaluationSplit)) {
        throw new Error('evaluationSplit must be calibration, development, or holdout.');
    }
    if (purposeSplit[runPurpose] !== evaluationSplit) {
        throw new Error('runPurpose and evaluationSplit do not match.');
    }

    const engineName = assertText(config.engine?.name, 'engine.name');
    const engineVersion = assertText(config.engine?.version, 'engine.version');
    if (/^(latest|current|unknown|unversioned)$/i.test(engineVersion)) {
        throw new Error('A pinned engine version is required; aliases are forbidden.');
    }

    const hardwareProfile = config.hardwareProfile;
    if (!hardwareProfile || typeof hardwareProfile !== 'object') {
        throw new TypeError('hardwareProfile is required.');
    }
    const normalizedHardware = {
        profileId: assertText(hardwareProfile.profileId, 'hardwareProfile.profileId'),
        os: assertText(hardwareProfile.os, 'hardwareProfile.os'),
        cpu: assertText(hardwareProfile.cpu, 'hardwareProfile.cpu'),
        gpu: hardwareProfile.gpu == null ? null : String(hardwareProfile.gpu),
        memoryBytes: assertPositiveInteger(hardwareProfile.memoryBytes, 'hardwareProfile.memoryBytes')
    };
    if (hardwareProfile.vramBytes != null) {
        if (!Number.isInteger(hardwareProfile.vramBytes) || hardwareProfile.vramBytes < 0) {
            throw new TypeError('hardwareProfile.vramBytes must be a non-negative integer.');
        }
        normalizedHardware.vramBytes = hardwareProfile.vramBytes;
    }

    const timeoutMs = assertPositiveInteger(config.timeoutMs, 'timeoutMs');
    if (!Number.isInteger(config.randomSeed)) throw new TypeError('randomSeed must be an integer.');
    const bootstrapIterations = assertPositiveInteger(
        config.bootstrapIterations,
        'bootstrapIterations'
    );

    const inputKind = assertText(config.input?.kind, 'input.kind');
    if (!['synthetic', 'private'].includes(inputKind)) {
        throw new Error('input.kind must be synthetic or private.');
    }
    if (inputKind === 'private' && env.QISI_ALLOW_REAL_OCR_BENCH !== '1') {
        throw new Error('Private benchmark input requires QISI_ALLOW_REAL_OCR_BENCH=1.');
    }
    const truthPath = path.resolve(assertText(config.input?.truthPath, 'input.truthPath'));
    const resultPath = path.resolve(assertText(config.input?.resultPath, 'input.resultPath'));
    if (path.extname(truthPath).toLowerCase() !== '.json' ||
        path.extname(resultPath).toLowerCase() !== '.json') {
        throw new Error('Benchmark inputs must be JSON metadata/results, never source documents.');
    }
    const privateRoot = path.join(path.resolve(repoRoot), 'local-test-materials', 'ocr-quality-r1');
    if (inputKind === 'private' && (!isWithin(truthPath, privateRoot) || !isWithin(resultPath, privateRoot))) {
        throw new Error('Private benchmark JSON must remain under local-test-materials/ocr-quality-r1/.');
    }
    if (inputKind === 'synthetic' && (isWithin(truthPath, privateRoot) || isWithin(resultPath, privateRoot))) {
        throw new Error('Private paths cannot be labeled synthetic.');
    }

    const jsonPath = path.resolve(assertText(config.output?.jsonPath, 'output.jsonPath'));
    const markdownPath = path.resolve(assertText(config.output?.markdownPath, 'output.markdownPath'));
    if (path.extname(jsonPath).toLowerCase() !== '.json' || path.extname(markdownPath).toLowerCase() !== '.md') {
        throw new Error('Output paths must use .json and .md extensions.');
    }
    if ([truthPath, resultPath].includes(jsonPath) || [truthPath, resultPath].includes(markdownPath)) {
        throw new Error('Benchmark outputs must not overwrite inputs.');
    }

    return {
        benchmarkId,
        corpusVersion,
        scorerVersion,
        runPurpose,
        evaluationSplit,
        engine: { name: engineName, version: engineVersion },
        hardwareProfile: normalizedHardware,
        timeoutMs,
        randomSeed: config.randomSeed,
        bootstrapIterations,
        input: { kind: inputKind, truthPath, resultPath },
        output: { jsonPath, markdownPath }
    };
};

const canonicalize = value => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
        );
    }
    return value;
};

const stableJson = value => JSON.stringify(canonicalize(value));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const asDocuments = value => {
    const rows = Array.isArray(value) ? value : value?.documents ? value.documents : [value];
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object')) {
        throw new TypeError('Benchmark input must contain document objects.');
    }
    if (rows.every(row => Array.isArray(row.questions) || row.status || row.failure)) return rows;

    const grouped = new Map();
    for (const row of rows) {
        const documentId = assertText(row.documentId, 'documentId');
        if (!grouped.has(documentId)) {
            grouped.set(documentId, {
                documentId,
                qualityTags: Array.isArray(row.qualityTags) ? row.qualityTags : [],
                questions: []
            });
        }
        grouped.get(documentId).questions.push(row);
    }
    return [...grouped.values()];
};

const reportConfig = config => ({
    benchmarkId: config.benchmarkId,
    corpusVersion: config.corpusVersion,
    scorerVersion: config.scorerVersion,
    runPurpose: config.runPurpose,
    evaluationSplit: config.evaluationSplit,
    engine: config.engine,
    hardwareProfile: config.hardwareProfile,
    timeoutMs: config.timeoutMs,
    randomSeed: config.randomSeed,
    bootstrapIterations: config.bootstrapIterations,
    inputKind: config.input.kind
});

const formatNumber = value => Number.isFinite(value) ? value.toFixed(6) : 'n/a';

const toMarkdown = report => {
    const raw = report.aggregate.statistics.rawCer;
    const normalizedScore = report.aggregate.statistics.normalizedCer;
    const lines = [
        '# OCR Benchmark R1 — Sanitized Report',
        '',
        `- Run: ${report.runId}`,
        `- Benchmark: ${report.benchmarkId}`,
        `- Corpus: ${report.corpusVersion}`,
        `- Purpose: ${report.runPurpose}`,
        `- Evaluation split: ${report.evaluationSplit}`,
        `- Engine: ${report.engine.name} ${report.engine.version}`,
        `- Hardware: ${report.hardwareProfile.profileId}`,
        `- Timeout: ${report.timeoutMs} ms`,
        `- Random seed: ${report.randomSeed}`,
        `- Input kind: ${report.inputKind}`,
        `- Promotion eligible: ${report.aggregate.promotionEligible}`,
        '',
        '## Aggregate',
        '',
        '| Metric | Value |',
        '| --- | ---: |',
        `| Documents | ${report.aggregate.documentCount} |`,
        `| Completed documents | ${report.aggregate.completedDocumentCount} |`,
        `| Failed documents | ${report.aggregate.failures.length} |`,
        `| Raw CER mean | ${formatNumber(raw?.mean)} |`,
        `| Normalized CER mean | ${formatNumber(normalizedScore?.mean)} |`,
        `| Fatal safety events | ${Object.values(report.aggregate.safety).reduce((sum, value) => sum + value, 0)} |`,
        '',
        '## Document status',
        '',
        '| Document | Status | Failure code |',
        '| --- | --- | --- |',
        ...report.documents.map(row =>
            `| ${row.documentId} | ${row.status} | ${row.failure?.code || ''} |`
        ),
        '',
        '> This report contains sanitized metrics only. It excludes source documents,',
        '> full ground truth, recognized text, raw responses, and private failure messages.',
        ''
    ];
    return lines.join('\n');
};

const runBenchmark = (config, options = {}) => {
    const validated = validateConfig(config, options);
    const truthBytes = fs.readFileSync(validated.input.truthPath);
    const resultBytes = fs.readFileSync(validated.input.resultPath);
    const truthDocuments = asDocuments(JSON.parse(truthBytes.toString('utf8')));
    const resultDocuments = asDocuments(JSON.parse(resultBytes.toString('utf8')));
    const ensureUniqueDocuments = (documents, label) => {
        const seen = new Set();
        for (const document of documents) {
            const id = assertText(document.documentId, `${label}.documentId`);
            if (seen.has(id)) throw new Error(`Duplicate ${label} documentId: ${id}`);
            seen.add(id);
        }
    };
    ensureUniqueDocuments(truthDocuments, 'truth');
    ensureUniqueDocuments(resultDocuments, 'result');
    for (const document of truthDocuments) {
        if (document.split !== validated.evaluationSplit) {
            throw new Error(
                `Corpus split mismatch for ${document.documentId}: expected ${validated.evaluationSplit}.`
            );
        }
    }
    const resultByDocument = new Map(resultDocuments.map(row => [String(row.documentId), row]));
    const truthIds = new Set(truthDocuments.map(row => String(row.documentId)));
    const scores = truthDocuments.map(truth => {
        const result = resultByDocument.get(String(truth.documentId)) || {
            documentId: truth.documentId,
            status: 'missing',
            failure: { code: 'missing-result' }
        };
        return Scoring.scoreDocumentR1(truth, result);
    });
    for (const result of resultDocuments.filter(row => !truthIds.has(String(row.documentId)))) {
        scores.push({
            documentId: String(result.documentId),
            qualityTags: [],
            status: 'unexpected',
            failure: { code: 'unexpected-result-document' },
            metrics: null,
            safety: Scoring.emptySafetyR1(),
            humanCost: null
        });
    }
    const summaryConfig = reportConfig(validated);
    const inputHashes = {
        truthSha256: sha256(truthBytes),
        resultSha256: sha256(resultBytes)
    };
    const runId = sha256(stableJson({ config: summaryConfig, inputHashes })).slice(0, 20);
    const report = {
        schemaVersion: 'ocr-benchmark-report-r1',
        reportKind: 'sanitized-aggregate-only',
        runId,
        ...summaryConfig,
        inputHashes,
        aggregate: Scoring.aggregateDocumentsR1(scores, {
            seed: validated.randomSeed,
            bootstrapIterations: validated.bootstrapIterations
        }),
        documents: scores
    };
    const json = `${JSON.stringify(report, null, 2)}\n`;
    const markdown = toMarkdown(report);
    fs.mkdirSync(path.dirname(validated.output.jsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(validated.output.markdownPath), { recursive: true });
    fs.writeFileSync(validated.output.jsonPath, json, 'utf8');
    fs.writeFileSync(validated.output.markdownPath, markdown, 'utf8');
    return report;
};

if (require.main === module) {
    const configPath = process.argv[2];
    if (!configPath) {
        process.stderr.write('Usage: node scripts/benchmark/run-ocr-benchmark.js <config.json>\n');
        process.exitCode = 2;
    } else {
        try {
            const report = runBenchmark(readJson(path.resolve(configPath)));
            process.stdout.write(`${JSON.stringify({
                ok: true,
                runId: report.runId,
                documentCount: report.aggregate.documentCount,
                failedDocumentCount: report.aggregate.failures.length,
                promotionEligible: report.aggregate.promotionEligible,
                realApiCalled: false
            })}\n`);
        } catch (error) {
            process.stderr.write(`[ocr-benchmark] ${error.message}\n`);
            process.exitCode = 1;
        }
    }
}

module.exports = {
    validateConfig,
    canonicalize,
    stableJson,
    asDocuments,
    toMarkdown,
    runBenchmark
};

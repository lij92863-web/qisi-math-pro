const { performance } = require('node:perf_hooks');
const Policy = require('../../qisi-formal-admission-policy.js');
const Validation = require('../../qisi-production-review-validator.js');

const readIntegerArg = (name, fallback, minimum, maximum) => {
    const prefix = `--${name}=`;
    const raw = process.argv.slice(2).find(value => value.startsWith(prefix));
    const value = Number(raw ? raw.slice(prefix.length) : fallback);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${name}-must-be-${minimum}-to-${maximum}`);
    }
    return value;
};

const sampleRuns = readIntegerArg('runs', 10, 1, 50);
const warmupRuns = readIntegerArg('warmup', 5, 0, 20);
const percentile = (values, ratio) => {
    const ordered = [...values].sort((left, right) => left - right);
    return ordered[Math.max(
        0,
        Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)
    )];
};

const createDraft = index => ({
    id: `benchmark-draft-${index}`,
    version: 1,
    status: 'pending',
    questionNumber: String(index + 1),
    type: '解答题',
    stem: `deterministic question ${index + 1}`,
    options: [],
    answer: 'A',
    solution: 'deterministic solution',
    images: [],
    source: {
        mode: 'docx-deterministic', sourceId: 'benchmark-docx', batchId: 'benchmark-batch'
    },
    fieldProvenance: Object.fromEntries(Policy.FORMAL_FIELDS.map(field => [
        field,
        field === 'images' || field === 'options'
            ? { status: 'missing' }
            : {
                status: 'deterministic-source',
                sourceId: 'benchmark-docx',
                evidenceRef: `benchmark:${index}:${field}`
            }
    ]))
});

const validator = Validation.createProductionReviewValidator({
    policy: Policy,
    clock: () => Date.parse('2026-07-13T00:00:00.000Z')
});

const results = [50, 100, 300].map(count => {
    const rows = Array.from({ length: count }, (_, index) => createDraft(index));
    for (let warmup = 0; warmup < warmupRuns; warmup += 1) {
        rows.forEach(row => validator.validate(row));
    }
    const samplesMs = [];
    for (let run = 0; run < sampleRuns; run += 1) {
        const started = performance.now();
        const validations = rows.map(row => validator.validate(row));
        if (!validations.every(result => result.valid)) {
            throw new Error(`review benchmark fixture invalid at count ${count}`);
        }
        samplesMs.push(performance.now() - started);
    }
    return {
        count,
        samplesMs,
        medianMs: percentile(samplesMs, 0.5),
        p50Ms: percentile(samplesMs, 0.5),
        p95Ms: percentile(samplesMs, 0.95)
    };
});

process.stdout.write(`${JSON.stringify({
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    warmupRuns,
    sampleRuns,
    results
}, null, 2)}\n`);

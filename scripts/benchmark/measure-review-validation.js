const { performance } = require('node:perf_hooks');
const Policy = require('../../qisi-formal-admission-policy.js');
const Validation = require('../../qisi-production-review-validator.js');

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

const results = [10, 50, 100].map(count => {
    const rows = Array.from({ length: count }, (_, index) => createDraft(index));
    for (let warmup = 0; warmup < 5; warmup += 1) {
        rows.forEach(row => validator.validate(row));
    }
    const samplesMs = [];
    for (let run = 0; run < 7; run += 1) {
        const started = performance.now();
        const validations = rows.map(row => validator.validate(row));
        if (!validations.every(result => result.valid)) {
            throw new Error(`review benchmark fixture invalid at count ${count}`);
        }
        samplesMs.push(performance.now() - started);
    }
    samplesMs.sort((left, right) => left - right);
    return {
        count,
        samplesMs,
        medianMs: samplesMs[Math.floor(samplesMs.length / 2)]
    };
});

process.stdout.write(`${JSON.stringify({
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    warmupRuns: 5,
    sampleRuns: 7,
    results
}, null, 2)}\n`);

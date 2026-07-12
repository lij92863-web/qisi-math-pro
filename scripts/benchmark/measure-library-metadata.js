const { performance } = require('node:perf_hooks');
const { metadataQuery } = require('../../qisi-library-service.js');

const records = Number(process.argv[2]) || 5000;
const iterations = Number(process.argv[3]) || 1000;
const rows = Array.from({ length: records }, (_, index) => ({
    id: `q${index}`,
    type: index % 2 ? 'A' : 'B',
    grade: `G${index % 3}`,
    diff: index % 2 ? 'M' : 'E',
    answer: index % 2 ? '' : 'A',
    images: index % 5 ? [] : [{ id: `i${index}` }]
}));

for (let index = 0; index < 100; index += 1) metadataQuery(rows);
const samplesMs = [];
for (let run = 0; run < 7; run += 1) {
    const started = performance.now();
    for (let index = 0; index < iterations; index += 1) metadataQuery(rows);
    samplesMs.push(performance.now() - started);
}
samplesMs.sort((left, right) => left - right);
const medianMs = samplesMs[Math.floor(samplesMs.length / 2)];
process.stdout.write(`${JSON.stringify({
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    records,
    iterations,
    samplesMs,
    medianMs,
    perCallMs: medianMs / iterations
}, null, 2)}\n`);

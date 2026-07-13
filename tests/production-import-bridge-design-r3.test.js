'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('legacy decomposition accounts for every required responsibility', () => {
    const report = read('docs/architecture/LEGACY_BATCH_OWNER_DECOMPOSITION_R3.md');
    for (const responsibility of [
        'batch/file loading', 'source role classification', 'DOCX parsing',
        'PDF page processing', 'OCR/vision calls', 'normalization', 'structure',
        'sequence validation', 'ownership validation', 'safe-prefix',
        'controlled-write', 'review draft projection', 'image handling',
        'draft persistence', 'batch/file status', 'progress', 'cancellation',
        'diagnostics', 'UI side effects', 'error/retry'
    ]) assert.match(report, new RegExp(`\\| ${responsibility.replace('/', '\\/')} \\|`));
    for (const heading of [
        'Legacy range', 'Direct dependencies', 'Reactive dependency',
        'DB side effect', 'Current owner', 'Production-wired',
        'Still trapped', 'Move without copy', 'Characterization'
    ]) assert.match(report, new RegExp(heading));
});

test('production port map classifies all nine ports and forbids new algorithms', () => {
    const report = read('docs/architecture/PRODUCTION_IMPORT_PORTS_R3.md');
    for (const port of [
        'loadBatchAndFiles', 'reportProgress', 'parseDocxSource',
        'processPdfSources', 'normalizeCandidates', 'validateCandidates',
        'buildReviewDrafts', 'persistReviewDraftBatch', 'recordDiagnostics'
    ]) assert.match(report, new RegExp(`\\| ${port} \\| [ABCD] \\|`));
    assert.match(report, /D: stop; do not create a second algorithm/);
    assert.doesNotMatch(report, /Category D exists: yes/i);
});

test('state mapping ends at review and excludes formal admission and commit', () => {
    const report = read('docs/architecture/PRODUCTION_IMPORT_STATE_MAPPING_R3.md');
    assert.match(report, /IDLE[\s\S]*PREPARING[\s\S]*LOADING_SOURCE/);
    assert.match(report, /RECOGNIZING \(PDF only\)/);
    assert.match(report, /NORMALIZING[\s\S]*STRUCTURING[\s\S]*VALIDATING/);
    assert.match(report, /BUILDING_REVIEW[\s\S]*PERSISTING_DRAFT[\s\S]*WAITING_CONFIRMATION/);
    assert.match(report, /MUST NOT enter `FORMAL_ADMISSION`/);
    assert.match(report, /MUST NOT enter `COMMITTING`/);
    assert.match(report, /MUST NOT enter `COMPLETED`/);
});

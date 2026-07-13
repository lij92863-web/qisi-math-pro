const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const inventory = require('../scripts/base-migration-inventory.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('C2-12 matrix freezes the post-C2-11 shell baseline honestly', () => {
    const app = read('app.js');
    const matrix = read(
        'docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_C2_12.md'
    );
    const result = inventory.inventoryAppJs();

    assert.equal(result.appJsLines, 19494);
    assert.equal(result.totalFunctionsFound, 396);
    assert.doesNotMatch(app, /const processDraftImportBatch\s*=/);
    assert.match(app, /const processDraftImportBatchV2\s*=/);
    assert.match(matrix, /processDraftImportBatchV2` \| 216 lines \/ unreachable/);
    assert.match(matrix, /direct Qwen\/DashScope transport callsites \| 17/);
    assert.match(matrix, /direct `db\.questions\.put` \| 6/);
});

test('baseline state trace records the formal lifecycle gap without a second enum', () => {
    const trace = read(
        'docs/architecture/IMPORT_STATE_MACHINE_PRODUCTION_TRACE_C2_12.md'
    );
    const machine = read('qisi-import-state-machine.js');
    const submit = read('qisi-batch-formal-submit.js');

    for (const state of [
        'IDLE', 'PREPARING', 'LOADING_SOURCE', 'RECOGNIZING',
        'NORMALIZING', 'STRUCTURING', 'VALIDATING', 'BUILDING_REVIEW',
        'PERSISTING_DRAFT', 'WAITING_CONFIRMATION', 'FORMAL_ADMISSION',
        'COMMITTING', 'COMPLETED', 'CANCELLED', 'FAILED'
    ]) assert.match(machine, new RegExp(`['\"]${state}['\"]`));
    assert.doesNotMatch(submit, /createImportStateMachine|\.transition\(/);
    assert.match(trace, /Baseline gap to close/);
});

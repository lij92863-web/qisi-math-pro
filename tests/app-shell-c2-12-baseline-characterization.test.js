const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const inventory = require('../scripts/base-migration-inventory.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('C2-12 matrix freezes the post-C2-11 shell baseline honestly', () => {
    const app = read('app.js');
    const matrix = read(
        'docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_C2_12.md'
    );
    const result = inventory.inventoryAppJs();
    const baseline = execFileSync(
        'git',
        ['show', 'f92f8e909aa53047755f71f5b9d9d45d3e849303:app.js'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );

    assert.equal(baseline.split(/\r?\n/).length, 19494);
    assert.equal(result.appJsLines <= 18586, true);
    assert.equal(result.totalFunctionsFound <= 379, true);
    assert.doesNotMatch(app, /const processDraftImportBatch\s*=/);
    assert.match(baseline, /const processDraftImportBatchV2\s*=/);
    assert.doesNotMatch(app, /const processDraftImportBatchV2\s*=/);
    assert.match(matrix, /processDraftImportBatchV2` \| 216 lines \/ unreachable/);
    assert.match(matrix, /direct Qwen\/DashScope transport callsites \| 17/);
    assert.match(matrix, /direct `db\.questions\.put` \| 6/);
});

test('state trace preserves the baseline gap and proves its unique-owner closure', () => {
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
    assert.match(submit, /createStateMachine/);
    assert.match(submit, /initialState: 'WAITING_CONFIRMATION'/);
    assert.match(submit, /transition\('teacher-confirm'\)/);
    assert.match(submit, /transition\('admitted'\)/);
    assert.match(submit, /transition\('repository-committed'\)/);
    assert.match(trace, /Baseline gap to close/);
    assert.match(trace, /Final production formal trace/);
});

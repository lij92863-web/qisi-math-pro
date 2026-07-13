const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPORT = path.resolve(__dirname, '../docs/architecture/IMPORT_STATE_MACHINE_R3.md');
const STATES = [
    'IDLE', 'PREPARING', 'LOADING_SOURCE', 'RECOGNIZING', 'NORMALIZING',
    'STRUCTURING', 'VALIDATING', 'BUILDING_REVIEW', 'PERSISTING_DRAFT',
    'WAITING_CONFIRMATION', 'FORMAL_ADMISSION', 'COMMITTING', 'COMPLETED',
    'CANCELLED', 'FAILED'
];

test('R3 import state machine design declares every required state exactly once', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const state of STATES) {
        const declarations = report.match(new RegExp(`^\\| ${state} \\|`, 'gm')) || [];
        assert.equal(declarations.length, 1, state);
    }
});

test('every transition row carries the complete transition contract', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const heading of [
        'From', 'To', 'Trigger', 'Precondition', 'Action', 'Output',
        'Recoverability', 'Error code', 'Cancellation behavior'
    ]) assert.match(report, new RegExp(heading, 'i'), heading);
    const rows = report.split(/\r?\n/).filter(line => line.startsWith('| T'));
    assert.equal(rows.length >= 20, true, `transition rows=${rows.length}`);
    for (const row of rows) {
        const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
        assert.equal(cells.length, 10, row);
        assert.equal(cells.every(Boolean), true, row);
    }
});

test('design is fail-closed, cancellable, retry-bounded, and preserves frozen owners', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of [
        'invalid transition', 'idempotency', 'retry budget', 'AbortSignal',
        'controlled-write', 'FormalAdmission', 'Repository', 'manual review',
        'no hidden side effects'
    ]) assert.match(report, new RegExp(term, 'i'), term);
    assert.match(report, /COMMITTING[^\n]*not cancellable/i);
});

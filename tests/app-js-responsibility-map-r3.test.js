const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/architecture/APP_JS_RESPONSIBILITY_MAP_R3.md');
const INVENTORY_SCRIPT = path.join(ROOT, 'scripts/app-shell-responsibility-inventory.js');

test('R3 responsibility inventory keeps the shell within the frozen baseline', () => {
    assert.equal(fs.existsSync(INVENTORY_SCRIPT), true, 'responsibility inventory script must exist');
    const { buildResponsibilityInventory } = require(INVENTORY_SCRIPT);
    const inventory = buildResponsibilityInventory();
    assert.ok(inventory.appJsLines <= 21778, `app.js grew beyond the 21778-line baseline: ${inventory.appJsLines}`);
    assert.ok(
        inventory.functions.length <= 318,
        `app.js function count grew beyond the 318-function baseline: ${inventory.functions.length}`
    );
    assert.equal(
        new Set(inventory.functions.map(item => item.name)).size,
        inventory.functions.length
    );
    for (const item of inventory.functions) {
        for (const field of [
            'name', 'startLine', 'endLine', 'domain', 'callers', 'dependencies',
            'reactiveState', 'sideEffects', 'tests', 'targetModule',
            'extractionRisk', 'migrationWave'
        ]) assert.notEqual(item[field], undefined, `${item.name}:${field}`);
        assert.equal(item.startLine <= item.endLine, true, item.name);
    }
});

test('R3 baseline responsibility map covers every current function name exactly once', () => {
    assert.equal(fs.existsSync(REPORT), true, 'responsibility map must exist');
    const { buildResponsibilityInventory } = require(INVENTORY_SCRIPT);
    const inventory = buildResponsibilityInventory();
    const report = fs.readFileSync(REPORT, 'utf8');
    const rows = report.split(/\r?\n/).filter(line => line.startsWith('| `'));
    assert.equal(rows.length, 318, 'baseline map row count changed');
    for (const item of inventory.functions) {
        const prefix = `| \`${item.name}\` |`;
        assert.equal(rows.filter(row => row.startsWith(prefix)).length, 1, item.name);
    }
    for (const heading of [
        'Name', 'Line range', 'Domain', 'Callers', 'Dependencies', 'Reactive state',
        'Side effects', 'Tests', 'Target module', 'Extraction risk', 'Migration wave'
    ]) assert.match(report, new RegExp(heading, 'i'), heading);
});

test('map keeps frozen owners and the giant legacy owner explicit', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    assert.match(report, /processDraftImportBatch[^\n]*15984–21115[^\n]*5132/i);
    for (const owner of ['controlled-write', 'FormalAdmission', 'Repository', 'Route B', 'OCR policy']) {
        assert.match(report, new RegExp(owner, 'i'), owner);
    }
});

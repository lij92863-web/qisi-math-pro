const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/architecture/APP_JS_RESPONSIBILITY_MAP_R3.md');
const INVENTORY_SCRIPT = path.join(ROOT, 'scripts/app-shell-responsibility-inventory.js');

test('R3 responsibility inventory covers every current app function exactly once', () => {
    assert.equal(fs.existsSync(INVENTORY_SCRIPT), true, 'responsibility inventory script must exist');
    const { buildResponsibilityInventory } = require(INVENTORY_SCRIPT);
    const inventory = buildResponsibilityInventory();
    assert.equal(inventory.appJsLines, 21778);
    assert.equal(inventory.functions.length, 318);
    assert.equal(new Set(inventory.functions.map(item => item.name)).size, 318);
    for (const item of inventory.functions) {
        for (const field of [
            'name', 'startLine', 'endLine', 'domain', 'callers', 'dependencies',
            'reactiveState', 'sideEffects', 'tests', 'targetModule',
            'extractionRisk', 'migrationWave'
        ]) assert.notEqual(item[field], undefined, `${item.name}:${field}`);
        assert.equal(item.startLine <= item.endLine, true, item.name);
    }
});

test('R3 responsibility map contains one machine-checkable row per inventory function', () => {
    assert.equal(fs.existsSync(REPORT), true, 'responsibility map must exist');
    const { buildResponsibilityInventory } = require(INVENTORY_SCRIPT);
    const inventory = buildResponsibilityInventory();
    const report = fs.readFileSync(REPORT, 'utf8');
    const rows = report.split(/\r?\n/).filter(line => line.startsWith('| `'));
    assert.equal(rows.length, inventory.functions.length);
    for (const item of inventory.functions) {
        const prefix = `| \`${item.name}\` | ${item.startLine}–${item.endLine} |`;
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

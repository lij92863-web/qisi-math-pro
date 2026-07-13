const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const { inventoryAppJs } = require('../scripts/base-migration-inventory.js');

test('app shell does not grow a new oversized business function', () => {
    const inventory = inventoryAppJs();
    assert.ok(inventory.appJsLines <= 21780, `app.js grew to ${inventory.appJsLines} lines`);
    const oversized = inventory.functions
        .filter(item => item.lineCount > 250)
        .map(item => item.name);
    assert.deepEqual(oversized, []);
    assert.equal(
        inventory.functions.some(item => item.name === 'processDraftImportBatch'),
        false
    );
});

test('OCR adapters cannot own answer alignment or formal persistence', () => {
    for (const file of [
        'qisi-ocr-qwen-adapter.js',
        'qisi-ocr-local-adapter.js',
        'qisi-ocr-engine-registry.js',
        'qisi-ocr-shadow-mode.js'
    ]) {
        const source = read(file);
        assert.doesNotMatch(source, /alignPdfSupport\s*\(|answerOwnership\s*[:=]/i, file);
        assert.doesNotMatch(source, /eligibleForControlledWrite\s*:\s*true/i, file);
        assert.doesNotMatch(source, /saveQuestion|updateQuestion|bulkPut|\.transaction\s*\(/, file);
        assert.doesNotMatch(source, /confirmedAt|manualConfirmed/, file);
    }
});

test('UI modules do not implement storage backends', () => {
    for (const file of [
        'qisi-components.js',
        'qisi-ui-events.js',
        'qisi-ui-renderer.js'
    ]) {
        const source = read(file);
        assert.doesNotMatch(source, /indexedDB|new\s+Dexie|localStorage\./, file);
        assert.doesNotMatch(source, /\.transaction\s*\(|\.bulkPut\s*\(/, file);
    }
});

test('tests import high-risk owners instead of copying their implementations', () => {
    const ownerNames = [
        'alignPdfSupport',
        'buildPdfSupportFieldLevelControlledWrite',
        'createRecognitionCandidate',
        'validateConfirmedQuestion',
        'createRepository',
        'createExportService',
        'createImportOrchestrator'
    ];
    const files = fs.readdirSync(path.join(ROOT, 'tests'))
        .filter(name => name.endsWith('.test.js'));
    const violations = [];
    for (const file of files) {
        const source = read(path.join('tests', file));
        for (const name of ownerNames) {
            const definition = new RegExp(
                `(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)`
            );
            if (definition.test(source)) violations.push(`${file}:${name}`);
        }
    }
    assert.deepEqual(violations, []);
});

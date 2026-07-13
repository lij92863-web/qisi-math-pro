const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const REPORT = path.resolve(__dirname, '../docs/architecture/APP_SHELL_TARGET_MODULES_R3.md');
const MODULES = [
    'qisi-batch-context-service.js', 'qisi-source-role-classifier.js',
    'qisi-docx-import-coordinator.js', 'qisi-pdf-import-coordinator.js',
    'qisi-candidate-normalizer.js', 'qisi-import-validation-service.js',
    'qisi-review-draft-builder.js', 'qisi-draft-persistence-service.js',
    'qisi-import-diagnostics.js', 'qisi-import-state-machine.js'
];

test('C2.3 defines one complete contract for every target module', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const module of MODULES) {
        assert.equal((report.match(new RegExp(`^## ${module.replaceAll('.', '\\.')}$`, 'gm')) || []).length, 1, module);
    }
    for (const field of ['Single owner', 'Public API', 'Allowed dependencies', 'Forbidden', 'Production-linked tests']) {
        assert.equal((report.match(new RegExp(`^- ${field}:`, 'gm')) || []).length, 10, field);
    }
});

test('target design prohibits UI coupling and frozen-owner duplication', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of ['no DOM', 'no Vue', 'no direct external call', 'controlled-write', 'FormalAdmission', 'Repository', 'Route B']) {
        assert.match(report, new RegExp(term, 'i'), term);
    }
});

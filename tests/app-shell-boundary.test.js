const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.html'), 'utf8');

test('app delegates migrated owners to production modules', () => {
    for (const call of [
        'StorageRepository.createRepository',
        'LibraryService.createLibraryService',
        'ReviewController.createReviewController',
        'ExportService.createExportService',
        'LegacyBatchRunCoordinator.createLegacyBatchRunCoordinator'
    ]) {
        assert.match(app, new RegExp(call.replace('.', '\\.')));
    }
    assert.doesNotMatch(app, /localStorage\.(?:getItem|setItem|removeItem)/);
    assert.doesNotMatch(app, /const\s+safeStorage\s*=/);
});

test('migrated module scripts load before app and app remains below baseline', () => {
    const scripts = [
        'qisi-storage-repository.js',
        'qisi-library-service.js',
        'qisi-review-controller.js',
        'qisi-export-service.js',
        'qisi-legacy-batch-run-coordinator.js'
    ];
    const appIndex = main.indexOf('./app.js');
    for (const script of scripts) {
        const index = main.indexOf(`./${script}`);
        assert.ok(index >= 0 && index < appIndex, `${script} order`);
    }
    // The ceiling tracks reviewed work only (see docs/integration/HARDENING_INTEGRATION_LEDGER_2026_09_15.md):
    // the deterministic-first DOCX orchestration added the enrichment-gap handling, the skeleton
    // contract and the deterministic support parsing; the 2026-09-16 rounds added the withheld
    // question rule and the active-anchor/no-promotion support rules.
    assert.ok(app.split(/\r?\n/).length < 22117);
});

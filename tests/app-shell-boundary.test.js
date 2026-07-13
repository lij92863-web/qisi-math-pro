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
        'ProductionImportBridge.createProductionImportBridge',
        'createNormalUiImportController'
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
        'qisi-production-import-bridge.js',
        'qisi-normal-ui-import-controller.js'
    ];
    const appIndex = main.indexOf('./app.js');
    for (const script of scripts) {
        const index = main.indexOf(`./${script}`);
        assert.ok(index >= 0 && index < appIndex, `${script} order`);
    }
    assert.ok(app.split(/\r?\n/).length < 22043);
});

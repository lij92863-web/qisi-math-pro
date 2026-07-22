const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const importerPath = path.resolve(__dirname, '../qisi-batch-importer.js');

const loadImporter = () => {
    const window = { Qisi: {} };
    const context = vm.createContext({ window, console });
    vm.runInContext(fs.readFileSync(importerPath, 'utf8'), context, {
        filename: 'qisi-batch-importer.js'
    });
    return window.QisiBatchImporter;
};

test('formula-image placeholder detection is explicit and bounded', () => {
    const importer = loadImporter();

    assert.equal(importer.hasUndisplayableFormulaPlaceholder('[公式图片待转换:wmf]'), true);
    assert.equal(importer.hasUndisplayableFormulaPlaceholder('[公式图片选项待转换:emf]'), true);
    assert.equal(importer.hasUndisplayableFormulaPlaceholder('普通题干与 $x^2$'), false);
    assert.equal(importer.hasUndisplayableFormulaPlaceholder('displayable'), false);
});

test('batch importer contains no generated multi-kilobyte source lines', () => {
    const lines = fs.readFileSync(importerPath, 'utf8').split(/\r?\n/);
    const longest = Math.max(...lines.map(line => line.length));

    assert.ok(longest < 1200, `longest source line is ${longest} characters`);
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const manifest = require('../scripts/production-entry-manifest.js');

const qisiModulePattern = /^qisi-[a-z0-9-]+\.js$/;

const sorted = values => [...values].sort((left, right) => left.localeCompare(right));

const readRootQisiModules = () => fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && qisiModulePattern.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

const normalizeLocalScriptSrc = src => {
    const withoutQuery = String(src || '').split(/[?#]/, 1)[0];
    return withoutQuery.replace(/^\.\//, '');
};

const readLocalScriptOrder = () => {
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    return [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
        .map(match => match[2].trim())
        .filter(src => /^(?:\.\/|\/)/.test(src))
        .map(normalizeLocalScriptSrc);
};

test('every root qisi module belongs to exactly one explicit category', () => {
    const entries = Object.entries(manifest.categoryFiles);
    assert.deepEqual(
        sorted(Object.keys(manifest.categoryPolicy)),
        sorted(entries.map(([category]) => category))
    );

    const occurrences = new Map();
    for (const [category, files] of entries) {
        assert.ok(Array.isArray(files), `${category} must be an array`);
        assert.equal(new Set(files).size, files.length, `${category} contains duplicate entries`);
        for (const file of files) {
            assert.match(file, qisiModulePattern, `${category} contains a non-qisi module: ${file}`);
            occurrences.set(file, [...(occurrences.get(file) || []), category]);
        }
    }

    for (const [file, categories] of occurrences) {
        assert.equal(categories.length, 1, `${file} is classified more than once: ${categories.join(', ')}`);
        assert.equal(manifest.categoryFor(file), categories[0]);
    }

    const classifiedPresent = entries.flatMap(([category, files]) =>
        manifest.categoryPolicy[category].mustExist ? files : []
    );
    assert.deepEqual(sorted(classifiedPresent), readRootQisiModules());

    for (const [category, files] of entries) {
        for (const file of files) {
            assert.equal(
                fs.existsSync(path.join(ROOT, file)),
                manifest.categoryPolicy[category].mustExist,
                `${file} violates the ${category} existence policy`
            );
        }
    }
});

test('main.html local production script order equals the manifest single source of truth', () => {
    const actual = readLocalScriptOrder();
    assert.equal(new Set(actual).size, actual.length, 'main.html contains duplicate local script src values');
    assert.equal(new Set(manifest.browserScriptOrder).size, manifest.browserScriptOrder.length);
    assert.deepEqual(actual, manifest.browserScriptOrder);
    assert.equal(actual.at(-1), 'app.js', 'app.js must remain the final local production script');

    const qisiBrowserScripts = actual.filter(file => qisiModulePattern.test(file));
    assert.deepEqual(qisiBrowserScripts, manifest.categoryFiles['browser-live']);
});

test('node, research, scaffold, and absent modules never enter the browser script graph', () => {
    const browserFiles = new Set(manifest.browserScriptOrder);
    for (const category of [
        'node-entry',
        'node-dependency',
        'node-safety',
        'frozen-research',
        'dead-scaffold',
        'expected-absent'
    ]) {
        for (const file of manifest.categoryFiles[category]) {
            assert.equal(browserFiles.has(file), false, `${category} module ${file} must not load in main.html`);
        }
    }
});

test('high-risk non-browser modules retain their audited ownership classification', () => {
    assert.equal(manifest.categoryFor('qisi-local-server.js'), 'node-entry');
    assert.equal(manifest.categoryFor('qisi-serial-task-queue.js'), 'node-dependency');
    assert.equal(manifest.categoryFor('qisi-pdf-answer-extraction-quality.js'), 'node-safety');
    assert.equal(manifest.categoryFor('qisi-batch-engine-v2.js'), 'frozen-research');
    assert.equal(manifest.categoryFor('qisi-pdf-answer-only-extraction.js'), 'frozen-research');

    assert.deepEqual(
        manifest.categoryFiles['expected-absent'],
        [
            'qisi-app-facade.js',
            'qisi-batch-orchestrator.js',
            'qisi-review-view-model.js',
            'qisi-storage-facade.js',
            'qisi-ui-renderer.js'
        ]
    );
});

test('audited Node entry and safety dependencies remain reachable from production code', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const localServerSource = fs.readFileSync(path.join(ROOT, 'qisi-local-server.js'), 'utf8');
    const controlledWriteSource = fs.readFileSync(
        path.join(ROOT, 'qisi-pdf-support-controlled-write.js'),
        'utf8'
    );

    assert.equal(packageJson.main, 'qisi-local-server.js');
    assert.match(packageJson.scripts.start, /node\s+qisi-local-server\.js(?:\s|$)/);
    assert.match(
        localServerSource,
        /require\(['"]\.\/qisi-serial-task-queue\.js['"]\)/
    );
    assert.match(
        controlledWriteSource,
        /require\(['"]\.\/qisi-pdf-answer-extraction-quality\.js['"]\)/
    );
});

test('every live browser and Node production JavaScript file passes node --check', () => {
    for (const file of manifest.productionSyntaxCheckFiles) {
        const absolute = path.join(ROOT, file);
        assert.equal(fs.existsSync(absolute), true, `${file} must exist before syntax checking`);
        const result = spawnSync(process.execPath, ['--check', absolute], {
            cwd: ROOT,
            encoding: 'utf8',
            windowsHide: true
        });
        assert.equal(
            result.status,
            0,
            `${file} failed node --check:\n${result.stderr || result.stdout}`
        );
    }
});

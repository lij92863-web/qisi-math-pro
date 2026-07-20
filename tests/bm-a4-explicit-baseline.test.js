const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { HELPERS } = require('../scripts/bm-a4-helper-extract');
const {
    analyzeFiles
} = require('../scripts/bm-a4-staged-migration-verify');
const {
    rankAll
} = require('../scripts/bm-a4-r3-candidate-ranker');
const {
    generatePlan
} = require('../scripts/bm-a4-r3-shard-planner');

const ROOT = path.resolve(__dirname, '..');
const STAGED_SCRIPT = path.join(ROOT, 'scripts', 'bm-a4-staged-migration-verify.js');
const LONG_RUN_SCRIPT = path.join(ROOT, 'scripts', 'bm-a4-long-run-report.js');

function moduleWithExports() {
    return `const api = {\n${HELPERS.map((helper) => `  ${helper},`).join('\n')}\n};`;
}

function wrapperFixture() {
    return HELPERS
        .map((helper) => `const ${helper} = (value) => window.Qisi.Utils.${helper}(value);`)
        .join('\n');
}

function makeFixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-bm-explicit-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const beforePath = path.join(directory, 'before.js');
    const afterPath = path.join(directory, 'after.js');
    const modulePath = path.join(directory, 'qisi-utils.js');
    fs.writeFileSync(beforePath, 'const legacy = true;\n');
    fs.writeFileSync(afterPath, `${wrapperFixture()}\ncleanDisplayTextForBatchSave(value);\n`);
    fs.writeFileSync(modulePath, moduleWithExports());
    return { beforePath, afterPath, modulePath };
}

describe('BM A4 tools use explicit baselines and in-memory analysis', () => {
    it('staged verifier rejects a missing explicit baseline instead of using a root snapshot', () => {
        assert.throws(
            () => analyzeFiles({
                afterPath: path.join(ROOT, 'app.js'),
                modulePath: path.join(ROOT, 'qisi-utils.js')
            }),
            (error) => error && error.code === 'QISI_EXPLICIT_BEFORE_REQUIRED'
        );

        const result = spawnSync(process.execPath, [
            STAGED_SCRIPT,
            '--after', path.join(ROOT, 'app.js'),
            '--module', path.join(ROOT, 'qisi-utils.js')
        ], { cwd: ROOT, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Explicit --before <path> is required/);
    });

    it('staged verifier accepts a temporary explicit baseline fixture', (t) => {
        const fixture = makeFixture(t);
        const result = spawnSync(process.execPath, [
            STAGED_SCRIPT,
            '--before', fixture.beforePath,
            '--after', fixture.afterPath,
            '--module', fixture.modulePath
        ], { cwd: path.dirname(fixture.beforePath), encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.beforeLines, 2);
        assert.equal(report.naked.cleanDisplayTextForBatchSave.length, 1);
    });

    it('candidate ranker analyzes injected sources without a historical file', () => {
        const summary = rankAll({
            afterSource: `${wrapperFixture()}\ncleanDisplayTextForBatchSave(value);`,
            moduleSource: moduleWithExports()
        });
        assert.equal(summary.total, 1);
        assert.equal(summary.ranked[0].helper, 'cleanDisplayTextForBatchSave');
    });

    it('shard planner analyzes injected sources without a historical file', () => {
        const plan = generatePlan({
            afterSource: `${wrapperFixture()}\ncleanDisplayTextForBatchSave(value);`,
            moduleSource: moduleWithExports()
        });
        assert.equal(plan.totalCallsites, 1);
        assert.equal(plan.callsites[0].helper, 'cleanDisplayTextForBatchSave');
    });

    it('long-run report fails clearly without --before and runs with a temporary baseline', (t) => {
        const missing = spawnSync(process.execPath, [LONG_RUN_SCRIPT], {
            cwd: ROOT,
            encoding: 'utf8'
        });
        assert.notEqual(missing.status, 0);
        assert.match(missing.stderr, /Explicit --before <path> is required/);

        const fixture = makeFixture(t);
        const explicit = spawnSync(process.execPath, [
            LONG_RUN_SCRIPT,
            '--before', fixture.beforePath,
            '--after', path.join(ROOT, 'app.js'),
            '--module', path.join(ROOT, 'qisi-utils.js')
        ], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(explicit.status, 0, explicit.stderr);
        assert.equal(JSON.parse(explicit.stdout).staged.beforeLines, 2);
    });

    it('live tools contain no hard-coded root baseline filename', () => {
        for (const relativePath of [
            'scripts/bm-a4-staged-migration-verify.js',
            'scripts/bm-a4-r3-candidate-ranker.js',
            'scripts/bm-a4-r3-shard-planner.js',
            'scripts/bm-a4-long-run-report.js'
        ]) {
            const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
            assert.equal(source.includes('.bm_a4_app_before.js'), false, relativePath);
        }
    });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { getChangedFiles, matchPattern } = require('../scripts/verify-diff-scope');
const gate = path.resolve(__dirname, '../scripts/verify-diff-scope.js');
test('scope gate checks untracked, staged, unstaged and committed changes', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-scope-test-'));
    const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const run = base => spawnSync(process.execPath, [gate], { cwd: directory, encoding: 'utf8',
        env: { ...process.env, QISI_ALLOWED_DIFF: 'safe.js', QISI_DIFF_BASE: base || '' } });
    try {
        git(['init']); git(['config', 'user.name', 'Scope Test']);
        git(['config', 'user.email', 'scope-test@example.invalid']);
        fs.writeFileSync(path.join(directory, 'safe.js'), 'initial');
        git(['add', 'safe.js']); git(['commit', '-m', 'baseline']);
        const base = git(['rev-parse', 'HEAD']);
        assert.equal(run().status, 0);
        fs.writeFileSync(path.join(directory, 'unsafe.js'), 'outside scope');
        assert.deepEqual(getChangedFiles({ cwd: directory }), ['unsafe.js']);
        assert.equal(run().status, 1);
        git(['add', 'unsafe.js']); assert.equal(run().status, 1);
        git(['commit', '-m', 'outside scope']);
        assert.equal(run(base).status, 1);
        fs.writeFileSync(path.join(directory, 'safe.js'), 'changed');
        assert.deepEqual(getChangedFiles({ cwd: directory }), ['safe.js']);
        assert.equal(run().status, 0);
        assert.equal(run('no-such-ref').status, 1);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('scope wildcards do not allow a sibling path', () => {
    assert.equal(matchPattern('tests/new.test.js', 'tests/**'), true);
    assert.equal(matchPattern('tests-other/new.test.js', 'tests/**'), false);
    assert.equal(matchPattern('safe.js', 'safe.js'), true);
    assert.equal(matchPattern('unsafe.js', 'safe.js'), false);
});

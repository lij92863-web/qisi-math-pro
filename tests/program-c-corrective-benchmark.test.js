const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(
    ROOT,
    'scripts/benchmark/measure-program-c-closure.js'
);

test('corrective benchmark compares the fixed RC2 tree without candidate fixtures', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');
    assert.doesNotMatch(
        source,
        /production-cutover-fixtures|true-import-fixtures|prebuiltCandidates|finalCandidates/
    );
    assert.match(source, /79fea1e1cad0c682c42539dd575370f3919f1d05/);

    const result = JSON.parse(execFileSync(
        process.execPath,
        [SCRIPT, '--smoke'],
        { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
    ));
    assert.equal(result.decision, 'PROGRAM_C_CORRECTIVE_BENCHMARK_ACCEPTED');
    assert.equal(result.sameMachine, true);
    assert.equal(result.sameNode, true);
    assert.equal(result.sameBrowser, true);
    assert.equal(result.realApiCalled, false);
    assert.equal(result.fixtureCandidateTransport, false);
    assert.equal(result.comparisons.length, 11);
    result.comparisons.forEach(item => {
        assert.equal(item.blocker, false, item.name);
        assert.equal(item.failureCount, 0, item.name);
        assert.equal(item.timeoutCount, 0, item.name);
    });
});

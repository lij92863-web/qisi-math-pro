const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPORT = path.resolve(__dirname, '../docs/architecture/APP_SHELL_MIGRATION_PROTOCOL_R3.md');

test('C2.4 protocol makes every migration gate mandatory and ordered', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    const gates = [
        'characterization test', 'extraction candidate', 'legacy/new shadow compare',
        'deterministic equivalence', 'production switch', 'old owner removal',
        'no duplicate', 'targeted tests', 'true E2E', 'full gates', 'commit'
    ];
    let last = -1;
    for (const gate of gates) {
        const index = report.toLowerCase().indexOf(gate.toLowerCase());
        assert.equal(index > last, true, `${gate}:${index}`);
        last = index;
    }
});

test('each wave has evidence, rollback, stop, and exact-scope requirements', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of [
        'failure-first', 'behavior hash', 'shadow mismatch', 'rollback point',
        'exact paths', 'verify:diff-scope', 'remote main', 'three bounded repairs',
        'production-wired', 'no hidden legacy fallback'
    ]) assert.match(report, new RegExp(term, 'i'), term);
    for (let wave = 1; wave <= 14; wave += 1) {
        assert.match(report, new RegExp(`C2-${wave}\\b`), `C2-${wave}`);
    }
});

test('protocol forbids copy debt, multi-domain moves, mocks, and wrong-layer state', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of [
        'copy then retain', 'multiple domains', 'mock replacing production behavior',
        'reactive state', 'force push', 'reset --hard', 'real-run'
    ]) assert.match(report, new RegExp(term, 'i'), term);
});

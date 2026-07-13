const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Bridge = require('../qisi-production-import-bridge.js');
const ROOT = path.resolve(__dirname, '..');

test('fixture runner is explicit, deterministic, prefix-safe, and review-only', async () => {
    const runner = Bridge.createFixtureImportRunner({
        getTransport: () => ({
            kind: 'qisi.mock-import-transport.v1',
            produceCandidates: async () => ({
                candidates: [
                    { questionNumber: '1', stem: 'one' },
                    { questionNumber: '3', stem: 'three' }
                ],
                expectedQuestionNumbers: ['1', '2', '3'],
                draftImages: [], warnings: ['fixture-warning']
            })
        }),
        normalizeQuestionNumber: value => String(value || '').trim()
    });
    const result = await runner({
        route: 'pdf', batch: { id: 'batch-1' }, files: []
    });
    assert.deepEqual(result.drafts.map(item => item.questionNumber), ['1']);
    assert.equal(result.prefixTruncated, true);
    assert.equal(result.safePartialCandidates[0].isSafePartial, true);
    assert.deepEqual(result.warnings, ['fixture-warning']);
});

test('fixture runner fails closed without the exact injected mock contract', async () => {
    const runner = Bridge.createFixtureImportRunner({
        getTransport: () => ({ kind: 'other' }),
        normalizeQuestionNumber: String
    });
    await assert.rejects(
        runner({ batch: {}, files: [] }),
        error => error.code === 'PRODUCTION_IMPORT_FIXTURE_INVALID'
    );
});

test('app only assembles the fixture runner and has no fixture projection algorithm', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /ProductionImportBridge\.createFixtureImportRunner\s*\(/);
    assert.doesNotMatch(app, /transport\?\.kind\s*!==\s*'qisi\.mock-import-transport\.v1'/);
    assert.doesNotMatch(app, /const\s+byNumber\s*=\s*new Map\(envelope\.candidates/);
});

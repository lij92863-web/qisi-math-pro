const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeDraftPreviewOptions } = require('../qisi-review-draft-state.js');

describe('normalizeDraftPreviewOptions', () => {
    it('normal input: preserves four option strings', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: ['A', 'B', 'C', 'D'] }),
            ['A', 'B', 'C', 'D']
        );
    });

    it('empty input: returns four empty strings', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: [] }),
            ['', '', '', '']
        );
    });

    it('null input: returns four empty strings', () => {
        assert.deepEqual(normalizeDraftPreviewOptions(null), ['', '', '', '']);
    });

    it('undefined input: returns four empty strings', () => {
        assert.deepEqual(normalizeDraftPreviewOptions(undefined), ['', '', '', '']);
    });

    it('whitespace and punctuation: treats whitespace-only options as empty', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: [' ', '\t', '\n', ''] }),
            ['', '', '', '']
        );
    });

    it('malformed input: non-array options return fallback shape', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: 'A. text' }),
            ['', '', '', '']
        );
    });

    it('representative project case: pads missing choice options', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: ['x > 0', 'x < 0'] }),
            ['x > 0', 'x < 0', '', '']
        );
    });

    // User-authorized N32/N40 consistency: editor must preserve existing E/F options.
    it('boundary case: preserves options after D', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: ['A', 'B', 'C', 'D', 'E'] }),
            ['A', 'B', 'C', 'D', 'E']
        );
    });

    it('coerces option values to strings', () => {
        assert.deepEqual(
            normalizeDraftPreviewOptions({ options: [1, false, null, undefined] }),
            ['1', '', '', '']
        );
    });

    it('no mutation: original options array is unchanged', () => {
        const question = { options: ['A', 'B', 'C', 'D', 'E'] };
        const before = question.options.slice();
        normalizeDraftPreviewOptions(question);
        assert.deepEqual(question.options, before);
    });

    it('output shape consistency: pads to four and preserves longer arrays', () => {
        const inputs = [{ options: ['A'] }, {}, null, undefined, { options: [1, 2, 3, 4, 5] }];
        for (const input of inputs) {
            const result = normalizeDraftPreviewOptions(input);
            assert.equal(result.length, Math.max(4, input?.options?.length || 0));
            assert.ok(result.every(option => typeof option === 'string'));
        }
    });

    it('app.js and the editor projection both use the shared ReviewDraftState helper', () => {
        const rootDir = path.join(__dirname, '..');
        const app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
        const projection = fs.readFileSync(path.join(rootDir, 'qisi-review-editor-projection.js'), 'utf8');
        // R1c moved the call into the projection module; app.js still passes the owner
        // reference, so neither file may reimplement the rule locally.
        assert.match(app, /normalizePreviewOptions:\s*window\.Qisi\.ReviewDraftState\.normalizeDraftPreviewOptions/);
        assert.doesNotMatch(app, /const\s+normalizeDraftPreviewOptions\s*=/);
        assert.match(projection, /normalizePreviewOptions\(question\)/);
        assert.doesNotMatch(projection, /const\s+normalizeDraftPreviewOptions\s*=/);
    });
});


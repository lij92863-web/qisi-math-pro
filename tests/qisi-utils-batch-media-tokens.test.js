const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    protectBatchMediaTokens,
    restoreBatchMediaTokens,
    hasBatchMediaToken,
    hasBatchImagePlaceholder,
    stripBatchImagePlaceholders
} = require('../qisi-utils.js');

describe('protectBatchMediaTokens', () => {
    it('text with IMAGE token: protects token', () => {
        const r = protectBatchMediaTokens('text [[IMAGE:abc123]] more');
        assert.ok(!r.protectedText.includes('[[IMAGE:abc123]]'));
        assert.ok(r.tokens.includes('[[IMAGE:abc123]]'));
    });
    it('text without tokens: returns unchanged', () => {
        const r = protectBatchMediaTokens('plain text');
        assert.equal(r.protectedText, 'plain text');
        assert.deepEqual(r.tokens, []);
    });
    it('empty string: returns empty', () => {
        const r = protectBatchMediaTokens('');
        assert.equal(r.protectedText, '');
        assert.equal(r.tokens.length, 0);
    });
    it('null: returns empty', () => {
        const r = protectBatchMediaTokens(null);
        assert.equal(r.protectedText, '');
    });
    it('undefined: returns empty', () => {
        const r = protectBatchMediaTokens(undefined);
        assert.equal(r.protectedText, '');
    });
    it('output shape: has protectedText and tokens', () => {
        const r = protectBatchMediaTokens('x');
        assert.ok('protectedText' in r);
        assert.ok('tokens' in r);
    });
    it('no mutation: input unchanged', () => {
        const input = 'test [[IMAGE:x]]';
        protectBatchMediaTokens(input);
        assert.equal(input, 'test [[IMAGE:x]]');
    });
});

describe('restoreBatchMediaTokens', () => {
    it('restores one token', () => {
        const r = restoreBatchMediaTokens('text __QISI_MEDIA_TOKEN_0__ more', ['TOKEN']);
        assert.equal(r, 'text TOKEN more');
    });
    it('restores multiple tokens in order', () => {
        const r = restoreBatchMediaTokens('a __QISI_MEDIA_TOKEN_0__ b __QISI_MEDIA_TOKEN_1__', ['X', 'Y']);
        assert.equal(r, 'a X b Y');
    });
    it('empty tokens array: replaces with empty', () => {
        const r = restoreBatchMediaTokens('text __QISI_MEDIA_TOKEN_0__', []);
        assert.equal(r, 'text ');
    });
    it('null tokens: throws (matches old behavior)', () => {
        assert.throws(() => restoreBatchMediaTokens('text __QISI_MEDIA_TOKEN_0__', null));
    });
    it('text without placeholders: returns unchanged', () => {
        const r = restoreBatchMediaTokens('plain text', ['X']);
        assert.equal(r, 'plain text');
    });
});

describe('hasBatchMediaToken', () => {
    it('detects IMAGE token', () => {
        assert.equal(hasBatchMediaToken('[[IMAGE:abc]]'), true);
    });
    it('detects FORMULA_IMAGE token', () => {
        assert.equal(hasBatchMediaToken('[[FORMULA_IMAGE:abc]]'), true);
    });
    it('plain text: returns false', () => {
        assert.equal(hasBatchMediaToken('plain text'), false);
    });
    it('empty string: returns false', () => {
        assert.equal(hasBatchMediaToken(''), false);
    });
    it('null: returns false', () => {
        assert.equal(hasBatchMediaToken(null), false);
    });
    it('repeated calls: no regex lastIndex bug', () => {
        assert.equal(hasBatchMediaToken('[[IMAGE:1]]'), true);
        assert.equal(hasBatchMediaToken('[[IMAGE:2]]'), true);
        assert.equal(hasBatchMediaToken('plain'), false);
        assert.equal(hasBatchMediaToken('[[IMAGE:3]]'), true);
    });
});

describe('hasBatchImagePlaceholder', () => {
    it('detects bad placeholder', () => {
        assert.equal(hasBatchImagePlaceholder('[公式图片待识别]'), true);
    });
    it('legal media token is not bad placeholder', () => {
        assert.equal(hasBatchImagePlaceholder('[[IMAGE:abc]]'), true);
    });
    it('plain text: returns false', () => {
        assert.equal(hasBatchImagePlaceholder('hello'), false);
    });
});

describe('stripBatchImagePlaceholders', () => {
    it('removes bad placeholders, preserves media tokens', () => {
        const r = stripBatchImagePlaceholders('text [公式图片待识别] [[IMAGE:x]] more');
        assert.ok(!r.includes('[公式图片待识别]'));
        assert.ok(r.includes('[[IMAGE:x]]'));
    });
    it('empty input: returns empty', () => {
        const r = stripBatchImagePlaceholders('');
        assert.equal(r, '');
    });
    it('null: returns empty', () => {
        const r = stripBatchImagePlaceholders(null);
        assert.equal(r, '');
    });
});

describe('app.js checks', () => {
    it('app.js explicit calls present', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        assert.match(app, /window\.Qisi\.Utils\.protectBatchMediaTokens\s*\(/);
        assert.match(app, /window\.Qisi\.Utils\.restoreBatchMediaTokens\s*\(/);
        assert.match(app, /window\.Qisi\.Utils\.hasBatchMediaToken\s*\(/);
        assert.match(app, /window\.Qisi\.Utils\.stripBatchImagePlaceholders\s*\(/);
    });
    it('app.js: no naked function calls', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const fns = ['protectBatchMediaTokens', 'restoreBatchMediaTokens', 'hasBatchMediaToken', 'stripBatchImagePlaceholders'];
        for (const fn of fns) {
            const naked = app.split(/\r?\n/).filter(l =>
                l.includes(fn + '(') && !l.includes('window.Qisi.Utils.' + fn + '(')
            );
            assert.deepEqual(naked, [], `naked ${fn} calls found`);
        }
    });
});

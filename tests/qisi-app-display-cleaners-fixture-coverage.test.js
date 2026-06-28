const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { REQUIRED_TAGS, R2_TAGS, checkFixtureCoverage } = require('../scripts/bm-a4-fixture-coverage-check');

function writeTemp(content) {
    const file = path.join(os.tmpdir(), `a4-fixture-${Date.now()}-${Math.random().toString(36).slice(2)}.test.js`);
    fs.writeFileSync(file, content);
    return file;
}

describe('bm-a4-fixture-coverage-check', () => {
    it('missing required tag fails', () => {
        const file = writeTemp("const { it } = require('node:test');\nit('[A4:text:empty]', () => {});\n");
        const result = checkFixtureCoverage(file);
        assert.equal(result.ok, false);
        assert.ok(result.missing.length > 0);
    });

    it('real fixture file passes after creation', () => {
        const result = checkFixtureCoverage('tests/qisi-app-display-cleaners-fixtures.test.js');
        assert.equal(result.ok, true);
    });

    it('skip/todo test fails', () => {
        const file = writeTemp(`${REQUIRED_TAGS.join('\n')}\nit.skip('bad', () => {});\n`);
        const result = checkFixtureCoverage(file);
        assert.equal(result.ok, false);
        assert.ok(result.errors.some((x) => x.includes('skip')));
    });

    it('only marker fails', () => {
        const file = writeTemp(`${REQUIRED_TAGS.join('\n')}\nit.only('bad', () => {});\n`);
        const result = checkFixtureCoverage(file);
        assert.equal(result.ok, false);
        assert.ok(result.errors.some((x) => x.includes('only')));
    });

    it('missing R2 callsite fixture tag fails', () => {
        const file = writeTemp(`${REQUIRED_TAGS.join('\n')}\n`);
        const result = checkFixtureCoverage(file);
        assert.equal(result.ok, false);
        assert.ok(result.missingR2.length > 0);
    });

    it('present R2 callsite fixture tag passes', () => {
        const file = writeTemp(`${REQUIRED_TAGS.join('\n')}\n${R2_TAGS.join('\n')}\n`);
        const result = checkFixtureCoverage(file);
        assert.equal(result.ok, true);
    });

    it('legacy 51 tags still required', () => {
        const result = checkFixtureCoverage('tests/qisi-app-display-cleaners-fixtures.test.js');
        assert.equal(result.legacyTotal, 51);
        assert.equal(result.missingLegacy.length, 0);
    });

    it('skip/todo/only still rejected', () => {
        const file = writeTemp(`${REQUIRED_TAGS.join('\n')}\n${R2_TAGS.join('\n')}\nit.skip('bad', () => {});\n`);
        const result = checkFixtureCoverage(file);
        assert.equal(result.ok, false);
        assert.ok(result.errors.some((x) => x.includes('skip')));
    });
});

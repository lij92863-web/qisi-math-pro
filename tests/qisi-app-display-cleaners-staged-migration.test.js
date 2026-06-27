const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { HELPERS } = require('../scripts/bm-a4-helper-extract');
const { analyzeSources } = require('../scripts/bm-a4-staged-migration-verify');

function moduleWithExports() {
    return `const api = {\n${HELPERS.map((helper) => `  ${helper},`).join('\n')}\n};`;
}

function wrappers() {
    return HELPERS.map((helper) => `const ${helper} = (value, value2) => window.Qisi.Utils.${helper}(value, value2);`).join('\n');
}

describe('bm-a4-staged-migration-verify', () => {
    it('TOOLING_ONLY when no qisi-utils exports', () => {
        const result = analyzeSources({ after: 'const x = 1;', moduleSource: 'const api = {};' });
        assert.equal(result.classification, 'TOOLING_ONLY');
    });

    it('QISI_UTILS_IMPL when module has helpers but app wrappers not added', () => {
        const result = analyzeSources({ after: 'const x = 1;', moduleSource: moduleWithExports() });
        assert.equal(result.classification, 'QISI_UTILS_IMPL');
    });

    it('WRAPPER_ADAPTER when app wrappers delegate', () => {
        const result = analyzeSources({ after: wrappers(), moduleSource: moduleWithExports() });
        assert.equal(result.classification, 'WRAPPER_ADAPTER');
    });

    it('CALLSITE_PARTIAL when some calls explicit', () => {
        const result = analyzeSources({
            after: `${wrappers()}\nwindow.Qisi.Utils.cleanDisplayTextForBatchSave(x);\ncleanDisplayOptionsForBatchSave(y);`,
            moduleSource: moduleWithExports()
        });
        assert.equal(result.classification, 'CALLSITE_PARTIAL');
    });

    it('CALLSITE_COMPLETE_WITH_WRAPPERS when all calls explicit and wrappers remain', () => {
        const result = analyzeSources({
            after: `${wrappers()}\n${HELPERS.map((helper) => `window.Qisi.Utils.${helper}(x);`).join('\n')}`,
            moduleSource: moduleWithExports()
        });
        assert.equal(result.classification, 'CALLSITE_COMPLETE_WITH_WRAPPERS');
    });

    it('STAGED_MIGRATION_COMPLETE when wrappers removed', () => {
        const result = analyzeSources({
            after: HELPERS.map((helper) => `window.Qisi.Utils.${helper}(x);`).join('\n'),
            moduleSource: moduleWithExports()
        });
        assert.equal(result.classification, 'STAGED_MIGRATION_COMPLETE');
    });

    it('BLOCKED when naked call remains', () => {
        const result = analyzeSources({
            after: 'cleanDisplayTextForBatchSave(x);',
            moduleSource: moduleWithExports()
        });
        assert.equal(result.classification, 'BLOCKED');
    });
});

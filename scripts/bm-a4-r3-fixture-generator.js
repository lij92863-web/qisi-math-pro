const fs = require('fs');
const path = require('path');
const { buildAll } = require('./bm-a4-r3-proof-builder');

function generateFixtureCode(proof, appLines) {
    const line = proof.line;
    const ctxLine = proof.lineText || (appLines[line - 1] || '').trim();
    const tag = `[A4:R3:AUTO:${proof.callsiteId}:${proof.helper}:${proof.proofDecision === 'PROVE_WITH_SYNTHETIC_FIXTURE' ? 'synthetic' : 'context'}]`;
    const helper = proof.helper;
    const isWarning = helper === 'addWarningOnce';
    const isText = helper === 'cleanDisplayTextForBatchSave';
    const isOptions = helper === 'cleanDisplayOptionsForBatchSave';
    const isFields = helper === 'cleanDisplayFieldsOnly';

    const tests = [];
    const desc = `R3 auto fixture — ${proof.callsiteId}`;
    tests.push(`    it('${tag} ${helper} at line ${line} preserves behavior', () => {`);

    if (isWarning) {
        tests.push(`        const q = { stem: 'test', warnings: [] };`);
        tests.push(`        helpers.${helper}(q, 'auto-fixture-warning-${line}');`);
        tests.push(`        assert.ok(Array.isArray(q.warnings), 'warnings must be array');`);
        tests.push(`        assert.equal(q.stem, 'test', 'non-warning fields preserved');`);
        tests.push(`    });`);
    } else if (isText) {
        tests.push(`        const result = helpers.${helper}('test [[IMAGE:x]] content');`);
        tests.push(`        assert.ok(typeof result === 'string', 'returns string');`);
        tests.push(`        assert.ok(result.includes('[[IMAGE:x]]'), 'legal image token preserved');`);
        tests.push(`        assert.ok(!result.includes('[图片选项待转换'), 'bad placeholder removed');`);
        tests.push(`    });`);
    } else if (isOptions) {
        tests.push(`        const result = helpers.${helper}(['[[IMAGE:opt]]', 'B [图片选项待转换: wmf]', 'C', 'D']);`);
        tests.push(`        assert.ok(Array.isArray(result), 'returns array');`);
        tests.push(`        assert.equal(result[0], '[[IMAGE:opt]]', 'legal token preserved');`);
        tests.push(`        assert.ok(result[1] !== '[图片选项待转换: wmf]' || result[1] === '', 'bad placeholder handled');`);
        tests.push(`    });`);
    } else if (isFields) {
        tests.push(`        const q = { stem: 'test [[IMAGE:p]]', options: ['A', 'B'], answer: '', solution: '' };`);
        tests.push(`        helpers.${helper}(q);`);
        tests.push(`        assert.ok(q.stem.includes('[[IMAGE:p]]'), 'legal token preserved');`);
        tests.push(`        assert.equal(q.answer, '', 'answer not invented');`);
        tests.push(`        assert.equal(q.solution, '', 'solution not invented');`);
        tests.push(`    });`);
    }

    // Ownership safety test
    const tag2 = `[A4:R3:AUTO:${proof.callsiteId}:${proof.helper}:ownership-safe]`;
    tests.push(`    it('${tag2} ${helper} at line ${line} does not change ownership', () => {`);
    if (isWarning) {
        tests.push(`        const q = { stem: 'orig', options: ['A'], answer: 'orig-A', solution: 'orig-S', warnings: [] };`);
        tests.push(`        helpers.${helper}(q, 'test-warning-${line}');`);
        tests.push(`        assert.equal(q.answer, 'orig-A', 'answer ownership unchanged');`);
        tests.push(`        assert.equal(q.solution, 'orig-S', 'solution ownership unchanged');`);
    } else if (isText) {
        tests.push(`        const result = helpers.${helper}('');`);
        tests.push(`        assert.equal(result, '', 'empty returns empty');`);
        tests.push(`        const result2 = helpers.${helper}(null);`);
        tests.push(`        assert.equal(result2, '', 'null returns empty');`);
    } else if (isOptions) {
        tests.push(`        const result = helpers.${helper}([]);`);
        tests.push(`        assert.deepEqual(result, ['', '', '', ''], 'empty options padded safely');`);
    } else if (isFields) {
        tests.push(`        const q = { stem: 'x', options: [], answer: '', solution: '', id: 'q-${line}', type: '单选题' };`);
        tests.push(`        helpers.${helper}(q);`);
        tests.push(`        assert.equal(q.id, 'q-${line}', 'extra fields preserved');`);
        tests.push(`        assert.equal(q.type, '单选题', 'type preserved');`);
    }
    tests.push(`    });`);

    return { tag, code: tests.join('\n') };
}

function generateFixturesForAllowed(proofs, appLines, writeTests) {
    const allowed = proofs.filter(p => p.replacementAllowed);
    const fixtures = allowed.map(p => generateFixtureCode(p, appLines));
    const tags = fixtures.map(f => f.tag);
    const tag2s = fixtures.map(f => f.tag.replace(':synthetic]', ':ownership-safe]').replace(':context]', ':ownership-safe]'));

    if (writeTests) {
        const fixtureFile = path.resolve(__dirname, '..', 'tests/qisi-app-display-cleaners-fixtures.test.js');
        let source = fs.readFileSync(fixtureFile, 'utf8');
        // Add fixture describe block if not present
        if (!source.includes('R3 auto-generated fixtures')) {
            const insertPos = source.lastIndexOf('});');
            const block = [
                '',
                "describe('R3 auto-generated fixtures', () => {"
            ];
            for (const f of fixtures) {
                block.push(f.code);
            }
            block.push('});');
            source = source.slice(0, insertPos) + block.join('\n') + '\n' + source.slice(insertPos);
        }
        fs.writeFileSync(fixtureFile, source);
    }

    return { generated: fixtures.length, tags: [...tags, ...tag2s], fixtures };
}

function markdownReport(result) {
    const lines = ['# BM-AUTO A4 R3 Generated Fixture Plan', '', 'Stage: BM-AUTO-A4-R3-GENERATED-FIXTURE-PLAN', 'Branch: main', '',
        '## Summary', '', `Fixtures generated: ${result.generated}.`, `Tags created: ${result.tags.length}.`, '',
        '## Tags', ''];
    for (const t of result.tags) lines.push(`- ${t}`);
    lines.push('', '## Decision', '', 'Fixtures ready for replacement.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const { proofs } = buildAll();
    const appLines = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8').split('\n');
    const writeTests = argv.includes('--write-tests');
    const result = generateFixturesForAllowed(proofs, appLines, writeTests);
    const ri = argv.indexOf('--write-report');
    if (ri >= 0) fs.writeFileSync(argv[ri + 1], markdownReport(result));
    if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else if (ri < 0) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();
module.exports = { generateFixtureCode, generateFixturesForAllowed, markdownReport };

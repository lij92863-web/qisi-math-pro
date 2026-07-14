const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Classifier = require('../qisi-source-role-classifier.js');
const ROOT = path.resolve(__dirname, '..');

const source = (id, fileType, roles, extra = {}) => ({
    id,
    fileType,
    roles,
    sourceOrder: extra.sourceOrder ?? 0,
    createdAt: extra.createdAt ?? 0,
    ...extra
});

for (const [name, fileType, role] of [
    ['question DOCX', 'docx', 'question'],
    ['answer DOCX', 'docx', 'answer'],
    ['question PDF', 'pdf', 'question'],
    ['answer PDF', 'pdf', 'answer']
]) {
    test(`${name} is classified only from its declared role`, () => {
        const result = Classifier.classifySourceRoles([
            source('source-1', fileType, [role])
        ]);
        assert.deepEqual(result.sources[0].roles, [role]);
        assert.deepEqual(result.roleSourceIds[role], ['source-1']);
        assert.equal(result.sources[0].recognitionRank, role === 'question' ? 0 : 1);
        assert.equal(Object.isFrozen(result), true);
        assert.equal(Object.isFrozen(result.sources[0]), true);
    });
}

test('explicit answer and solution roles remain deterministic and source ordered', () => {
    const result = Classifier.classifySourceRoles([
        source('late', 'pdf', ['answer', 'solution'], { sourceOrder: 2 }),
        source('early', 'docx', ['question'], { sourceOrder: 1 })
    ]);
    assert.deepEqual(result.orderedSourceIds, ['early', 'late']);
    assert.deepEqual(result.roleSourceIds.answer, ['late']);
    assert.deepEqual(result.roleSourceIds.solution, ['late']);
});

for (const [name, manifest, code] of [
    ['ambiguous source', [source('f1', 'docx', ['full', 'question'])], 'SOURCE_ROLE_AMBIGUOUS'],
    ['duplicate role', [source('f1', 'pdf', ['answer', 'answer'])], 'SOURCE_ROLE_DUPLICATE_ROLE'],
    ['missing role', [source('f1', 'docx', [], { rawText: '答案详解和题目正文' })], 'SOURCE_ROLE_MISSING_ROLE']
]) {
    test(`${name} fails closed with a stable code`, () => {
        assert.throws(
            () => Classifier.classifySourceRoles(manifest),
            error => error.code === code
        );
    });
}

test('production routing uses the classifier and never performs content inference', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const implementation = fs.readFileSync(path.join(ROOT, 'qisi-source-role-classifier.js'), 'utf8');
    const bridge = fs.readFileSync(path.join(ROOT, 'qisi-production-import-bridge.js'), 'utf8');
    const routePolicy = fs.readFileSync(path.join(ROOT, 'qisi-production-import-route-policy.js'), 'utf8');
    assert.match(app, /Qisi\.SourceRoleClassifier\.classifySourceRoles\s*\(/);
    assert.match(bridge, /classification\.sources/);
    assert.match(bridge, /ports\.resolveProductionRoute\s*\(\{/);
    assert.match(app, /ProductionImportRoutePolicy[\s\S]*\.resolveProductionImportRoute\(input\)/);
    assert.doesNotMatch(routePolicy, /rawText|textContent|keyword|document\.|window\.|\bfetch\s*\(/i);
    assert.doesNotMatch(app, /const recognitionFileRank\s*=\s*file\s*=>/);
    assert.ok(html.indexOf('qisi-source-role-classifier.js') < html.indexOf('app.js'));
    assert.doesNotMatch(implementation, /rawText|textContent|keyword|document\.|window\.|\bfetch\s*\(/i);
    assert.doesNotMatch(implementation, /\.put\s*\(|\.add\s*\(|\.delete\s*\(|\.transaction\s*\(/);
});

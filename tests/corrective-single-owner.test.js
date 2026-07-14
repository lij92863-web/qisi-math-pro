const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const productionFiles = fs.readdirSync(ROOT)
    .filter(file => /^(?:app|qisi-[\w-]+)\.js$/.test(file));

function definitions(file) {
    const ast = acorn.parse(read(file), {
        ecmaVersion: 'latest',
        sourceType: 'script'
    });
    const names = [];
    const walk = node => {
        if (!node?.type) return;
        if (node.type === 'FunctionDeclaration' && node.id?.name) {
            names.push(node.id.name);
        }
        if (
            node.type === 'VariableDeclarator' && node.id?.name &&
            ['ArrowFunctionExpression', 'FunctionExpression'].includes(
                node.init?.type
            )
        ) names.push(node.id.name);
        for (const [key, value] of Object.entries(node)) {
            if (['start', 'end', 'loc'].includes(key)) continue;
            if (Array.isArray(value)) value.forEach(walk);
            else if (value?.type) walk(value);
        }
    };
    walk(ast);
    return names;
}

test('corrective owner manifest names exactly one production owner per policy', () => {
    const manifest = JSON.parse(read('docs/architecture/owners.json'));
    const expected = {
        routePolicy: 'production-import-route-policy',
        duplicatePolicy: 'question-duplicate-policy',
        reviewWorkflow: 'review-workflow',
        draftMaintenance: 'draft-maintenance'
    };
    assert.deepEqual(manifest.singleOwnerAssertions, expected);
    for (const ownerId of Object.values(expected)) {
        assert.equal(
            manifest.owners.filter(owner =>
                owner.ownerId === ownerId && owner.status === 'production'
            ).length,
            1,
            ownerId
        );
    }
});

test('critical corrective constructors and route decision have one definition', () => {
    const expected = {
        resolveProductionImportRoute: 'qisi-production-import-route-policy.js',
        createReviewWorkflowService: 'qisi-review-workflow-service.js',
        createDraftMaintenanceService: 'qisi-draft-maintenance-service.js'
    };
    const inventories = new Map(productionFiles.map(file => [
        file,
        definitions(file)
    ]));
    for (const [symbol, owner] of Object.entries(expected)) {
        const matches = productionFiles.filter(file =>
            inventories.get(file).includes(symbol)
        );
        assert.deepEqual(matches, [owner], symbol);
    }
});

test('duplicate decision namespace has one production implementation', () => {
    const owners = productionFiles.filter(file =>
        /root\.Qisi\.QuestionDuplicatePolicy\s*=\s*api/.test(read(file))
    );
    assert.deepEqual(owners, ['qisi-question-duplicate-policy.js']);
    const app = read('app.js');
    assert.doesNotMatch(app, /QuestionDuplicatePolicy\.(?:evaluate|canonical)/);
    const appDefinitions = definitions('app.js');
    for (const retiredOwner of [
        'detectDraftDuplicate',
        'duplicateLabel',
        'evaluateDuplicate'
    ]) assert.equal(appDefinitions.includes(retiredOwner), false, retiredOwner);
});

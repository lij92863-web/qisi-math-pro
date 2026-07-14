const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const APP_PATH = path.join(ROOT, 'app.js');
const MATRIX_PATH = path.join(
    ROOT,
    'docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json'
);
const OWNERS_PATH = path.join(ROOT, 'docs/architecture/owners.json');

const FUNCTION_TYPES = new Set([
    'ArrowFunctionExpression',
    'FunctionExpression',
    'FunctionDeclaration'
]);

function childNodes(node) {
    const children = [];
    for (const [key, value] of Object.entries(node || {})) {
        if (['start', 'end', 'loc'].includes(key)) continue;
        if (Array.isArray(value)) {
            children.push(...value.filter(item => item?.type));
        } else if (value?.type) {
            children.push(value);
        }
    }
    return children;
}

function walk(node, visit, ancestors = []) {
    if (!node?.type) return;
    visit(node, ancestors);
    const next = [...ancestors, node];
    childNodes(node).forEach(child => walk(child, visit, next));
}

function calleePath(node) {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'ThisExpression') return 'this';
    if (node.type === 'ChainExpression') return calleePath(node.expression);
    if (node.type !== 'MemberExpression') return node.type;
    const object = calleePath(node.object);
    const property = node.computed
        ? (node.property.type === 'Literal'
            ? String(node.property.value)
            : '*')
        : node.property.name;
    return object ? `${object}.${property}` : property;
}

function collectDefinitions(ast) {
    const definitions = new Map();
    const record = (name, node) => {
        if (!name || !FUNCTION_TYPES.has(node?.type)) return;
        const list = definitions.get(name) || [];
        list.push(node);
        definitions.set(name, list);
    };
    walk(ast, node => {
        if (node.type === 'FunctionDeclaration') record(node.id?.name, node);
        if (node.type === 'VariableDeclarator') record(node.id?.name, node.init);
    });
    return definitions;
}

function directCalls(functionNode) {
    const calls = [];
    const descend = node => {
        if (!node?.type) return;
        if (node !== functionNode && FUNCTION_TYPES.has(node.type)) return;
        if (node.type === 'CallExpression') calls.push({
            path: calleePath(node.callee),
            line: node.loc.start.line
        });
        childNodes(node).forEach(descend);
    };
    descend(functionNode.body);
    return calls;
}

function propertyAncestor(ancestors, name) {
    return ancestors.some(node => node.type === 'Property' && (
        node.key?.name === name || node.key?.value === name
    ));
}

function callAncestor(ancestors, expectedPath) {
    return ancestors.some(node =>
        node.type === 'CallExpression' && calleePath(node.callee) === expectedPath
    );
}

function verifyCompositionOnlyUses(ast, errors) {
    const routeCalls = [];
    const duplicateReferences = [];
    const persistenceCalls = [];
    const forbiddenDatabaseCalls = [];
    walk(ast, (node, ancestors) => {
        if (node.type === 'CallExpression') {
            const call = calleePath(node.callee);
            if (call.endsWith('ProductionImportRoutePolicy.resolveProductionImportRoute')) {
                routeCalls.push(node.loc.start.line);
                if (
                    !propertyAncestor(ancestors, 'resolveProductionRoute') ||
                    !callAncestor(
                        ancestors,
                        'window.Qisi.ProductionImportBridge.createProductionImportBridge'
                    )
                ) {
                    errors.push(`route policy used outside Bridge composition at ${node.loc.start.line}`);
                }
            }
            if (call === 'draftPersistenceService.persistReviewDraftBatch') {
                persistenceCalls.push(node.loc.start.line);
                if (
                    !propertyAncestor(ancestors, 'persistReviewDraftBatch') ||
                    !callAncestor(
                        ancestors,
                        'window.Qisi.ProductionImportBridge.createProductionImportBridge'
                    )
                ) {
                    errors.push(`review persistence lifecycle in app at ${node.loc.start.line}`);
                }
            }
            if (
                /^db\.(?:draftQuestions|draftImages|draftImportBatches|questions)\./.test(call) &&
                /\.(?:put|add|bulkPut|update|delete|bulkDelete|clear)$/.test(call)
            ) forbiddenDatabaseCalls.push(`${call}@${node.loc.start.line}`);
            if (call === 'batchFormalSubmit.submit') {
                errors.push(`direct formal submit in app at ${node.loc.start.line}`);
            }
        }
        if (
            node.type === 'MemberExpression' &&
            calleePath(node).endsWith('Qisi.QuestionDuplicatePolicy')
        ) {
            duplicateReferences.push(node.loc.start.line);
            if (
                !propertyAncestor(ancestors, 'duplicatePolicy') ||
                !callAncestor(ancestors, 'Qisi.StorageRepository.createRepository')
            ) {
                errors.push(`duplicate policy used outside repository composition at ${node.loc.start.line}`);
            }
        }
    });
    if (routeCalls.length !== 1) {
        errors.push(`expected one route-policy composition call, found ${routeCalls.length}`);
    }
    if (duplicateReferences.length !== 1) {
        errors.push(`expected one duplicate-policy injection, found ${duplicateReferences.length}`);
    }
    if (persistenceCalls.length !== 1) {
        errors.push(`expected one Bridge persistence port, found ${persistenceCalls.length}`);
    }
    forbiddenDatabaseCalls.forEach(item =>
        errors.push(`Program C database mutation in app: ${item}`)
    );
}

function verifyAppShellArchitecture(options = {}) {
    const appSource = fs.readFileSync(options.appPath || APP_PATH, 'utf8');
    const matrix = JSON.parse(fs.readFileSync(
        options.matrixPath || MATRIX_PATH,
        'utf8'
    ));
    const owners = JSON.parse(fs.readFileSync(
        options.ownersPath || OWNERS_PATH,
        'utf8'
    ));
    const ast = acorn.parse(appSource, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        locations: true
    });
    const definitions = collectDefinitions(ast);
    const errors = [];
    const requiredOwners = new Set([
        'production-import-route-policy',
        'question-duplicate-policy',
        'review-workflow',
        'draft-maintenance',
        'ui-shell'
    ]);
    const ownerIds = new Set(owners.owners.map(owner => owner.ownerId));
    for (const ownerId of requiredOwners) {
        if (!ownerIds.has(ownerId)) errors.push(`owner manifest missing ${ownerId}`);
    }
    if (matrix.decision !== 'APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED') {
        errors.push('responsibility matrix decision is not accepted');
    }
    for (const item of matrix.functions) {
        const matches = definitions.get(item.name) || [];
        if (matches.length !== 1) {
            errors.push(`${item.name} definition count ${matches.length}`);
            continue;
        }
        const definition = matches[0];
        const range = [definition.loc.start.line, definition.loc.end.line];
        if (range[0] !== item.range[0] || range[1] !== item.range[1]) {
            errors.push(`${item.name} range ${range.join('-')} != ${item.range.join('-')}`);
        }
        const lineCount = range[1] - range[0] + 1;
        if (lineCount > matrix.maxWrapperLines) {
            errors.push(`${item.name} exceeds ${matrix.maxWrapperLines} lines`);
        }
        const calls = directCalls(definition);
        const allowed = new Set(item.allowedCalls);
        for (const call of calls) {
            if (!allowed.has(call.path)) {
                errors.push(`${item.name} unowned call ${call.path}@${call.line}`);
            }
            if (item.forbiddenCalls.includes(call.path)) {
                errors.push(`${item.name} forbidden call ${call.path}@${call.line}`);
            }
        }
    }
    verifyCompositionOnlyUses(ast, errors);
    const fixtureTokens = [
        'testFixture',
        'fixtureTransport',
        'prebuiltCandidates',
        'createFixtureImportRunner',
        'runFixtureImport',
        'ImportAdapterRegistry'
    ].filter(token => appSource.includes(token));
    fixtureTokens.forEach(token => errors.push(`fixture token in app: ${token}`));
    const result = Object.freeze({
        decision: errors.length
            ? 'APP_SHELL_CORRECTIVE_CLOSURE_BLOCKED'
            : 'APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED',
        functionCount: matrix.functions.length,
        errors: Object.freeze(errors)
    });
    return result;
}

if (require.main === module) {
    const result = verifyAppShellArchitecture();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.errors.length) process.exitCode = 1;
}

module.exports = {
    calleePath,
    directCalls,
    verifyAppShellArchitecture
};

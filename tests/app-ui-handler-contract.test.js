const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_HTML = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const COMPONENT_SOURCE = fs.readFileSync(path.join(ROOT, 'qisi-components.js'), 'utf8');

const EXPECTED_CLICK_BINDING_COUNT = 139;
const EXPECTED_ACTIONABLE_CLICK_EXPRESSION_COUNT = 137;
const EXPECTED_DISTINCT_CLICK_EXPRESSION_COUNT = 117;
const EXPECTED_BINDING_COUNTS_BY_TEMPLATE = {
    'knowledge-tree-tpl': 6,
    'question-card-tpl': 6,
    'app-tpl': 127
};
const EXPECTED_CLICK_MANIFEST_SHA256 = 'cfef31d0358e86662980549ca4d3be7963aaf825f5e718d735ce3f7541d38349';

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

const readTagAt = (html, start) => {
    let quote = '';
    for (let cursor = start + 1; cursor < html.length; cursor += 1) {
        const char = html[cursor];
        if (quote) {
            if (char === quote && html[cursor - 1] !== '\\') quote = '';
            continue;
        }
        if (char === '"' || char === "'") quote = char;
        else if (char === '>') return { text: html.slice(start, cursor + 1), end: cursor };
    }
    throw new Error(`unterminated HTML tag at line ${lineAt(html, start)}`);
};

const parseTag = (tagText) => {
    const closing = /^<\s*\//.test(tagText);
    const nameMatch = tagText.match(/^<\s*\/?\s*([^\s/>]+)/);
    const name = nameMatch ? nameMatch[1].toLowerCase() : '';
    const attributes = new Map();
    let cursor = nameMatch ? nameMatch[0].length : tagText.length;

    if (!closing) {
        while (cursor < tagText.length) {
            while (/\s/.test(tagText[cursor] || '')) cursor += 1;
            if (tagText[cursor] === '>' || tagText[cursor] === '/') break;
            const nameStart = cursor;
            while (cursor < tagText.length && !/[\s=/>]/.test(tagText[cursor])) cursor += 1;
            const attributeName = tagText.slice(nameStart, cursor).toLowerCase();
            while (/\s/.test(tagText[cursor] || '')) cursor += 1;

            let value = '';
            if (tagText[cursor] === '=') {
                cursor += 1;
                while (/\s/.test(tagText[cursor] || '')) cursor += 1;
                const quote = tagText[cursor];
                if (quote === '"' || quote === "'") {
                    cursor += 1;
                    const valueStart = cursor;
                    while (cursor < tagText.length && tagText[cursor] !== quote) cursor += 1;
                    value = tagText.slice(valueStart, cursor);
                    if (tagText[cursor] === quote) cursor += 1;
                } else {
                    const valueStart = cursor;
                    while (cursor < tagText.length && !/[\s>]/.test(tagText[cursor])) cursor += 1;
                    value = tagText.slice(valueStart, cursor);
                }
            }
            if (attributeName) attributes.set(attributeName, value);
        }
    }

    return {
        name,
        closing,
        selfClosing: /\/\s*>$/.test(tagText),
        attributes
    };
};

const isClickAttribute = (name) => (
    name === '@click' ||
    name.startsWith('@click.') ||
    name === 'v-on:click' ||
    name.startsWith('v-on:click.')
);

const collectTemplateClickBindings = (html) => {
    const bindings = [];
    const templateScopes = [];
    let cursor = 0;

    while (cursor < html.length) {
        const start = html.indexOf('<', cursor);
        if (start < 0) break;
        if (html.startsWith('<!--', start)) {
            const commentEnd = html.indexOf('-->', start + 4);
            assert.ok(commentEnd >= 0, `unterminated HTML comment at line ${lineAt(html, start)}`);
            cursor = commentEnd + 3;
            continue;
        }

        const { text, end } = readTagAt(html, start);
        const tag = parseTag(text);
        if (!tag.name) {
            cursor = end + 1;
            continue;
        }

        if (tag.closing) {
            if (tag.name === 'template') templateScopes.pop();
            cursor = end + 1;
            continue;
        }

        if (tag.name === 'template') {
            templateScopes.push(tag.attributes.get('id') || templateScopes.at(-1) || '');
        }
        const templateId = templateScopes.at(-1) || '';
        for (const [attribute, expression] of tag.attributes) {
            if (!isClickAttribute(attribute)) continue;
            bindings.push({
                templateId,
                tag: tag.name,
                attribute,
                expression: expression.trim(),
                line: lineAt(html, start)
            });
        }
        if (tag.name === 'template' && tag.selfClosing) templateScopes.pop();
        cursor = end + 1;
    }

    return bindings;
};

const previousSignificantCharacter = (source, index) => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (!/\s/.test(source[cursor])) return source[cursor];
    }
    return '';
};

const skipQuoted = (source, start, quote) => {
    for (let cursor = start + 1; cursor < source.length; cursor += 1) {
        if (source[cursor] === '\\') cursor += 1;
        else if (source[cursor] === quote) return cursor;
    }
    return source.length - 1;
};

const skipRegexLiteral = (source, start) => {
    let inCharacterClass = false;
    for (let cursor = start + 1; cursor < source.length; cursor += 1) {
        const char = source[cursor];
        if (char === '\\') cursor += 1;
        else if (char === '[') inCharacterClass = true;
        else if (char === ']') inCharacterClass = false;
        else if (char === '/' && !inCharacterClass) {
            while (/[a-z]/i.test(source[cursor + 1] || '')) cursor += 1;
            return cursor;
        }
    }
    return source.length - 1;
};

const regexCanStartAfter = (char) => !char || /[({[=,:;!?&|+*%^~<>-]/.test(char);

const scanJavascript = (source, visitor) => {
    for (let cursor = 0; cursor < source.length; cursor += 1) {
        const char = source[cursor];
        const next = source[cursor + 1] || '';
        if (char === "'" || char === '"' || char === '`') {
            cursor = skipQuoted(source, cursor, char);
        } else if (char === '/' && next === '/') {
            const end = source.indexOf('\n', cursor + 2);
            cursor = end < 0 ? source.length : end;
        } else if (char === '/' && next === '*') {
            const end = source.indexOf('*/', cursor + 2);
            cursor = end < 0 ? source.length : end + 1;
        } else if (char === '/' && regexCanStartAfter(previousSignificantCharacter(source, cursor))) {
            cursor = skipRegexLiteral(source, cursor);
        } else {
            visitor(char, cursor);
        }
    }
};

const findMatchingBrace = (source, openIndex) => {
    let depth = 0;
    let closeIndex = -1;
    scanJavascript(source.slice(openIndex), (char, relativeIndex) => {
        if (closeIndex >= 0) return;
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) closeIndex = openIndex + relativeIndex;
        }
    });
    return closeIndex;
};

const splitTopLevel = (source, delimiter) => {
    const parts = [];
    let start = 0;
    let round = 0;
    let square = 0;
    let curly = 0;
    scanJavascript(source, (char, index) => {
        if (char === '(') round += 1;
        else if (char === ')') round -= 1;
        else if (char === '[') square += 1;
        else if (char === ']') square -= 1;
        else if (char === '{') curly += 1;
        else if (char === '}') curly -= 1;
        else if (char === delimiter && round === 0 && square === 0 && curly === 0) {
            parts.push(source.slice(start, index));
            start = index + 1;
        }
    });
    parts.push(source.slice(start));
    return parts;
};

const extractSetupReturnKeys = (source, templateId) => {
    const templateMarker = `template: '#${templateId}'`;
    const templateIndex = source.indexOf(templateMarker);
    assert.ok(templateIndex >= 0, `missing component template marker ${templateMarker}`);

    let searchBefore = templateIndex;
    while (searchBefore >= 0) {
        const returnIndex = source.lastIndexOf('return {', searchBefore);
        assert.ok(returnIndex >= 0, `missing setup return object for #${templateId}`);
        const openIndex = source.indexOf('{', returnIndex);
        const closeIndex = findMatchingBrace(source, openIndex);
        if (closeIndex >= 0 && closeIndex < templateIndex) {
            const body = source.slice(openIndex + 1, closeIndex);
            const keys = splitTopLevel(body, ',')
                .map(part => part.replace(/^\s*(?:(?:\/\/[^\n]*\n)|(?:\/\*[\s\S]*?\*\/))*/g, '').trim())
                .map(part => part.match(/^([A-Za-z_$][\w$]*)\s*(?=:|$|\()/)?.[1])
                .filter(Boolean);
            return new Set(keys);
        }
        searchBefore = returnIndex - 1;
    }
    throw new Error(`unable to find setup return object for #${templateId}`);
};

const classifyExpression = (expression) => {
    if (!expression) return 'modifier-only';
    const statements = splitTopLevel(expression, ';').map(value => value.trim()).filter(Boolean);
    if (statements.length > 1) return 'compound';
    if (/^[A-Za-z_$][\w$]*$/.test(expression)) return 'simple-handler';
    if (/^[A-Za-z_$][\w$]*\s*\([\s\S]*\)$/.test(expression)) return 'direct-handler-call';
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])*\s*=(?!=)/.test(expression)) return 'assignment';
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*\(/.test(expression)) return 'member-call';
    return 'inline-expression';
};

const resolvableReferences = (expression) => {
    const references = [];
    for (const statement of splitTopLevel(expression, ';').map(value => value.trim()).filter(Boolean)) {
        const handler = statement.match(/^([A-Za-z_$][\w$]*)\s*(?:\([\s\S]*\))?$/);
        if (handler) {
            references.push({ name: handler[1], kind: 'handler' });
        }
    }
    return references;
};

test('template click bindings resolve simple setup handlers and expose an auditable manifest', t => {
    const bindings = collectTemplateClickBindings(MAIN_HTML);
    const setupScopes = new Map([
        ['knowledge-tree-tpl', extractSetupReturnKeys(COMPONENT_SOURCE, 'knowledge-tree-tpl')],
        ['question-card-tpl', extractSetupReturnKeys(COMPONENT_SOURCE, 'question-card-tpl')],
        ['app-tpl', extractSetupReturnKeys(APP_SOURCE, 'app-tpl')]
    ]);
    const unresolved = [];
    const auditByTemplate = {};

    for (const binding of bindings) {
        const setupKeys = setupScopes.get(binding.templateId);
        assert.ok(setupKeys, `click binding at main.html:${binding.line} has no declared component scope`);
        const classification = classifyExpression(binding.expression);
        const audit = auditByTemplate[binding.templateId] ||= {
            bindingCount: 0,
            classificationCounts: {},
            resolvedReferences: new Set(),
            inlineExpressionsByClassification: {}
        };
        audit.bindingCount += 1;
        audit.classificationCounts[classification] = (audit.classificationCounts[classification] || 0) + 1;
        if (classification !== 'simple-handler' && classification !== 'direct-handler-call') {
            const expressions = audit.inlineExpressionsByClassification[classification] ||= new Set();
            expressions.add(binding.expression || '(modifier-only)');
        }

        for (const reference of resolvableReferences(binding.expression)) {
            if (setupKeys.has(reference.name)) audit.resolvedReferences.add(reference.name);
            else unresolved.push({ ...binding, ...reference });
        }
    }

    const actionableExpressions = bindings.filter(binding => binding.expression);
    const distinctActionableExpressions = new Set(actionableExpressions.map(binding => binding.expression));
    const canonicalManifest = bindings.map(({ templateId, tag, attribute, expression }) => ({
        templateId,
        tag,
        attribute,
        expression
    }));
    const digest = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalManifest))
        .digest('hex');
    const auditOutput = Object.fromEntries(Object.entries(auditByTemplate).map(([templateId, audit]) => [
        templateId,
        {
            bindingCount: audit.bindingCount,
            classificationCounts: audit.classificationCounts,
            resolvedReferences: [...audit.resolvedReferences].sort(),
            inlineExpressionsByClassification: Object.fromEntries(
                Object.entries(audit.inlineExpressionsByClassification).map(([classification, expressions]) => [
                    classification,
                    [...expressions].sort()
                ])
            )
        }
    ]));

    t.diagnostic(`UI click binding audit: ${JSON.stringify(auditOutput)}`);
    assert.equal(bindings.length, EXPECTED_CLICK_BINDING_COUNT, 'click binding inventory changed');
    assert.deepEqual(
        Object.fromEntries(Object.entries(auditOutput).map(([templateId, audit]) => [templateId, audit.bindingCount])),
        EXPECTED_BINDING_COUNTS_BY_TEMPLATE,
        'click bindings moved between component scopes'
    );
    assert.equal(
        actionableExpressions.length,
        EXPECTED_ACTIONABLE_CLICK_EXPRESSION_COUNT,
        'actionable click expression inventory changed'
    );
    assert.equal(
        distinctActionableExpressions.size,
        EXPECTED_DISTINCT_CLICK_EXPRESSION_COUNT,
        'distinct click expression inventory changed'
    );
    assert.deepEqual(unresolved, [], 'simple handlers referenced by @click must be returned from their setup scope');
    assert.equal(digest, EXPECTED_CLICK_MANIFEST_SHA256, 'parsed click binding manifest changed');
});

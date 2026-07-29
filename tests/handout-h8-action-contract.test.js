'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(
    path.join(ROOT, 'handout.html'),
    'utf8'
);
const appSource = fs.readFileSync(
    path.join(ROOT, 'qisi-handout-app.js'),
    'utf8'
);

const escapeRegExp = value => value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
);

test('H8 every handout click binding resolves to a real action', () => {
    const bindings = [
        ...html.matchAll(/@click="([^"]+)"/g)
    ].map(match => match[1].trim());
    const expressions = [...new Set(bindings)].sort();
    const methodNames = [...new Set(
        expressions
            .map(expression => expression.match(
                /^([A-Za-z_$][\w$]*)(?:\s*\(|$)/
            )?.[1])
            .filter(Boolean)
    )].sort();
    const assignments = expressions.filter(
        expression => !/^[A-Za-z_$][\w$]*(?:\s*\(|$)/.test(expression)
    );

    assert.equal(bindings.length, 67);
    assert.equal(expressions.length, 65);
    assert.deepEqual(
        assignments.map(expression =>
            expression.match(/^([A-Za-z_$][\w$]*)/)?.[1]
        ).sort(),
        [
            'batchPanelOpen',
            'confirmDialog',
            'globalTab',
            'globalTab',
            'globalTab',
            'globalTab',
            'inspectorTab',
            'notice',
            'questionModal',
            'revisionModal',
            'viewMode'
        ].sort()
    );

    for (const methodName of methodNames) {
        assert.match(
            appSource,
            new RegExp(
                `\\n\\s+(?:async\\s+)?${escapeRegExp(methodName)}\\s*\\(`
            ),
            `${methodName} must be implemented by the handout app`
        );
    }
});

test('H8 clickable handout buttons expose an accessible label', () => {
    const buttons = [
        ...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)
    ].filter(match => /@click=/.test(match[1]));

    assert.ok(buttons.length >= 60);
    for (const [, attributes, body] of buttons) {
        const explicitLabel = /\b(?:aria-label|title|data-testid)=/.test(
            attributes
        );
        const visibleLabel = body
            .replace(/<[^>]+>/g, ' ')
            .replace(/\{\{[\s\S]*?\}\}/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        assert.equal(
            explicitLabel || Boolean(visibleLabel),
            true,
            `button has no accessible label: ${attributes.trim()}`
        );
    }
});

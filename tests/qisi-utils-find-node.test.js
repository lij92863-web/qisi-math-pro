const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { findNode } = require('../qisi-utils.js');

describe('findNode', () => {
    const tree = [
        {
            id: 'algebra',
            name: '代数',
            children: [
                { id: 'function', name: '函数' },
                {
                    id: 'sequence',
                    name: '数列',
                    children: [
                        { id: 'arithmetic', name: '等差数列' }
                    ]
                }
            ]
        },
        {
            id: 'geometry',
            name: '几何',
            children: [
                { id: 'triangle', name: '三角形' }
            ]
        }
    ];

    it('normal input: returns a top-level node', () => {
        assert.equal(findNode(tree, '几何'), tree[1]);
    });

    it('nested input: returns the first matching descendant', () => {
        assert.equal(findNode(tree, '等差数列'), tree[0].children[1].children[0]);
    });

    it('empty input: returns null for empty node list', () => {
        assert.equal(findNode([], '函数'), null);
    });

    it('null input: returns null', () => {
        assert.equal(findNode(null, '函数'), null);
    });

    it('undefined input: returns null', () => {
        assert.equal(findNode(undefined, '函数'), null);
    });

    it('whitespace and punctuation: matches exact name only', () => {
        assert.equal(findNode(tree, ' 函数 '), null);
        assert.equal(findNode(tree, '函数.'), null);
    });

    it('malformed input: skips nullish nodes safely', () => {
        const mixed = [null, { name: '有效节点' }, undefined];
        assert.deepEqual(findNode(mixed, '有效节点'), mixed[1]);
    });

    it('representative project case: active knowledge lookup', () => {
        const result = findNode(tree, '数列');
        assert.equal(result.id, 'sequence');
    });

    it('boundary case: duplicate names return first depth-first match', () => {
        const duplicated = [
            { name: '重复', id: 1 },
            { name: '父级', children: [{ name: '重复', id: 2 }] }
        ];
        assert.equal(findNode(duplicated, '重复').id, 1);
    });

    it('no mutation: tree shape is unchanged', () => {
        const before = JSON.stringify(tree);
        findNode(tree, '三角形');
        assert.equal(JSON.stringify(tree), before);
    });

    it('output shape consistency: returns object or null', () => {
        assert.equal(typeof findNode(tree, '函数'), 'object');
        assert.equal(findNode(tree, '不存在'), null);
    });

    it('app.js injects the Qisi Utils helper into the library selector', () => {
        const rootDir = path.join(__dirname, '..');
        const app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
        const libraryState = fs.readFileSync(path.join(rootDir, 'qisi-library-view-state.js'), 'utf8');
        assert.match(app, /findNode:\s*window\.Qisi\.Utils\.findNode/);
        assert.match(libraryState, /const\s+targetNode\s*=\s*findNode\(knowledgeTree,\s*activeKnowledge\)/);
        assert.doesNotMatch(app, /const\s+findNode\s*=/);
    });
});

(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.KnowledgeTreeState = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const buildPersonalTreeRows = tree => {
            const rows = [];

            const walk = (nodes, level, parent = null, grandParent = null) => {
                (nodes || []).forEach(node => {
                    const children = Array.isArray(node.children) ? node.children : [];
                    rows.push({
                        node,
                        level,
                        parent,
                        grandParent,
                        hasChildren: children.length > 0
                    });

                    if (children.length > 0 && node.expanded !== false) {
                        walk(
                            children,
                            level + 1,
                            node,
                            level === 1 ? node : grandParent
                        );
                    }
                });
            };

            walk(tree, 1);
            return rows;
        };

        const findPersonalNodeById = (tree, id) => {
            for (const node of tree || []) {
                if (node.id === id) return node;
                if (Array.isArray(node.children)) {
                    const child = findPersonalNodeById(node.children, id);
                    if (child) return child;
                }
            }
            return null;
        };

        const updateNodeByIdentity = (nodes, target, update) => {
            if (!Array.isArray(nodes)) return nodes;

            let result = nodes;
            for (let index = 0; index < nodes.length; index += 1) {
                const node = nodes[index];
                let nextNode = node;

                if (node === target) {
                    nextNode = update(node);
                } else if (Array.isArray(node?.children)) {
                    const nextChildren = updateNodeByIdentity(
                        node.children,
                        target,
                        update
                    );
                    if (nextChildren !== node.children) {
                        nextNode = {
                            ...node,
                            children: nextChildren
                        };
                    }
                }

                if (nextNode !== node) {
                    if (result === nodes) result = nodes.slice();
                    result[index] = nextNode;
                }
            }

            return result;
        };

        const appendPersonalNode = (tree, parent, node) => {
            if (parent === null) return [...tree, node];

            return updateNodeByIdentity(tree, parent, current => {
                const children = current.children || [];
                if (!Array.isArray(children)) {
                    throw new TypeError('personal knowledge node children must be an array');
                }

                return {
                    ...current,
                    children: [...children, node],
                    expanded: true
                };
            });
        };

        const togglePersonalNodeExpanded = (tree, target) => (
            updateNodeByIdentity(tree, target, node => ({
                ...node,
                expanded: node.expanded === false
            }))
        );

        const renamePersonalNode = (tree, target, name) => (
            updateNodeByIdentity(
                tree,
                target,
                node => node.name === name
                    ? node
                    : { ...node, name }
            )
        );

        const deletePersonalNode = (tree, level, id, parentId = '') => {
            if (level === 1) {
                const nextTree = tree.filter(node => node.id !== id);
                return nextTree.length === tree.length ? tree : nextTree;
            }

            if (level === 2) {
                const parentIndex = tree.findIndex(node => node.id === parentId);
                if (parentIndex < 0) return tree;

                const parent = tree[parentIndex];
                const children = parent.children || [];
                const nextParent = {
                    ...parent,
                    children: children.filter(node => node.id !== id)
                };
                const nextTree = tree.slice();
                nextTree[parentIndex] = nextParent;
                return nextTree;
            }

            let nextTree = tree;
            for (let rootIndex = 0; rootIndex < tree.length; rootIndex += 1) {
                const rootNode = tree[rootIndex];
                const children = rootNode.children;
                if (children === null || children === undefined) continue;

                const parentIndex = children.findIndex(node => node.id === parentId);
                if (parentIndex < 0) continue;

                const parent = children[parentIndex];
                const parentChildren = parent.children || [];
                const nextParent = {
                    ...parent,
                    children: parentChildren.filter(node => node.id !== id)
                };
                const nextChildren = children.slice();
                nextChildren[parentIndex] = nextParent;
                const nextRoot = {
                    ...rootNode,
                    children: nextChildren
                };

                if (nextTree === tree) nextTree = tree.slice();
                nextTree[rootIndex] = nextRoot;
            }

            return nextTree;
        };

        return {
            appendPersonalNode,
            buildPersonalTreeRows,
            deletePersonalNode,
            findPersonalNodeById,
            renamePersonalNode,
            togglePersonalNodeExpanded
        };
    }
);

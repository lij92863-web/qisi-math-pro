(function initPersonalKnowledgeModel(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PersonalKnowledgeModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Personal knowledge tree: row flattening for the UI and node shapes for the
    // three levels. The page still mutates the reactive tree and persists it.

    const flattenRows = (nodes, level = 1, parent = null, grandParent = null, rows = []) => {
        (Array.isArray(nodes) ? nodes : []).forEach(node => {
            const children = Array.isArray(node.children) ? node.children : [];
            rows.push({ node, level, parent, grandParent, hasChildren: children.length > 0 });
            if (children.length > 0 && node.expanded !== false) {
                flattenRows(children, level + 1, node, level === 1 ? node : grandParent, rows);
            }
        });
        return rows;
    };

    const buildNode = ({ id, name, level } = {}) => {
        if (!id || !String(name).trim()) {
            const error = new Error('PERSONAL_KNOWLEDGE_NODE_INVALID');
            error.code = 'PERSONAL_KNOWLEDGE_NODE_INVALID';
            throw error;
        }
        if (Number(level) === 3) return { id, name };
        return { id, name, children: [], expanded: true };
    };

    return Object.freeze({ flattenRows, buildNode });
});

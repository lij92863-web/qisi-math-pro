(function initPersonalKnowledgeModel(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PersonalKnowledgeModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Personal tree state and transactional commands; publish only durable tree receipts.

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

    const cloneTree = nodes => JSON.parse(JSON.stringify(Array.isArray(nodes) ? nodes : []));
    const flattenPaths = (tree, prefix = []) => (tree || []).flatMap(node => {
        const path = [...prefix, node.name];
        return [{ id: node.id, name: node.name, path: path.join(' / ') }, ...flattenPaths(node.children || [], path)];
    });
    const locateNode = (nodes, id, parent = null, level = 1) => {
        for (const node of nodes || []) {
            if (node.id === id) return { node, parent, level, siblings: nodes };
            const found = locateNode(node.children, id, node, level + 1);
            if (found) return found;
        }
        return null;
    };
    const treeError = message => { const error = new Error(message); error.code = 'PERSONAL_KNOWLEDGE_COMMAND_INVALID'; throw error; };
    const applyTreeCommand = (nodes, command) => {
        if (!Array.isArray(nodes)) treeError('知识点树结构无效，已停止写入。');
        const tree = cloneTree(nodes), name = String(command.name || '').trim();
        const ids = flattenPaths(tree).map(node => node.id);
        if (ids.some(id => !id) || new Set(ids).size !== ids.length) treeError('知识点标识重复或缺失，已停止写入。');
        if (command.kind === 'add') {
            if (![1, 2, 3].includes(command.level) || !name || !command.id || locateNode(tree, command.id)) treeError('知识点名称、级别或标识无效。');
            const parent = command.level === 1 ? null : locateNode(tree, command.parentId);
            if (command.level !== 1 && (!parent || parent.level !== command.level - 1)) treeError('所选上级知识点已不存在，请重新选择。');
            if (command.level === 3 && parent.parent?.id !== command.rootId) treeError('二级知识点不属于所选一级方向。');
            const node = buildNode({ id: command.id, name, level: command.level });
            if (parent) { parent.node.children = parent.node.children || []; parent.node.children.push(node); parent.node.expanded = true; }
            else tree.push(node);
            return { tree, node };
        }
        const target = locateNode(tree, command.id);
        if (!target || target.level !== command.level || (target.parent?.id || '') !== (command.parentId || '')) treeError('知识点层级或上级已变化，请重新选择。');
        if (command.expectedNode && JSON.stringify(target.node) !== JSON.stringify(command.expectedNode)) treeError('知识点已被其他操作修改，请刷新后重试。');
        if (command.kind === 'rename') { if (!name) treeError('知识点名称不能为空。'); target.node.name = name; }
        else if (command.kind === 'toggle') target.node.expanded = target.node.expanded === false;
        else if (command.kind === 'delete') target.siblings.splice(target.siblings.findIndex(node => node.id === command.id), 1);
        else treeError('未知知识点操作。');
        return { tree, node: target.node };
    };
    const createState = ({ ref }) => Object.freeze({ tree: ref([]), name1: ref(''), name2: ref(''), name3: ref(''), selected1: ref(''), selected2: ref('') });
    const createWorkspace = ({ state, repository, prompt, confirm, notify, countTree, getKnowledge,
        clock = Date.now, random = Math.random } = {}) => {
        let pending = null, disposed = false, initialized = false, delayedInitial = null, sequence = 0;
        const tell = message => { if (!disposed) notify(message); };
        const acceptLoadedTree = nodes => {
            if (disposed || initialized) return false;
            if (pending) { delayedInitial = cloneTree(nodes); return false; }
            state.tree.value = cloneTree(nodes); initialized = true; return true;
        };
        const reconcileSelection = () => {
            const root = state.tree.value.find(node => node.id === state.selected1.value);
            if (!root) { state.selected1.value = ''; state.selected2.value = ''; }
            else if (!(root.children || []).some(node => node.id === state.selected2.value)) state.selected2.value = '';
        };
        const commit = (key, command, afterPublish = () => {}) => {
            if (disposed) return Promise.resolve(false);
            if (pending) {
                if (pending.key === key) return pending.promise;
                tell('知识点正在保存，请完成后再操作。'); return Promise.resolve(false);
            }
            const entry = { key }; pending = entry;
            entry.promise = Promise.resolve().then(() => {
                if (disposed) return false;
                return repository.updatePersonalKnowledgeTree(nodes => applyTreeCommand(nodes, command).tree, clock());
            }).then(nodes => {
                if (nodes === false || disposed) return false;
                state.tree.value = cloneTree(nodes); initialized = true; delayedInitial = null;
                afterPublish(); reconcileSelection(); return true;
            }).catch(error => { tell(`知识点保存失败，当前内容已保留：${error?.message || error}`); return false; })
                .finally(() => {
                    if (pending === entry) pending = null;
                    if (!initialized && delayedInitial && !disposed) { const initial = delayedInitial; delayedInitial = null; acceptLoadedTree(initial); }
                });
            return entry.promise;
        };
        const add = (level, parentId, rootId, name, clearInput) => {
            name = String(name || '').trim(); if (!name) return Promise.resolve(false);
            const selected = [state.selected1.value, state.selected2.value];
            const id = `pk_${clock()}_${++sequence}_${random().toString(36).slice(2, 6)}`;
            return commit(`add:${level}`, { kind: 'add', level, parentId, rootId, name, id }, () => {
                if (state.selected1.value === selected[0] && state.selected2.value === selected[1]) {
                    if (level === 1) { state.selected1.value = id; state.selected2.value = ''; }
                    if (level === 2) { state.selected1.value = parentId; state.selected2.value = id; }
                    if (level === 3) { state.selected1.value = rootId; state.selected2.value = parentId; }
                }
                if (clearInput && state[clearInput].value.trim() === name) state[clearInput].value = '';
            });
        };
        const create1 = () => add(1, '', '', state.name1.value, 'name1');
        const create2 = () => add(2, state.selected1.value, state.selected1.value, state.name2.value, 'name2');
        const create3 = () => add(3, state.selected2.value, state.selected1.value, state.name3.value, 'name3');
        const addChild = row => {
            const found = locateNode(state.tree.value, row?.node?.id);
            if (!found || found.level >= 3) { tell('请重新选择有效的上级知识点。'); return Promise.resolve(false); }
            const name = prompt(found.level === 1 ? '二级方向名称' : '三级知识点名称', '');
            if (!name?.trim()) return Promise.resolve(false);
            return add(found.level + 1, found.node.id, found.level === 1 ? found.node.id : found.parent.id, name);
        };
        const nodeCommand = (kind, node, name) => {
            const found = locateNode(state.tree.value, node?.id);
            if (!found) { tell('知识点已不存在，请重新选择。'); return Promise.resolve(false); }
            return commit(`${kind}:${node.id}`, { kind, id: node.id, level: found.level, parentId: found.parent?.id || '', name,
                expectedNode: JSON.parse(JSON.stringify(found.node)) });
        };
        const rename = node => {
            const name = prompt('新的知识点名称', node?.name || '');
            return name?.trim() ? nodeCommand('rename', node, name) : Promise.resolve(false);
        };
        const toggle = node => nodeCommand('toggle', node);
        const remove = (level, id, parentId = '') => {
            const found = locateNode(state.tree.value, id);
            if (!found || found.level !== level || (found.parent?.id || '') !== parentId) { tell('知识点层级或上级已变化，请重新选择。'); return Promise.resolve(false); }
            if (!confirm('确定删除这个知识点及其下级吗？')) return Promise.resolve(false);
            return nodeCommand('delete', found.node);
        };
        const removeRow = row => remove(row.level, row.node.id, row.parent?.id || '');
        const counts = questions => countTree(state.tree.value, 'personal', questions, getKnowledge);
        const dispose = () => { disposed = true; delayedInitial = null; };
        return Object.freeze({ acceptLoadedTree, create1, create2, create3, addChild, rename, toggle, remove, removeRow, counts, dispose });
    };

    return Object.freeze({ flattenRows, buildNode, flattenPaths, applyTreeCommand, createState, createWorkspace });
});

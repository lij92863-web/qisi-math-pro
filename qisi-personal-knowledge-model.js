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
    const tagKey = name => String(name || '').normalize('NFKC').trim();
    const conceptKey = name => tagKey(name).replace(/\s+/g, '').replace(/(?:的)?解法$/, '') || tagKey(name);
    const validTag = value => typeof value === 'string' && Boolean(value.trim()) &&
        value.trim().length <= 80 && !/[\\＼\r\n\u0000-\u001f]/u.test(value.trim());
    const parseTags = (input, { maxTags = 3 } = {}) => {
        const names = tagKey(input).split('\\').map(name => name.trim());
        if (names.length > maxTags || names.some(name => !validTag(name))) {
            const error = Number.isFinite(maxTags)
                ? `请填写 1 至 ${maxTags} 个标签，用反斜杠分隔，每个标签最多 80 字。`
                : '请用反斜杠分隔个人知识点，每个名称须有 1 至 80 字。';
            return { names: [], error };
        }
        return { names: [...new Map(names.map(name => [conceptKey(name), name])).values()], error: '' };
    };
    const knowledgeIndex = rows => {
        const exact = new Map(), concepts = new Map();
        for (const node of rows || []) {
            if (!node?.id || !validTag(node.name)) continue;
            const key = tagKey(node.name);
            const concept = conceptKey(node.name);
            if (!exact.has(key)) exact.set(key, []);
            if (!concepts.has(concept)) concepts.set(concept, []);
            exact.get(key).push(node);
            concepts.get(concept).push(node);
        }
        const matches = name => exact.get(tagKey(name)) || concepts.get(conceptKey(name)) || [];
        return Object.freeze({ matches, unique: name => {
            const found = matches(name);
            return found.length === 1 ? found[0] : null;
        } });
    };
    const tagReferences = question => question?.personalKnowledgeIds ?? question?.meta?.personalKnowledgeIds;
    const knowledgeIds = question => {
        const ids = tagReferences(question);
        return [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id.trim()) : [])];
    };
    const grams = value => {
        const chars = [...conceptKey(value)];
        return new Set(chars.slice(1).map((char, index) => chars[index] + char));
    };
    const planReviewMetadata = (payload, rows, allowed) => {
        if (!payload || !Array.isArray(payload.concepts) || payload.concepts.length < 1 || payload.concepts.length > 3 ||
            payload.concepts.some(concept => !validTag(concept?.name)) ||
            Object.keys(allowed).some(field => payload[field] != null && !allowed[field].includes(payload[field]))) return null;
        const index = knowledgeIndex(rows);
        const concepts = [...new Map(payload.concepts.map(concept => [conceptKey(concept.name), concept])).values()];
        const lookup = rows.map(node => ({ node, key: conceptKey(node.name), grams: grams(node.name) }));
        const entries = concepts.map(({ name, aliases }) => {
            name = name.trim();
            const existing = index.unique(name);
            if (existing) return { name, existing, candidates: [] };
            const variants = [name, ...(Array.isArray(aliases) ? aliases.slice(0, 4).filter(validTag) : [])]
                .map(value => ({ key: conceptKey(value), grams: grams(value) }));
            const ranked = [];
            for (const row of lookup) {
                const score = Math.max(...variants.map(variant => {
                    if (row.key === variant.key) return 2;
                    const overlap = [...variant.grams].filter(gram => row.grams.has(gram)).length;
                    return overlap ? 2 * overlap / (variant.grams.size + row.grams.size) : 0;
                }));
                if (score <= 0) continue;
                const position = ranked.findIndex(hit => hit.score < score);
                if (position >= 0) ranked.splice(position, 0, { node: row.node, score });
                else if (ranked.length < 8) ranked.push({ node: row.node, score });
                if (ranked.length > 8) ranked.pop();
            }
            return { name, existing: null, candidates: ranked.map(row => row.node) };
        });
        return { fields: Object.fromEntries(Object.keys(allowed).flatMap(field => payload[field] ? [[field, payload[field]]] : [])), entries };
    };
    const resolveReviewMatches = (plan, response) => {
        const ranked = Array.isArray(response?.matches) ? response.matches : [];
        return plan.entries.map((entry, index) => {
            if (entry.existing) return { name: entry.name, node: entry.existing };
            const matches = ranked.filter(match => match?.index === index);
            const match = matches.length === 1 && matches[0].equivalent === true ? matches[0] : null;
            return { name: entry.name, node: match ? entry.candidates.find(node => node.id === match.id) || null : null };
        });
    };
    const applyTreeCommand = (nodes, command) => {
        if (!Array.isArray(nodes)) treeError('知识点树结构无效，已停止写入。');
        const tree = cloneTree(nodes), name = String(command.name || '').trim();
        const ids = flattenPaths(tree).map(node => node.id);
        if (ids.some(id => !id) || new Set(ids).size !== ids.length) treeError('知识点标识重复或缺失，已停止写入。');
        if (command.kind === 'ensureTags') {
            if (!Array.isArray(command.rows) || command.rows.length < 1 || command.rows.length > 3 ||
                command.rows.some(row => !validTag(row.name) || !row.id || ids.includes(row.id)) ||
                new Set(command.rows.map(row => row.id)).size !== command.rows.length ||
                new Set(command.rows.map(row => conceptKey(row.name))).size !== command.rows.length) treeError('批量标签名称或标识无效。');
            const index = knowledgeIndex(flattenPaths(tree));
            for (const row of command.rows) {
                const matches = index.matches(row.name);
                if (matches.length > 1) treeError('个人知识点中有同名标签，请从知识点菜单选择具体条目。');
                if (!matches.length) tree.push(buildNode({ ...row, level: 1 }));
            }
            return { tree };
        }
        if (command.kind === 'add' || command.kind === 'ensureTag') {
            if (![1, 2, 3].includes(command.level) || !name || !command.id || locateNode(tree, command.id)) treeError('知识点名称、级别或标识无效。');
            if (command.kind === 'ensureTag') {
                const existing = flattenPaths(tree).find(node => tagKey(node.name) === tagKey(name));
                if (existing) return { tree, node: existing };
            }
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
    const resolveQuestionTags = (nodes, rows, { id, name, newId }, previousIds) => {
        if (id) {
            const node = rows.find(row => row.id === id);
            if (!node) treeError('所选个人知识点已不存在，请重新选择。');
            return { selected: [node] };
        }
        if (!String(name || '').trim()) return { selected: [] };
        const { names, error } = parseTags(name, { maxTags: Infinity });
        if (error) treeError(error);
        const rowsByName = new Map();
        for (const row of rows) {
            const key = tagKey(row.name);
            if (!rowsByName.has(key)) rowsByName.set(key, []);
            rowsByName.get(key).push(row);
        }
        const existingIds = new Set(rows.map(row => row.id));
        const added = [];
        const selected = names.map((name, index) => {
            const matches = rowsByName.get(name) || [];
            if (matches.length > 1) {
                const current = matches.filter(row => previousIds.includes(row.id));
                if (current.length === 1) return current[0];
                treeError('个人知识点中有同名标签，请从知识点菜单选择具体条目。');
            }
            if (matches.length) return matches[0];
            const id = index ? `${newId}_${index}` : newId;
            if (!newId || existingIds.has(id)) treeError('知识点标识重复或缺失，已停止写入。');
            const node = buildNode({ id, name, level: 1 });
            added.push(node);
            return node;
        });
        if (added.length && (existingIds.size !== rows.length || rows.some(row => !row.id)))
            treeError('知识点标识重复或缺失，已停止写入。');
        return { selected, tree: added.length ? [...nodes, ...added] : undefined };
    };
    const planQuestionTagEdit = (nodes, question, previous, edit, getKnowledge) => {
        if (!Array.isArray(nodes)) treeError('知识点树结构无效，已停止写入。');
        const rows = flattenPaths(nodes);
        const oldName = getKnowledge(previous, 'personal');
        const oldNameMatches = Array.isArray(tagReferences(previous)) || !oldName
            ? [] : rows.filter(row => tagKey(row.name) === tagKey(oldName));
        const oldIds = oldNameMatches.length === 1 ? [oldNameMatches[0].id] : knowledgeIds(previous);
        const { selected, tree } = resolveQuestionTags(nodes, rows, edit, oldIds);
        const ids = selected.map(node => node.id);
        const released = oldIds.flatMap(id => {
            if (ids.includes(id)) return [];
            const found = locateNode(nodes, id)?.node;
            return found && !found.children?.length ? [found] : [];
        });
        const name = selected[0]?.name || '';
        const previousType = previous?.meta?.knowledgeType || previous?.knowledgeType;
        const fallback = previousType === 'personal' || edit.legacyKnowledge === oldName ? '' : edit.legacyKnowledge;
        const knowledge = name || question.systemKnowledge || fallback || '';
        const fields = { personalKnowledge: name, personalKnowledgeIds: ids, knowledge, knowledgeType: name ? 'personal' : 'system' };
        return { question: { ...question, ...fields, meta: { ...question.meta, ...fields } }, tree, released };
    };
    const questionUsesTag = (question, tag, getKnowledge) => {
        const ids = tagReferences(question);
        return Array.isArray(ids) ? ids.includes(tag.id) : tagKey(getKnowledge(question, 'personal')) === tagKey(tag.name);
    };
    const removeQuestionTags = (nodes, unused) => nodes
        .filter(node => !unused.has(node.id))
        .map(node => node.children?.length ? { ...node, children: removeQuestionTags(node.children, unused) } : node);
    const createState = ({ ref }) => Object.freeze({ tree: ref([]), name1: ref(''), name2: ref(''), name3: ref(''), selected1: ref(''), selected2: ref('') });
    const createWorkspace = ({ state, repository, prompt, confirm, notify, countTree, getKnowledge,
        clock = Date.now, random = Math.random } = {}) => {
        let pending = null, disposed = false, initialized = false, delayedInitial = null, sequence = 0, reloadEpoch = 0;
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
        const reloadTree = async () => {
            const epoch = ++reloadEpoch;
            if (pending) await pending.promise;
            const record = await repository.get('personalKnowledge', 'tree');
            if (disposed || epoch !== reloadEpoch || pending) return false;
            const nodes = Array.isArray(record?.nodes) ? record.nodes : [];
            if (initialized && JSON.stringify(state.tree.value) === JSON.stringify(nodes)) return false;
            state.tree.value = cloneTree(nodes);
            initialized = true;
            reconcileSelection();
            return true;
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
                const bindLegacy = command.kind === 'rename' ? nodes => {
                    const rows = flattenPaths(nodes);
                    const target = rows.find(node => node.id === command.id);
                    return target && rows.filter(node => node.name === target.name).length === 1
                        ? { id: target.id, name: target.name } : null;
                } : undefined;
                return repository.updatePersonalKnowledgeTree(nodes => applyTreeCommand(nodes, command).tree, clock(), bindLegacy);
            }).then(nodes => {
                if (nodes === false || disposed) return false;
                state.tree.value = cloneTree(nodes); initialized = true; delayedInitial = null;
                const result = afterPublish(); reconcileSelection(); return result ?? true;
            }).catch(error => { tell(`知识点保存失败，当前内容已保留：${error?.message || error}`); return false; })
                .finally(() => {
                    if (pending === entry) pending = null;
                    if (!initialized && delayedInitial && !disposed) { const initial = delayedInitial; delayedInitial = null; acceptLoadedTree(initial); }
                });
            return entry.promise;
        };
        const nextId = () => `pk_${clock()}_${++sequence}_${random().toString(36).slice(2, 6)}`;
        const add = (level, parentId, rootId, name, clearInput) => {
            name = String(name || '').trim(); if (!name) return Promise.resolve(false);
            const selected = [state.selected1.value, state.selected2.value];
            const id = nextId();
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
        const ensureTag = raw => {
            const name = String(raw || '').trim().slice(0, 80);
            if (!tagKey(name)) return Promise.resolve(false);
            const key = tagKey(name);
            return commit('ensureTag:' + key, { kind: 'ensureTag', level: 1, name, id: nextId() }, () =>
                flattenPaths(state.tree.value).find(node => tagKey(node.name) === key)?.name || false);
        };
        const ensureTags = raw => {
            const { names, error } = parseTags(raw);
            if (error) return Promise.resolve(false);
            const rows = names.map(name => ({ name, id: nextId() }));
            return commit('ensureTags:' + JSON.stringify(names.map(conceptKey)), { kind: 'ensureTags', rows }, () => {
                const index = knowledgeIndex(flattenPaths(state.tree.value));
                return names.map(name => index.unique(name)).filter(Boolean);
            });
        };
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
        return Object.freeze({ acceptLoadedTree, reloadTree, create1, create2, create3, ensureTag, ensureTags, addChild, rename, toggle, remove, removeRow, counts, dispose });
    };

    const TagField = {
        props: { modelValue: String, nodes: Array, ensureTag: Function },
        emits: ['update:modelValue'],
        data: () => ({ tag: '', savingTag: false }),
        methods: {
            tagKey(event) {
                if (event.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                event.stopPropagation();
                this.tagQuestion();
            },
            async tagQuestion() {
                if (this.savingTag || !this.ensureTag || !this.tag.trim()) return;
                this.savingTag = true;
                try {
                    const name = await this.ensureTag(this.tag);
                    if (name) {
                        this.$emit('update:modelValue', name);
                        this.tag = '';
                    }
                } finally { this.savingTag = false; }
            }
        },
        template: `<div class="material-field qisi-personal-tag">
            <label>个人知识点
                <select aria-label="个人知识点" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                    <option value="">不选择</option>
                    <option v-for="node in nodes" :key="node.id" :value="node.name">{{node.path}}</option>
                </select>
            </label>
            <div v-if="ensureTag" class="qisi-personal-tag-entry">
                <input v-model="tag" maxlength="80" placeholder="输入新标签" aria-label="新个人知识点标签" @keydown.enter="tagKey" :disabled="savingTag">
                <button type="button" class="v-btn" @click="tagQuestion" :disabled="savingTag||!tag.trim()">添加并选中</button>
            </div>
        </div>`
    };

    return Object.freeze({ flattenRows, buildNode, flattenPaths, applyTreeCommand, createState, createWorkspace,
        parseTags, conceptKey, validTag, knowledgeIndex, knowledgeIds, locateNode, planReviewMetadata, resolveReviewMatches,
        planQuestionTagEdit, questionUsesTag, removeQuestionTags,
        install(app) { app.component('personal-knowledge-tag', TagField); }
    });
});

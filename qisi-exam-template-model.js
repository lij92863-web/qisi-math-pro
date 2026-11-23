(function initExamTemplateModel(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ExamTemplateModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Template records: layout config travels with the LaTeX code, because storing
    // only the code loses the teacher's font/size settings.
    const buildCustomTemplate = ({ id, name, code, config, now } = {}) => {
        if (!id || !Number.isFinite(now)) {
            const error = new Error('EXAM_TEMPLATE_RECORD_INVALID');
            error.code = 'EXAM_TEMPLATE_RECORD_INVALID';
            throw error;
        }
        return { id, name, code, config, createdAt: now };
    };

    const buildSystemOverride = ({ name, code, config, now } = {}) => {
        if (!Number.isFinite(now)) {
            const error = new Error('EXAM_TEMPLATE_RECORD_INVALID');
            error.code = 'EXAM_TEMPLATE_RECORD_INVALID';
            throw error;
        }
        return { name, code, config, updatedAt: now };
    };

    const buildCustomTemplateUpdate = ({ name, code, config } = {}) => ({ name, code, config });

    const cloneConfig = value => JSON.parse(JSON.stringify(value || {}));
    const createState = ({ ref, reactive, preferences, defaultKey, layoutPresets, defaultTemplate }) => Object.freeze({
        selected: ref(defaultKey), config: reactive(cloneConfig(layoutPresets[defaultKey].config)),
        templates: ref([]), overrides: ref(preferences.json('qisi_template_overrides', {}) || {}),
        code: ref(preferences.get('qisi_template', defaultTemplate) || defaultTemplate),
        mode: ref('system'), current: ref(''), name: ref('')
    });
    const createWorkspace = ({ state, repository, preferences, presets, layoutPresets, defaultKey, defaultTemplate,
        ensurePackages, notify, titleChanged = () => {}, observeConfig = () => () => {}, observeSelected = () => () => {},
        clock = Date.now, random = Math.random } = {}) => {
        let disposed = false, guarding = 0, pending = null, sequence = 0, templatesLoaded = false, editorTouched = false, layoutTouched = false;
        const tell = message => { if (!disposed) notify(message); };
        const guarded = work => { guarding++; try { return work(); } finally { guarding--; } };
        const signature = () => JSON.stringify([state.code.value, state.name.value, state.mode.value, state.current.value, state.selected.value, state.config]);
        const card = (id, preset = presets[id]) => {
            if (!preset) return null;
            const override = state.overrides.value[id] || {};
            return { id, name: override.name || preset.name, desc: preset.desc, code: override.code || preset.code, system: true };
        };
        const cards = () => [...Object.entries(presets).map(([id, preset]) => card(id, preset)),
            ...state.templates.value.map(tpl => ({ id: tpl.id, name: tpl.name, desc: tpl.desc || '自定义模板', code: tpl.code, system: false }))];
        const examPresets = () => ({
            ...Object.fromEntries(Object.entries(layoutPresets).map(([id, preset]) => {
                const override = state.overrides.value[id] || {};
                return [id, { ...preset, name: override.name || preset.name, desc: presets[id]?.desc || preset.desc,
                    config: { ...preset.config, ...(override.config || {}) } }];
            })),
            ...Object.fromEntries(state.templates.value.map(tpl => [tpl.id, { name: tpl.name, desc: tpl.desc || '自定义模板',
                config: { ...layoutPresets[defaultKey].config, ...(tpl.config || {}), title: tpl.config?.title || tpl.name } }]))
        });
        const acceptLoadedTemplates = records => {
            if (disposed || templatesLoaded || pending) return false;
            state.templates.value = cloneConfig(records || []); templatesLoaded = true; return true;
        };
        const persistLayout = () => {
            const selectedOk = preferences.set('qisi_exam_template', state.selected.value);
            const configOk = preferences.setJson('qisi_exam_config', { template: state.selected.value, config: cloneConfig(state.config) });
            if (selectedOk === false || configOk === false) tell('排版偏好保存失败，当前页面配置仍保留。');
            titleChanged(state.config.title); return selectedOk !== false && configOk !== false;
        };
        const replaceConfig = config => {
            for (const key of Object.keys(state.config)) if (!Object.hasOwn(config, key)) delete state.config[key];
            Object.assign(state.config, cloneConfig(config));
        };
        const applySelected = key => {
            const available = examPresets();
            const next = Object.hasOwn(available, key) ? key : defaultKey;
            guarded(() => {
                state.selected.value = next;
                replaceConfig({ ...layoutPresets[defaultKey].config, ...(available[next]?.config || {}) });
                if (presets[next] && state.mode.value === 'system' && state.current.value !== next) {
                    const selectedCard = card(next); state.current.value = next; state.name.value = selectedCard.name; state.code.value = selectedCard.code;
                }
            });
            persistLayout();
        };
        const stops = [observeConfig(() => { if (!disposed && !guarding) { layoutTouched = true; persistLayout(); } }),
            observeSelected(key => { if (!disposed && !guarding) { editorTouched = true; layoutTouched = true; applySelected(key); } })];
        const restore = () => {
            if (disposed || layoutTouched) return;
            guarded(() => {
                const saved = preferences.get('qisi_exam_template', defaultKey) || defaultKey;
                const exists = Boolean(layoutPresets[saved]) || state.templates.value.some(tpl => tpl.id === saved);
                const key = exists ? saved : defaultKey;
                const raw = exists ? preferences.json('qisi_exam_config', null) : null;
                const config = raw?.template ? (raw.template === key ? raw.config : null) : raw;
                state.selected.value = key;
                replaceConfig({ ...layoutPresets[defaultKey].config, ...(examPresets()[key]?.config || {}), ...(config || {}) });
            });
            titleChanged(state.config.title);
        };
        const restoreEditor = () => {
            if (disposed || editorTouched || state.current.value || state.name.value) return;
            const custom = state.templates.value.find(tpl => tpl.code === state.code.value);
            const system = cards().find(tpl => tpl.system && tpl.code === state.code.value);
            guarded(() => {
                if (custom || system) { const chosen = custom || system; state.mode.value = custom ? 'custom' : 'system'; state.current.value = chosen.id; state.name.value = chosen.name; }
                else { state.mode.value = 'new'; state.current.value = ''; state.name.value = '我的修改模板'; }
            });
        };
        const selectCard = tpl => {
            if (disposed || !tpl) return false;
            const found = tpl.system ? card(tpl.id) : state.templates.value.find(item => item.id === tpl.id);
            if (!found) { tell('模板已不存在，请重新选择。'); return false; }
            editorTouched = true;
            const previous = state.selected.value;
            guarded(() => {
                state.mode.value = tpl.system ? 'system' : 'custom'; state.current.value = tpl.id;
                state.name.value = found.name; state.code.value = found.code;
                if ((tpl.system && layoutPresets[tpl.id]) || !tpl.system) state.selected.value = tpl.id;
                if (state.selected.value !== previous) replaceConfig({ ...layoutPresets[defaultKey].config, ...(examPresets()[state.selected.value]?.config || {}) });
            });
            if (state.selected.value !== previous) { layoutTouched = true; persistLayout(); } return true;
        };
        const selectPreset = key => selectCard(card(key));
        const selectCustom = tpl => selectCard({ ...tpl, system: false });
        const startNew = () => { if (disposed) return; editorTouched = true; guarded(() => { state.mode.value = 'new'; state.current.value = ''; state.name.value = '我的新模板'; state.code.value = defaultTemplate; }); };
        const inputCode = event => { if (!disposed) { editorTouched = true; state.code.value = event.target.value; } };
        const receipt = (kind, record) => {
            const without = state.templates.value.filter(tpl => tpl.id !== record.id);
            state.templates.value = kind === 'delete' ? without : [cloneConfig(record), ...without].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
            templatesLoaded = true;
        };
        const run = (key, work) => {
            if (disposed) return Promise.resolve(false);
            if (pending) { if (pending.key === key) return pending.promise; tell('模板正在保存，请稍后再操作。'); return Promise.resolve(false); }
            const entry = { key }; pending = entry;
            entry.promise = Promise.resolve().then(() => disposed ? false : work()).catch(error => { tell(`模板保存失败，输入已保留：${error?.message || error}`); return false; })
                .finally(() => { if (pending === entry) pending = null; });
            return entry.promise;
        };
        const refresh = async () => {
            try { const records = await repository.listTable('customTemplates', { orderBy: 'createdAt', reverse: true }); if (!disposed) state.templates.value = cloneConfig(records); return true; }
            catch (error) { tell(`模板操作已写入，列表刷新失败：${error?.message || error}`); return false; }
        };
        const saveNew = () => {
            const captured = signature();
            const record = buildCustomTemplate({ id: `tpl_${clock()}_${++sequence}_${random().toString(36).slice(2,6)}`, name: state.name.value,
                code: ensurePackages(state.code.value), config: cloneConfig(state.config), now: clock() });
            return run('new', async () => {
                await repository.put('customTemplates', record);
                if (disposed) return true;
                receipt('save', record);
                if (signature() === captured) guarded(() => { state.code.value = record.code; state.mode.value = 'custom'; state.current.value = record.id; });
                const fresh = await refresh(); if (fresh) tell('已存为新模板'); return true;
            });
        };
        const update = () => {
            const id = state.current.value, captured = signature();
            const patch = buildCustomTemplateUpdate({ name: state.name.value, code: ensurePackages(state.code.value), config: cloneConfig(state.config) });
            if (presets[id]) return run(`system:${id}`, () => {
                const overrides = { ...state.overrides.value, [id]: buildSystemOverride({ ...patch, now: clock() }) };
                if (preferences.setJson('qisi_template_overrides', overrides) === false) throw new Error('本地模板偏好未能保存。');
                state.overrides.value = overrides;
                if (signature() === captured) state.code.value = patch.code;
                tell('系统模板已更新'); return true;
            });
            const expected = cloneConfig(state.templates.value.find(tpl => tpl.id === id));
            return run(`update:${id}`, async () => {
                const record = await repository.applyCustomTemplateChange({ id, expected, patch });
                if (disposed) return true; receipt('save', record);
                if (signature() === captured) state.code.value = patch.code;
                const fresh = await refresh(); if (fresh) tell('已更新'); return true;
            });
        };
        const remove = id => {
            const captured = signature(), expected = cloneConfig(state.templates.value.find(tpl => tpl.id === id));
            return run(`delete:${id}`, async () => {
                await repository.applyCustomTemplateChange({ id, expected, remove: true });
                if (disposed) return true; receipt('delete', {id});
                if (signature() === captured && (state.current.value === id || state.selected.value === id)) selectPreset(defaultKey);
                else {
                    const lostSelection = state.selected.value === id;
                    guarded(() => {
                        if (lostSelection) state.selected.value = defaultKey;
                        if (state.current.value === id) { state.current.value = ''; state.mode.value = 'new'; }
                    });
                    if (lostSelection) persistLayout();
                }
                await refresh(); return true;
            });
        };
        const setGlobal = () => {
            if (disposed) return false;
            try { const code = ensurePackages(state.code.value); if (preferences.set('qisi_template', code) === false) throw new Error('本地排版偏好未能保存。'); state.code.value = code; tell('全局默认已更新'); return true; }
            catch (error) { tell(`默认模板保存失败，输入已保留：${error?.message || error}`); return false; }
        };
        const dispose = () => { if (disposed) return; disposed = true; stops.forEach(stop => stop?.()); };
        return Object.freeze({ card, cards, examPresets, acceptLoadedTemplates, restore, restoreEditor, selectCard, selectPreset, selectCustom,
            startNew, inputCode, saveNew, update, remove, setGlobal, dispose });
    };

    return Object.freeze({ buildCustomTemplate, buildSystemOverride, buildCustomTemplateUpdate, createState, createWorkspace });
});

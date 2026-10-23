(function initManualEntryModel(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ManualEntryModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Manual-entry state, image input and confirmed save coordination. Formal writes use LibraryService.
    const cleanEntryImages = images => (Array.isArray(images) ? images : [])
        .filter(image => image && image.id)
        .map(image => ({ id: image.id, align: image.align || 'center' }));

    const splitTags = tags => String(tags || '').split(',').map(tag => tag.trim()).filter(Boolean);

    const buildManualQuestion = ({ form, now, splitQuestion, images } = {}) => {
        if (typeof splitQuestion !== 'function') {
            const error = new Error('MANUAL_ENTRY_SPLIT_HELPER_REQUIRED');
            error.code = 'MANUAL_ENTRY_SPLIT_HELPER_REQUIRED';
            throw error;
        }
        if (!form || !Number.isFinite(now)) {
            const error = new Error('MANUAL_ENTRY_INPUT_INVALID');
            error.code = 'MANUAL_ENTRY_INPUT_INVALID';
            throw error;
        }
        const prepared = splitQuestion(form.stem, form.type, form.options);
        const tags = splitTags(form.tags);
        const systemKnowledge = form.systemKnowledge || '';
        const personalKnowledge = form.personalKnowledge || '';
        const primaryKnowledge = personalKnowledge || systemKnowledge || '';
        const primaryKnowledgeType = personalKnowledge ? 'personal' : 'system';

        return {
            prepared,
            question: {
                id: now.toString(),
                grade: form.grade,
                diff: form.diff,
                type: prepared.type,
                knowledge: primaryKnowledge,
                knowledgeType: primaryKnowledgeType,
                systemKnowledge,
                personalKnowledge,
                stem: prepared.stem,
                options: prepared.options.map(option => option || ''),
                answer: form.answer,
                solution: form.solution,
                images: cleanEntryImages(images),
                meta: {
                    grade: form.grade,
                    diff: form.diff,
                    knowledge: primaryKnowledge,
                    knowledgeType: primaryKnowledgeType,
                    systemKnowledge,
                    personalKnowledge,
                    tags
                },
                createdAt: now,
                updatedAt: now
            }
        };
    };

    const createEntryState = ({ reactive, ref }) => Object.freeze({
        form: reactive({ grade: '高一', diff: '中等', type: '解答题', knowledge: '', knowledgeType: 'system',
            systemKnowledge: '', personalKnowledge: '', tags: '', stem: '', options: ['', '', '', ''],
            answer: '', solution: '', images: [] }), tab: ref('stem')
    });
    const createImagePort = ({ FileReader, fetch }) => {
        const readers = new Set(); let disposed = false;
        const read = blob => new Promise((resolve, reject) => {
            if (disposed) { reject(new Error('图片读取已取消')); return; }
            const reader = new FileReader(); readers.add(reader);
            const finish = (callback, value) => { readers.delete(reader); reader.onload = reader.onerror = reader.onabort = null; callback(value); };
            reader.onload = () => finish(resolve, reader.result);
            reader.onerror = () => finish(reject, reader.error || new Error('图片读取失败'));
            reader.onabort = () => finish(reject, new Error('图片读取已取消'));
            try { reader.readAsDataURL(blob); } catch (error) { finish(reject, error); }
        });
        const fromDataUrl = async value => {
            if (typeof value !== 'string' || !value.startsWith('data:image/')) throw new Error('图片数据格式无效');
            return (await fetch(value)).blob();
        };
        return Object.freeze({ read, fromDataUrl, dispose() { disposed = true; for (const reader of [...readers]) reader.abort(); } });
    };
    const imagePattern = id => {
        const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\    return Object.freeze({ cleanEntryImages,');
        return `\\[\\[(?:IMAGE|FORMULA_IMAGE):${escaped}\\]\\]|\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escaped}\\}`;
    };
    const editImageReference = (value, id, replacement) => {
        const token = imagePattern(id);
        // Only remove a wrapper when its entire content is this one reference.
        const references = new RegExp(`\\\\begin\\{(center|flushleft|flushright)\\}\\s*(?:${token})\\s*\\\\end\\{\\1\\}|(?:${token})`, 'g');
        return String(value || '').replace(references, () => replacement);
    };
    const createWorkspace = ({ state, library, repository, imagePort, preferences, splitQuestion,
        refreshLibrary, notify, onSaved, observeForm = () => () => {}, observeNavigation = () => () => {}, clock = Date.now, random = Math.random } = {}) => {
        const form = state.form; let disposed = false, internal = false, revision = 0, pending = null, uploads = 0, imageSequence = 0;
        let visit = 0;
        const stopNavigation = observeNavigation(() => { visit++; });
        const tell = message => { if (!disposed) notify(message); };
        const plain = value => JSON.parse(JSON.stringify(value));
        const persist = () => {
            const content = form.stem || form.answer || form.solution || (form.options || []).some(Boolean) || form.images.length;
            const saved = content ? preferences.save({ ...plain(form), images: cleanEntryImages(form.images) }) : preferences.remove();
            if (saved === false) tell('草稿暂未保存到本机，请保留当前页面后再试。');
        };
        const change = work => { const before = internal; internal = true; try { work(); } finally { internal = before; } if (!internal) { revision++; persist(); } };
        const stopObserve = observeForm(() => { if (!internal && !disposed) { revision++; persist(); } });
        const syncKnowledge = () => change(() => {
            form.knowledge = form.personalKnowledge || form.systemKnowledge || '';
            form.knowledgeType = form.personalKnowledge ? 'personal' : 'system';
        });
        const restore = async () => {
            if (disposed || revision > 0) return false;
            let saved;
            try { saved = preferences.read(); }
            catch (error) { tell(`恢复草稿失败：${error?.message || error}`); return false; }
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return false;
            change(() => {
                for (const key of Object.keys(form)) if (Object.prototype.hasOwnProperty.call(saved, key)) form[key] = saved[key];
                if (!Array.isArray(form.options)) form.options = ['', '', '', ''];
                if (!Array.isArray(form.images)) form.images = [];
                for (const field of ['stem', 'answer', 'solution', 'tags']) if (typeof form[field] !== 'string') form[field] = '';
                if (!form.knowledgeType) form.knowledgeType = 'system';
                if (!form.systemKnowledge && form.knowledgeType === 'system') form.systemKnowledge = form.knowledge || '';
                if (!form.personalKnowledge && form.knowledgeType === 'personal') form.personalKnowledge = form.knowledge || '';
                form.knowledge = form.personalKnowledge || form.systemKnowledge || '';
                form.knowledgeType = form.personalKnowledge ? 'personal' : 'system';
            });
            for (const image of [...form.images]) {
                try {
                    const row = await repository.get('images', image.id);
                    if (!row?.blob) { tell('草稿图片缺少数据：' + image.id); continue; }
                    const url = await imagePort.read(row.blob);
                    if (!disposed && form.images.includes(image)) change(() => { image.url = url; });
                } catch (error) { tell(`恢复草稿图片失败：${error?.message || error}`); }
            }
            return true;
        };
        const upload = async file => {
            if (disposed || !file) return false;
            const field = state.tab.value;
            if (!['stem', 'answer', 'solution'].includes(field)) return false;
            uploads++;
            try {
                const url = await imagePort.read(file);
                if (disposed) return false;
                const id = `img_${clock()}_${++imageSequence}_${random().toString(36).slice(2, 8)}`;
                await repository.put('images', { id, blob: file, createdAt: clock() });
                if (disposed) return false;
                change(() => {
                    form.images.push({ id, url, align: 'center' });
                    form[field] += `\n\\begin{center}[[IMAGE:${id}]]\\end{center}\n`;
                });
                return true;
            } catch (error) { tell(`图片保存失败，未插入短码：${error?.message || error}`); return false; }
            finally { uploads--; }
        };
        const paste = async event => {
            const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
            if (!files.length) return;
            event.preventDefault();
            for (const file of files) await upload(file);
        };
        const editFields = (id, replacement) => {
            for (const field of ['stem', 'answer', 'solution']) form[field] = editImageReference(form[field], id, replacement);
            form.options = (form.options || []).map(value => editImageReference(value, id, replacement));
        };
        const alignImage = (id, align) => {
            if (!['center', 'flushleft', 'flushright'].includes(align) || !form.images.some(image => image.id === id)) return;
            change(() => { form.images.find(image => image.id === id).align = align;
                editFields(id, `\\begin{${align}}[[IMAGE:${id}]]\\end{${align}}`); });
        };
        const removeImage = id => change(() => { editFields(id, ''); form.images = form.images.filter(image => image.id !== id); });
        const snippet = id => { const image = form.images.find(row => row.id === id); return image ? `\\begin{${image.align || 'center'}}[[IMAGE:${id}]]\\end{${image.align || 'center'}}` : ''; };
        const appendText = (field, text) => {
            if (['stem', 'answer', 'solution'].includes(field)) change(() => { form[field] += (form[field] ? '\n\n' : '') + text; });
        };
        const submit = () => {
            if (pending) return pending;
            if (disposed) return Promise.resolve(false);
            if (uploads) { tell('图片正在保存，请完成后再入库。'); return Promise.resolve(false); }
            if (!form.stem.trim()) { tell('题干为空，先把 OCR 内容送入题干或手动输入题目。'); return Promise.resolve(false); }
            syncKnowledge(); const captured = plain(form), version = revision, savedVisit = visit;
            pending = (async () => {
                let saved;
                try {
                    const now = clock();
                    const { question } = buildManualQuestion({ form: captured, now, splitQuestion, images: captured.images });
                    const declared = new Set(question.images.map(image => image.id));
                    for (const source of [question.stem, question.answer, question.solution, ...question.options]) {
                        for (const match of String(source || '').matchAll(/\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]|\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
                            if (!declared.has(match[1] || match[2])) throw new Error('正文含未关联的图片短码：' + (match[1] || match[2]));
                        }
                    }
                    const imageRecords = [];
                    for (const image of captured.images) {
                        const row = await repository.get('images', image.id);
                        const blob = row?.blob || (image.url?.startsWith('data:image/') ? await imagePort.fromDataUrl(image.url) : null);
                        if (!blob) throw new Error('图片缺少已保存的数据，请重新上传：' + image.id);
                        imageRecords.push({ id: image.id, blob, createdAt: now });
                    }
                    if (disposed) return false;
                    saved = await library.saveQuestion(question, { imageRecords, confirmationToken: `manual-entry:${question.id}` });
                } catch (error) { tell(`保存入库失败：${error?.message || error}`); return false; }
                const unchanged = !disposed && version === revision;
                if (unchanged) change(() => { form.stem = ''; form.answer = ''; form.solution = ''; form.options = ['', '', '', '']; form.images = []; });
                if (disposed) return { committed: true, refreshed: false };
                try { await refreshLibrary(); }
                catch (error) { tell(`题目已保存，但页面刷新失败，请勿重复入库：${error?.message || error}`); return { committed: true, refreshed: false }; }
                if (!disposed && unchanged && revision === version + 1 && savedVisit === visit) onSaved(saved);
                else tell('题目已保存，保存期间的新输入或页面选择已保留。');
                return { committed: true, refreshed: true };
            })().finally(() => { pending = null; });
            return pending;
        };
        const dispose = () => { if (disposed) return; disposed = true; stopObserve(); stopNavigation(); imagePort.dispose(); };
        return Object.freeze({ restore, syncKnowledge, upload, paste, alignImage, removeImage, snippet, appendText, submit, dispose });
    };

    return Object.freeze({ createEntryState, createImagePort, createWorkspace, cleanEntryImages, splitTags, buildManualQuestion });
});

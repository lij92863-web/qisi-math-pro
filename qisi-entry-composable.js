(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.EntryComposable = api;

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

        const COPY_SUCCESS_MESSAGE = 'LaTeX 短码已复制！配图选行内浮动时，请将短码置于文字内部！';
        const COPY_FAILURE_MESSAGE = '复制失败，请手动复制短码。';

        const requireFunction = (value, name) => {
            if (typeof value !== 'function') {
                throw new TypeError(`useEntry requires ${name}`);
            }
            return value;
        };

        const requireEntryViewFunction = (dependencies, name) => {
            const entryViewState = dependencies && dependencies.EntryViewState;
            return requireFunction(
                entryViewState && entryViewState[name],
                `EntryViewState.${name}`
            );
        };

        const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const buildImageSources = id => {
            const escapedId = escapeRegExp(id);
            return {
                tokenSource: `\\[\\[(?:IMAGE|FORMULA_IMAGE):${escapedId}\\]\\]`,
                includeSource: `\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedId}\\}`
            };
        };

        const useEntry = (context = {}, dependencies = {}) => {
            const ref = requireFunction(context.ref, 'context.ref');
            const reactive = requireFunction(context.reactive, 'context.reactive');
            const computed = requireFunction(context.computed, 'context.computed');

            const entryForm = reactive({
                grade: '高一',
                diff: '中等',
                type: '解答题',
                knowledge: '',
                knowledgeType: 'system',
                systemKnowledge: '',
                personalKnowledge: '',
                tags: '',
                stem: '',
                options: ['', '', '', ''],
                answer: '',
                solution: '',
                images: []
            });
            const entryTab = ref('stem');
            const showEntryKnowledge = ref(false);
            const showEntryPersonalKnowledge = ref(false);
            const hoverL1 = ref(null);

            const entryPreview = computed(() => {
                const buildEntryPreview = requireEntryViewFunction(
                    dependencies,
                    'buildEntryPreview'
                );
                const splitQuestionForStorage = requireFunction(
                    dependencies.splitQuestionForStorage,
                    'splitQuestionForStorage'
                );
                return buildEntryPreview(entryForm, { splitQuestionForStorage });
            });
            const entryPreviewStem = computed(() => entryPreview.value.stem);
            const entryPreviewOptions = computed(() => entryPreview.value.options);

            const syncEntryLegacyKnowledge = () => {
                const projectEntryKnowledge = requireEntryViewFunction(
                    dependencies,
                    'projectEntryKnowledge'
                );
                const projection = projectEntryKnowledge(entryForm);
                entryForm.knowledge = projection.knowledge;
                entryForm.knowledgeType = projection.knowledgeType;
                return projection;
            };

            const selectKnowledge = (name, type = 'system') => {
                if (type === 'personal') entryForm.personalKnowledge = name || '';
                else entryForm.systemKnowledge = name || '';
                syncEntryLegacyKnowledge();
                showEntryKnowledge.value = false;
                showEntryPersonalKnowledge.value = false;
            };

            const changeEntryAlign = (id, align) => {
                const image = entryForm.images.find(item => item.id === id);
                if (image) image.align = align;

                const { tokenSource, includeSource } = buildImageSources(id);
                const pattern = new RegExp(
                    `(?:\\\\begin\\{(?:center|flushleft|flushright)\\}\\s*)?` +
                    `(?:${tokenSource}|${includeSource})` +
                    `(?:\\s*\\\\end\\{(?:center|flushleft|flushright)\\})?`,
                    'g'
                );
                const replacement = `\\begin{${align}}[[IMAGE:${id}]]\\end{${align}}`;

                entryForm.stem = entryForm.stem.replace(pattern, replacement);
                entryForm.answer = entryForm.answer.replace(pattern, replacement);
                entryForm.solution = entryForm.solution.replace(pattern, replacement);
            };

            const removeEntryImage = id => {
                entryForm.images = entryForm.images.filter(item => item.id !== id);

                const { tokenSource, includeSource } = buildImageSources(id);
                const block = new RegExp(
                    `\\n?\\\\begin\\{(?:wrapfigure|center|flushleft|flushright)\\}` +
                    `[\\s\\S]*?(?:${tokenSource}|${includeSource})[\\s\\S]*?` +
                    `\\\\end\\{(?:wrapfigure|center|flushleft|flushright)\\}`,
                    'g'
                );
                const inline = new RegExp(`\\n?(?:${tokenSource}|${includeSource})`, 'g');
                const clean = value => String(value || '')
                    .replace(block, '')
                    .replace(inline, '')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();

                entryForm.stem = clean(entryForm.stem);
                entryForm.answer = clean(entryForm.answer);
                entryForm.solution = clean(entryForm.solution);
            };

            const copyMainSnippet = async id => {
                const copyText = requireFunction(dependencies.copyText, 'copyText');
                const notify = requireFunction(dependencies.notify, 'notify');
                const image = entryForm.images.find(item => item.id === id);
                const align = image && image.align ? image.align : 'center';
                const snippet = `\\begin{${align}}[[IMAGE:${id}]]\\end{${align}}`;
                const ok = await copyText(snippet);
                notify(ok ? COPY_SUCCESS_MESSAGE : COPY_FAILURE_MESSAGE);
            };

            return {
                entryForm,
                entryTab,
                showEntryKnowledge,
                showEntryPersonalKnowledge,
                hoverL1,
                entryPreview,
                entryPreviewStem,
                entryPreviewOptions,
                syncEntryLegacyKnowledge,
                selectKnowledge,
                changeEntryAlign,
                removeEntryImage,
                copyMainSnippet
            };
        };

        return {
            useEntry
        };
    }
);

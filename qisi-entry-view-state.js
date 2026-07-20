(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.EntryViewState = api;

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

        const ENTRY_OPTION_COUNT = 4;
        const EMPTY_STEM_MESSAGE = '题干为空，先把 OCR 内容送入题干或手动输入题目。';

        const normalizeEntryOptions = options => {
            const source = Array.isArray(options) ? options : [];
            return Array.from(
                { length: ENTRY_OPTION_COUNT },
                (_, index) => source[index] || ''
            );
        };

        const buildEntryPreview = (form, dependencies = {}) => {
            const { splitQuestionForStorage } = dependencies;
            if (typeof splitQuestionForStorage !== 'function') {
                throw new TypeError('buildEntryPreview requires splitQuestionForStorage');
            }

            const parsed = splitQuestionForStorage(
                form.stem,
                form.type,
                form.options
            );

            return {
                parsed,
                stem: parsed.stem || form.stem,
                options: parsed.options || []
            };
        };

        const projectEntryKnowledge = form => {
            const systemKnowledge = form.systemKnowledge || '';
            const personalKnowledge = form.personalKnowledge || '';

            return {
                knowledge: personalKnowledge || systemKnowledge || '',
                knowledgeType: personalKnowledge ? 'personal' : 'system',
                systemKnowledge,
                personalKnowledge
            };
        };

        const validateEntryForm = form => {
            const valid = Boolean(form.stem.trim());
            return {
                valid,
                message: valid ? '' : EMPTY_STEM_MESSAGE
            };
        };

        return {
            buildEntryPreview,
            normalizeEntryOptions,
            projectEntryKnowledge,
            validateEntryForm
        };
    }
);

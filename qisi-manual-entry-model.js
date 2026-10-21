(function initManualEntryModel(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ManualEntryModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Manual entry: the pure shape of a new formal question. Binary collection,
    // storage and page state stay in app.js.
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

    return Object.freeze({ cleanEntryImages, splitTags, buildManualQuestion });
});

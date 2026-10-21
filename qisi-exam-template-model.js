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

    return Object.freeze({ buildCustomTemplate, buildSystemOverride, buildCustomTemplateUpdate });
});

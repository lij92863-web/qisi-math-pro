(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.FileDispatcher = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const classifyFileType = name => { const ext = (name || '').split('.').pop().toLowerCase(); if (ext === 'docx') return 'docx'; if (ext === 'pdf') return 'pdf'; if (/png|jpg|jpeg|gif|svg|webp/.test(ext)) return 'image'; return 'unknown'; };
    const buildDispatchPlan = files => { const plan = { questions: null, answers: null, solutions: null, images: [] }; (files || []).forEach(f => { const t = classifyFileType(f.name); if (!plan.questions && (t === 'docx' || t === 'pdf')) plan.questions = f; else if (!plan.answers && (t === 'docx' || t === 'pdf')) plan.answers = f; else if (t === 'image') plan.images.push(f); }); return plan; };
    return { classifyFileType, buildDispatchPlan };
});

(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.FileDispatcher = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const getFileType = (fileName = '') => {
        const ext = String(fileName).split('.').pop()?.toLowerCase() || '';
        if (ext === 'pdf') return 'pdf';
        if (ext === 'docx' || ext === 'doc') return 'docx';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
        if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';
        if (ext === 'txt') return 'text';
        return 'unknown';
    };

    const fileTypeText = (type) => ({
        pdf: 'PDF',
        docx: 'Word',
        image: '图片',
        text: '文本',
        excel: 'Excel',
        unknown: '未知'
    }[type] || '未知');

    const formatFileSize = (size = 0) => {
        if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
        return `${Math.max(1, Math.round(size / 1024))} KB`;
    };

    const makeBatchId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const classifyFileType = name => { const ext = (name || '').split('.').pop().toLowerCase(); if (ext === 'docx') return 'docx'; if (ext === 'pdf') return 'pdf'; if (/png|jpg|jpeg|gif|svg|webp/.test(ext)) return 'image'; return 'unknown'; };

    const buildDispatchPlan = files => { const plan = { questions: null, answers: null, solutions: null, images: [] }; (files || []).forEach(f => { const t = classifyFileType(f.name); if (!plan.questions && (t === 'docx' || t === 'pdf')) plan.questions = f; else if (!plan.answers && (t === 'docx' || t === 'pdf')) plan.answers = f; else if (t === 'image') plan.images.push(f); }); return plan; };

    const getBatchFileRoles = (file) => {
        const roles = Array.isArray(file?.roles) ? file.roles.filter(Boolean) : [];
        if (roles.length) return [...new Set(roles)];
        return file?.role ? [file.role] : [];
    };

    const batchHasRole = (file, role) => getBatchFileRoles(file).includes(role);

    const batchHasQuestionRole = (file) => {
        const roles = getBatchFileRoles(file);
        return roles.includes('question') || roles.includes('full');
    };

    const batchHasAnswerRole = (file) => {
        const roles = getBatchFileRoles(file);
        return roles.includes('answer') || roles.includes('full');
    };

    const batchHasSolutionRole = (file) => {
        const roles = getBatchFileRoles(file);
        return roles.includes('solution') || roles.includes('full');
    };

    const batchIsFullRole = (file) => getBatchFileRoles(file).includes('full');

    const batchIsSupplementalImage = (file) => getBatchFileRoles(file).includes('supplemental_image');

    return { getFileType, fileTypeText, formatFileSize, makeBatchId, classifyFileType, buildDispatchPlan, getBatchFileRoles, batchHasRole, batchHasQuestionRole, batchHasAnswerRole, batchHasSolutionRole, batchIsFullRole, batchIsSupplementalImage };
});

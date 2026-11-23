(function initSourceRoleClassifier(root) {
    'use strict';

    const DECLARED_ROLES = Object.freeze([
        'question', 'answer', 'solution', 'full', 'supplemental_image'
    ]);
    const SUPPORTED_TYPES = Object.freeze(['docx', 'pdf', 'image', 'text']);

    function fail(code) {
        const error = new Error(code);
        error.code = code;
        throw error;
    }

    function freeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(freeze);
        return Object.freeze(value);
    }

    function classifySourceRoles(manifest = []) {
        if (!Array.isArray(manifest) || manifest.length === 0) {
            fail('SOURCE_ROLE_MISSING_SOURCE');
        }

        const classified = manifest.map((source, manifestIndex) => {
            const id = String(source?.id || '').trim();
            if (!id) fail('SOURCE_ROLE_MISSING_SOURCE');
            const fileType = String(source?.fileType || '').trim().toLowerCase();
            if (!SUPPORTED_TYPES.includes(fileType)) fail('SOURCE_ROLE_UNSUPPORTED_TYPE');

            const roles = Array.isArray(source?.roles)
                ? source.roles.map(role => String(role).trim().toLowerCase()).filter(Boolean)
                : [];
            if (roles.length === 0) fail('SOURCE_ROLE_MISSING_ROLE');
            if (new Set(roles).size !== roles.length) fail('SOURCE_ROLE_DUPLICATE_ROLE');
            if (roles.some(role => !DECLARED_ROLES.includes(role))) {
                fail('SOURCE_ROLE_UNSUPPORTED_ROLE');
            }
            if ((roles.includes('full') || roles.includes('supplemental_image')) && roles.length !== 1) {
                fail('SOURCE_ROLE_AMBIGUOUS');
            }
            if (roles.includes('supplemental_image') && fileType !== 'image') {
                fail('SOURCE_ROLE_AMBIGUOUS');
            }

            const isQuestion = roles.includes('question') || roles.includes('full');
            const isAnswer = roles.includes('answer') || roles.includes('full');
            const isSolution = roles.includes('solution') || roles.includes('full');
            const isSupplementalImage = roles.includes('supplemental_image');
            return {
                id,
                fileType,
                roles,
                sourceOrder: Number.isInteger(source.sourceOrder)
                    ? source.sourceOrder
                    : manifestIndex,
                recognitionRank: isQuestion ? 0 : (isAnswer || isSolution ? 1 : (isSupplementalImage ? 2 : 3)),
                isQuestion,
                isAnswer,
                isSolution,
                isFull: roles.includes('full'),
                isSupplementalImage
            };
        });

        if (new Set(classified.map(source => source.id)).size !== classified.length) {
            fail('SOURCE_ROLE_DUPLICATE_SOURCE');
        }

        classified.sort((left, right) => left.sourceOrder - right.sourceOrder);
        const roleSourceIds = {
            question: classified.filter(source => source.isQuestion).map(source => source.id),
            answer: classified.filter(source => source.isAnswer).map(source => source.id),
            solution: classified.filter(source => source.isSolution).map(source => source.id),
            full: classified.filter(source => source.isFull).map(source => source.id),
            supplemental_image: classified.filter(source => source.isSupplementalImage).map(source => source.id)
        };
        const summary = {
            questionPdfCount: classified.filter(source => source.fileType === 'pdf' && source.isQuestion).length,
            answerSupportPdfCount: classified.filter(source =>
                source.fileType === 'pdf' && (source.isAnswer || source.isSolution)
            ).length,
            supplementalImageCount: roleSourceIds.supplemental_image.length
        };

        return freeze({
            schemaVersion: 'qisi.source-role-classification.r3',
            sources: classified,
            orderedSourceIds: classified.map(source => source.id),
            roleSourceIds,
            summary
        });
    }

    const api = Object.freeze({ DECLARED_ROLES, classifySourceRoles });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.SourceRoleClassifier = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);

(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewController = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const clone = value => {
        if (value == null) return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (_error) {
                // Vue reactive proxies are intentionally cloned as plain data.
            }
        }
        return JSON.parse(JSON.stringify(value));
    };

    const createReviewController = ({
        validateDraft,
        formalFields = [],
        clock = () => Date.now()
    } = {}) => {
        const formalFieldSet = new Set(
            Array.isArray(formalFields) ? formalFields : []
        );

        const open = draft => ({
            draft: clone(draft),
            baseline: clone(draft),
            dirty: false,
            cancelled: false
        });

        const markFieldsManual = (draft, fields = []) => {
            if (!draft || draft.status === 'submitted') return clone(draft);
            const next = clone(draft);
            const explicitFields = [...new Set(
                (Array.isArray(fields) ? fields : [fields])
                    .map(field => String(field || '').trim())
                    .filter(Boolean)
            )];
            if (!explicitFields.length) return next;

            const fieldProvenance = clone(next.fieldProvenance || {});
            for (const field of explicitFields) {
                if (!formalFieldSet.has(field)) continue;
                const current = fieldProvenance[field] || {};
                fieldProvenance[field] = {
                    kind: 'manual',
                    status: 'manual',
                    sourceId:
                        current.sourceId || next?.source?.sourceId || '',
                    manuallyEdited: true,
                    manualEditRevision:
                        (Number.isInteger(current.manualEditRevision)
                            ? current.manualEditRevision
                            : 0) + 1
                };
            }
            next.fieldProvenance = fieldProvenance;
            next.userEdited = true;
            next.manualEdited = true;
            next.updatedAt = clock();
            return next;
        };

        const editFields = (draft, changes = {}) => {
            if (!draft || draft.status === 'submitted') return clone(draft);
            const next = clone(draft);
            const changedFields = [];
            for (const [field, value] of Object.entries(changes || {})) {
                if (JSON.stringify(next[field]) === JSON.stringify(value)) {
                    continue;
                }
                next[field] = clone(value);
                changedFields.push(field);
            }
            return changedFields.length
                ? markFieldsManual(next, changedFields)
                : next;
        };

        const editField = (draft, field, value) =>
            editFields(draft, { [field]: value });

        const addWarning = (draft, warning) => {
            const next = clone(draft);
            next.warnings = [...new Set([
                ...(next?.warnings || []),
                String(warning || '').trim()
            ].filter(Boolean))];
            return next;
        };

        const removeWarning = (draft, predicate) => {
            const next = clone(draft);
            next.warnings = (next?.warnings || []).filter(warning =>
                typeof predicate === 'function'
                    ? !predicate(warning)
                    : warning !== predicate
            );
            return next;
        };

        const provenanceDisplay = draft => {
            const provenance = draft?.fieldProvenance ||
                draft?.provenance || draft?.sourceTrace || {};
            return Object.entries(provenance).map(([field, evidence]) => ({
                field,
                sourceFile: evidence?.file || evidence?.sourceFileName || '',
                page: evidence?.page || evidence?.sourcePage || null,
                block: evidence?.block || evidence?.rawBlock || '',
                engine: evidence?.engine || provenance.engine || '',
                repair: Boolean(evidence?.repair || evidence?.repaired),
                manualEdit: Boolean(
                    evidence?.manualEdit || evidence?.manuallyEdited ||
                    evidence?.status === 'manual' || evidence?.kind === 'manual'
                ),
                decision: evidence?.decision || evidence?.reason || ''
            }));
        };

        const requestValidation = draft => {
            if (typeof validateDraft !== 'function') {
                return {
                    valid: false,
                    errors: [{
                        code: 'validator-required',
                        message: 'A review validator is required.'
                    }],
                    warnings: []
                };
            }
            let result;
            try {
                result = validateDraft(clone(draft));
            } catch (_error) {
                return {
                    valid: false,
                    errors: [{
                        code: 'validator-failed',
                        message: 'Review validator failed.'
                    }],
                    warnings: []
                };
            }
            if (
                !result ||
                typeof result !== 'object' ||
                Array.isArray(result) ||
                typeof result.valid !== 'boolean' ||
                (result.errors !== undefined && !Array.isArray(result.errors)) ||
                (result.warnings !== undefined && !Array.isArray(result.warnings))
            ) {
                return {
                    valid: false,
                    errors: [{
                        code: 'validator-malformed',
                        message: 'Review validator returned a malformed result.'
                    }],
                    warnings: []
                };
            }
            return {
                valid: result.valid,
                errors: clone(result?.errors || []),
                warnings: clone(result?.warnings || [])
            };
        };

        const confirm = draft => {
            const validation = requestValidation(draft);
            if (!validation.valid) {
                return { accepted: false, draft: clone(draft), validation };
            }
            const next = clone(draft);
            next.status = 'reviewed';
            next.manualConfirmed = true;
            next.confirmedAt = new Date(clock()).toISOString();
            next.updatedAt = clock();
            return { accepted: true, draft: next, validation };
        };

        const cancel = session => ({
            ...session,
            draft: clone(session?.baseline),
            dirty: false,
            cancelled: true
        });

        const isDirty = (draft, baseline) =>
            JSON.stringify(draft) !== JSON.stringify(baseline);

        return Object.freeze({
            open,
            editField,
            editFields,
            markFieldsManual,
            addWarning,
            removeWarning,
            provenanceDisplay,
            requestValidation,
            confirm,
            cancel,
            isDirty
        });
    };

    return Object.freeze({ createReviewController });
});

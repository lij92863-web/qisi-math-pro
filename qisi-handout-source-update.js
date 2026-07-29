(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const questionInstance = root.Qisi?.HandoutQuestionInstance
        || (
            typeof require === 'function'
                ? require('./qisi-handout-question-instance.js')
                : null
        );
    const api = factory(model, questionInstance);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutSourceUpdate = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function (model, questionInstance) {
        'use strict';

        if (!model || !questionInstance) {
            throw new Error(
                'handout source-update dependencies are unavailable'
            );
        }

        const normalizeTimestamp = (
            value,
            label,
            { optional = false } = {}
        ) => {
            const source = String(value || '').trim();
            const parsed = Date.parse(source);

            if (!source && optional) return '';
            if (!source || !Number.isFinite(parsed)) {
                throw new TypeError(`${label} is invalid`);
            }
            return new Date(parsed).toISOString();
        };

        const normalizeFieldList = (value, label) => [
            ...new Set(
                (Array.isArray(value) ? value : [])
                    .map(field => String(field || '').trim())
                    .filter(Boolean)
            )
        ].map(field => {
            if (!questionInstance.SNAPSHOT_FIELDS.includes(field)) {
                throw new TypeError(`${label} contains invalid field: ${field}`);
            }
            return field;
        });

        const createSourceUpdatePlan = (
            block,
            sourceQuestion,
            {
                selectedFields,
                acceptedConflictFields = []
            } = {}
        ) => {
            if (block?.type !== 'question') {
                throw new TypeError(
                    'source update requires a question block'
                );
            }
            const comparison = questionInstance.compareQuestionSource(
                block.snapshot,
                sourceQuestion,
                block.contentOverrides || {}
            );

            if (comparison.status === 'missing') {
                const error = new Error(
                    `source question ${block.sourceQuestionId} is missing`
                );
                error.code = 'HANDOUT_SOURCE_MISSING';
                throw error;
            }

            const selected = normalizeFieldList(
                selectedFields,
                'selected source-update fields'
            );
            if (!selected.length) {
                throw new TypeError(
                    'at least one changed source field must be selected'
                );
            }
            const changed = new Set(comparison.changedFields);
            const unchangedSelections = selected.filter(
                field => !changed.has(field)
            );
            if (unchangedSelections.length) {
                throw new Error(
                    `selected source fields have not changed: ${unchangedSelections.join(', ')}`
                );
            }

            const accepted = normalizeFieldList(
                acceptedConflictFields,
                'accepted source-update conflict fields'
            );
            const conflicts = new Set(comparison.conflictFields);
            const invalidAccepted = accepted.filter(
                field => !selected.includes(field) || !conflicts.has(field)
            );
            if (invalidAccepted.length) {
                throw new Error(
                    `accepted conflict fields are invalid: ${invalidAccepted.join(', ')}`
                );
            }
            const unresolved = selected.filter(
                field => conflicts.has(field) && !accepted.includes(field)
            );
            if (unresolved.length) {
                const error = new Error(
                    `source update conflicts require explicit acceptance: ${unresolved.join(', ')}`
                );
                error.code = 'HANDOUT_SOURCE_CONFLICT';
                error.conflictFields = unresolved;
                throw error;
            }

            return Object.freeze({
                comparison: model.cloneValue(comparison),
                selectedFields: Object.freeze([...selected]),
                acceptedConflictFields: Object.freeze([...accepted]),
                requiresImages: selected.includes('images')
            });
        };

        const applySourceUpdatePlan = (
            block,
            sourceQuestion,
            plan,
            {
                refreshedImages,
                now = new Date().toISOString()
            } = {}
        ) => {
            if (!plan?.selectedFields) {
                throw new TypeError('source update plan is required');
            }
            const snapshot = model.cloneValue(block.snapshot);
            const overrides = model.cloneValue(
                block.contentOverrides || {}
            );

            for (const field of plan.selectedFields) {
                if (field === 'images') {
                    if (!Array.isArray(refreshedImages)) {
                        throw new TypeError(
                            'refreshed source images are required'
                        );
                    }
                    snapshot.images = model.cloneValue(refreshedImages);
                } else {
                    snapshot[field] = model.cloneValue(
                        sourceQuestion?.[field]
                    );
                }
                delete overrides[field];
            }

            const sourceUpdatedAt = normalizeTimestamp(
                sourceQuestion?.updatedAt || sourceQuestion?.createdAt,
                `question ${block.sourceQuestionId} source timestamp`,
                { optional: true }
            );
            snapshot.sourceUpdatedAt = sourceUpdatedAt;
            snapshot.capturedAt = normalizeTimestamp(
                now,
                `question ${block.sourceQuestionId} capture timestamp`
            );

            const next = {
                ...block,
                sourceUpdatedAt,
                snapshot,
                contentOverrides: overrides
            };
            if (plan.requiresImages) {
                delete next.images;
            }

            return next;
        };

        return {
            normalizeFieldList,
            createSourceUpdatePlan,
            applySourceUpdatePlan
        };
    }
);

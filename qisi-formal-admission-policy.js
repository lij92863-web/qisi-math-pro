(function (root, factory) {
    const identityContract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );
    const api = factory(identityContract);
    root.Qisi = root.Qisi || {};
    root.Qisi.FormalAdmissionPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identityContract) {
    'use strict';

    const ADMISSION_SCHEMA_VERSION = 'qisi.admission.v1';
    const POLICY_VERSION = 'formal-admission-r1';
    const ADMISSION_MODES = Object.freeze([
        'manual',
        'docx-deterministic',
        'pdf-ai',
        'imported-package',
        'deterministic-docx',
        'deterministic-pdf',
        'vision-ai'
    ]);
    const FORMAL_FIELDS = Object.freeze([
        'questionNumber',
        'stem',
        'options',
        'answer',
        'solution',
        'images'
    ]);
    const PROVENANCE_STATUSES = Object.freeze([
        'manual',
        'deterministic-source',
        'controlled-write',
        'rejected',
        'missing'
    ]);

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (isRecord(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, clone(item)])
            );
        }
        return value;
    };
    const deepFreeze = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    };
    const immutable = value => deepFreeze(clone(value));
    const errorOf = (code, field, message, details = undefined) => {
        const error = { code, field, message };
        if (details !== undefined) error.details = clone(details);
        return error;
    };
    const hasValue = value => Array.isArray(value)
        ? value.length > 0
        : typeof value === 'string'
            ? Boolean(value.trim())
            : value !== null && value !== undefined;
    const isObjective = type => /(?:单选|多选|选择|choice|select)/i.test(
        String(type || '')
    );
    const requiresAnswer = type => isObjective(type) || /填空|blank/i.test(
        String(type || '')
    );
    const requiredField = (field, draft) => {
        if (field === 'questionNumber' || field === 'stem') return true;
        if (field === 'options') return isObjective(draft?.type);
        if (field === 'answer') return requiresAnswer(draft?.type);
        return false;
    };

    const createAdmissionContext = (input = {}) => immutable({
        schemaVersion: ADMISSION_SCHEMA_VERSION,
        mode: input.mode || '',
        actorId: input.actorId || '',
        explicitConfirmation: input.explicitConfirmation === true,
        requestId: input.requestId || '',
        idempotencyKey: input.idempotencyKey || '',
        evaluatedAt: input.evaluatedAt || new Date().toISOString(),
        source: isRecord(input.source) ? input.source : {},
        producer: isRecord(input.producer) ? input.producer : {},
        route: isRecord(input.route) ? input.route : {},
        packageSchemaValid: input.packageSchemaValid,
        policyVersion: POLICY_VERSION
    });

    const normalizeProvenance = value => {
        if (Array.isArray(value)) {
            const entries = value.filter(isRecord).map(item => clone(item));
            return { entries, duplicateFields: entries
                .map(item => item.field)
                .filter((field, index, all) => field && all.indexOf(field) !== index) };
        }
        if (isRecord(value)) {
            return {
                entries: Object.entries(value).map(([field, item]) => ({
                    field,
                    ...(isRecord(item) ? clone(item) : {})
                })),
                duplicateFields: []
            };
        }
        return { entries: [], duplicateFields: [] };
    };

    const modeFamily = mode => {
        if (mode === 'manual') return 'manual';
        if (['docx-deterministic', 'deterministic-docx', 'deterministic-pdf']
            .includes(mode)) return 'deterministic';
        if (['pdf-ai', 'vision-ai'].includes(mode)) return 'vision';
        if (mode === 'imported-package') return 'imported-package';
        return 'unknown';
    };

    const validateContext = (context, draft, errors, identity) => {
        if (!isRecord(context) || !ADMISSION_MODES.includes(context.mode)) {
            errors.push(errorOf(
                'admission-mode-unsupported',
                'mode',
                'Admission mode is unsupported.'
            ));
            return;
        }
        if (!context.actorId || !context.requestId || !context.idempotencyKey) {
            errors.push(errorOf(
                'admission-context-invalid',
                'context',
                'Actor, request, and idempotency identifiers are required.'
            ));
        }
        if (context.explicitConfirmation !== true) {
            errors.push(errorOf(
                'admission-confirmation-required',
                'explicitConfirmation',
                'Explicit teacher confirmation is required.'
            ));
        }
        if (!identity || ['invalid', 'legacy-unknown'].includes(identity.status)) {
            errors.push(errorOf(
                'admission-producer-identity-invalid',
                'producer',
                'Draft producer identity is missing, unknown, or invalid.',
                identity?.errors || identity?.status || ''
            ));
        } else {
            const expectedMode = identity.status === 'canonical'
                ? identity.producer?.mode
                : identity.legacyMode;
            if (String(expectedMode || '') !== String(context.mode)) {
                errors.push(errorOf(
                    'admission-context-invalid',
                    identity.status === 'canonical' ? 'producer.mode' : 'source.mode',
                    'Draft producer mode does not match admission mode.'
                ));
            }
        }
        if (
            context.mode === 'imported-package' &&
            context.packageSchemaValid !== true
        ) {
            errors.push(errorOf(
                'admission-package-schema-invalid',
                'packageSchemaValid',
                'Imported package schema must be valid.'
            ));
        }
    };

    const validateCanonicalProvenance = (
        field, provenance, identity, errors
    ) => {
        if (identity?.status !== 'canonical' ||
            ['manual', 'missing', 'rejected'].includes(provenance.status)) return;
        const expectedBoundary = identity.producer?.mode === 'vision-ai'
            ? 'docx-vision-engine-output-to-candidate'
            : 'docx-deterministic-source-to-candidate';
        if (
            (identity.producer?.mode === 'vision-ai' &&
                provenance.status !== 'controlled-write') ||
            (identity.producer?.mode === 'deterministic-docx' &&
                provenance.status !== 'deterministic-source')
        ) {
            errors.push(errorOf(
                'admission-producer-provenance-invalid',
                field,
                `Producer mode and provenance kind disagree for ${field}.`
            ));
        }
        if (
            provenance.kind !== provenance.status ||
            provenance.sourceId !== identity.source?.sourceId ||
            provenance.sourceFormat !== identity.source?.format ||
            provenance.producerMode !== identity.producer?.mode ||
            provenance.routeId !== identity.route?.identity ||
            !provenance.engine ||
            provenance.manuallyEdited !== false ||
            provenance.producerBoundary !== expectedBoundary ||
            provenance.contractVersion !== identityContract?.CONTRACT_VERSION
        ) {
            errors.push(errorOf(
                'admission-producer-provenance-invalid',
                field,
                `Canonical producer-time provenance is invalid for ${field}.`
            ));
        }
    };

    const validateFieldDecision = (
        field, value, provenance, mode, draft, errors, identity
    ) => {
        if (!isRecord(provenance)) {
            errors.push(errorOf(
                'admission-provenance-missing',
                field,
                `Provenance is required for ${field}.`
            ));
            return;
        }
        const status = provenance.status;
        if (!PROVENANCE_STATUSES.includes(status)) {
            errors.push(errorOf(
                'admission-provenance-missing',
                field,
                `Valid provenance status is required for ${field}.`
            ));
            return;
        }
        if (provenance.kind && provenance.kind !== status) {
            errors.push(errorOf(
                'admission-producer-provenance-invalid',
                field,
                `Provenance kind and status disagree for ${field}.`
            ));
        }
        const present = hasValue(value);
        if (status === 'rejected') {
            errors.push(errorOf(
                'admission-field-rejected',
                field,
                `Rejected field ${field} cannot enter formal data.`,
                provenance.reasonCode || ''
            ));
            return;
        }
        if (status === 'missing') {
            if (present || requiredField(field, draft)) {
                errors.push(errorOf(
                    'admission-required-field-missing',
                    field,
                    `Field ${field} cannot be admitted as missing.`
                ));
            }
            return;
        }
        if (!present) {
            errors.push(errorOf(
                'admission-provenance-missing',
                field,
                `Non-missing provenance for ${field} has no field value.`
            ));
            return;
        }
        if (status === 'manual') {
            if (
                !Number.isInteger(provenance.manualEditRevision) ||
                provenance.manualEditRevision < 1
            ) {
                errors.push(errorOf(
                    'admission-manual-revision-required',
                    field,
                    `Manual field ${field} requires an actual edit revision.`
                ));
            }
            return;
        }
        validateCanonicalProvenance(field, provenance, identity, errors);
        const family = modeFamily(mode);
        if (family === 'manual') {
            errors.push(errorOf(
                'admission-provenance-missing',
                field,
                `Manual admission cannot use ${status} provenance.`
            ));
            return;
        }
        if (family === 'deterministic' || family === 'imported-package') {
            if (status !== 'deterministic-source') {
                errors.push(errorOf(
                    'admission-provenance-missing',
                    field,
                    `${mode} field ${field} requires deterministic or manual provenance.`
                ));
            } else if (!provenance.sourceId || !provenance.evidenceRef) {
                errors.push(errorOf(
                    'admission-provenance-missing',
                    field,
                    `Deterministic field ${field} requires source evidence.`
                ));
            }
            return;
        }
        if (family === 'vision') {
            if (status !== 'controlled-write') {
                errors.push(errorOf(
                    'admission-controlled-write-required',
                    field,
                    `PDF/AI field ${field} requires controlled-write or manual provenance.`
                ));
            } else if (
                provenance.controlledWriteAccepted !== true ||
                !provenance.controlledWriteDecisionId
            ) {
                errors.push(errorOf(
                    'admission-controlled-write-rejected',
                    field,
                    `PDF/AI field ${field} lacks accepted controlled-write evidence.`
                ));
            }
        }
    };

    const evaluateDraftAdmission = (draft, rawContext = {}) => {
        const context = createAdmissionContext(rawContext);
        const errors = [];
        const warnings = [];
        if (!isRecord(draft)) {
            return immutable({
                schemaVersion: ADMISSION_SCHEMA_VERSION,
                decisionId: '', mode: context.mode, draftId: '', draftVersion: null,
                accepted: false, fieldDecisions: [],
                errors: [errorOf(
                    'admission-context-invalid', '$', 'Draft must be an object.'
                )],
                warnings, evaluatedAt: context.evaluatedAt,
                policyVersion: POLICY_VERSION
            });
        }
        const identity = typeof identityContract?.resolveIdentity === 'function'
            ? identityContract.resolveIdentity(draft, { allowLegacyRead: true })
            : { status: 'invalid', errors: [{ code: 'identity-contract-missing' }] };
        validateContext(context, draft, errors, identity);
        if (!draft.id || !Number.isInteger(draft.version) || !draft.type) {
            errors.push(errorOf(
                'admission-context-invalid',
                'draft',
                'Draft ID, integer version, and type are required.'
            ));
        }
        const normalized = normalizeProvenance(
            draft.fieldProvenance || draft.provenance
        );
        for (const field of normalized.duplicateFields) {
            errors.push(errorOf(
                'admission-provenance-duplicate',
                field,
                `Duplicate provenance for ${field}.`
            ));
        }
        const byField = new Map(
            normalized.entries.map(item => [item.field, item])
        );
        const fieldDecisions = FORMAL_FIELDS.map(field => {
            const item = byField.get(field);
            validateFieldDecision(
                field,
                draft[field],
                item,
                context.mode,
                draft,
                errors,
                identity
            );
            return {
                field,
                ...(item ? clone(item) : { status: 'missing' })
            };
        });
        for (const field of byField.keys()) {
            if (!FORMAL_FIELDS.includes(field)) {
                errors.push(errorOf(
                    'admission-decision-malformed',
                    field,
                    `Unknown formal field ${field}.`
                ));
            }
        }
        return immutable({
            schemaVersion: ADMISSION_SCHEMA_VERSION,
            decisionId: `${draft.id || 'draft'}:${draft.version ?? 'unknown'}:${context.idempotencyKey}`,
            mode: context.mode,
            draftId: draft.id || '',
            draftVersion: draft.version ?? null,
            accepted: errors.length === 0,
            fieldDecisions,
            errors,
            warnings,
            evaluatedAt: context.evaluatedAt,
            policyVersion: POLICY_VERSION
        });
    };

    const validateAdmissionDecision = (decision, draft, rawContext = {}) => {
        const errors = [];
        if (
            !isRecord(decision) ||
            decision.schemaVersion !== ADMISSION_SCHEMA_VERSION ||
            typeof decision.accepted !== 'boolean' ||
            !Array.isArray(decision.fieldDecisions)
        ) {
            return immutable({
                valid: false,
                errors: [errorOf(
                    'admission-decision-malformed',
                    'decision',
                    'Admission decision shape is malformed.'
                )],
                warnings: []
            });
        }
        const names = decision.fieldDecisions.map(item => item?.field);
        for (const field of names.filter(
            (name, index) => name && names.indexOf(name) !== index
        )) {
            errors.push(errorOf(
                'admission-provenance-duplicate',
                field,
                `Duplicate field decision for ${field}.`
            ));
        }
        if (
            names.length !== FORMAL_FIELDS.length ||
            FORMAL_FIELDS.some(field => !names.includes(field)) ||
            names.some(field => !FORMAL_FIELDS.includes(field))
        ) {
            errors.push(errorOf(
                'admission-decision-malformed',
                'fieldDecisions',
                'Admission decision must contain each formal field exactly once.'
            ));
        }
        const expected = evaluateDraftAdmission(draft, rawContext);
        if (
            decision.draftId !== expected.draftId ||
            decision.draftVersion !== expected.draftVersion ||
            decision.mode !== expected.mode
        ) {
            errors.push(errorOf(
                'admission-decision-stale',
                'decision',
                'Admission decision does not match the current draft/context.'
            ));
        }
        if (decision.accepted !== expected.accepted) {
            errors.push(errorOf(
                'admission-decision-malformed',
                'accepted',
                'Admission acceptance does not match policy evaluation.'
            ));
        }
        const expectedByField = new Map(
            expected.fieldDecisions.map(item => [item.field, item.status])
        );
        for (const item of decision.fieldDecisions) {
            if (
                FORMAL_FIELDS.includes(item?.field) &&
                item.status !== expectedByField.get(item.field)
            ) {
                errors.push(errorOf(
                    'admission-decision-malformed',
                    item.field,
                    `Field decision for ${item.field} does not match policy evaluation.`
                ));
            }
        }
        if (expected.errors.length) errors.push(...clone(expected.errors));
        return immutable({
            valid: errors.length === 0,
            errors,
            warnings: clone(expected.warnings)
        });
    };

    const buildQuestionV2 = (draft, decision, options = {}) => {
        const context = createAdmissionContext(options.context || {});
        const validation = validateAdmissionDecision(decision, draft, context);
        if (!validation.valid || decision.accepted !== true) {
            const error = new Error('Admission decision is invalid.');
            error.code = 'admission-invalid';
            error.details = clone(validation.errors);
            throw error;
        }
        const id = String(options.id || draft?.formalQuestionId || '').trim();
        if (!id) {
            const error = new Error('Formal question ID is required.');
            error.code = 'admission-context-invalid';
            throw error;
        }
        const now = options.confirmedAt || context.evaluatedAt;
        const fieldProvenance = Object.fromEntries(
            decision.fieldDecisions.map(item => [item.field, clone(item)])
        );
        const identity = identityContract.resolveIdentity(
            draft, { allowLegacyRead: true }
        );
        const formalSource = {
            ...clone(draft.source || {}),
            ...clone(context.source)
        };
        if (identity.status === 'canonical') {
            delete formalSource.mode;
        } else {
            formalSource.mode = context.mode;
        }
        return immutable({
            id,
            schemaVersion: 'qisi.question.v2',
            questionNumber: draft.questionNumber,
            type: draft.type,
            stem: draft.stem,
            options: clone(draft.options || []),
            answer: draft.answer || '',
            solution: draft.solution || '',
            images: clone(draft.images || []),
            source: formalSource,
            ...(identity.status === 'canonical' ? {
                producer: clone(draft.producer),
                route: clone(draft.route)
            } : {}),
            admission: {
                schemaVersion: ADMISSION_SCHEMA_VERSION,
                decisionId: decision.decisionId,
                mode: decision.mode,
                policyVersion: POLICY_VERSION,
                draftId: decision.draftId,
                draftVersion: decision.draftVersion,
                confirmedBy: context.actorId,
                confirmedAt: now,
                idempotencyKey: context.idempotencyKey
            },
            provenance: fieldProvenance,
            recognition: clone(draft.recognition ?? null),
            createdAt: options.createdAt || now,
            updatedAt: options.updatedAt || now,
            confirmedAt: now,
            grade: draft.grade,
            diff: draft.diff,
            knowledge: draft.knowledge,
            knowledgeType: draft.knowledgeType,
            systemKnowledge: draft.systemKnowledge,
            personalKnowledge: draft.personalKnowledge,
            tags: clone(draft.tags || []),
            meta: clone(draft.meta || {})
        });
    };

    return Object.freeze({
        ADMISSION_SCHEMA_VERSION,
        POLICY_VERSION,
        ADMISSION_MODES,
        FORMAL_FIELDS,
        PROVENANCE_STATUSES,
        createAdmissionContext,
        evaluateDraftAdmission,
        validateAdmissionDecision,
        buildQuestionV2
    });
});

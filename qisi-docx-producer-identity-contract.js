(function initDocxProducerIdentityContract(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.DocxProducerIdentityContract = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CONTRACT_VERSION = 'docx-producer-identity-r1';
    const FORMAL_FIELDS = Object.freeze([
        'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
    ]);
    const SOURCE_FORMATS = Object.freeze([
        'docx', 'pdf', 'image', 'manual', 'imported-package'
    ]);
    const PRODUCER_MODES = Object.freeze([
        'deterministic-docx', 'deterministic-pdf', 'vision-ai', 'manual',
        'imported-package'
    ]);
    const ROUTES = Object.freeze({
        DOCX_DETERMINISTIC: 'docx-deterministic-import',
        DOCX_VISION: 'docx-rendered-to-pdf-vision',
        PDF_DETERMINISTIC: 'pdf-deterministic-import',
        PDF_VISION: 'pdf-vision-controlled-write'
    });
    const DOCX_VISION_TRANSITIONS = Object.freeze([
        Object.freeze({ code: 'docx-selected', reason: 'source-manifest-docx-selected' }),
        Object.freeze({ code: 'docx-rendered', reason: 'docx-rendered-for-vision' }),
        Object.freeze({ code: 'vision-route-selected', reason: 'normal-ui-docx-vision-owner' }),
        Object.freeze({ code: 'vision-engine-result-produced', reason: 'strict-vision-engine-returned' }),
        Object.freeze({ code: 'controlled-write-evaluated', reason: 'strict-json-contract-evaluated' }),
        Object.freeze({ code: 'provenance-projected', reason: 'producer-boundary-projection-complete' }),
        Object.freeze({ code: 'review-candidate-built', reason: 'canonical-review-candidate-created' })
    ]);
    const DOCX_DETERMINISTIC_TRANSITIONS = Object.freeze([
        Object.freeze({ code: 'docx-selected', reason: 'source-manifest-docx-selected' }),
        Object.freeze({ code: 'deterministic-route-selected', reason: 'docx-xml-importer-selected' }),
        Object.freeze({ code: 'deterministic-fields-produced', reason: 'docx-xml-importer-returned' }),
        Object.freeze({ code: 'provenance-projected', reason: 'producer-boundary-projection-complete' }),
        Object.freeze({ code: 'review-candidate-built', reason: 'canonical-review-candidate-created' })
    ]);
    const PDF_VISION_TRANSITIONS = Object.freeze([
        Object.freeze({ code: 'pdf-selected', reason: 'source-manifest-pdf-selected' }),
        Object.freeze({ code: 'vision-engine-result-produced', reason: 'pdf-vision-engine-returned' }),
        Object.freeze({ code: 'controlled-write-evaluated', reason: 'pdf-controlled-write-evaluated' }),
        Object.freeze({ code: 'provenance-projected', reason: 'producer-boundary-projection-complete' }),
        Object.freeze({ code: 'review-candidate-built', reason: 'canonical-review-candidate-created' })
    ]);
    const PDF_DETERMINISTIC_TRANSITIONS = Object.freeze([
        Object.freeze({ code: 'pdf-selected', reason: 'source-manifest-pdf-selected' }),
        Object.freeze({ code: 'deterministic-route-selected', reason: 'pdf-deterministic-source-selected' }),
        Object.freeze({ code: 'deterministic-fields-produced', reason: 'pdf-deterministic-source-returned' }),
        Object.freeze({ code: 'controlled-write-evaluated', reason: 'pdf-controlled-write-evaluated' }),
        Object.freeze({ code: 'provenance-projected', reason: 'producer-boundary-projection-complete' }),
        Object.freeze({ code: 'review-candidate-built', reason: 'canonical-review-candidate-created' })
    ]);
    const LEGACY_MODES = Object.freeze({
        manual: Object.freeze({
            sourceFormat: 'manual', producerMode: 'manual', routeId: 'legacy-manual'
        }),
        'docx-deterministic': Object.freeze({
            sourceFormat: 'docx', producerMode: 'deterministic-docx',
            routeId: 'legacy-docx-deterministic'
        }),
        'pdf-ai': Object.freeze({
            sourceFormat: 'pdf', producerMode: 'vision-ai', routeId: 'legacy-pdf-vision'
        }),
        'imported-package': Object.freeze({
            sourceFormat: 'imported-package', producerMode: 'imported-package',
            routeId: 'legacy-imported-package'
        })
    });
    const VOLATILE_KEYS = new Set([
        'requestId', 'timestamp', 'timestamps', 'duration', 'durationMs',
        'temporaryPath', 'tempPath', 'randomDiagnosticId', 'createdAt', 'updatedAt'
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
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    };
    const immutable = value => deepFreeze(clone(value));
    const hasValue = value => Array.isArray(value)
        ? value.length > 0
        : typeof value === 'string'
            ? Boolean(value.trim())
            : value !== null && value !== undefined;
    const errorOf = (code, path, message) => ({ code, path, message });
    const fail = (code, details = {}) => {
        const error = new Error(code);
        error.code = code;
        error.stage = 'docx-producer-identity-contract';
        error.details = clone(details);
        return error;
    };
    const stableStrings = value => Array.isArray(value)
        ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))]
        : [];
    const fieldValue = (candidate, field) => field === 'questionNumber'
        ? candidate?.questionNumber ?? candidate?.question ?? ''
        : candidate?.[field];

    function canonicalSource(input = {}, expectedFormat = '') {
        const sourceId = String(input.sourceId || input.id || '').trim();
        const format = String(input.format || '').trim().toLowerCase();
        if (!sourceId) throw fail('DOCX_SOURCE_IDENTITY_MISSING');
        if (!SOURCE_FORMATS.includes(format)) throw fail('DOCX_SOURCE_FORMAT_INVALID');
        if (expectedFormat && format !== expectedFormat) {
            throw fail('DOCX_SOURCE_FORMAT_MISMATCH', { expectedFormat, format });
        }
        if (Object.prototype.hasOwnProperty.call(input, 'mode')) {
            throw fail('DOCX_SOURCE_MODE_AXIS_MIXED');
        }
        return {
            sourceId,
            format,
            filename: String(input.filename || '').trim(),
            mimeType: String(input.mimeType || '').trim(),
            sourceOrder: Number.isInteger(input.sourceOrder) ? input.sourceOrder : 0
        };
    }

    function routeFor(identity, reason, transitions) {
        return {
            identity,
            reason,
            transitions: transitions.map(item => ({ ...item }))
        };
    }

    function producerFor(mode, routeId, routeReason, engine, deterministic) {
        return {
            mode,
            routeId,
            routeReason,
            engine: String(engine || '').trim(),
            deterministic
        };
    }

    function legacyIdentityForMode(mode) {
        const mapping = LEGACY_MODES[String(mode || '')];
        if (!mapping) return immutable({ status: 'legacy-unknown', mode: String(mode || '') });
        return immutable({
            status: 'legacy-exact',
            source: { format: mapping.sourceFormat },
            producer: { mode: mapping.producerMode, routeId: mapping.routeId },
            route: { identity: mapping.routeId, reason: 'legacy-exact-mapping' },
            legacyMode: String(mode)
        });
    }

    function validateTransitionOrder(route, expected, errors) {
        if (!Array.isArray(route?.transitions)) {
            errors.push(errorOf('route-transitions-missing', 'route.transitions',
                'Route transition history is required.'));
            return;
        }
        const actual = route.transitions.map(item => item?.code);
        const expectedCodes = expected.map(item => item.code);
        if (
            actual.length !== expectedCodes.length ||
            actual.some((code, index) => code !== expectedCodes[index])
        ) {
            errors.push(errorOf('route-transition-order-invalid', 'route.transitions',
                'Route transition order does not match the producer route.'));
        }
        route.transitions.forEach((item, index) => {
            if (!String(item?.reason || '').trim()) {
                errors.push(errorOf('route-transition-reason-missing',
                    `route.transitions[${index}].reason`, 'Route reason is required.'));
            }
        });
    }

    function validateCanonicalIdentity(value) {
        const errors = [];
        const source = value?.source;
        const producer = value?.producer;
        const route = value?.route;
        if (!isRecord(source) || !String(source.sourceId || '').trim()) {
            errors.push(errorOf('source-identity-missing', 'source.sourceId',
                'Canonical source identity is required.'));
        }
        if (!SOURCE_FORMATS.includes(source?.format)) {
            errors.push(errorOf('source-format-invalid', 'source.format',
                'Canonical source format is unsupported.'));
        }
        if (isRecord(source) && Object.prototype.hasOwnProperty.call(source, 'mode')) {
            errors.push(errorOf('source-mode-axis-mixed', 'source.mode',
                'Canonical source must not mix producer mode into source.'));
        }
        if (!isRecord(producer) || !PRODUCER_MODES.includes(producer?.mode)) {
            errors.push(errorOf('producer-identity-missing', 'producer.mode',
                'Canonical producer mode is required.'));
        }
        if (!String(producer?.routeId || '').trim() || !String(producer?.routeReason || '').trim()) {
            errors.push(errorOf('producer-route-missing', 'producer.routeId',
                'Producer route and reason are required.'));
        }
        if (!isRecord(route) || !String(route?.identity || '').trim() ||
            !String(route?.reason || '').trim()) {
            errors.push(errorOf('route-identity-missing', 'route.identity',
                'Canonical route identity and reason are required.'));
        }
        if (producer?.routeId && route?.identity && producer.routeId !== route.identity) {
            errors.push(errorOf('producer-route-mismatch', 'route.identity',
                'Producer and route identities must match.'));
        }
        if (producer?.routeReason && route?.reason && producer.routeReason !== route.reason) {
            errors.push(errorOf('producer-route-reason-mismatch', 'route.reason',
                'Producer and route reasons must match.'));
        }
        if (source?.format === 'docx' && producer?.mode === 'vision-ai') {
            if (producer.routeId !== ROUTES.DOCX_VISION || producer.deterministic !== false) {
                errors.push(errorOf('docx-vision-identity-invalid', 'producer',
                    'DOCX vision producer identity is invalid.'));
            }
            validateTransitionOrder(route, DOCX_VISION_TRANSITIONS, errors);
        }
        if (source?.format === 'docx' && producer?.mode === 'deterministic-docx') {
            if (producer.routeId !== ROUTES.DOCX_DETERMINISTIC || producer.deterministic !== true) {
                errors.push(errorOf('docx-deterministic-identity-invalid', 'producer',
                    'DOCX deterministic producer identity is invalid.'));
            }
            validateTransitionOrder(route, DOCX_DETERMINISTIC_TRANSITIONS, errors);
        }
        if (source?.format === 'pdf' && producer?.mode === 'vision-ai') {
            if (producer.routeId !== ROUTES.PDF_VISION || producer.deterministic !== false) {
                errors.push(errorOf('pdf-vision-identity-invalid', 'producer',
                    'PDF vision producer identity is invalid.'));
            }
            validateTransitionOrder(route, PDF_VISION_TRANSITIONS, errors);
        }
        if (source?.format === 'pdf' && producer?.mode === 'deterministic-pdf') {
            if (producer.routeId !== ROUTES.PDF_DETERMINISTIC || producer.deterministic !== true) {
                errors.push(errorOf('pdf-deterministic-identity-invalid', 'producer',
                    'PDF deterministic producer identity is invalid.'));
            }
            validateTransitionOrder(route, PDF_DETERMINISTIC_TRANSITIONS, errors);
        }
        if (source?.format === 'pdf' && producer?.routeId === ROUTES.DOCX_VISION) {
            errors.push(errorOf('docx-vision-source-contaminated', 'source.format',
                'A rendered DOCX must remain a DOCX source.'));
        }
        if (producer?.mode === 'vision-ai' && producer?.deterministic === true) {
            errors.push(errorOf('producer-mode-contaminated', 'producer.deterministic',
                'Vision output cannot be deterministic.'));
        }
        if (value?.supportSources !== undefined) {
            const supportSources = value.supportSources;
            if (
                !Array.isArray(supportSources) ||
                producer?.mode !== 'deterministic-docx' ||
                source?.format !== 'docx'
            ) {
                errors.push(errorOf(
                    'support-source-manifest-invalid',
                    'supportSources',
                    'Support sources require deterministic DOCX identity.'
                ));
            } else {
                const ids = new Set();
                supportSources.forEach((support, index) => {
                    const roles = stableStrings(support?.roles);
                    if (
                        !String(support?.sourceId || '').trim() ||
                        support.sourceId === source?.sourceId ||
                        support.format !== 'docx' ||
                        ids.has(support.sourceId) ||
                        !roles.length ||
                        roles.some(role =>
                            !['answer', 'solution'].includes(role)
                        )
                    ) {
                        errors.push(errorOf(
                            'support-source-manifest-invalid',
                            `supportSources[${index}]`,
                            'DOCX support source identity or role is invalid.'
                        ));
                    }
                    ids.add(support?.sourceId);
                });
            }
        }
        return immutable({ valid: errors.length === 0, errors });
    }

    function resolveIdentity(value, { allowLegacyRead = false } = {}) {
        const hasCanonicalAxis = Boolean(
            value?.producer || value?.route || value?.source?.format
        );
        if (hasCanonicalAxis) {
            const validation = validateCanonicalIdentity(value);
            return immutable({
                status: validation.valid ? 'canonical' : 'invalid',
                source: value?.source || {}, producer: value?.producer || {},
                route: value?.route || {}, errors: validation.errors
            });
        }
        if (!allowLegacyRead) {
            return immutable({
                status: 'invalid',
                errors: [errorOf('canonical-identity-missing', '$',
                    'Canonical source, producer, and route are required.')]
            });
        }
        return legacyIdentityForMode(value?.source?.mode);
    }

    function provenanceEntry({
        field, kind, source, producer, page, blockIds, decisionId,
        accepted, reasonCode, evidenceRef, producerBoundary
    }) {
        const entry = {
            field,
            kind,
            status: kind,
            sourceId: source.sourceId,
            sourceFormat: source.format,
            producerMode: producer.mode,
            routeId: producer.routeId,
            engine: producer.engine,
            page: Number(page || 0),
            blockIds: stableStrings(blockIds),
            controlledWriteDecisionId: String(decisionId || ''),
            controlledWriteAccepted: accepted === true,
            manuallyEdited: false,
            reasonCode: String(reasonCode || ''),
            producerBoundary,
            contractVersion: CONTRACT_VERSION
        };
        if (evidenceRef) entry.evidenceRef = String(evidenceRef);
        return entry;
    }

    function assertSafeVisionContent(candidate) {
        if (candidate?.rawJsonCandidate === true) throw fail('DOCX_VISION_RAW_JSON_REJECTED');
        for (const field of FORMAL_FIELDS) {
            const values = Array.isArray(fieldValue(candidate, field))
                ? fieldValue(candidate, field)
                : [fieldValue(candidate, field)];
            for (const value of values) {
                if (typeof value !== 'string') continue;
                const text = value.trim();
                if (/^```(?:json)?/i.test(text) || /^\s*[\[{]\s*"questions"\s*:/i.test(text)) {
                    throw fail('DOCX_VISION_RAW_JSON_REJECTED', { field });
                }
                if (/\[placeholder\]|\{\{[^}]+\}\}|待补充|PLACEHOLDER/i.test(text)) {
                    throw fail('DOCX_VISION_PLACEHOLDER_REJECTED', { field });
                }
            }
        }
    }

    function buildDocxVisionControlledWriteDecision(candidate) {
        if (!isRecord(candidate)) throw fail('DOCX_VISION_CANDIDATE_INVALID');
        const strict = isRecord(candidate.sourceTrace?.strictProtocol)
            ? candidate.sourceTrace.strictProtocol : {};
        const provenFields = Object.entries(
            isRecord(candidate.fieldProvenance) ? candidate.fieldProvenance : {}
        ).filter(([, evidence]) =>
            evidence?.status === 'controlled-write' &&
            evidence?.controlledWriteAccepted === true
        ).map(([field]) => field);
        return immutable({
            ...strict,
            accepted: strict.accepted === true ||
                candidate.controlledWrite?.evaluated === true,
            decisionId: strict.decisionId ||
                candidate.controlledWrite?.decisionId || '',
            sourceId: strict.sourceId ||
                candidate.source?.sourceId ||
                candidate.sourceDocxFileId ||
                candidate.sourceFileId || '',
            fields: stableStrings([
                ...(strict.fields || []),
                ...(candidate.controlledWrite?.acceptedFields || []),
                ...provenFields
            ]),
            engine: strict.engine || strict.model ||
                candidate.producer?.engine || ''
        });
    }

    function projectDocxVisionCandidate(input = {}) {
        const candidate = input.candidate;
        if (!isRecord(candidate)) throw fail('DOCX_VISION_CANDIDATE_INVALID');
        assertSafeVisionContent(candidate);
        const source = canonicalSource(input.source, 'docx');
        const decision = input.controlledWriteDecision;
        if (!isRecord(decision) || decision.accepted !== true ||
            !String(decision.decisionId || '').trim()) {
            throw fail('DOCX_CONTROLLED_WRITE_MISSING');
        }
        if (decision.sourceId && String(decision.sourceId) !== source.sourceId) {
            throw fail('DOCX_CONTROLLED_WRITE_SOURCE_MISMATCH');
        }
        const rawAccepted = Array.isArray(decision.acceptedFields)
            ? decision.acceptedFields
            : decision.fields;
        if (!Array.isArray(rawAccepted)) throw fail('DOCX_CONTROLLED_WRITE_MALFORMED');
        const acceptedFields = stableStrings(rawAccepted);
        if (acceptedFields.length !== rawAccepted.length ||
            acceptedFields.some(field => !FORMAL_FIELDS.includes(field))) {
            throw fail('DOCX_CONTROLLED_WRITE_CONFLICT');
        }
        const engine = String(input.engine || decision.engine || '').trim();
        if (!engine) throw fail('DOCX_VISION_ENGINE_IDENTITY_MISSING');
        const routeReason = 'normal-ui-docx-vision-owner';
        const producer = producerFor(
            'vision-ai', ROUTES.DOCX_VISION, routeReason, engine, false
        );
        const route = routeFor(
            ROUTES.DOCX_VISION, routeReason, DOCX_VISION_TRANSITIONS
        );
        const rejectedFields = [];
        const missingFields = [];
        const provenance = {};
        for (const field of FORMAL_FIELDS) {
            const present = hasValue(fieldValue(candidate, field));
            const accepted = acceptedFields.includes(field);
            let kind;
            let reasonCode;
            if (accepted && present) {
                kind = 'controlled-write';
                reasonCode = 'strict-json-contract-accepted';
            } else if (present) {
                kind = 'rejected';
                reasonCode = 'field-not-authorized-by-controlled-write';
                rejectedFields.push(field);
            } else {
                kind = 'missing';
                reasonCode = accepted
                    ? 'controlled-write-accepted-field-empty'
                    : 'field-not-produced';
                missingFields.push(field);
            }
            provenance[field] = provenanceEntry({
                field, kind, source, producer, page: input.page,
                blockIds: input.blockIds, decisionId: decision.decisionId,
                accepted: kind === 'controlled-write', reasonCode,
                producerBoundary: 'docx-vision-engine-output-to-candidate'
            });
        }
        const output = {
            ...clone(candidate),
            source,
            producer,
            route,
            fieldProvenance: provenance,
            controlledWrite: {
                evaluated: true,
                decisionId: String(decision.decisionId),
                acceptedFields,
                rejectedFields,
                method: String(decision.method || 'strict-json-contract')
            },
            supportLevel: rejectedFields.length
                ? 'rejected'
                : missingFields.length ? 'safe-partial' : 'full',
            manualReviewRequired: rejectedFields.length > 0 || missingFields.length > 0,
            canonicalReviewHandoff: rejectedFields.length === 0,
            producerIdentityContractVersion: CONTRACT_VERSION
        };
        const identity = validateCanonicalIdentity(output);
        if (!identity.valid) throw fail('DOCX_PRODUCER_IDENTITY_INVALID', identity);
        return immutable(output);
    }

    function projectDeterministicDocxCandidate(input = {}) {
        const candidate = input.candidate;
        if (!isRecord(candidate)) throw fail('DOCX_DETERMINISTIC_CANDIDATE_INVALID');
        const source = canonicalSource(input.source, 'docx');
        const engine = String(input.engine || 'docx-xml-importer').trim();
        const routeReason = 'docx-xml-importer-selected';
        const producer = producerFor(
            'deterministic-docx', ROUTES.DOCX_DETERMINISTIC,
            routeReason, engine, true
        );
        const route = routeFor(
            ROUTES.DOCX_DETERMINISTIC, routeReason,
            DOCX_DETERMINISTIC_TRANSITIONS
        );
        const provenance = {};
        const questionIdentity = String(
            candidate.questionNumber || candidate.question || input.index + 1 || 1
        );
        for (const field of FORMAL_FIELDS) {
            const present = hasValue(fieldValue(candidate, field));
            const evidenceRef = present
                ? String(input.evidenceRefs?.[field] ||
                    `docx:${source.sourceId}:question:${questionIdentity}:field:${field}`)
                : '';
            provenance[field] = provenanceEntry({
                field,
                kind: present ? 'deterministic-source' : 'missing',
                source,
                producer,
                page: input.page || 1,
                blockIds: input.blockIds,
                accepted: false,
                reasonCode: present
                    ? 'docx-xml-importer-field-produced'
                    : 'field-not-produced',
                evidenceRef,
                producerBoundary: 'docx-deterministic-source-to-candidate'
            });
        }
        const output = {
            ...clone(candidate),
            source,
            producer,
            route,
            fieldProvenance: provenance,
            controlledWrite: { evaluated: false, acceptedFields: [], rejectedFields: [] },
            producerIdentityContractVersion: CONTRACT_VERSION
        };
        const identity = validateCanonicalIdentity(output);
        if (!identity.valid) throw fail('DOCX_PRODUCER_IDENTITY_INVALID', identity);
        return immutable(output);
    }

    function applyDocxVisionSupportField(input = {}) {
        const candidate = input.candidate;
        const field = String(input.field || '').trim();
        if (!isRecord(candidate) || !['answer', 'solution'].includes(field)) {
            throw fail('DOCX_VISION_SUPPORT_INPUT_INVALID');
        }
        const identity = validateCanonicalIdentity(candidate);
        if (
            !identity.valid || candidate.source?.format !== 'docx' ||
            candidate.producer?.routeId !== ROUTES.DOCX_VISION
        ) throw fail('DOCX_PRODUCER_IDENTITY_INVALID', identity);
        const value = fieldValue(input.support, field);
        if (!hasValue(value)) throw fail('DOCX_VISION_SUPPORT_VALUE_MISSING');
        if (hasValue(candidate[field]) && candidate[field] !== value) {
            throw fail('DOCX_CONTROLLED_WRITE_CONFLICT', { field });
        }
        const source = canonicalSource(input.source, 'docx');
        const decision = input.controlledWriteDecision;
        const acceptedFields = stableStrings(
            decision?.acceptedFields || decision?.fields
        );
        if (
            !isRecord(decision) || decision.accepted !== true ||
            !String(decision.decisionId || '').trim() ||
            acceptedFields.length !== 1 || acceptedFields[0] !== field
        ) throw fail('DOCX_CONTROLLED_WRITE_MISSING', { field });
        if (decision.sourceId && String(decision.sourceId) !== source.sourceId) {
            throw fail('DOCX_CONTROLLED_WRITE_SOURCE_MISMATCH', { field });
        }
        const engine = String(decision.engine || input.engine || '').trim();
        if (!engine) throw fail('DOCX_VISION_ENGINE_IDENTITY_MISSING');
        const supportProducer = producerFor(
            'vision-ai', ROUTES.DOCX_VISION,
            'normal-ui-docx-vision-support-owner', engine, false
        );
        const output = clone(candidate);
        output[field] = clone(value);
        output.fieldProvenance = {
            ...(output.fieldProvenance || {}),
            [field]: provenanceEntry({
                field,
                kind: 'controlled-write',
                source,
                producer: supportProducer,
                page: input.support?.sourcePage || input.page,
                blockIds: input.support?.blockIds ||
                    input.support?.sourceTrace?.blockIds || [],
                decisionId: decision.decisionId,
                accepted: true,
                reasonCode: 'strict-json-contract-accepted',
                producerBoundary: 'docx-vision-support-output-to-candidate'
            })
        };
        const previousDecisionIds = stableStrings([
            ...(output.controlledWrite?.decisionIds || []),
            output.controlledWrite?.decisionId
        ]);
        output.controlledWrite = {
            ...(output.controlledWrite || {}),
            evaluated: true,
            acceptedFields: stableStrings([
                ...(output.controlledWrite?.acceptedFields || []),
                field
            ]),
            decisionIds: stableStrings([
                ...previousDecisionIds,
                decision.decisionId
            ]),
            supportDecisions: [
                ...(output.controlledWrite?.supportDecisions || []),
                {
                    field,
                    decisionId: String(decision.decisionId),
                    sourceId: source.sourceId,
                    engine,
                    method: String(decision.method || 'strict-json-contract')
                }
            ]
        };
        const rejectedFields = FORMAL_FIELDS.filter(name =>
            output.fieldProvenance?.[name]?.status === 'rejected'
        );
        const missingFields = FORMAL_FIELDS.filter(name =>
            output.fieldProvenance?.[name]?.status === 'missing'
        );
        output.controlledWrite.rejectedFields = rejectedFields;
        output.supportLevel = rejectedFields.length
            ? 'rejected'
            : missingFields.length ? 'safe-partial' : 'full';
        output.manualReviewRequired = output.supportLevel !== 'full';
        output.canonicalReviewHandoff = rejectedFields.length === 0;
        const updatedIdentity = validateCanonicalIdentity(output);
        if (!updatedIdentity.valid) {
            throw fail('DOCX_PRODUCER_IDENTITY_INVALID', updatedIdentity);
        }
        return immutable(output);
    }

    function applyDeterministicDocxSupportField(input = {}) {
        const candidate = input.candidate;
        const field = String(input.field || '').trim();
        if (!isRecord(candidate) || !['answer', 'solution'].includes(field)) {
            throw fail('DOCX_DETERMINISTIC_SUPPORT_INPUT_INVALID');
        }
        const identity = validateCanonicalIdentity(candidate);
        if (
            !identity.valid ||
            candidate.source?.format !== 'docx' ||
            candidate.producer?.routeId !== ROUTES.DOCX_DETERMINISTIC
        ) throw fail('DOCX_PRODUCER_IDENTITY_INVALID', identity);
        const value = fieldValue(input.support, field);
        if (!hasValue(value)) {
            throw fail('DOCX_DETERMINISTIC_SUPPORT_VALUE_MISSING', { field });
        }
        const candidateQuestion = String(
            candidate.questionNumber || candidate.question || ''
        ).trim();
        const supportQuestion = String(
            input.support?.questionNumber || input.support?.question || ''
        ).trim();
        if (!candidateQuestion || supportQuestion !== candidateQuestion) {
            throw fail('DOCX_DETERMINISTIC_SUPPORT_QUESTION_MISMATCH', {
                field, candidateQuestion, supportQuestion
            });
        }
        if (hasValue(candidate[field]) && candidate[field] !== value) {
            throw fail('DOCX_DETERMINISTIC_SUPPORT_CONFLICT', { field });
        }
        const source = canonicalSource(input.source, 'docx');
        const roles = stableStrings(input.roles).filter(role => role !== 'full');
        if (!roles.includes(field) ||
            roles.some(role => !['answer', 'solution'].includes(role))) {
            throw fail('DOCX_DETERMINISTIC_SUPPORT_ROLE_INVALID', { field });
        }
        const producer = clone(candidate.producer);
        const output = clone(candidate);
        output[field] = clone(value);
        output.supportSources = [
            ...(output.supportSources || []).filter(item =>
                item.sourceId !== source.sourceId
            ),
            { ...source, roles }
        ];
        output.fieldProvenance = {
            ...(output.fieldProvenance || {}),
            [field]: provenanceEntry({
                field,
                kind: 'deterministic-source',
                source,
                producer,
                page: input.support?.sourcePage || 1,
                blockIds: input.support?.blockIds || [],
                accepted: false,
                reasonCode: 'docx-support-exact-question-match',
                evidenceRef:
                    `docx:${source.sourceId}:question:${candidateQuestion}:field:${field}`,
                producerBoundary:
                    'docx-deterministic-support-to-candidate'
            })
        };
        const updatedIdentity = validateCanonicalIdentity(output);
        if (!updatedIdentity.valid) {
            throw fail('DOCX_PRODUCER_IDENTITY_INVALID', updatedIdentity);
        }
        return immutable(output);
    }

    function canonicalComparable(value) {
        if (Array.isArray(value)) return value.map(canonicalComparable);
        if (!isRecord(value)) return value;
        return Object.fromEntries(
            Object.keys(value).sort()
                .filter(key => !VOLATILE_KEYS.has(key))
                .map(key => [key, canonicalComparable(value[key])])
        );
    }

    function compareValues(left, right, path = '$') {
        if (JSON.stringify(left) === JSON.stringify(right)) return [];
        if (Array.isArray(left) && Array.isArray(right)) {
            const output = [];
            const length = Math.max(left.length, right.length);
            for (let index = 0; index < length; index += 1) {
                output.push(...compareValues(left[index], right[index], `${path}[${index}]`));
            }
            return output;
        }
        if (isRecord(left) && isRecord(right)) {
            const output = [];
            const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
            for (const key of keys) {
                output.push(...compareValues(left[key], right[key], `${path}.${key}`));
            }
            return output;
        }
        return [{ path, legacyValue: clone(left), bridgeValue: clone(right), severity: 'safety' }];
    }

    function compareCanonicalDocxCandidates(left, right) {
        return immutable(compareValues(
            canonicalComparable(left), canonicalComparable(right)
        ));
    }

    return Object.freeze({
        CONTRACT_VERSION,
        FORMAL_FIELDS,
        SOURCE_FORMATS,
        PRODUCER_MODES,
        ROUTES,
        DOCX_VISION_TRANSITIONS,
        DOCX_DETERMINISTIC_TRANSITIONS,
        PDF_VISION_TRANSITIONS,
        PDF_DETERMINISTIC_TRANSITIONS,
        legacyIdentityForMode,
        resolveIdentity,
        validateCanonicalIdentity,
        buildDocxVisionControlledWriteDecision,
        projectDocxVisionCandidate,
        applyDocxVisionSupportField,
        projectDeterministicDocxCandidate,
        applyDeterministicDocxSupportField,
        compareCanonicalDocxCandidates
    });
});

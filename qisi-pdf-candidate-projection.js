(function initPdfCandidateProjection(root) {
    'use strict';

    const identityContract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );

    const FIELDS = Object.freeze([
        'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
    ]);
    const SUPPORT_FIELDS = new Set(['answer', 'solution']);
    const ALLOWED_SOURCE_MODES = new Set([
        'pdf-ai',
        'pdf-deterministic',
        'manual',
        'docx-deterministic',
        'imported-package'
    ]);
    const VOLATILE_KEYS = new Set([
        'requestId', 'timestamp', 'timestamps', 'createdAt', 'updatedAt',
        'duration', 'durationMs', 'temporaryPath', 'temporaryFilePath',
        'tempPath', 'tempFilePath', 'filePath', 'randomDiagnosticId'
    ]);

    class PdfCandidateProjectionError extends Error {
        constructor(code) {
            super(code);
            this.name = 'PdfCandidateProjectionError';
            this.code = code;
            this.stage = 'pdf-candidate-projection';
        }
    }

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

    const freeze = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.values(value).forEach(freeze);
        return Object.freeze(value);
    };

    const immutable = value => freeze(clone(value));
    const cleanString = value => String(value ?? '').trim();
    const finiteNumberOrNull = value => {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    };
    const normalizeQuestionNumber = value => {
        const match = cleanString(value).match(/\d{1,3}/);
        return match ? String(Number(match[0])) : '';
    };
    const fieldValue = (question, field) => {
        if (field === 'options' || field === 'images') {
            return Array.isArray(question?.[field]) ? clone(question[field]) : [];
        }
        return cleanString(question?.[field]);
    };
    const hasValue = value => Array.isArray(value)
        ? value.length > 0
        : Boolean(cleanString(value));

    function createError(code) {
        return new PdfCandidateProjectionError(code);
    }

    function deriveSourceMode(source, engineResult) {
        const explicit = [
            source?.mode,
            source?.manifest?.mode,
            source?.executionContext?.sourceMode,
            engineResult?.sourceMode,
            engineResult?.executionContext?.sourceMode,
            engineResult?.actualImportRoute
        ].map(cleanString).find(Boolean);
        if (explicit) {
            if (!ALLOWED_SOURCE_MODES.has(explicit)) {
                throw createError('source-mode-invalid');
            }
            return explicit;
        }

        const sourceKind = cleanString(
            engineResult?.sourceKind ||
            engineResult?.executionContext?.sourceKind
        ).toLowerCase().replace(/[\s_-]+/g, '');
        if (/^(textlayer|pdftext|deterministictext)$/.test(sourceKind)) {
            return 'pdf-deterministic';
        }
        if (/^(ocrmarkdown|ocr|vision|pdfocr|aimarkdown)$/.test(sourceKind)) {
            return 'pdf-ai';
        }
        throw createError('source-mode-missing');
    }

    function producerIdentity(sourceMode, engine) {
        const deterministic = sourceMode === 'pdf-deterministic';
        if (!deterministic && sourceMode !== 'pdf-ai') {
            throw createError('pdf-source-mode-invalid');
        }
        const routeId = deterministic
            ? identityContract?.ROUTES?.PDF_DETERMINISTIC
            : identityContract?.ROUTES?.PDF_VISION;
        const routeReason = deterministic
            ? 'pdf-deterministic-source-selected'
            : 'pdf-engine-controlled-write-projection';
        const transitions = deterministic
            ? identityContract?.PDF_DETERMINISTIC_TRANSITIONS
            : identityContract?.PDF_VISION_TRANSITIONS;
        if (!routeId || !Array.isArray(transitions)) {
            throw createError('pdf-producer-identity-contract-missing');
        }
        return {
            sourceFormat: 'pdf',
            producer: {
                mode: deterministic ? 'deterministic-pdf' : 'vision-ai',
                routeId,
                routeReason,
                engine,
                deterministic
            },
            route: {
                identity: routeId,
                reason: routeReason,
                transitions: transitions.map(item => ({ ...item }))
            },
            producerBoundary: deterministic
                ? 'pdf-deterministic-source-to-candidate'
                : 'pdf-vision-engine-output-to-candidate'
        };
    }

    function assertControlledWrite(decision) {
        if (
            !isRecord(decision) ||
            !Array.isArray(decision.fieldDecisions) ||
            !Array.isArray(decision.effectiveAnswerItems) ||
            !Array.isArray(decision.effectiveSolutionItems) ||
            !isRecord(decision.controlledWriteSummary)
        ) {
            throw createError('controlled-write-missing');
        }
        return decision;
    }

    function decisionFor(decision, questionNumber, field) {
        return decision.fieldDecisions.find(item =>
            normalizeQuestionNumber(item?.questionNumber) === questionNumber &&
            item?.field === field
        ) || null;
    }

    function engineDecisionFor(engineResult, questionNumber, field) {
        const strict = engineResult?.strictProtocol;
        if (
            isRecord(strict) &&
            strict.accepted === true &&
            cleanString(strict.decisionId) &&
            Array.isArray(strict.fields) &&
            strict.fields.includes(field)
        ) {
            return {
                questionNumber,
                field,
                accepted: true,
                decisionId: cleanString(strict.decisionId),
                reason: cleanString(strict.method) || 'strict-protocol-accepted'
            };
        }
        if (!Array.isArray(engineResult?.fieldDecisions)) return null;
        const decision = engineResult.fieldDecisions.find(item =>
            normalizeQuestionNumber(item?.questionNumber) === questionNumber &&
            item?.field === field && item?.accepted === true
        );
        return decision ? {
            ...decision,
            decisionId: cleanString(decision.decisionId || engineResult.decisionId)
        } : null;
    }

    function supportItemFor(decision, questionNumber, field) {
        const items = field === 'answer'
            ? decision.effectiveAnswerItems
            : decision.effectiveSolutionItems;
        return items.find(item =>
            normalizeQuestionNumber(
                item?.questionNumber ?? item?.question ?? item?.no ?? item?.order
            ) === questionNumber
        ) || null;
    }

    function supportItemValue(item, field) {
        if (!isRecord(item)) return '';
        if (field === 'answer') {
            return cleanString(item.answer ?? item.answerRaw ?? item.value);
        }
        return cleanString(item.solution ?? item.solutionRaw ?? item.explanation);
    }

    function stableCode(value, fallback = 'pdf-projection-warning') {
        const raw = cleanString(value);
        return /^[a-zA-Z0-9_.:-]{1,100}$/.test(raw) ? raw : fallback;
    }

    function warningOf(value) {
        if (typeof value === 'string') return { code: stableCode(value) };
        if (!isRecord(value)) return null;
        const warning = { code: stableCode(value.code || value.reason) };
        if (value.field && FIELDS.includes(value.field)) warning.field = value.field;
        const questionNumber = normalizeQuestionNumber(value.questionNumber);
        if (questionNumber) warning.questionNumber = questionNumber;
        return warning;
    }

    function stableWarnings(...lists) {
        const seen = new Set();
        const warnings = [];
        for (const value of lists.flat()) {
            const warning = warningOf(value);
            if (!warning) continue;
            const key = JSON.stringify(warning);
            if (seen.has(key)) continue;
            seen.add(key);
            warnings.push(warning);
        }
        return warnings;
    }

    function evidencePage(fieldEvidence, item, pageContext) {
        const values = [
            fieldEvidence?.page,
            item?.page,
            item?.sourceTrace?.page,
            item?.sourceTrace?.sourcePage,
            item?.sourceTrace?.pageIndex,
            item?.evidence?.page,
            item?.sourcePage,
            pageContext?.page
        ];
        const page = values.find(value => Number.isInteger(Number(value)) && Number(value) > 0);
        return page === undefined ? null : Number(page);
    }

    function evidenceBlockIds(fieldEvidence, item) {
        const values = [
            ...(Array.isArray(fieldEvidence?.blockIds) ? fieldEvidence.blockIds : []),
            ...(Array.isArray(item?.blockIds) ? item.blockIds : []),
            ...(Array.isArray(item?.sourceTrace?.blockIds) ? item.sourceTrace.blockIds : []),
            item?.evidenceId,
            item?.evidence?.evidenceId,
            item?.sourceTrace?.blockId
        ];
        return [...new Set(values.map(cleanString).filter(Boolean))];
    }

    function provenanceEntry({
        kind,
        sourceId,
        page,
        blockIds,
        engine,
        decisionId,
        manuallyEdited = false,
        reason,
        identity
    }) {
        return {
            kind,
            status: kind,
            sourceId,
            page,
            blockIds,
            engine,
            controlledWriteDecisionId: decisionId,
            ...(kind === 'controlled-write'
                ? { controlledWriteAccepted: true }
                : {}),
            manuallyEdited,
            reason,
            reasonCode: reason,
            sourceFormat: identity.sourceFormat,
            producerMode: identity.producer.mode,
            routeId: identity.producer.routeId,
            producerBoundary: identity.producerBoundary,
            contractVersion: identityContract.CONTRACT_VERSION
        };
    }

    function projectionForField({
        field,
        mode,
        rawValue,
        fieldEvidence,
        item,
        decision,
        engineDecision,
        sourceId,
        pageContext,
        engine,
        decisionId,
        identity
    }) {
        const accepted = decision && decision.source !== 'none' && item;
        const rejected = decision && decision.source === 'none';
        const page = evidencePage(fieldEvidence, item, pageContext);
        const blockIds = evidenceBlockIds(fieldEvidence, item);

        if (SUPPORT_FIELDS.has(field)) {
            if (accepted) {
                return {
                    value: supportItemValue(item, field),
                    provenance: provenanceEntry({
                        kind: 'controlled-write', sourceId, page, blockIds,
                        engine, decisionId, identity,
                        reason: cleanString(decision.reason) ||
                            'controlled-write-accepted'
                    })
                };
            }
            return {
                value: '',
                provenance: provenanceEntry({
                    kind: rejected ? 'rejected' : 'missing', identity,
                    sourceId, page, blockIds, engine, decisionId,
                    reason: rejected
                        ? cleanString(decision.reason) || 'controlled-write-rejected'
                        : `${field}-missing`
                })
            };
        }

        if (mode === 'pdf-ai') {
            if (engineDecision) {
                return {
                    value: rawValue,
                    provenance: provenanceEntry({
                        kind: 'controlled-write', sourceId, page, blockIds,
                        engine,
                        identity, decisionId: cleanString(
                            engineDecision.decisionId || decisionId
                        ),
                        reason: cleanString(engineDecision.reason) ||
                            'strict-engine-field-accepted'
                    })
                };
            }
            return {
                value: Array.isArray(rawValue) ? [] : '',
                provenance: provenanceEntry({
                    kind: hasValue(rawValue) ? 'rejected' : 'missing', identity,
                    sourceId, page, blockIds, engine, decisionId,
                    reason: hasValue(rawValue)
                        ? 'pdf-ai-controlled-write-field-missing'
                        : `${field}-missing`
                })
            };
        }

        if (
            mode === 'manual' &&
            fieldEvidence?.manuallyEdited === true
        ) {
            return {
                value: rawValue,
                provenance: provenanceEntry({
                    kind: 'manual', sourceId, page, blockIds, engine,
                    decisionId, manuallyEdited: true, identity,
                    reason: 'manual-field-edit'
                })
            };
        }

        const evidenceExists = isRecord(fieldEvidence);
        const kind = evidenceExists && (hasValue(rawValue) || Array.isArray(rawValue))
            ? 'deterministic-source'
            : 'missing';
        return {
            value: kind === 'missing'
                ? (Array.isArray(rawValue) ? [] : '')
                : rawValue,
            provenance: provenanceEntry({
                kind, sourceId, page, blockIds, engine, decisionId, identity,
                reason: kind === 'deterministic-source'
                    ? 'deterministic-source-evidence'
                    : `${field}-missing`
            })
        };
    }

    function evidenceReferences(evidence, fieldRows) {
        const refs = Array.isArray(evidence?.rawEvidenceRefs)
            ? evidence.rawEvidenceRefs.map(clone)
            : [];
        for (const row of Object.values(fieldRows)) {
            for (const blockId of row.provenance.blockIds) {
                refs.push({ evidenceId: blockId });
            }
        }
        const seen = new Set();
        return refs.filter(ref => {
            if (!isRecord(ref)) return false;
            const identity = cleanString(
                ref.evidenceId || ref.imageId || ref.blockId || ref.id
            );
            const key = identity || JSON.stringify(ref);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function projectPdfCandidate(input = {}) {
        const sourceId = cleanString(input.source?.sourceId || input.source?.id);
        if (!sourceId) throw createError('source-id-missing');
        const sourceMode = deriveSourceMode(input.source, input.engineResult);
        const controlledWrite = assertControlledWrite(
            input.controlledWriteDecision
        );
        const question = isRecord(input.parsedQuestion)
            ? input.parsedQuestion
            : {};
        const rawQuestionNumber = normalizeQuestionNumber(
            question.questionNumber ?? question.question ?? question.no ?? question.order
        );
        const engine = cleanString(
            input.engineResult?.engine ||
            input.engineResult?.executionContext?.engine
        );
        if (!engine) throw createError('pdf-producer-engine-missing');
        const identity = producerIdentity(sourceMode, engine);
        const decisionId = cleanString(controlledWrite.decisionId);
        const fieldRows = {};

        for (const field of FIELDS) {
            const decision = decisionFor(
                controlledWrite, rawQuestionNumber, field
            );
            const engineDecision = engineDecisionFor(
                input.engineResult, rawQuestionNumber, field
            );
            const item = SUPPORT_FIELDS.has(field)
                ? supportItemFor(controlledWrite, rawQuestionNumber, field)
                : null;
            fieldRows[field] = projectionForField({
                field,
                mode: sourceMode,
                rawValue: field === 'questionNumber'
                    ? rawQuestionNumber
                    : fieldValue(question, field),
                fieldEvidence: input.evidence?.fields?.[field],
                item,
                decision,
                engineDecision,
                sourceId,
                pageContext: input.pageContext,
                engine,
                decisionId,
                identity
            });
        }

        const rawJsonCandidate = question.rawJsonCandidate === true;
        if (rawJsonCandidate) {
            for (const field of FIELDS) {
                const row = fieldRows[field];
                row.value = Array.isArray(row.value) ? [] : '';
                row.provenance = provenanceEntry({
                    kind: 'rejected',
                    sourceId: row.provenance.sourceId,
                    page: row.provenance.page,
                    blockIds: row.provenance.blockIds,
                    engine: row.provenance.engine,
                    decisionId: row.provenance.controlledWriteDecisionId,
                    manuallyEdited: false,
                    reason: 'raw-json-candidate',
                    identity
                });
            }
        }

        const safeQuestionNumbers = new Set(
            (input.alignmentResult?.safeQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean)
        );
        const fusedQuestionNumbers = new Set(
            (input.alignmentResult?.fusedQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean)
        );
        const alignmentMode = cleanString(input.alignmentResult?.mode);
        const isAligned = Boolean(
            rawQuestionNumber &&
            safeQuestionNumbers.has(rawQuestionNumber) &&
            !fusedQuestionNumbers.has(rawQuestionNumber) &&
            alignmentMode !== 'fail-closed'
        );
        const validation = {
            schemaValid: input.validation?.schemaValid === true &&
                !rawJsonCandidate &&
                Boolean(cleanString(question.type)) &&
                isRecord(question),
            sequenceValid: input.validation?.sequenceValid === true && isAligned,
            ownershipValid: input.validation?.ownershipValid === true
        };

        const provenance = Object.fromEntries(
            FIELDS.map(field => [field, fieldRows[field].provenance])
        );
        const kinds = Object.values(provenance).map(item => item.kind);
        const coreRejected = ['questionNumber', 'stem'].some(field =>
            ['rejected', 'missing'].includes(provenance[field].kind)
        );
        const validityRejected = !validation.schemaValid ||
            !validation.sequenceValid ||
            !validation.ownershipValid;
        let supportLevel = 'rejected';
        if (!coreRejected && !validityRejected) {
            if (alignmentMode === 'prefix') {
                supportLevel = 'prefix';
            } else if (kinds.some(kind => ['rejected', 'missing'].includes(kind))) {
                supportLevel = 'safe-partial';
            } else {
                supportLevel = 'full';
            }
        }

        const warnings = stableWarnings(
            input.engineResult?.warnings || [],
            input.alignmentResult?.warnings || [],
            input.alignmentResult?.fusedWarnings || [],
            controlledWrite.warnings || [],
            input.evidence?.formulaFallback ? [{ code: 'formula-fallback' }] : [],
            input.evidence?.engineConflict ? [{ code: 'engine-conflict' }] : [],
            rawJsonCandidate ? [{ code: 'raw-json-candidate' }] : []
        );
        const acceptedFields = FIELDS.filter(field =>
            provenance[field].kind === 'controlled-write'
        );
        const rejectedFields = FIELDS.filter(field =>
            provenance[field].kind === 'rejected'
        );
        const incompleteProvenance = Object.values(provenance).some(item =>
            !item.sourceId || item.page === null ||
            (item.kind === 'controlled-write' && !item.controlledWriteDecisionId)
        );
        const manualReviewRequired = supportLevel !== 'full' ||
            kinds.some(kind => ['rejected', 'missing'].includes(kind)) ||
            input.evidence?.formulaFallback === true ||
            alignmentMode === 'prefix' ||
            input.evidence?.engineConflict === true ||
            incompleteProvenance ||
            input.evidence?.userInterventionRequired === true;

        const output = {
            id: cleanString(question.id),
            source: {
                sourceId,
                format: identity.sourceFormat,
                sourceType: cleanString(input.source?.sourceType) || 'pdf',
                filename: cleanString(input.source?.filename),
                mimeType: cleanString(input.source?.mimeType),
                page: evidencePage(null, null, input.pageContext),
                sourceOrder: finiteNumberOrNull(
                    input.source?.sourceOrder ?? input.pageContext?.sourceOrder
                )
            },
            producer: identity.producer,
            route: identity.route,
            questionNumber: fieldRows.questionNumber.value,
            type: rawJsonCandidate ? '' : cleanString(question.type),
            stem: fieldRows.stem.value,
            options: fieldRows.options.value,
            answer: fieldRows.answer.value,
            solution: fieldRows.solution.value,
            images: fieldRows.images.value,
            fieldProvenance: provenance,
            supportLevel,
            manualReviewRequired,
            controlledWrite: {
                evaluated: true,
                decisionId,
                acceptedFields,
                rejectedFields,
                errors: stableWarnings(
                    controlledWrite.errors || [],
                    validityRejected
                        ? [
                            !validation.schemaValid
                                ? { code: 'schema-invalid' }
                                : null,
                            !validation.sequenceValid
                                ? { code: 'sequence-invalid' }
                                : null,
                            !validation.ownershipValid
                                ? { code: 'ownership-invalid' }
                                : null
                        ].filter(Boolean)
                        : []
                ),
                warnings: stableWarnings(controlledWrite.warnings || [])
            },
            validation,
            warnings,
            rawEvidenceRefs: evidenceReferences(input.evidence, fieldRows),
            diagnostics: {
                requestId: cleanString(
                    input.engineResult?.requestId || input.evidence?.requestId
                ),
                controlledWriteDecisionId: decisionId
            }
        };
        const identityValidation = identityContract.validateCanonicalIdentity(output);
        if (!identityValidation.valid) {
            throw createError('pdf-producer-identity-invalid');
        }
        return immutable(output);
    }

    function mergeControlledWriteDecisions(decisions = [], decisionId = '') {
        const results = (Array.isArray(decisions) ? decisions : [])
            .map(assertControlledWrite);
        if (!results.length) throw createError('controlled-write-missing');

        const fieldDecisionMap = new Map();
        const acceptedItemMaps = {
            answer: new Map(),
            solution: new Map()
        };
        const acceptDecision = item => item?.source && item.source !== 'none';
        for (const result of results) {
            for (const item of result.fieldDecisions) {
                const questionNumber = normalizeQuestionNumber(item?.questionNumber);
                const field = cleanString(item?.field);
                if (!questionNumber || !SUPPORT_FIELDS.has(field)) continue;
                const key = `${questionNumber}:${field}`;
                const current = fieldDecisionMap.get(key);
                if (!current || (!acceptDecision(current) && acceptDecision(item))) {
                    fieldDecisionMap.set(key, clone({ ...item, questionNumber, field }));
                }
                if (!acceptDecision(item)) continue;

                const effectiveItems = field === 'answer'
                    ? result.effectiveAnswerItems
                    : result.effectiveSolutionItems;
                const effectiveItem = effectiveItems.find(candidate =>
                    normalizeQuestionNumber(
                        candidate?.questionNumber ?? candidate?.question ??
                        candidate?.no ?? candidate?.order
                    ) === questionNumber
                );
                if (!effectiveItem) throw createError('controlled-write-conflict');

                const sourceId = cleanString(
                    effectiveItem.sourceId ||
                    effectiveItem.sourceFileId ||
                    effectiveItem.sourceTrace?.sourceFileId ||
                    effectiveItem.sourceTrace?.sourceId ||
                    effectiveItem.evidence?.sourceId
                );
                const evidenceIds = [...new Set([
                    effectiveItem.evidenceId,
                    effectiveItem.evidence?.evidenceId,
                    effectiveItem.sourceTrace?.evidenceId
                ].map(cleanString).filter(Boolean))].sort();
                const conflictIdentity = {
                    value: supportItemValue(effectiveItem, field),
                    sourceId,
                    page: evidencePage(null, effectiveItem, null),
                    blockIds: evidenceBlockIds(null, effectiveItem).sort(),
                    evidenceIds,
                    decisionReason: cleanString(item.reason),
                    normalizationRule: cleanString(
                        effectiveItem.normalizeReason || effectiveItem.reason
                    )
                };
                const acceptedMap = acceptedItemMaps[field];
                const existing = acceptedMap.get(questionNumber);
                if (existing && !same(existing.identity, conflictIdentity)) {
                    throw createError('controlled-write-conflict');
                }
                if (!existing) {
                    acceptedMap.set(questionNumber, {
                        identity: conflictIdentity,
                        item: clone(effectiveItem)
                    });
                }
            }
        }

        const acceptedByField = field => {
            return [...acceptedItemMaps[field].values()].map(entry => entry.item);
        };
        const effectiveAnswerItems = acceptedByField('answer');
        const effectiveSolutionItems = acceptedByField('solution');
        const answerQuestionNumbers = effectiveAnswerItems
            .map(item => normalizeQuestionNumber(
                item?.questionNumber ?? item?.question ?? item?.no ?? item?.order
            ))
            .filter(Boolean);
        const solutionQuestionNumbers = effectiveSolutionItems
            .map(item => normalizeQuestionNumber(
                item?.questionNumber ?? item?.question ?? item?.no ?? item?.order
            ))
            .filter(Boolean);

        return immutable({
            decisionId: cleanString(decisionId) || results
                .map(result => cleanString(result.decisionId))
                .filter(Boolean)
                .join('+'),
            effectiveAnswerItems,
            effectiveSolutionItems,
            fusedQuestionNumbers: [...new Set(results.flatMap(result =>
                result.fusedQuestionNumbers || []
            ).map(normalizeQuestionNumber).filter(Boolean))],
            warnings: stableWarnings(results.flatMap(result => result.warnings || [])),
            fieldDecisions: [...fieldDecisionMap.values()],
            answerQuestionNumbers,
            solutionQuestionNumbers,
            controlledWriteSummary: {
                answerQuestionNumbers,
                solutionQuestionNumbers,
                decisionCount: fieldDecisionMap.size
            }
        });
    }

    function createPdfEngineProjectionContext({
        sources = [],
        engineResult = {},
        controlledWriteOwner,
        blockParser,
        aligner,
        decisionId = ''
    } = {}) {
        if (
            !Array.isArray(sources) || !sources.length ||
            !Array.isArray(engineResult?.drafts) || !engineResult.drafts.length ||
            typeof controlledWriteOwner?.buildPdfSupportParserGate !== 'function' ||
            typeof controlledWriteOwner?.buildPdfSupportFieldLevelControlledWrite !== 'function' ||
            typeof blockParser?.parsePdfSupportBlocks !== 'function' ||
            typeof aligner?.alignPdfSupport !== 'function'
        ) {
            throw createError('pdf-projection-context-invalid');
        }
        const expectedQuestionNumbers = engineResult.drafts
            .map(draft => normalizeQuestionNumber(
                draft?.questionNumber ?? draft?.question ?? draft?.no ?? draft?.order
            ))
            .filter(Boolean);
        const supportSources = sources.filter(source => {
            const roles = sourceRoles(source);
            return roles.has('answer') || roles.has('solution') || roles.has('full');
        });
        if (supportSources.length > 1) {
            throw createError('pdf-support-source-ambiguous');
        }
        const supportSourceIds = new Set(
            supportSources.map(source => cleanString(source?.id || source?.sourceId))
        );
        const supportEvidences = (Array.isArray(engineResult.evidences)
            ? engineResult.evidences
            : []).filter(evidence =>
            supportSourceIds.has(cleanString(evidence?.sourceFileId))
        );
        const rawTextPages = supportEvidences.map(evidence => {
            const selectedSourceKind = cleanString(evidence?.selectedSourceKind);
            const text = selectedSourceKind === 'ocrMarkdown'
                ? cleanString(evidence?.ocrMarkdown)
                : selectedSourceKind === 'textLayer'
                    ? cleanString(evidence?.textLayer)
                    : '';
            return {
                pageNo: Number(evidence?.pageNo || 0),
                sourceOrder: Number(evidence?.pageNo || 0),
                text
            };
        }).filter(page => page.text);
        const supportFile = supportSources[0] || {
            id: cleanString(supportEvidences[0]?.sourceFileId),
            filename: cleanString(supportEvidences[0]?.sourceFileName)
        };
        const parserGate = controlledWriteOwner.buildPdfSupportParserGate({
            parsePdfSupportBlocks: blockParser.parsePdfSupportBlocks,
            alignPdfSupport: aligner.alignPdfSupport,
            file: supportFile,
            expectedQuestionNumbers,
            rawTextPages
        });
        const controlledWrite = controlledWriteOwner
            .buildPdfSupportFieldLevelControlledWrite({
                drafts: engineResult.drafts,
                parserSafeAnswerItems: parserGate?.failClosed
                    ? [] : parserGate?.answers || [],
                parserSafeSolutionItems: parserGate?.failClosed
                    ? [] : parserGate?.solutions || [],
                parserFusedQuestionNumbers: parserGate?.fusedQuestionNumbers || []
            });
        if (!controlledWrite) throw createError('controlled-write-missing');
        const controlledWriteDecision = {
            ...controlledWrite,
            decisionId: cleanString(decisionId) ||
                `pdf-cw:${cleanString(supportFile?.id)}:engine`
        };
        const alignmentResult = parserGate
            ? {
                mode: parserGate.mode,
                safeQuestionNumbers: parserGate.safeQuestionNumbers || [],
                fusedQuestionNumbers: parserGate.fusedQuestionNumbers || [],
                warnings: [
                    ...(parserGate.fusedWarnings || []),
                    ...(controlledWriteDecision.warnings || [])
                ]
            }
            : {
                mode: 'fail-closed',
                safeQuestionNumbers: [],
                fusedQuestionNumbers: expectedQuestionNumbers,
                warnings: [{ code: 'support-parser-evidence-missing' }]
            };

        return immutable({
            drafts: engineResult.drafts,
            sources,
            controlledWriteDecisions: [controlledWriteDecision],
            controlledWriteDecisionId: controlledWriteDecision.decisionId,
            alignmentResults: [alignmentResult],
            routeContext: { engine: 'qisi-batch-engine-v2' }
        });
    }

    function sourceRoles(source) {
        const roles = Array.isArray(source?.roles)
            ? source.roles
            : source?.role
                ? [source.role]
                : [];
        return new Set(roles.map(role => cleanString(role).toLowerCase()));
    }

    function sourceIdForDraft(draft) {
        return cleanString(
            draft?.sourceQuestionFileId ||
            draft?.sourceFileId ||
            draft?.sourceTrace?.sourceQuestionFileId ||
            draft?.sourceTrace?.sourceFileId
        );
    }

    function mergeProjectedDraft(draft, projected) {
        const warningCodes = projected.warnings.map(item => item.code);
        return {
            ...clone(draft),
            ...(typeof draft?.source === 'string' && draft.source
                ? { sourceLabel: draft.source }
                : {}),
            ...clone(projected),
            warnings: [...new Set([
                ...(Array.isArray(draft?.warnings) ? draft.warnings : []),
                ...warningCodes
            ])]
        };
    }

    function batchProjectionInputs(input) {
        const drafts = Array.isArray(input?.drafts) ? input.drafts : [];
        const sources = Array.isArray(input?.sources) ? input.sources : [];
        if (!drafts.length || !sources.length) {
            throw createError('pdf-projection-input-missing');
        }
        const sourceMap = new Map(sources.map(source => [
            cleanString(source?.id || source?.sourceId), source
        ]));
        const controlledWriteDecision = mergeControlledWriteDecisions(
            input.controlledWriteDecisions,
            cleanString(input.controlledWriteDecisionId)
        );
        const alignments = Array.isArray(input.alignmentResults)
            ? input.alignmentResults
            : [];
        const failClosed = !alignments.length ||
            alignments.some(result => result?.mode === 'fail-closed');
        const alignmentMode = failClosed
            ? 'fail-closed'
            : alignments.some(result => result?.mode === 'prefix')
                ? 'prefix'
                : 'full';
        const safeQuestionNumbers = [...new Set(
            alignments.flatMap(result => result?.safeQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean)
        )];
        const fusedQuestionNumbers = [...new Set([
            ...alignments.flatMap(result => result?.fusedQuestionNumbers || []),
            ...(controlledWriteDecision.fusedQuestionNumbers || [])
        ].map(normalizeQuestionNumber).filter(Boolean))];
        const alignmentWarnings = stableWarnings(
            alignments.flatMap(result => result?.warnings || [])
        );
        const projectedIndexes = [];
        const projectionInputs = [];

        drafts.forEach((draft, index) => {
            const sourceId = sourceIdForDraft(draft);
            const source = sourceMap.get(sourceId);
            if (cleanString(source?.fileType).toLowerCase() !== 'pdf') return;
            const roles = sourceRoles(source);
            const questionNumber = normalizeQuestionNumber(
                draft?.questionNumber ?? draft?.question ?? draft?.no ?? draft?.order
            );
            const trace = isRecord(draft?.sourceTrace) ? draft.sourceTrace : {};
            const page = Number(
                draft?.sourcePage || trace.sourcePage || trace.pageIndex || 1
            );
            const questionEvidenceId = cleanString(
                trace.evidenceId || trace.strictProtocol?.decisionId
            );
            const questionEvidence = {
                page,
                blockIds: questionEvidenceId ? [questionEvidenceId] : []
            };
            const imageBlockIds = (Array.isArray(draft?.images) ? draft.images : [])
                .map(image => cleanString(image?.id || image?.imageId || image))
                .filter(Boolean);
            const strict = isRecord(trace.strictProtocol)
                ? trace.strictProtocol
                : null;
            const sourceKind = cleanString(
                trace.sourceKind || draft?.sourceKind || input.routeContext?.sourceKind
            );
            const sourceMode = cleanString(input.routeContext?.sourceMode);
            const ownershipValid = Boolean(
                sourceId && source && (roles.has('question') || roles.has('full'))
            );
            const structuralValid = Boolean(
                questionNumber && cleanString(draft?.type) && cleanString(draft?.stem) &&
                draft?.rawJsonCandidate !== true
            );

            projectedIndexes.push(index);
            projectionInputs.push({
                source: {
                    sourceId,
                    sourceType: 'pdf',
                    sourceOrder: Number.isFinite(Number(source?.sourceOrder))
                        ? Number(source.sourceOrder)
                        : null,
                    ...(sourceMode ? { mode: sourceMode } : {})
                },
                engineResult: {
                    ...(sourceKind ? { sourceKind } : {}),
                    engine: cleanString(
                        trace.model || trace.source || input.routeContext?.engine
                    ),
                    requestId: cleanString(trace.requestId),
                    ...(strict ? { strictProtocol: strict } : {})
                },
                parsedQuestion: draft,
                alignmentResult: {
                    mode: alignmentMode,
                    safeQuestionNumbers,
                    fusedQuestionNumbers,
                    warnings: alignmentWarnings
                },
                controlledWriteDecision,
                evidence: {
                    fields: {
                        questionNumber: questionEvidence,
                        stem: questionEvidence,
                        options: questionEvidence,
                        answer: {},
                        solution: {},
                        images: { page, blockIds: imageBlockIds }
                    },
                    rawEvidenceRefs: [
                        ...(questionEvidenceId
                            ? [{ evidenceId: questionEvidenceId }]
                            : []),
                        ...imageBlockIds.map(imageId => ({ imageId }))
                    ],
                    formulaFallback: draft?.formulaFallback === true,
                    engineConflict: draft?.engineConflict === true
                },
                pageContext: {
                    page,
                    sourceOrder: Number.isFinite(Number(source?.sourceOrder))
                        ? Number(source.sourceOrder)
                        : null
                },
                validation: {
                    schemaValid: structuralValid,
                    sequenceValid: !failClosed &&
                        safeQuestionNumbers.includes(questionNumber) &&
                        !fusedQuestionNumbers.includes(questionNumber),
                    ownershipValid
                }
            });
        });

        if (!projectionInputs.length) return { drafts, projectionInputs, projectedIndexes };
        return { drafts, projectionInputs, projectedIndexes };
    }

    function projectPdfCandidates(input = []) {
        if (Array.isArray(input)) {
            if (!input.length) throw createError('pdf-projection-input-missing');
            return immutable(input.map(projectPdfCandidate));
        }
        const batch = batchProjectionInputs(input);
        if (!batch.projectionInputs.length) return immutable(batch.drafts);
        const projected = batch.projectionInputs.map(projectPdfCandidate);
        const byIndex = new Map(
            batch.projectedIndexes.map((index, offset) => [index, projected[offset]])
        );
        return immutable(batch.drafts.map((draft, index) =>
            byIndex.has(index)
                ? mergeProjectedDraft(draft, byIndex.get(index))
                : clone(draft)
        ));
    }

    function stripVolatile(value) {
        if (Array.isArray(value)) return value.map(stripVolatile);
        if (!isRecord(value)) return value;
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !VOLATILE_KEYS.has(key))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, stripVolatile(item)])
        );
    }

    function stableCodes(values) {
        return [...new Set((values || []).map(item =>
            typeof item === 'string' ? stableCode(item) : stableCode(item?.code)
        ))].sort();
    }

    function stableWarningCodes(candidate) {
        return stableCodes(candidate?.warnings);
    }

    function stableEvidenceIdentities(candidate) {
        return [...new Set((candidate?.rawEvidenceRefs || []).map(ref => {
            if (!isRecord(ref)) return cleanString(ref);
            const identity = cleanString(
                ref.evidenceId || ref.imageId || ref.blockId || ref.id
            );
            return identity || JSON.stringify(stripVolatile(ref));
        }).filter(Boolean))].sort();
    }

    function same(left, right) {
        return JSON.stringify(stripVolatile(left)) ===
            JSON.stringify(stripVolatile(right));
    }

    function canonicalProvenance(entry) {
        const value = isRecord(entry) ? entry : {};
        const kind = cleanString(value.kind || value.status) || 'missing';
        const numericPage = Number(value.page);
        const reasonCode = cleanString(value.reasonCode || value.reason);
        return {
            kind,
            sourceId: cleanString(value.sourceId),
            sourceFormat: cleanString(value.sourceFormat),
            producerMode: cleanString(value.producerMode),
            routeId: cleanString(value.routeId),
            engine: cleanString(value.engine),
            page: Number.isInteger(numericPage) && numericPage > 0
                ? numericPage
                : null,
            blockIds: [...new Set(
                (Array.isArray(value.blockIds) ? value.blockIds : [])
                    .map(cleanString)
                    .filter(Boolean)
            )].sort(),
            controlledWriteDecisionId: cleanString(
                value.controlledWriteDecisionId
            ),
            controlledWriteAccepted: value.controlledWriteAccepted === true,
            manuallyEdited: value.manuallyEdited === true,
            reasonCode: reasonCode || (kind === 'missing' ? 'missing' : ''),
            producerBoundary: cleanString(value.producerBoundary),
            contractVersion: cleanString(value.contractVersion)
        };
    }

    function canonicalRouteTransitions(route) {
        return (Array.isArray(route?.transitions) ? route.transitions : [])
            .map(item => ({
                code: cleanString(item?.code),
                reason: cleanString(item?.reason)
            }));
    }

    function compareCanonicalPdfCandidates(legacy, bridge) {
        const provenanceProperties = [
            'kind',
            'sourceId',
            'sourceFormat',
            'producerMode',
            'routeId',
            'engine',
            'page',
            'blockIds',
            'controlledWriteDecisionId',
            'controlledWriteAccepted',
            'manuallyEdited',
            'reasonCode',
            'producerBoundary',
            'contractVersion'
        ];
        const provenanceChecks = FIELDS.flatMap(field => {
            const legacyProvenance = canonicalProvenance(
                legacy?.fieldProvenance?.[field]
            );
            const bridgeProvenance = canonicalProvenance(
                bridge?.fieldProvenance?.[field]
            );
            return provenanceProperties.map(property => [
                `fieldProvenance.${field}.${property}`,
                legacyProvenance[property],
                bridgeProvenance[property],
                'error',
                'pdf-canonical-provenance-mismatch'
            ]);
        });
        const checks = [
            ['source.sourceId', legacy?.source?.sourceId, bridge?.source?.sourceId, 'error', 'pdf-canonical-source-mismatch'],
            ['source.format', legacy?.source?.format, bridge?.source?.format, 'error', 'pdf-canonical-source-mismatch'],
            ['source.page', legacy?.source?.page, bridge?.source?.page, 'error', 'pdf-canonical-source-mismatch'],
            ['source.sourceOrder', legacy?.source?.sourceOrder, bridge?.source?.sourceOrder, 'error', 'pdf-canonical-value-mismatch'],
            ['producer.mode', legacy?.producer?.mode, bridge?.producer?.mode, 'error', 'pdf-canonical-producer-mismatch'],
            ['producer.routeId', legacy?.producer?.routeId, bridge?.producer?.routeId, 'error', 'pdf-canonical-producer-mismatch'],
            ['producer.routeReason', legacy?.producer?.routeReason, bridge?.producer?.routeReason, 'error', 'pdf-canonical-producer-mismatch'],
            ['producer.engine', legacy?.producer?.engine, bridge?.producer?.engine, 'error', 'pdf-canonical-producer-mismatch'],
            ['producer.deterministic', legacy?.producer?.deterministic, bridge?.producer?.deterministic, 'error', 'pdf-canonical-producer-mismatch'],
            ['route.identity', legacy?.route?.identity, bridge?.route?.identity, 'error', 'pdf-canonical-route-mismatch'],
            ['route.reason', legacy?.route?.reason, bridge?.route?.reason, 'error', 'pdf-canonical-route-mismatch'],
            ['route.transitions', canonicalRouteTransitions(legacy?.route), canonicalRouteTransitions(bridge?.route), 'error', 'pdf-canonical-route-mismatch'],
            ['questionNumber', legacy?.questionNumber, bridge?.questionNumber, 'error', 'pdf-canonical-value-mismatch'],
            ['type', legacy?.type, bridge?.type, 'error', 'pdf-canonical-value-mismatch'],
            ['stem', legacy?.stem, bridge?.stem, 'error', 'pdf-canonical-value-mismatch'],
            ['options', legacy?.options, bridge?.options, 'error', 'pdf-canonical-value-mismatch'],
            ['answer', legacy?.answer, bridge?.answer, 'error', 'pdf-canonical-value-mismatch'],
            ['solution', legacy?.solution, bridge?.solution, 'error', 'pdf-canonical-value-mismatch'],
            ['images', legacy?.images, bridge?.images, 'error', 'pdf-canonical-value-mismatch'],
            ...provenanceChecks,
            [
                'controlledWrite.evaluated',
                legacy?.controlledWrite?.evaluated,
                bridge?.controlledWrite?.evaluated,
                'error',
                'pdf-canonical-controlled-write-mismatch'
            ],
            [
                'controlledWrite.decisionId',
                legacy?.controlledWrite?.decisionId,
                bridge?.controlledWrite?.decisionId,
                'error',
                'pdf-canonical-controlled-write-mismatch'
            ],
            [
                'controlledWrite.acceptedFields',
                legacy?.controlledWrite?.acceptedFields,
                bridge?.controlledWrite?.acceptedFields,
                'error',
                'pdf-canonical-controlled-write-mismatch'
            ],
            [
                'controlledWrite.rejectedFields',
                legacy?.controlledWrite?.rejectedFields,
                bridge?.controlledWrite?.rejectedFields,
                'error',
                'pdf-canonical-controlled-write-mismatch'
            ],
            [
                'controlledWrite.errors',
                stableCodes(legacy?.controlledWrite?.errors),
                stableCodes(bridge?.controlledWrite?.errors),
                'error',
                'pdf-canonical-controlled-write-mismatch'
            ],
            [
                'controlledWrite.warnings',
                stableCodes(legacy?.controlledWrite?.warnings),
                stableCodes(bridge?.controlledWrite?.warnings),
                'warning',
                'pdf-canonical-controlled-write-mismatch'
            ],
            ['supportLevel', legacy?.supportLevel, bridge?.supportLevel, 'error', 'pdf-canonical-value-mismatch'],
            [
                'manualReviewRequired',
                legacy?.manualReviewRequired,
                bridge?.manualReviewRequired,
                'error',
                'pdf-canonical-value-mismatch'
            ],
            [
                'validation.schemaValid',
                legacy?.validation?.schemaValid,
                bridge?.validation?.schemaValid,
                'error',
                'pdf-canonical-validation-mismatch'
            ],
            [
                'validation.sequenceValid',
                legacy?.validation?.sequenceValid,
                bridge?.validation?.sequenceValid,
                'error',
                'pdf-canonical-validation-mismatch'
            ],
            [
                'validation.ownershipValid',
                legacy?.validation?.ownershipValid,
                bridge?.validation?.ownershipValid,
                'error',
                'pdf-canonical-validation-mismatch'
            ],
            [
                'warnings',
                stableWarningCodes(legacy),
                stableWarningCodes(bridge),
                'warning',
                'pdf-canonical-warning-mismatch'
            ],
            [
                'rawEvidenceRefs',
                stableEvidenceIdentities(legacy),
                stableEvidenceIdentities(bridge),
                'warning',
                'pdf-canonical-evidence-mismatch'
            ]
        ];

        return checks.filter(([, left, right]) => !same(left, right))
            .map(([path, left, right, severity, code]) => ({
                path,
                legacyValue: clone(left),
                bridgeValue: clone(right),
                severity,
                code
            }));
    }

    const api = Object.freeze({
        FIELDS,
        PdfCandidateProjectionError,
        mergeControlledWriteDecisions,
        createPdfEngineProjectionContext,
        projectPdfCandidate,
        projectPdfCandidates,
        compareCanonicalPdfCandidates
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.PdfCandidateProjection = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);

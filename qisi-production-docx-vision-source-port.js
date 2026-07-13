(function initProductionDocxVisionSourcePort(root, factory) {
    const contract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );
    const api = factory(contract);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionDocxVisionSourcePort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
    'use strict';

    const fail = code => {
        const error = new Error(code);
        error.code = code;
        error.stage = 'production-docx-vision-shadow';
        return error;
    };
    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const assertActive = signal => {
        if (!signal?.aborted) return;
        const error = fail('DOCX_VISION_SHADOW_CANCELLED');
        error.name = 'AbortError';
        throw error;
    };

    const sourcesOf = input => {
        const sources = Array.isArray(input.sources)
            ? input.sources
            : input.source ? [input.source] : [];
        if (
            sources.length === 0 ||
            sources.some(source =>
                !isRecord(source) ||
                String(source.fileType || source.format || '').toLowerCase() !== 'docx' ||
                !String(source.sourceId || source.id || '').trim()
            )
        ) throw fail('DOCX_VISION_SOURCE_INVALID');
        return sources;
    };

    async function runDocxVision(input = {}, ports = {}) {
        const mode = String(input.mode || '').trim();
        if (!['shadow', 'production'].includes(mode)) {
            throw fail('DOCX_VISION_MODE_REQUIRED');
        }
        const sources = sourcesOf(input);
        if (
            typeof ports.runVisionProducer !== 'function' ||
            typeof contract?.projectDocxVisionCandidate !== 'function'
        ) throw fail('DOCX_VISION_PORT_REQUIRED');
        assertActive(input.signal);
        const result = await ports.runVisionProducer({
            sources,
            source: sources[0],
            engineContext: input.engineContext || {},
            mode,
            shadow: mode === 'shadow',
            signal: input.signal
        });
        assertActive(input.signal);
        if (
            !isRecord(result) || !Array.isArray(result.candidates) ||
            !Array.isArray(result.controlledWriteDecisions) ||
            result.candidates.length !== result.controlledWriteDecisions.length
        ) throw fail('DOCX_VISION_RESULT_MALFORMED');
        const sourceById = new Map(sources.map(source => [
            String(source.sourceId || source.id), source
        ]));
        const drafts = result.candidates.map((candidate, index) => {
            const decision = result.controlledWriteDecisions[index];
            const sourceId = String(
                decision?.sourceId || candidate?.source?.sourceId ||
                candidate?.sourceDocxFileId || candidate?.sourceFileId ||
                sources[0].sourceId || sources[0].id
            );
            const source = sourceById.get(sourceId);
            if (!source) throw fail('DOCX_VISION_SOURCE_MISMATCH');
            return contract.projectDocxVisionCandidate({
                candidate,
                source: {
                    sourceId,
                    format: 'docx',
                    filename: source.filename || '',
                    mimeType: source.mimeType || source.type || '',
                    sourceOrder: Number.isInteger(source.sourceOrder)
                        ? source.sourceOrder : 0
                },
                engine: result.engine,
                page: candidate.sourcePage || candidate.pageIndex || 0,
                blockIds: candidate.blockIds ||
                    candidate.sourceTrace?.blockIds ||
                    [...new Set(Object.values(candidate.fieldProvenance || {})
                        .flatMap(entry => Array.isArray(entry?.blockIds)
                            ? entry.blockIds : []))],
                controlledWriteDecision: decision
            });
        });
        if (drafts.some(draft => draft.canonicalReviewHandoff !== true)) {
            throw fail('DOCX_VISION_HANDOFF_REJECTED');
        }
        return Object.freeze({
            schemaVersion: 'qisi.docx-vision-source.r1',
            mode,
            shadow: mode === 'shadow',
            drafts: Object.freeze(drafts),
            draftImages: Object.freeze(Array.isArray(result.draftImages)
                ? result.draftImages : []),
            warnings: Object.freeze(Array.isArray(result.warnings)
                ? result.warnings.map(String) : []),
            formalWrites: 0,
            reviewDraftWrites: 0,
            realApiCalled: result.realApiCalled === true,
            diagnostics: Object.freeze({
                producer: 'shared-docx-producer-identity-contract',
                candidateCount: drafts.length
            })
        });
    }

    async function runDocxVisionShadow(input = {}, ports = {}) {
        if (input.shadow !== true) throw fail('DOCX_VISION_SHADOW_REQUIRED');
        const result = await runDocxVision({
            ...input,
            mode: 'shadow'
        }, ports);
        if (result.realApiCalled !== false) {
            throw fail('DOCX_VISION_SHADOW_REAL_API_FORBIDDEN');
        }
        return Object.freeze({
            ...result,
            schemaVersion: 'qisi.docx-vision-shadow.r1',
            shadow: true
        });
    }

    const runDocxVisionProduction = (input = {}, ports = {}) =>
        runDocxVision({ ...input, mode: 'production' }, ports);

    function createProductionImportRunner(ports = {}) {
        if (
            typeof ports.hasQuestionRole !== 'function' ||
            typeof ports.isFullRole !== 'function' ||
            typeof ports.hasAnswerRole !== 'function' ||
            typeof ports.hasSolutionRole !== 'function' ||
            typeof ports.normalizeQuestionNumber !== 'function' ||
            typeof ports.processQuestionSource !== 'function' ||
            typeof ports.processSupportSource !== 'function' ||
            typeof contract?.buildDocxVisionControlledWriteDecision !== 'function' ||
            typeof contract?.applyDocxVisionSupportField !== 'function'
        ) throw fail('DOCX_VISION_PRODUCTION_PORT_REQUIRED');

        return async function runProductionDocxVisionImport(context = {}, signal) {
            const sources = Array.isArray(context.sources) ? context.sources : [];
            const questionSources = sources.filter(source =>
                ports.hasQuestionRole(source) || ports.isFullRole(source)
            );
            const supportSources = sources.filter(source =>
                !ports.hasQuestionRole(source) &&
                !ports.isFullRole(source) &&
                (ports.hasAnswerRole(source) || ports.hasSolutionRole(source))
            );
            if (!questionSources.length) {
                const error = fail('PRODUCTION_IMPORT_SOURCE_UNSUPPORTED');
                error.message = 'docx-question-source-required';
                throw error;
            }
            const base = await runDocxVisionProduction({
                ...context,
                sources,
                signal
            }, {
                runVisionProducer: async () => {
                    const candidates = [];
                    const warnings = [];
                    for (const source of questionSources) {
                        const result = await ports.processQuestionSource({
                            source,
                            batch: context.batch,
                            sources,
                            expectedQuestionCount:
                                context.batch?.expectedQuestionCount || 0,
                            signal
                        });
                        candidates.push(...(result?.questions || []));
                        warnings.push(...(result?.check?.warningReasons || []));
                    }
                    return {
                        engine: candidates[0]?.producer?.engine || '',
                        candidates,
                        controlledWriteDecisions: candidates.map(candidate =>
                            contract.buildDocxVisionControlledWriteDecision(candidate)
                        ),
                        draftImages: [],
                        warnings,
                        realApiCalled: true
                    };
                }
            });
            let drafts = [...base.drafts];
            const warnings = [...base.warnings];
            for (const source of supportSources) {
                const expectedQuestionNumbers = drafts
                    .map(draft =>
                        ports.normalizeQuestionNumber(draft.questionNumber)
                    )
                    .filter(Boolean);
                const support = await ports.processSupportSource({
                    source,
                    expectedQuestionNumbers,
                    requiredKinds: {
                        answers: ports.hasAnswerRole(source),
                        solutions: ports.hasSolutionRole(source)
                    },
                    signal
                });
                for (const [field, items] of [
                    ['answer', support?.answers || []],
                    ['solution', support?.solutions || []]
                ]) {
                    for (const item of items) {
                        const questionNumber =
                            ports.normalizeQuestionNumber(item.question);
                        const matches = drafts.map((draft, index) => ({
                            draft,
                            index
                        })).filter(entry =>
                            ports.normalizeQuestionNumber(
                                entry.draft.questionNumber
                            ) === questionNumber
                        );
                        if (matches.length !== 1) {
                            throw fail('DOCX_SUPPORT_OWNERSHIP_INVALID');
                        }
                        const index = matches[0].index;
                        drafts[index] = contract.applyDocxVisionSupportField({
                            candidate: drafts[index],
                            field,
                            support: item,
                            source: {
                                sourceId: source.id,
                                format: 'docx',
                                filename: source.filename || '',
                                mimeType: source.mimeType || source.type || '',
                                sourceOrder: Number.isInteger(source.sourceOrder)
                                    ? source.sourceOrder : 0
                            },
                            controlledWriteDecision: item.controlledWriteDecision
                        });
                    }
                }
            }
            return Object.freeze({
                ...base,
                drafts: Object.freeze(drafts),
                warnings: Object.freeze(warnings)
            });
        };
    }

    return Object.freeze({
        runDocxVision,
        runDocxVisionShadow,
        runDocxVisionProduction,
        createProductionImportRunner
    });
});

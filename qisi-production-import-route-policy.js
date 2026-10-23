(function initProductionImportRoutePolicy(root) {
    'use strict';

    const PRODUCER_IDENTITIES = Object.freeze([
        'docx-deterministic',
        'docx-vision',
        'pdf'
    ]);

    class ProductionImportRoutePolicyError extends Error {
        constructor(code, causeCode = '') {
            super(code);
            this.name = 'ProductionImportRoutePolicyError';
            this.code = code;
            this.stage = 'production-import-route-policy';
            if (causeCode) this.causeCode = causeCode;
        }
    }

    const fail = (code, causeCode = '') => {
        throw new ProductionImportRoutePolicyError(code, causeCode);
    };

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );

    function explicitProducerIdentity(input, activeManifest) {
        const batchIdentity = String(
            input.batch?.producerMode ||
            input.batchContext?.batchMetadata?.producerMode || ''
        ).trim();
        const sourceIdentities = [...new Set(activeManifest
            .map(source => String(source?.producerMode || '').trim())
            .filter(Boolean))];
        if (sourceIdentities.length > 1) {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_IDENTITY_MISMATCH',
                'source-producer-identity-conflict'
            );
        }
        const sourceIdentity = sourceIdentities[0] || '';
        if (batchIdentity && sourceIdentity && batchIdentity !== sourceIdentity) {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_IDENTITY_MISMATCH',
                'batch-source-producer-identity-conflict'
            );
        }
        const identity = batchIdentity || sourceIdentity;
        if (!identity) {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_IDENTITY_REQUIRED',
                'explicit-producer-identity-required'
            );
        }
        if (!PRODUCER_IDENTITIES.includes(identity)) {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_IDENTITY_UNSUPPORTED',
                'unsupported-producer-identity'
            );
        }
        return identity;
    }

    // Restore the original normal-UI producer; identity remains explicit internally.
    function selectNormalUiProducerMode(classification) {
        const sources = Array.isArray(classification?.sources)
            ? classification.sources.filter(source => !source.isSupplementalImage)
            : [];
        const types = new Set(sources.map(source => source.fileType));
        if (!sources.some(source => source.isQuestion) || types.size !== 1 ||
            !['docx', 'pdf'].includes([...types][0])) {
            fail('PRODUCTION_IMPORT_SOURCE_UNSUPPORTED', 'normal-ui-source-unsupported');
        }
        return types.has('docx') ? 'docx-deterministic' : 'pdf';
    }

    function canReuseNormalUiCommittedRequest(batch) {
        return batch?.producerMode !== 'pdf';
    }

    function resolveProductionImportRoute(input = {}) {
        const manifest = input.sourceManifest;
        const classification = input.classification;
        if (
            !Array.isArray(manifest) || !manifest.length ||
            !isRecord(classification) || !Array.isArray(classification.sources)
        ) {
            fail(
                'PRODUCTION_IMPORT_ROUTE_INPUT_MALFORMED',
                'source-classification-malformed'
            );
        }
        const manifestById = new Map(manifest.map(source => [
            String(source?.id || ''), source
        ]));
        const active = classification.sources.filter(
            source => source?.isSupplementalImage !== true
        );
        if (!active.length || !active.some(source => source?.isQuestion === true)) {
            fail(
                'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED',
                'question-source-required'
            );
        }
        const activeManifest = active.map(source => {
            const item = manifestById.get(String(source?.id || ''));
            if (!item) {
                fail(
                    'PRODUCTION_IMPORT_ROUTE_INPUT_MALFORMED',
                    'classified-source-missing'
                );
            }
            return item;
        });
        const sourceTypes = new Set(active.map(source =>
            String(source?.fileType || '').trim().toLowerCase()
        ));
        if (
            sourceTypes.size !== 1 ||
            !['docx', 'pdf'].includes([...sourceTypes][0])
        ) {
            fail(
                'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED',
                'mixed-or-unsupported-source'
            );
        }
        const route = [...sourceTypes][0];
        // One question source plus at most one answer source and one solution
        // source. Roles are explicit in the UI, so a separate answer and solution
        // file is unambiguous; two sources claiming the same role are not.
        if (
            route === 'pdf' &&
            (active.filter(source => source?.isQuestion).length !== 1 ||
                active.filter(source => source?.isAnswer).length > 1 ||
                active.filter(source => source?.isSolution).length > 1)
        ) {
            fail(
                'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED',
                'pdf-support-source-ambiguous'
            );
        }
        const producerIdentity = explicitProducerIdentity(input, activeManifest);
        // DOCX visual fallback was retired on 2026-10-22 (user decision): the
        // deterministic DOCX chain is the only DOCX producer. The Qwen OCR runtime
        // is kept for manual screenshot recognition, not for DOCX re-runs.
        if (producerIdentity === 'docx-vision') {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_RETIRED',
                'docx-vision-retired'
            );
        }
        const compatible = route === 'docx'
            ? ['docx-deterministic']
            : ['pdf'];
        if (!compatible.includes(producerIdentity)) {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_IDENTITY_MISMATCH',
                'producer-source-type-mismatch'
            );
        }
        const capabilityName = producerIdentity === 'docx-deterministic'
            ? 'docxDeterministic'
            : 'pdf';
        if (input.availableCapabilities?.[capabilityName] !== true) {
            fail(
                'PRODUCTION_IMPORT_PRODUCER_CAPABILITY_UNAVAILABLE',
                capabilityName
            );
        }
        return Object.freeze({
            schemaVersion: 'qisi.production-import-route.r1',
            route,
            producerIdentity,
            sourceIds: Object.freeze(active.map(source => String(source.id))),
            supplementalSourceIds: Object.freeze(
                classification.sources
                    .filter(source => source?.isSupplementalImage === true)
                    .map(source => String(source.id))
            )
        });
    }

    const api = Object.freeze({
        PRODUCER_IDENTITIES,
        ProductionImportRoutePolicyError,
        resolveProductionImportRoute,
        selectNormalUiProducerMode,
        canReuseNormalUiCommittedRequest
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionImportRoutePolicy = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);

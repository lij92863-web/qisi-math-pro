(function initImportEquivalenceNormalizer(globalScope) {
    'use strict';

    const RESULTS = Object.freeze({
        EXACT: 'EXACT',
        SAFE_REFINEMENT: 'SAFE_REFINEMENT',
        NOT_EQUIVALENT: 'NOT_EQUIVALENT'
    });
    const VOLATILE_KEYS = new Set([
        'requestId', 'timestamp', 'createdAt', 'updatedAt', 'startedAt',
        'endedAt', 'completedAt', 'recordedAt'
    ]);
    const ID_COLLECTIONS = Object.freeze([
        ['batches', 'batch'], ['files', 'file'], ['drafts', 'draft'],
        ['images', 'image'], ['draftImages', 'draft-image']
    ]);
    const ID_REFERENCE_KEYS = new Set([
        'id', 'batchId', 'fileId', 'sourceId', 'draftId', 'imageId',
        'parentId', 'reviewDraftId'
    ]);
    const SAFE_EVIDENCE_KINDS = new Set([
        'conservative-rejection', 'safe-prefix-truncation'
    ]);
    const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        for (const child of Object.values(value)) deepFreeze(child);
        return Object.freeze(value);
    }

    function entityList(snapshot, name) {
        const value = snapshot?.[name];
        if (Array.isArray(value)) return value;
        if (name === 'batches' && isObject(snapshot?.batch)) return [snapshot.batch];
        return [];
    }

    function buildIdMap(snapshot) {
        const idMap = new Map();
        for (const [collection, token] of ID_COLLECTIONS) {
            entityList(snapshot, collection).forEach((entity, index) => {
                const id = entity?.id;
                if ((typeof id === 'string' || typeof id === 'number') && !idMap.has(id)) {
                    idMap.set(id, `${token}#${index + 1}`);
                }
            });
        }
        return idMap;
    }

    function normalizeIdReference(value, key, idMap) {
        if (ID_REFERENCE_KEYS.has(key) && idMap.has(value)) return idMap.get(value);
        if (key.endsWith('Ids') && Array.isArray(value)) {
            return value.map(item => idMap.has(item) ? idMap.get(item) : item);
        }
        return value;
    }

    function isProgressEventTime(key, path) {
        return ['time', 'eventTime'].includes(key) &&
            /(?:^|\.)(?:progressEvents|progress\.events)\[\d+]$/.test(path);
    }

    function canonicalizeValue(value, key, idMap, path = '') {
        const referenced = normalizeIdReference(value, key, idMap);
        if (referenced !== value) {
            if (Array.isArray(referenced)) {
                return referenced.map((item, index) => canonicalizeValue(
                    item, '', idMap, childPath(path, index, true)
                ));
            }
            return referenced;
        }
        if (value === undefined) return Object.freeze({ __qisiUndefined: true });
        if (value === null || typeof value !== 'object') {
            if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item, index) => canonicalizeValue(
                item, '', idMap, childPath(path, index, true)
            ));
        }
        if (value instanceof Date) return value.toISOString();
        const output = {};
        for (const childKey of Object.keys(value).sort()) {
            if (VOLATILE_KEYS.has(childKey) || isProgressEventTime(childKey, path)) continue;
            output[childKey] = canonicalizeValue(
                value[childKey], childKey, idMap, childPath(path, childKey)
            );
        }
        return output;
    }

    function canonicalizeImportSnapshot(snapshot) {
        if (!isObject(snapshot)) {
            throw new TypeError('Import equivalence snapshot must be an object.');
        }
        return deepFreeze(canonicalizeValue(snapshot, '', buildIdMap(snapshot)));
    }

    function same(left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    }

    function childPath(parent, key, arrayIndex = false) {
        if (arrayIndex) return `${parent}[${key}]`;
        return parent ? `${parent}.${key}` : key;
    }

    function collectDifferences(legacy, bridge, path = '') {
        if (same(legacy, bridge)) return [];
        if (Array.isArray(legacy) && Array.isArray(bridge)) {
            const differences = [];
            const length = Math.max(legacy.length, bridge.length);
            for (let index = 0; index < length; index += 1) {
                const itemPath = childPath(path, index, true);
                if (index >= legacy.length || index >= bridge.length) {
                    differences.push({ path: itemPath });
                } else {
                    differences.push(...collectDifferences(
                        legacy[index], bridge[index], itemPath
                    ));
                }
            }
            return differences;
        }
        if (isObject(legacy) && isObject(bridge)) {
            const differences = [];
            const keys = [...new Set([...Object.keys(legacy), ...Object.keys(bridge)])].sort();
            for (const key of keys) {
                const itemPath = childPath(path, key);
                if (!hasOwn(legacy, key) || !hasOwn(bridge, key)) {
                    differences.push({ path: itemPath });
                } else {
                    differences.push(...collectDifferences(
                        legacy[key], bridge[key], itemPath
                    ));
                }
            }
            return differences;
        }
        return [{ path: path || '$' }];
    }

    function approvedEvidence(evidence) {
        return isObject(evidence) &&
            SAFE_EVIDENCE_KINDS.has(evidence.kind) &&
            typeof evidence.code === 'string' && evidence.code.trim().length > 0 &&
            Array.isArray(evidence.paths) && evidence.paths.length > 0 &&
            evidence.paths.every(path => typeof path === 'string' && path.length > 0) &&
            evidence.approval?.status === 'approved' &&
            typeof evidence.approval?.reviewer === 'string' &&
            evidence.approval.reviewer.trim().length > 0;
    }

    function pathCovers(parent, child) {
        return parent === child || child.startsWith(`${parent}.`) || child.startsWith(`${parent}[`);
    }

    function safeDifferencePath(path, bridgeDraftCount) {
        const removedDraft = path.match(/^drafts\[(\d+)]$/);
        if (removedDraft) return Number(removedDraft[1]) >= bridgeDraftCount;
        return [
            /^drafts\[\d+]\.(answer|solution)$/,
            /^drafts\[\d+]\.(warnings|rejectedFields)(?:\[|\.|$)/,
            /^drafts\[\d+]\.fieldProvenance\.(answer|solution)(?:\.|$)/,
            /^drafts\[\d+]\.(manualReviewRequired|supportLevel)$/,
            /^drafts\[\d+]\.(controlledWriteEvidence|ownershipDecision)(?:\.|$)/,
            /^(batch|batches\[\d+])\.(totalCount|problemCount|prefixTruncated)$/,
            /^files\[\d+]\.(parseStatus|warnings|rejectedFields|safePartial)(?:\[|\.|$)/,
            /^(selectedPrefix|warnings|rejectedFields|safePartial)(?:\[|\.|$)/,
            /^(controlledWriteEvidence|ownershipDecision)(?:\.|$)/,
            /^draftCount$/
        ].some(pattern => pattern.test(path));
    }

    function isEmptyRejectedValue(value) {
        return value === '' || value === null ||
            (Array.isArray(value) && value.length === 0);
    }

    function warningsAreSuperset(legacy, bridge) {
        if (!Array.isArray(legacy)) return true;
        if (!Array.isArray(bridge)) return false;
        return legacy.every(item => bridge.some(candidate => same(item, candidate)));
    }

    function draftRefinementIsSafe(legacy, bridge, evidence) {
        const legacyDrafts = Array.isArray(legacy.drafts) ? legacy.drafts : [];
        const bridgeDrafts = Array.isArray(bridge.drafts) ? bridge.drafts : [];
        if (bridgeDrafts.length > legacyDrafts.length) return false;
        if (
            bridgeDrafts.length < legacyDrafts.length &&
            !evidence.some(item => item.kind === 'safe-prefix-truncation')
        ) return false;

        const protectedFields = [
            'questionNumber', 'stem', 'options', 'images', 'source',
            'sourceTrace', 'order', 'type'
        ];
        for (let index = 0; index < bridgeDrafts.length; index += 1) {
            const oldDraft = legacyDrafts[index];
            const newDraft = bridgeDrafts[index];
            if (!oldDraft || !newDraft) return false;
            for (const field of protectedFields) {
                if (!same(oldDraft[field], newDraft[field])) return false;
            }
            for (const field of ['answer', 'solution']) {
                if (same(oldDraft[field], newDraft[field])) continue;
                const provenance = newDraft.fieldProvenance?.[field];
                if (
                    !isEmptyRejectedValue(newDraft[field]) ||
                    !['rejected', 'missing'].includes(provenance?.status) ||
                    typeof provenance?.reasonCode !== 'string' ||
                    provenance.reasonCode.length === 0
                ) return false;
            }
            if (!warningsAreSuperset(oldDraft.warnings, newDraft.warnings)) return false;
        }
        return true;
    }

    function isPrefix(legacy, bridge) {
        return Array.isArray(legacy) && Array.isArray(bridge) &&
            bridge.length <= legacy.length &&
            bridge.every((item, index) => same(item, legacy[index]));
    }

    function sideEffectsRefinementIsSafe(legacy, bridge) {
        const legacyBatches = entityList(legacy, 'batches');
        const bridgeBatches = entityList(bridge, 'batches');
        if (legacyBatches.length !== bridgeBatches.length) return false;
        for (let index = 0; index < legacyBatches.length; index += 1) {
            const oldBatch = legacyBatches[index];
            const newBatch = bridgeBatches[index];
            if (oldBatch.status !== newBatch.status) return false;
            if (
                hasOwn(oldBatch, 'totalCount') && hasOwn(newBatch, 'totalCount') &&
                Number(newBatch.totalCount) > Number(oldBatch.totalCount)
            ) return false;
            if (
                hasOwn(oldBatch, 'problemCount') && hasOwn(newBatch, 'problemCount') &&
                Number(newBatch.problemCount) < Number(oldBatch.problemCount)
            ) return false;
            if (oldBatch.prefixTruncated === true && newBatch.prefixTruncated !== true) {
                return false;
            }
        }

        const statusRank = new Map([
            ['success', 0], ['completed', 0], ['safe-partial', 1],
            ['rejected', 2], ['failed', 2]
        ]);
        const legacyFiles = entityList(legacy, 'files');
        const bridgeFiles = entityList(bridge, 'files');
        if (legacyFiles.length !== bridgeFiles.length) return false;
        for (let index = 0; index < legacyFiles.length; index += 1) {
            const oldStatus = legacyFiles[index].parseStatus;
            const newStatus = bridgeFiles[index].parseStatus;
            if (oldStatus === newStatus) continue;
            if (
                !statusRank.has(oldStatus) || !statusRank.has(newStatus) ||
                statusRank.get(newStatus) < statusRank.get(oldStatus)
            ) return false;
        }
        if (
            hasOwn(legacy, 'selectedPrefix') || hasOwn(bridge, 'selectedPrefix')
        ) {
            if (!isPrefix(legacy.selectedPrefix, bridge.selectedPrefix)) return false;
        }
        if (!warningsAreSuperset(legacy.warnings, bridge.warnings)) return false;
        return true;
    }

    function safeRefinement(legacy, bridge, differences, options) {
        if (String(options.sourceKind || '').toLowerCase() === 'docx') return false;
        const evidence = Array.isArray(options.safetyEvidence)
            ? options.safetyEvidence
            : [];
        if (!evidence.length || !evidence.every(approvedEvidence)) return false;
        const evidencePaths = evidence.flatMap(item => item.paths);
        if (!differences.every(diff =>
            safeDifferencePath(diff.path, bridge.drafts?.length || 0) &&
            evidencePaths.some(path => pathCovers(path, diff.path))
        )) return false;
        if (!evidencePaths.every(path =>
            differences.some(diff => pathCovers(path, diff.path) || pathCovers(diff.path, path))
        )) return false;
        return draftRefinementIsSafe(legacy, bridge, evidence) &&
            sideEffectsRefinementIsSafe(legacy, bridge);
    }

    function compareImportSnapshots(legacySnapshot, bridgeSnapshot, options = {}) {
        const legacy = canonicalizeImportSnapshot(legacySnapshot);
        const bridge = canonicalizeImportSnapshot(bridgeSnapshot);
        const differences = collectDifferences(legacy, bridge);
        const result = differences.length === 0
            ? RESULTS.EXACT
            : safeRefinement(legacy, bridge, differences, options)
                ? RESULTS.SAFE_REFINEMENT
                : RESULTS.NOT_EQUIVALENT;
        return deepFreeze({
            result,
            differences,
            evidenceCodes: result === RESULTS.SAFE_REFINEMENT
                ? options.safetyEvidence.map(item => item.code)
                : []
        });
    }

    const api = Object.freeze({
        RESULTS,
        canonicalizeImportSnapshot,
        compareImportSnapshots
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (globalScope) {
        globalScope.Qisi = globalScope.Qisi || {};
        globalScope.Qisi.ImportEquivalenceNormalizer = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);

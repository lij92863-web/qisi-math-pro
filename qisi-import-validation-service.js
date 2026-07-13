(function initImportValidationService(root) {
    'use strict';

    const PORTS = Object.freeze([
        ['validateSequence', 'sequence', false],
        ['validateSchema', 'schema', true],
        ['validateOwnership', 'ownership', true],
        ['validateSafePartial', 'safe-partial', true],
        ['validateControlledWriteEvidence', 'controlled-write-evidence', true]
    ]);

    const cloneValue = value => {
        if (Array.isArray(value)) return value.map(cloneValue);
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
            );
        }
        return value;
    };

    const freezeValue = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(freezeValue);
        return Object.freeze(value);
    };

    const immutable = value => freezeValue(cloneValue(value));

    const createError = (code, failures = []) => {
        const error = new Error(code);
        error.code = code;
        if (failures.length) error.failures = immutable(failures);
        return error;
    };

    const assertResult = (result, stage) => {
        if (
            !result || typeof result !== 'object' || Array.isArray(result) ||
            typeof result.valid !== 'boolean' ||
            (result.errors !== undefined && !Array.isArray(result.errors)) ||
            (result.warnings !== undefined && !Array.isArray(result.warnings))
        ) {
            throw createError('IMPORT_VALIDATOR_MALFORMED', [
                { stage, index: null, code: 'validator-result-malformed' }
            ]);
        }
        return result;
    };

    const failuresOf = (result, stage, index) => {
        if (result.valid) return [];
        const errors = Array.isArray(result.errors) && result.errors.length
            ? result.errors
            : [{ code: 'validator-rejected' }];
        return errors.map(item => ({
            stage,
            index,
            code: String(item?.code || 'validator-rejected')
        }));
    };

    const validateImportDrafts = (drafts, validatorPorts = {}) => {
        if (!Array.isArray(drafts) || !drafts.length) {
            throw createError('IMPORT_VALIDATION_INPUT_INVALID');
        }
        for (const [name, stage] of PORTS) {
            if (typeof validatorPorts[name] !== 'function') {
                throw createError('IMPORT_VALIDATOR_REQUIRED', [
                    { stage, index: null, code: 'validator-required' }
                ]);
            }
        }

        const candidates = immutable(drafts);
        const context = immutable(validatorPorts.context || {});
        const failures = [];
        const invoke = (name, stage, value, index) => {
            let result;
            try {
                result = validatorPorts[name](value, {
                    index,
                    drafts: candidates,
                    context
                });
            } catch (_error) {
                throw createError('IMPORT_VALIDATOR_FAILED', [
                    { stage, index, code: 'validator-threw' }
                ]);
            }
            failures.push(...failuresOf(assertResult(result, stage), stage, index));
        };

        invoke('validateSequence', 'sequence', candidates, null);
        candidates.forEach((candidate, index) => {
            for (const [name, stage, perDraft] of PORTS) {
                if (perDraft) invoke(name, stage, candidate, index);
            }
        });

        if (failures.length) {
            throw createError('IMPORT_VALIDATION_REJECTED', failures);
        }
        return immutable(candidates);
    };

    const api = Object.freeze({ validateImportDrafts });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ImportValidationService = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);

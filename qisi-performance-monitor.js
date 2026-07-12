(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.PerformanceMonitor = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const ALLOWED_STAGES = new Set([
        'import', 'ocr', 'normalize', 'validation', 'review-render',
        'formula-render', 'save', 'reload', 'export', 'library-query'
    ]);
    const createMonitor = ({ now = () => performance.now(), maxSamples = 500, enabled = true } = {}) => {
        const samples = [];
        const record = (stage, durationMs, metadata = {}) => {
            if (!enabled || !ALLOWED_STAGES.has(stage)) return null;
            const sample = {
                stage,
                durationMs: Math.max(0, Number(durationMs) || 0),
                count: Number.isFinite(metadata.count) ? metadata.count : null,
                success: metadata.success !== false
            };
            samples.push(sample);
            if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples);
            return sample;
        };
        const measure = async (stage, work, metadata = {}) => {
            const started = now();
            try {
                const value = await work();
                record(stage, now() - started, { ...metadata, success: true });
                return value;
            } catch (error) {
                record(stage, now() - started, { ...metadata, success: false });
                throw error;
            }
        };
        const snapshot = () => samples.map(sample => ({ ...sample }));
        const clear = () => { samples.length = 0; };
        return Object.freeze({ record, measure, snapshot, clear });
    };
    return Object.freeze({ ALLOWED_STAGES, createMonitor });
});

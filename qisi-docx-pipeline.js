(function (root, factory) { const api = factory(); root.Qisi = root.Qisi || {}; root.Qisi.DocxPipeline = api; if (typeof module !== 'undefined' && module.exports) { module.exports = api; } })(typeof globalThis !== 'undefined' ? globalThis : this, function () { 'use strict';
const normalizeDocxPipelineResult = (questions, answers, solutions) => ({ questionCount: (questions || []).length, answerCount: (answers || []).length, solutionCount: (solutions || []).length, mode: (questions || []).length === (answers || []).length && (questions || []).length === (solutions || []).length ? 'full' : 'partial' });
return { normalizeDocxPipelineResult };
});

const test = require('node:test');
const assert = require('node:assert/strict');
const enginePath = require.resolve('../qisi-batch-engine-v2');
const row = (q, top, extra = {}) => ({ questionNumber: String(q), type: '解答题',
    stem: '原题题干', question_bbox: [100, top, 900, top + 100], ...extra });
async function run(file) {
    delete require.cache[enginePath]; global.window = {};
    require(enginePath);
    const calls = [];
    const ports = {
        mapWithConcurrency: (items, n, worker) => Promise.all(items.map(worker)),
        recognizePage: async arg => {
            calls.push(arg);
            if (arg.repairInfo) return [row(16, 0, { stem: '完整题干、小问和表格',
                question_bbox: [80, 0, 950, 950], recognizedImages: [{ bbox: [100, 500, 200, 600] }] })];
            return arg.pageNo === 1 ? [row(16, 764)] :
                [{ questionNumber: '(1)(2)', stem: '跨页后续内容' }, row(17, 747)];
        },
        composeBoundaryImage: async () => ({ url: 'composite', splitY: 300 }),
        collectValidFigures: item => item.recognizedImages || [],
        hasFigureCue: () => false, locateQuestionFigures: async () => [],
        normalizeFigure: x => x, isLikelyRealFigure: () => true,
        mergeQuestionItems: x => x, validateQuestionItems: () => ({
            fatal: false, fatalReasons: [], warningReasons: [], failedQuestions: [], rows: [] }),
        isStrictChoiceType: () => false, repairChoiceAndSolutionDetails: async () => [],
        buildQuestionNumberGapWarning: () => '', normalizeFourOptions: x => x,
        isBadChoiceOption: () => false, cleanRecognizedText: x => x,
        isFatalServiceError: () => false
    };
    try {
        const result = await window.QisiBatchEngineV2.createStrictVisualPreparedPagesRecognizer(ports)({
            file, pages: [{ pageNo: 1, url: 'p1' }, { pageNo: 2, url: 'p2' }] });
        return { result, calls };
    } finally { delete global.window; delete require.cache[enginePath]; }
}
test('native PDF cannot call the shared DOCX recognizer after retirement', async () => {
    await assert.rejects(
        run({ id: 'pdf', filename: 'paper.pdf', fileType: 'pdf' }),
        error => error.code === 'PDF_V1_PRODUCER_REQUIRED'
    );
});
test('DOCX and converted DOCX bypass all PDF boundary processing', async () => {
    for (const file of [{ fileType: 'docx' }, { fileType: 'pdf', convertedFromDocx: true }]) {
        const { result, calls } = await run({ filename: 'stable.docx', ...file });
        assert.equal(calls.length, 2);
        assert.equal(result.questions.length, 3);
        assert.equal(result.boundaryDiagnostics, undefined);
    }
});

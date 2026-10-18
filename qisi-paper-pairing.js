(function initPaperPairing(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PaperPairing = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const segmenter = root.Qisi && root.Qisi.PaperSegmenter
        ? root.Qisi.PaperSegmenter
        : (typeof require === 'function' ? require('./qisi-paper-segmenter.js') : null);

    // Two files, one paper: the teacher often keeps 题目.pdf and 答案.pdf apart.
    // Pairing is by printed number only — never by position, never by "the nth
    // answer goes with the nth question". A number that exists on one side and
    // not the other is reported, not filled in.
    const pairPapers = ({ questionBlocks, answerBlocks, answerTable = null, types = {} }) => {
        if (!segmenter) throw new Error('PAPER_SEGMENTER_REQUIRED');
        const namespace = (blocks, side) => blocks.map(block => ({ ...block, id: side + '/' + block.id,
            ...(block.parentId ? { parentId: side + '/' + block.parentId } : {}),
            ...(block.origin ? { origin: { ...block.origin, blockId: side + '/' + block.origin.blockId } } : {}) }));
        const questionSegment = segmenter.segment(namespace(questionBlocks || [], 'question'));
        const answerSegment = segmenter.segment(namespace(answerBlocks || [], 'support'), { numbers: questionSegment.order, role: 'support' });
        const built = segmenter.assemble({ questionSegment, solutionSegment: answerSegment, answerTable, types });

        const questionNumbers = questionSegment.order;
        const answerNumbers = answerSegment.order;
        const questionSet = new Set(questionNumbers), answerSet = new Set(answerNumbers);
        const onlyQuestions = questionNumbers.filter(no => !answerSet.has(no));
        const onlyAnswers = answerNumbers.filter(no => !questionSet.has(no));

        return {
            combined: false,
            paired: built.valid,
            valid: built.valid,
            blocksById: built.blocksById,
            questionSegment,
            answerSegment,
            questions: built.questions,
            issues: [
                ...built.issues.map(issue => ({ ...issue, side: issue.side === 'support' ? 'answer' : issue.side || 'pair' })),
                ...onlyQuestions.map(no => ({ code: 'answer-file-missing-number', no, side: 'pair' })),
                ...onlyAnswers.map(no => ({ code: 'question-file-missing-number', no, side: 'pair' }))
            ],
            coverage: {
                questions: questionNumbers.length,
                answers: answerNumbers.length,
                matched: [...questionSet].filter(no => answerSet.has(no)).length,
                paired: built.questions.filter(question => question.solutionBlocks.length > 0).length
            }
        };
    };

    return Object.freeze({ pairPapers });
});

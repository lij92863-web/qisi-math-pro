const ANSWER_LABEL = '\u3010\u7b54\u6848\u3011';
const SOLUTION_LABEL = '\u3010\u89e3\u6790\u3011';

module.exports = {
    questionParagraphs: [
        '1. sanitized stem A. one B. two C. three D. four',
        '[[IMAGE:docx_img_8]] 8. sanitized image-prefixed stem A. one B. two C. three D. four',
        '[[IMAGE:docx_img_11]] 1 1. sanitized spaced marker stem'
    ],
    supportText: [
        `1 ${ANSWER_LABEL}A`,
        `${SOLUTION_LABEL}sanitized solution 1`,
        `[[IMAGE:support_img_2]] 2 ${ANSWER_LABEL}B`,
        `${SOLUTION_LABEL}sanitized solution 2`
    ].join('\n'),
    expectedQuestionNumbers: ['1', '2']
};

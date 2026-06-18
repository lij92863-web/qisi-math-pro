const badOrder =
    [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 2];

const wrongAnswers =
    new Map([
        [8, 'ABD'],
        [9, '-19/13'],
        [10, '6'],
        [11, '\\frac{\\sqrt{2}+1}{2}']
    ]);

const questionItems =
    Array.from(
        { length: 12 },
        (_, index) => {
            const number =
                index + 1;

            return {
                question: String(number),
                stem: `PDF known bad question ${number}`,
                options:
                    number <= 8
                        ? ['A', 'B', 'C', 'D'].map(label => ({
                            label,
                            text: `Option ${label}${number}`
                        }))
                        : []
            };
        }
    );

const makeSupportItem = number => ({
    question: String(number),
    answer:
        wrongAnswers.get(number) || `known-good-answer-${number}`,
    solution:
        wrongAnswers.get(number)
            ? `Known bad solution carrying ${wrongAnswers.get(number)}`
            : `known-good-solution-${number}`
});

const supportItems =
    badOrder.map(makeSupportItem);

const rawTextPages = [
    supportItems
        .map(item => [
            `${item.question}. 【答案】${item.answer}`,
            `【解析】${item.solution}`
        ].join('\n'))
        .join('\n')
];

module.exports = {
    questionItems,
    answerItems:
        supportItems,
    solutionItems:
        supportItems,
    rawTextPages,
    expectedQuestionNumbers:
        Array.from(
            { length: 12 },
            (_, index) => index + 1
        ),
    wrongAnswers:
        Object.fromEntries(wrongAnswers)
};

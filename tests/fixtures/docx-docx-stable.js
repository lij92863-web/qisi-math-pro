module.exports = {
    questionItems: [
        {
            question: '1',
            stem: 'DOCX stable question 1',
            options: [
                { label: 'A', text: '2' },
                { label: 'B', text: '3' },
                { label: 'C', text: '4' },
                { label: 'D', text: '5' }
            ]
        },
        {
            question: '2',
            stem: 'DOCX stable question 2',
            options: [
                { label: 'A', text: 'x = 1' },
                { label: 'B', text: 'x = 2' },
                { label: 'C', text: 'x = 3' },
                { label: 'D', text: 'x = 4' }
            ]
        },
        {
            question: '3',
            stem: 'DOCX stable question 3',
            options: [
                { label: 'A', text: 'acute' },
                { label: 'B', text: 'right' },
                { label: 'C', text: 'obtuse' },
                { label: 'D', text: 'straight' }
            ]
        }
    ],
    answerItems: [
        { question: '1', answer: 'C' },
        { question: '2', answer: 'B' },
        { question: '3', answer: 'A' }
    ],
    solutionItems: [
        { question: '1', solution: 'Because 2 + 2 = 4.' },
        { question: '2', solution: 'Solving the equation gives x = 2.' },
        { question: '3', solution: 'The angle measure is below 90 degrees.' }
    ],
    warnings: []
};

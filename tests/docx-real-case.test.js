const assert = require('node:assert/strict');
const test = require('node:test');

const {
    parseExplicitSupportBlocks
} = require('../qisi-support-parser.js');

const fixture =
    require('./fixtures/docx-real-case-minimal.js');

test(
    'C9B fixture records image-prefixed DOCX marker gap',
    () => {
        const parsed =
            parseExplicitSupportBlocks({
                pages: [
                    {
                        pageNo: 1,
                        rawText:
                            fixture.supportText
                    }
                ],
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers
            });

        assert.deepEqual(
            parsed.blocks.map(
                block => block.questionNumber
            ),
            ['1']
        );

        assert.ok(
            fixture.questionParagraphs.some(
                paragraph =>
                    paragraph.startsWith(
                        '[[IMAGE:docx_img_8]] 8.'
                    )
            )
        );

        assert.ok(
            fixture.questionParagraphs.some(
                paragraph =>
                    paragraph.startsWith(
                        '[[IMAGE:docx_img_11]] 1 1.'
                    )
            )
        );
    }
);

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    hasUnconvertedImagePlaceholder,
    hasUnconvertedOptionPlaceholder,
    itemHasUnconvertedImagePlaceholder
} = require('../qisi-utils.js');

describe('hasUnconvertedImagePlaceholder', () => {
    it('[IMAGE:...] follows old behavior and returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder('[IMAGE:abc]'), false);
    });

    it('[公式图片待识别] follows old behavior and returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder('[公式图片待识别]'), false);
    });

    it('[公式图片识别] follows old behavior and returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder('[公式图片识别]'), false);
    });

    it('[图片选项待转换...] returns true', () => {
        assert.equal(hasUnconvertedImagePlaceholder('[图片选项待转换: wmf]'), true);
    });

    it('[公式图片选项待转换...] returns true', () => {
        assert.equal(hasUnconvertedImagePlaceholder('[公式图片选项待转换: emf]'), true);
    });

    it('legal IMAGE token returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder('before [[IMAGE:id]] after'), false);
    });

    it('legal FORMULA_IMAGE token returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder('before [[FORMULA_IMAGE:id]] after'), false);
    });

    it('includegraphics returns false because it is protected as legal media', () => {
        assert.equal(hasUnconvertedImagePlaceholder('\\includegraphics{fig.png}'), false);
    });

    it('plain text returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder('plain text'), false);
    });

    it('empty string returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder(''), false);
    });

    it('null returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder(null), false);
    });

    it('undefined returns false', () => {
        assert.equal(hasUnconvertedImagePlaceholder(undefined), false);
    });

    it('object placeholder text returns true', () => {
        assert.equal(hasUnconvertedImagePlaceholder('[object Object]'), true);
    });
});

describe('hasUnconvertedOptionPlaceholder', () => {
    it('option array with placeholder returns true', () => {
        assert.equal(hasUnconvertedOptionPlaceholder({
            stem: 'question',
            options: ['A', '[公式图片选项待转换: unknown]', 'C']
        }), true);
    });

    it('option array without placeholder returns false', () => {
        assert.equal(hasUnconvertedOptionPlaceholder({
            stem: 'question',
            options: ['A', 'B', 'C']
        }), false);
    });

    it('empty option array returns false', () => {
        assert.equal(hasUnconvertedOptionPlaceholder({ stem: 'question', options: [] }), false);
    });

    it('stem with image option placeholder returns true', () => {
        assert.equal(hasUnconvertedOptionPlaceholder({
            stem: '[图片选项待转换: ole]',
            options: []
        }), true);
    });
});

describe('itemHasUnconvertedImagePlaceholder', () => {
    it('item stem with placeholder returns true', () => {
        assert.equal(itemHasUnconvertedImagePlaceholder({
            stem: '题干 [图片选项待转换: wmf]',
            options: [],
            answer: '',
            solution: ''
        }), true);
    });

    it('item option with placeholder returns true', () => {
        assert.equal(itemHasUnconvertedImagePlaceholder({
            stem: '题干',
            options: ['A', '[公式图片选项待转换: bin]'],
            answer: '',
            solution: ''
        }), true);
    });

    it('clean item returns false', () => {
        assert.equal(itemHasUnconvertedImagePlaceholder({
            stem: '题干 [[IMAGE:x]]',
            options: ['A', 'B'],
            answer: 'A',
            solution: '\\includegraphics{ok.png}'
        }), false);
    });

    it('malformed string item returns false', () => {
        assert.equal(itemHasUnconvertedImagePlaceholder('not an item'), false);
    });

    it('does not mutate the item or options array', () => {
        const item = {
            stem: '题干',
            options: ['A', '[图片选项待转换: wmf]'],
            answer: '',
            solution: ''
        };
        const before = JSON.stringify(item);
        itemHasUnconvertedImagePlaceholder(item);
        assert.equal(JSON.stringify(item), before);
    });
});

describe('C2-12 placeholder owner migration checks', () => {
    const appPath = path.join(__dirname, '..', 'app.js');

    it('focused policies own placeholder checks outside app.js', () => {
        const app = fs.readFileSync(appPath, 'utf8');
        const strictPolicy = fs.readFileSync(
            path.join(__dirname, '..', 'qisi-strict-question-policy.js'),
            'utf8'
        );
        assert.doesNotMatch(app, /hasUnconverted(?:Image|Option)Placeholder/);
        assert.doesNotMatch(app, /itemHasUnconvertedImagePlaceholder/);
        assert.match(strictPolicy, /root\.Qisi\.Utils\.hasUnconvertedImagePlaceholder/);
        assert.match(strictPolicy, /root\.Qisi\.Utils\.hasUnconvertedOptionPlaceholder/);
        assert.match(strictPolicy, /root\.Qisi\.Utils\.itemHasUnconvertedImagePlaceholder/);
    });

    it('app.js no naked call check', () => {
        const app = fs.readFileSync(appPath, 'utf8');
        const fns = [
            'hasUnconvertedImagePlaceholder',
            'hasUnconvertedOptionPlaceholder',
            'itemHasUnconvertedImagePlaceholder'
        ];

        for (const fn of fns) {
            const naked = app
                .split(/\r?\n/)
                .filter(line => line.includes(fn + '('))
                .filter(line => !line.includes('window.Qisi.Utils.' + fn + '('));

            assert.deepEqual(naked, [], `naked ${fn} calls found`);
        }
    });
});

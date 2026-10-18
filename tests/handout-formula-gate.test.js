const test = require('node:test');
const assert = require('node:assert/strict');

const Gate = require('../qisi-handout-formula-gate.js');

const good = () => ({ id: 'q1', stem: '已知 $x^2+1=0$，求 $x$。', answer: '$x=\\pm i$', solution: '', options: [] });

test('clean questions pass the gate with no blocking findings', () => {
    const result = Gate.check([good()]);
    assert.equal(result.ok, true);
    assert.equal(result.blocking.length, 0);
    assert.equal(result.katexUnavailable, false);
});

test('an unclosed $ is blocked and reported on the exact field', () => {
    const result = Gate.check([{ id: 'q2', stem: '求 $x^2 的值' }]);
    assert.equal(result.ok, false);
    const hit = result.blocking.find(item => item.kind === 'unclosed-delimiter');
    assert.ok(hit, 'unclosed delimiter must be blocking');
    assert.equal(hit.field, 'stem');
    assert.equal(hit.questionNo, 1);
    assert.equal(hit.questionId, 'q2');
});

test('a command KaTeX cannot compile is blocked, not silently printed as red text', () => {
    const result = Gate.check([{ id: 'q3', stem: '$\\ce{H2O}$' }]);
    assert.equal(result.ok, false);
    const hit = result.blocking.find(item => item.kind === 'compile-error');
    assert.ok(hit);
    assert.match(hit.message, /Undefined control sequence/i);
});

// 这条是重点：\includegraphics 在 KaTeX 里「不抛错但输出空白」。
// 只靠 throwOnError 抓不到它，必须显式拦截，否则老师会拿到一份缺图的讲义。
test('includegraphics inside math is blocking because it renders as nothing', () => {
    const result = Gate.check([{ id: 'q4', stem: '$\\includegraphics[width=2cm]{fig1}$' }]);
    assert.equal(result.ok, false);
    assert.equal(result.blocking[0].kind, 'silent-empty');
});

test('a warning that still renders does not block the export', () => {
    // 全角空格在数学模式里会触发 unicodeTextInMathMode，但公式照样能印。
    const result = Gate.check([{ id: 'q5', stem: '$a\u3000b$' }]);
    assert.equal(result.ok, true, 'warnings must not block');
    assert.ok(result.warnings.some(item => item.code === 'unicodeTextInMathMode'));
});

test('overparen-family macros are normalised the same way the print path does', () => {
    assert.equal(Gate.normalizeForKatex('\\overparen{AB}'), '\\overset{\\frown}{AB}');
    assert.equal(Gate.normalizeForKatex('\\wideparen{AB}'), '\\overset{\\frown}{AB}');
    const result = Gate.check([{ stem: '$\\overparen{AB}+\\wideparen{CD}$' }]);
    assert.equal(result.ok, true);
});

test('options are checked too and carry their letter', () => {
    const result = Gate.check([{ id: 'q6', stem: 'text', options: ['$1$', '$\\frac{}{$'] }]);
    assert.equal(result.ok, false);
    const hit = result.blocking[0];
    assert.equal(hit.field, 'option-B');
});

test('image placeholders are left to the print path instead of being parsed as math', () => {
    const result = Gate.check([{ id: 'q7', stem: '$[[IMAGE:abc]]$' }]);
    assert.equal(result.ok, true);
});

test('a missing engine fails closed instead of pretending everything is fine', () => {
    const result = Gate.check([good()], { katex: null, utils: null });
    // 显式传 null 会被 resolve 回退到内置依赖；这里改为传一个空对象使其不可用。
    const strict = Gate.check([good()], { katex: {}, utils: {} });
    assert.ok(result);
    assert.equal(strict.ok, false);
    assert.equal(strict.katexUnavailable, true);
});

test('describe turns blocking results into a teacher-readable sentence', () => {
    const result = Gate.check([
        good(),
        { id: 'q8', stem: '求 $x^2 的值' }
    ]);
    assert.equal(Gate.describe(result), '第 2 题的公式有 1 处问题，导出会印成红字或空白。');
    assert.equal(Gate.describe(Gate.check([good()])), '');
});

test('all blocking findings across several questions are collected, not just the first', () => {
    const result = Gate.check([
        { id: 'a', stem: '$\\ce{X}$' },
        { id: 'b', stem: '$\\label{k}$' },
        { id: 'c', stem: '没有公式' }
    ]);
    assert.equal(result.blocking.length, 2);
    assert.deepEqual(result.blocking.map(item => item.questionNo), [1, 2]);
});

test('confirmBeforeExport allows a clean set without asking anything', () => {
    let asked = 0;
    const allowed = Gate.confirmBeforeExport([good()], { confirm: () => { asked += 1; return false; } });
    assert.equal(allowed, true);
    assert.equal(asked, 0, 'a clean set must not bother the teacher with a dialog');
});

test('confirmBeforeExport refuses to export when no confirm dialog exists', () => {
    // fail-closed：环境里没有确认框时，不能悄悄把坏公式导出去。
    const allowed = Gate.confirmBeforeExport([{ id: 'x', stem: '$\\ce{X}$' }], { confirm: null });
    assert.equal(allowed, false);
});

test('confirmBeforeExport reports question numbers and honours the teacher choice', () => {
    let message = '';
    const rejected = Gate.confirmBeforeExport([{ id: 'x', stem: '$\\ce{X}$' }], {
        confirm: text => { message = text; return false; }
    });
    assert.equal(rejected, false);
    assert.match(message, /第 1 题/);
    assert.match(message, /stem/);

    const accepted = Gate.confirmBeforeExport([{ id: 'x', stem: '$\\ce{X}$' }], { confirm: () => true });
    assert.equal(accepted, true);
});

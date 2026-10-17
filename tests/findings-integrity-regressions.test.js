const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../qisi-utils.js');
const Write = require('../qisi-pdf-support-controlled-write.js');
const Contracts = require('../qisi-recognition-contracts.js');
const Parser = require('../qisi-support-text-parser.js').createSupportTextParser({
    normalizeQuestionKey: value => String(value), stripQuestionSectionNoise: value => value,
    extractGraphicRefs: () => [], normalizeMathTextForLatexSafe: value => value
});
const options = ['1', '2', '3', '4', '5', '6'];
test('N3 explicit summary cells preserve six pairs and reject ambiguous rows as a unit', () => {
    const rows = Parser.parseAnswerItemsFromText('题号 1 2 3 4 5 6\n答案 ABCDAB', { id: 'support' });
    assert.deepEqual(rows.map(row => [row.question, row.answer]), ['A','B','C','D','A','B'].map((label, i) => [String(i + 1), label]));
    assert.equal(Parser.parseAnswerItemsFromText('题号 1 2 3\n答案 A B', { id: 'support' }).length, 0);
    assert.equal(Parser.parseAnswerItemsFromText('题号 1 1 3\n答案 ABC', { id: 'support' }).length, 0);
});
test('N31/N33/N35 controlled write uses exact unique draft identities and consistent labels', () => {
    const write = drafts => Write.buildPdfSupportFieldLevelControlledWrite({ drafts,
        parserSafeAnswerItems: [{ question: '1', answer: '2' }] });
    assert.equal(write([{ questionNumber: '1', type: '选择题', options }]).effectiveAnswerItems[0]?.answer, 'B');
    assert.equal(write([{ type: 'choice', options }, { questionNumber: '1', type: 'choice', options: ['2','3'] }]).effectiveAnswerItems[0]?.answer, 'A');
    assert.equal(write([{ questionNumber: '1', type: 'choice', options }, { questionNumber: '1', type: 'choice', options: ['2','3'] }]).effectiveAnswerItems.length, 0);
    assert.equal(write([{ type: 'choice', options }]).effectiveAnswerItems.length, 0);
    const draft = { type: 'multiple-choice', options };
    assert.equal(Write.normalizeObjectiveAnswerToLabels('BA', draft).answer, 'AB');
    assert.equal(Write.normalizeObjectiveAnswerToLabels('}_{BA}', draft).answer, 'AB');
});
test('N32 six-option draft labels pass the same contract as controlled write', () => {
    const draft = Contracts.createStructuredQuestionDraft({ sourceId: 'source', sourceOrder: 1,
        questionNumber: '1', type: 'choice', stem: 'Choose.', options, answer: 'F' });
    assert.equal(Contracts.validateStructuredQuestionDraft(draft).valid, true);
});
test('N41/N42 page and answer utilities never invent fractional pages or geometry answers', () => {
    assert.deepEqual(Utils.expandPageRange('3.14', 10), []);
    assert.deepEqual(Utils.expandPageRange('0-3', 10), []);
    assert.deepEqual(Utils.expandPageRange('2-4,6', 10), [2,3,4,6]);
    for (const text of ['三角形ABC', '已知△ABC中，AB=AC', '选项为A、B、C、D']) assert.equal(Utils.finalChoiceAnswerText(text), '');
    assert.equal(Utils.finalChoiceAnswerText('故选A'), 'A');
});
test('N43 dormant dispatch still preserves an explicitly supplied third support file', () => {
    const files = ['questions.docx', 'answers.pdf', 'solutions.docx'].map(name => ({ name }));
    const plan = require('../qisi-file-dispatcher.js').buildDispatchPlan(files);
    assert.equal(plan.solutions, files[2]);
});


test('N10/N11 explicit markers reject decimals, years and equations without losing Chinese or numbered questions', () => {
    const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
    const context = { window: { Qisi: { Utils } } };
    const source = fs.readFileSync(path.join(__dirname, '../qisi-batch-importer.js'), 'utf8');
    vm.runInNewContext(source.replace('window.QisiBatchImporter = {', 'window.QisiBatchImporter = { parseLeadingQuestionMarker,'), context);
    const Docx = context.window.QisiBatchImporter;
    for (const source of ['2x+1=0', '2023年高考数学试卷', '3.14 是圆周率', '1.5倍根号2']) {
        assert.equal(Docx.parseLeadingQuestionMarker(source).questionNumber, '', source);
    }
    for (const [source, number] of [['第3题 已知', '3'], ['一、已知', '1'], ['二十一、已知', '21'], ['1234. 已知', '1234']]) {
        assert.equal(Docx.parseLeadingQuestionMarker(source).questionNumber, number, source);
    }
    assert.equal(Docx.parseLeadingQuestionMarker('一、选择题：本大题共8小题').questionNumber, '');
    assert.equal(Docx.parseLeadingQuestionMarker('1)3x的值').questionNumber, '1');
});
test('N18 an evaluated flag alone does not authorize DOCX vision fields', () => {
    const Contract = require('../qisi-docx-producer-identity-contract.js');
    const result = Contract.buildDocxVisionControlledWriteDecision({
        controlledWrite: { evaluated: true, decisionId: 'self-reported', acceptedFields: ['stem'] }
    });
    assert.equal(result.accepted, false);
    assert.deepEqual(result.fields, []);
});


test('scalar products do not falsely reject same-question geometry or complex solutions', () => {
    require('../qisi-utils.js');
    const policy = require('../qisi-solution-quality-policy.js');
    assert.equal(policy.solutionQualityIssue('复数 z,w 的模乘积', ['|zw|','|z||w|'], '复数 z=a+bi,w=c+di，由 $|zw|^2=(a^2+b^2)\\cdot(c^2+d^2)$ 得模乘积。'), '');
    assert.equal(policy.solutionQualityIssue('三棱锥的体积与表面积', ['体积为 2','表面积为 3'], '三棱锥的体积 $V=\\frac13\\cdot 3\\cdot 2=2$，表面积为 3。'), '');
    assert.equal(policy.solutionQualityIssue('向量 CP 和 DP 的数量积最大值', [], '设 P(x,0)，CP=(x-2,-√3)，DP=(x,-√3)，故 CP · DP = x(x-2)+3，最大值为 6。'), '');
    assert.equal(policy.solutionQualityIssue('数列 a_n 是递增数列，a_2=3，a_3=5，求 a_4', [], '由数列的单调性，a_3<a_4<a_5，a_5=7，因此 a_4=6。'), '');
    assert.notEqual(policy.solutionQualityIssue('已知复数 z 的实部为 2，求其模', [], '已知数列为等差数列，前 n 项和为 $n(n+1)/2$，所以通项公式为 n。'), '');
});

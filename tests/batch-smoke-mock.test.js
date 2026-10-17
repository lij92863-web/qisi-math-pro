const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../qisi-pdf-multimodal-contract.js');
const I = require('../qisi-docx-producer-identity-contract.js');
const bad = require('./fixtures/pdf-support-known-bad.js');
const docxStable = require('./fixtures/docx-docx-stable.js');
const source = { sourceId: 'known-bad-pdf', format: 'pdf', filename: 'local-fixture.pdf' };
const question = no => ({ question_no: no, type: 'single', stem: '原 fixture 题干 ' + no,
    options: ['A','B','C','D'].map(label => ({ label, text: '原选项 ' + label })),
    figures: [], source_pages: [1], status: 'complete', warnings: [] });
const support = (no, field, text) => ({ question_no: no, [field]: text,
    figures: [], source_pages: [1], status: 'complete', warnings: [] });
const parse = wire => C.parseResponse(JSON.stringify(wire), { pages: [1], roles: ['full'] });
const groups = (wire, exam='known-bad-exam') => C.groupProposals(
    [['questions','question'],['answers','answer'],['solutions','solution']].flatMap(([stream,field]) => wire[stream].map(item => ({ field, item, source, model: 'offline-fixture', evidence: [] }))), exam);
const draft = (group, batchId='known-bad-exam') => C.canonicalDraft(group, { batchId, now: 1, identityContract: I });

test('original known-bad rewind preserves exact numbers and rejects incomplete observations', () => {
    const wire = parse({
        questions: bad.questionItems.map(q => ({ ...question(q.question), type: q.options.length ? 'single' : 'long', options: q.options })),
        answers: bad.answerItems.map(a => support(a.question, 'answer', a.answer)),
        solutions: bad.solutionItems.map(s => support(s.question, 'solution', s.solution))
    });
    assert.deepEqual(wire.answers.map(a => a.question_no), bad.answerItems.map(a => a.question));
    const drafts = groups(wire).filter(g => g.question.length).map(g => draft(g));
    for (const q of drafts) {
        assert.equal(q.answer, bad.answerItems.find(a => a.question === q.questionNumber)?.answer || '');
        assert.equal(q.solution, bad.solutionItems.find(s => s.question === q.questionNumber)?.solution || '');
        assert.equal(q.manualConfirmed, false); assert.equal(q.status, 'pending');
    }
    assert.equal(drafts.find(q => q.questionNumber === '12').pdfV1.states.answer, 'missing');
    const rewind = drafts.find(q => q.questionNumber === '2');
    assert.equal(rewind.pdfV1.states.answer, 'partial');
    assert.equal(rewind.fieldProvenance.answer.status, 'rejected');
    assert.match(C.reviewProblem(rewind), /不完整或冲突/);
    assert.match(C.reviewProblem(drafts.find(q => q.questionNumber === '8')), /标签与当前题型/);
});

test('missing question 8 never moves its answer to question 9', () => {
    const rows = groups(parse({ questions: [question('7'),question('9')],
        answers: [support('7','answer','A'),support('8','answer','B'),support('9','answer','C')], solutions: [] }));
    assert.equal(rows.find(g => g.no === '8').question.length, 0);
    assert.throws(() => draft(rows.find(g => g.no === '8')), e => e.code === 'PDF_V1_SCHEMA_INVALID');
    const q9 = draft(rows.find(g => g.no === '9'));
    assert.equal(q9.answer, 'C'); assert.equal(q9.fieldProvenance.answer.sourceId, source.sourceId);
});

test('duplicate answers stay conflicting and cannot be silently selected by text length', () => {
    const q = draft(groups(parse({ questions: [question('1')],
        answers: [support('1','answer','A'),support('1','answer','B')], solutions: [] }))[0]);
    assert.equal(q.pdfV1.states.answer, 'conflict');
    assert.equal(q.pdfV1.candidates.answer.length, 2);
    assert.match(C.reviewProblem(q), /不完整或冲突/);
});

test('same question number from another exam has a different identity', () => {
    const wire = parse({ questions: [question('1')], answers: [], solutions: [] });
    const left = draft(groups(wire,'exam-left')[0],'exam-left');
    const right = draft(groups(wire,'exam-right')[0],'exam-right');
    assert.notEqual(left.id, right.id);
    assert.throws(() => C.validateCanonical([left], 'exam-right', I), e => e.code === 'PDF_V1_SCHEMA_INVALID');
});

test('missing, fractional, out-of-window and old inferred question fields fail schema closed', () => {
    for (const item of [
        { ...question('1'), question_no: '' },
        { ...question('1'), source_pages: [1.5] },
        { ...question('1'), source_pages: [2] },
        { ...question('1'), question: '2' }
    ]) assert.throws(() => parse({ questions: [item], answers: [], solutions: [] }), e => e.code === 'PDF_V1_SCHEMA_INVALID');
});

test('answer and solution field schemas cannot be swapped or accepted from an unassigned role', () => {
    assert.throws(() => parse({ questions: [question('1')], answers: [support('1','solution','foreign proof')], solutions: [] }), e => e.code === 'PDF_V1_SCHEMA_INVALID');
    assert.throws(() => C.parseResponse(JSON.stringify({ questions: [question('1')], answers: [support('1','answer','A')], solutions: [] }), { pages: [1], roles: ['question'] }), e => e.code === 'PDF_V1_SCHEMA_INVALID');
});

test('overlap does not splice complementary question fragments into invented complete text', () => {
    const first = question('16'), second = { ...question('16'), stem: '跨页原后半题干', status: 'partial' };
    const q = draft(groups(parse({ questions: [first,second], answers: [], solutions: [] }))[0]);
    assert.equal(q.stem, first.stem);
    assert.equal(q.pdfV1.candidates.question.length, 2);
    assert.equal(q.pdfV1.states.question, 'conflict');
    assert.match(C.reviewProblem(q), /不完整或冲突/);
});

test('DOCX+DOCX stable fixture keeps all three exact support pairs through the production identity owner', () => {
    const drafts = docxStable.questionItems.map((q, index) => {
        let candidate = I.projectDeterministicDocxCandidate({
            candidate: { id: 'docx:' + q.question, questionNumber: q.question, type: '单选题',
                stem: q.stem, options: q.options.map(o => o.text), answer: '', solution: '', images: [], warnings: [] },
            source: { sourceId: 'docx-question', format: 'docx', filename: 'question.docx', sourceOrder: 1 },
            engine: 'docx-xml-importer', page: 1, index
        });
        for (const field of ['answer','solution']) {
            candidate = I.applyDeterministicDocxSupportField({
                candidate, field,
                support: docxStable[field === 'answer' ? 'answerItems' : 'solutionItems'].find(s => s.question === q.question),
                source: { sourceId: 'docx-support', format: 'docx', filename: 'support.docx', sourceOrder: 2 },
                roles: ['answer','solution']
            });
        }
        return candidate;
    });
    assert.equal(drafts.length, 3);
    for (const q of drafts) {
        assert.ok(q.stem); assert.equal(q.options.length, 4);
        assert.equal(q.answer, docxStable.answerItems.find(s => s.question === q.questionNumber).answer);
        assert.equal(q.solution, docxStable.solutionItems.find(s => s.question === q.questionNumber).solution);
        assert.equal(q.source.format, 'docx'); assert.equal(q.producer.deterministic, true);
        assert.equal(q.fieldProvenance.answer.producerBoundary, 'docx-deterministic-support-to-candidate');
        assert.equal(q.fieldProvenance.solution.producerBoundary, 'docx-deterministic-support-to-candidate');
        assert.deepEqual(q.warnings, []);
    }
});

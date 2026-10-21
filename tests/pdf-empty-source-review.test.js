const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Client = require('../qisi-mineru-client').internals;
const Producer = require('../qisi-pdf-mineru-producer');
const Contract = require('../qisi-pdf-mineru-contract');
const Identity = require('../qisi-docx-producer-identity-contract');
const Review = require('../qisi-review-controller');

test('an unread table reaches only its question review problems and cannot be silently confirmed', async () => {
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/true-import/pdf-question.pdf'));
    const digest = value => crypto.createHash('sha256').update(value).digest('hex');
    const hash = digest(bytes), item = text => ({ page_idx: 0, type: 'text', text });
    const items = [item('一、单项选择题'), item('1. 第一题 A.甲 B.乙 C.丙 D.丁'),
        { page_idx: 0, type: 'table', table_body: '' },
        item('2. 第二题 A.甲 B.乙 C.丙 D.丁'), item(''),
        item('参考答案'), item('1【答案】A'), item('【解析】甲符合题意。'),
        item('2【答案】B'), item('【解析】乙符合题意。')];
    const parsed = Client.parseContentList(items, { sourceId: hash });
    const source = { id: 'source-1', filename: 'question.pdf', fileType: 'pdf', roles: ['full'], uploadPath: 'fixture:pdf' };
    const pages = [{ pageNo: 1, url: 'data:image/png;base64,AA==' }]; pages.totalPages = 1;
    const calls = [];
    const producer = Producer.createProducer({ getRoles: file => file.roles, renderPages: async () => pages,
        fetch: async (url, options) => {
            calls.push(url);
            if (url === '/api/mineru/status') return Response.json({ configured: true });
            if (url === 'fixture:pdf') return new Response(bytes, { headers: { 'content-type': 'application/pdf' } });
            if (url === '/api/mineru/parse') {
                assert.equal(digest(Buffer.from(await options.body.get('file').arrayBuffer())), hash);
                return Response.json({ protocol: 'mineru-blocks-v1', job: hash, source: { sha256: hash, pages: 1 },
                    ...parsed, answerTable: null, receipt: { state: 'ready' } });
            }
            throw new Error('Unexpected offline request: ' + url);
        } });
    const result = await producer({ batchId: 'empty-table-review', sources: [source], supplementalSources: [] });
    assert.equal(result.drafts.length, 2);
    const first = result.drafts.find(draft => draft.questionNumber === '1');
    const second = result.drafts.find(draft => draft.questionNumber === '2');
    assert.ok(first.warnings.some(text => text.includes('表格内容未读取')));
    assert.ok(first.pdfReview.taskProblems.some(text => text.includes('第1页')));
    assert.deepEqual(second.pdfReview.taskProblems, [], 'an empty non-table block must not create another table warning');
    assert.equal(first.answer, 'A'); assert.equal(second.answer, 'B');
    assert.equal(first.fieldProvenance.answer.status, 'rejected');
    assert.equal(first.manualConfirmed, false);
    assert.deepEqual(result.evidence[0].rawEvidence.items, items, 'raw empty-table evidence must survive');
    const review = Review.createReviewController({ formalFields: Identity.FORMAL_FIELDS });
    let adopted = first;
    for (const field of ['question', 'answer', 'solution']) adopted = Contract.chooseCandidate(adopted, field, 0, review);
    assert.match(Contract.reviewProblem(adopted), /请先对照来源/);
    assert.equal(adopted.pdfReview.taskIssuesAcknowledged, false);
    assert.deepEqual(calls, ['/api/mineru/status', 'fixture:pdf', '/api/mineru/parse']);
});

test('an unread support-PDF table keeps its own filename and does not flag the next question', async () => {
    const item = text => ({ page_idx: 0, type: 'text', text });
    const inputs = [
        { id: 'question-source', filename: 'questions.pdf', fixture: 'pdf-question.pdf', roles: ['question'],
            items: [item('一、单项选择题'), item('1. 第一题 A.甲 B.乙 C.丙 D.丁'), item('2. 第二题 A.甲 B.乙 C.丙 D.丁')] },
        { id: 'support-source', filename: 'support.pdf', fixture: 'pdf-solution.pdf', roles: ['answer', 'solution'],
            items: [item('参考答案'), item('1【答案】A'), { page_idx: 0, type: 'table', table_body: '' },
                item('【解析】甲符合题意。'), item('2【答案】B'), item('【解析】乙符合题意。')] }
    ];
    const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
    for (const source of inputs) {
        source.fileType = 'pdf'; source.uploadPath = 'fixture:' + source.id;
        source.bytes = fs.readFileSync(path.join(__dirname, 'fixtures/true-import', source.fixture));
        source.hash = digest(source.bytes);
    }
    const pages = [{ pageNo: 1, url: 'data:image/png;base64,AA==' }]; pages.totalPages = 1;
    const producer = Producer.createProducer({ getRoles: source => source.roles, renderPages: async () => pages,
        fetch: async (url, options) => {
            if (url === '/api/mineru/status') return Response.json({ configured: true });
            const file = inputs.find(source => source.uploadPath === url);
            if (file) return new Response(file.bytes, { headers: { 'content-type': 'application/pdf' } });
            if (url === '/api/mineru/parse') {
                const hash = digest(Buffer.from(await options.body.get('file').arrayBuffer()));
                const source = inputs.find(source => source.hash === hash);
                assert.ok(source);
                const parsed = Client.parseContentList(source.items, { sourceId: hash });
                return Response.json({ protocol: 'mineru-blocks-v1', job: hash, source: { sha256: hash, pages: 1 },
                    ...parsed, answerTable: null, receipt: { state: 'ready' } });
            }
            throw new Error('Unexpected offline request');
        } });
    const result = await producer({ batchId: 'support-table-review', sources: inputs, supplementalSources: [] });
    const first = result.drafts.find(draft => draft.questionNumber === '1');
    const second = result.drafts.find(draft => draft.questionNumber === '2');
    assert.equal(first.pdfReview.taskProblems.length, 1);
    assert.match(first.pdfReview.taskProblems[0], /support\.pdf.*第1页.*表格内容未读取/);
    assert.deepEqual(second.pdfReview.taskProblems, []);
    assert.deepEqual(result.drafts.map(draft => draft.answer), ['A', 'B']);
    assert.equal(first.fieldProvenance.answer.sourceId, 'support-source');
});

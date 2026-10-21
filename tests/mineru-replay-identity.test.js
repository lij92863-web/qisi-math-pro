const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { installMineruReplay } = require('./harness/mineru-replay');

test('offline MinerU evidence follows exact source bytes in either request order', async () => {
    const sources = [
        { file: path.join(__dirname, 'fixtures/true-import/pdf-question.pdf'), items: [{ page_idx: 0, type: 'text', text: '1. Question source' }] },
        { file: path.join(__dirname, 'fixtures/true-import/pdf-solution.pdf'), items: [{ page_idx: 0, type: 'text', text: '1【答案】A' }] }
    ];
    for (const order of [[0, 1], [1, 0]]) {
        let handler;
        await installMineruReplay({ route: async (_, fn) => { handler = fn; } }, sources);
        for (const index of order) {
            const source = sources[index], file = fs.readFileSync(source.file);
            const boundary = 'exact-source-fixture';
            const bytes = Buffer.concat([
                Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="input.pdf"\r\n\r\n'),
                file, Buffer.from('\r\n--' + boundary + '--\r\n')
            ]);
            let response;
            await handler({
                request: () => ({ url: () => 'http://127.0.0.1/api/mineru/parse', postDataBuffer: () => bytes,
                    headers: () => ({ 'content-type': 'multipart/form-data; boundary=' + boundary }) }),
                fulfill: async result => { response = result.json; }
            });
            assert.equal(response.source.sha256, crypto.createHash('sha256').update(file).digest('hex'));
            assert.equal(response.pages[0].blocks[0].text, source.items[0].text);
        }
    }
});

test('legacy fixture envelopes use explicit SHA identities and reject an unknown source', async () => {
    const { installBrowserEngineInjection } = require('./harness/browser-engine-injection');
    const files = ['pdf-question.pdf', 'pdf-solution.pdf'].map(name => path.join(__dirname, 'fixtures/true-import', name));
    const responses = [
        { value: { questions: [{ question_no: '1', type: 'single', stem: 'Question source', options: [] }], answers: [], solutions: [] } },
        { value: { questions: [], answers: [{ question_no: '1', status: 'complete', answer: 'A' }], solutions: [] } }
    ];
    for (const order of [[0, 1], [1, 0]]) {
        const handlers = new Map();
        const engine = await installBrowserEngineInjection({ route: async (pattern, handler) => handlers.set(pattern, handler) });
        engine.setResponses(responses, files);
        const handler = handlers.get('**/api/mineru/**');
        const requestBytes = async bytes => {
            const boundary = 'legacy-source-identity';
            const body = Buffer.concat([Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"\r\n\r\n'),
                bytes, Buffer.from('\r\n--' + boundary + '--\r\n')]);
            let result, aborted = false;
            await handler({
                request: () => ({ url: () => 'http://127.0.0.1/api/mineru/parse', postDataBuffer: () => body,
                    headers: () => ({ 'content-type': 'multipart/form-data; boundary=' + boundary }) }),
                fulfill: async value => { result = value.json; }, abort: async () => { aborted = true; }
            });
            return { result, aborted };
        };
        for (const index of order) {
            const { result, aborted } = await requestBytes(fs.readFileSync(files[index]));
            assert.equal(aborted, false);
            const text = result.pages.flatMap(page => page.blocks).map(block => block.text).join('\n');
            assert.equal(text.includes('Question source'), index === 0);
            assert.equal(text.includes('1【答案】A'), index === 1);
        }
        assert.equal((await requestBytes(Buffer.from('unknown source'))).aborted, true);
        assert.equal(engine.blockedRequests.length, 1);
    }
});

const test = require('node:test');
const assert = require('node:assert/strict');

const rich = require('../qisi-docx-rich-content.js');

test('more than 512 MathType equations are translated in bounded serial batches', async () => {
    const equations = Array.from({ length: 517 }, (_, index) => ({
        id: `rId${index + 1}`,
        mtefBase64: 'BQ=='
    }));
    const requests = [];
    const fetchImpl = async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push(body.equations.map(row => row.id));
        return {
            ok: true,
            status: 200,
            json: async () => ({
                equations: body.equations.map(row => ({
                    id: row.id,
                    ok: true,
                    latex: 'x'
                }))
            })
        };
    };

    const translated = await rich.requestMathTypeTranslations(equations, {
        fetchImpl,
        endpoint: '/api/convert/mathtype-mtef'
    });

    assert.deepEqual(requests.map(rows => rows.length), [512, 5]);
    assert.equal(translated.length, 517);
    assert.equal(new Set(translated.map(row => row.id)).size, 517);
});

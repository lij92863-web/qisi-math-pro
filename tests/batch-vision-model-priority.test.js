const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('batch strict vision tries the configured and observed-available qwen-vl-plus before expensive fallbacks', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const match = source.match(/const VISION_MODELS = \[([\s\S]*?)\];/);
    assert.ok(match, 'VISION_MODELS declaration must remain explicit');

    const models = [...match[1].matchAll(/'([^']+)'/g)].map(entry => entry[1]);
    assert.equal(models[0], 'qwen-vl-plus');
    assert.ok(models.includes('qwen3-vl-plus'));
    assert.ok(models.includes('qwen-vl-max-latest'));
});

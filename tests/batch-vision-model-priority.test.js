const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('standard batch strict vision cannot silently escalate to accurate-model fallbacks', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const match = source.match(/const VISION_MODELS = \[([\s\S]*?)\];/);
    assert.ok(match, 'VISION_MODELS declaration must remain explicit');

    const models = [...match[1].matchAll(/'([^']+)'/g)].map(entry => entry[1]);
    assert.equal(models[0], 'qwen-vl-plus');
    assert.ok(models.includes('qwen3-vl-plus'));
    assert.ok(models.includes('qwen-vl-max-latest'));

    const standardPolicy = source.match(
        /const getVisionModelsForMode = \(mode = 'standard'\) => \{([\s\S]*?)\n\s*\};/
    );
    assert.ok(standardPolicy, 'vision-mode policy must remain explicit');
    assert.match(
        standardPolicy[1],
        /if \(mode === 'accurate'\) return VISION_MODELS;/
    );
    assert.match(
        standardPolicy[1],
        /return \[VISION_MODELS\.find\(model => model === 'qwen-vl-plus'\)/
    );

    assert.match(
        source,
        /const configuredModels = getVisionModelsForMode\(\s*activeRecognitionMode \|\| 'standard'\s*\);/
    );
    assert.doesNotMatch(
        source,
        /const configuredModels = getVisionModelsForMode\('accurate'\);/
    );
});

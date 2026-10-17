const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const permutations = values => values.length ? values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map(tail => [value, ...tail])) : [[]];

test('config and component modules register without Vue and expose their existing APIs', () => {
    const context = vm.createContext({});
    for (const file of ['qisi-config.js', 'qisi-components.js']) vm.runInContext(source(file), context);
    assert.equal(context.Qisi.Config.DEFAULT_PRESET_KEY, 'quizSheet');
    assert.match(context.Qisi.Config.DEFAULT_TEMPLATE, /documentclass/);
    assert.equal(typeof context.Qisi.Components.QuestionCard.setup, 'function');
    assert.equal(typeof context.Qisi.Components.renderLatexPreviewHtml, 'function');
    assert.equal(typeof context.Vue, 'undefined');
});

test('all 24 orders of config, components, app and Vue defer one boot until scripts finish', () => {
    for (const order of permutations(['qisi-config.js', 'qisi-components.js', 'app.js', 'Vue'])) {
        let mounted = 0, ready;
        const proxy = {};
        const context = vm.createContext({console: {log() {}, warn() {}, error() {}},
            document: {readyState: 'loading', addEventListener(name, callback, options) {
                assert.equal(name, 'DOMContentLoaded'); assert.equal(options.once, true); ready = callback;
            }}, addEventListener() {}, Qisi: {Runtime: {
                boot(start, {requiredModules}) {
                    assert.ok(requiredModules.includes('Config'));
                    assert.ok(requiredModules.includes('Components'));
                    return start();
                }, setRuntimeDependency(name, value) {assert.equal(name, 'AppProxy'); assert.equal(value, proxy);}
            }} });
        context.window = context;
        for (const file of order) {
            if (file === 'Vue') context.Vue = {createApp(app) {
                assert.equal(app.components.QuestionCard, context.Qisi.Components.QuestionCard);
                return {config: {}, component() {}, mount(selector) {
                    assert.equal(selector, '#app'); mounted++; return proxy;
                }};
            }};
            else vm.runInContext(source(file), context, {filename: file});
        }
        assert.equal(mounted, 0, order.join(','));
        assert.equal(typeof ready, 'function'); ready(); assert.equal(mounted, 1, order.join(','));
    }
});

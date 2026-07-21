const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { useEntry } = require('../qisi-entry-composable.js');
const EntryViewState = require('../qisi-entry-view-state.js');
const { splitQuestionForStorage } = require('../qisi-utils.js');

const ROOT = path.join(__dirname, '..');
const COPY_SUCCESS_MESSAGE = 'LaTeX 短码已复制！配图选行内浮动时，请将短码置于文字内部！';
const COPY_FAILURE_MESSAGE = '复制失败，请手动复制短码。';

const createVueHarness = () => {
    const reactiveInputs = [];
    const refInputs = [];
    const computedGetters = [];
    const context = {
        ref(value) {
            refInputs.push(value);
            return { value };
        },
        reactive(value) {
            reactiveInputs.push(value);
            return value;
        },
        computed(getter) {
            computedGetters.push(getter);
            return Object.defineProperty({}, 'value', {
                enumerable: true,
                get: getter
            });
        }
    };
    return { context, reactiveInputs, refInputs, computedGetters };
};

const createEntry = (dependencyOverrides = {}) => {
    const harness = createVueHarness();
    const notifications = [];
    const copied = [];
    const dependencies = {
        EntryViewState,
        splitQuestionForStorage,
        async copyText(value) {
            copied.push(value);
            return true;
        },
        notify(message) {
            notifications.push(message);
        },
        ...dependencyOverrides
    };
    return {
        ...harness,
        dependencies,
        notifications,
        copied,
        entry: useEntry(harness.context, dependencies)
    };
};

test('entry composable exposes useEntry in Node and the browser global without hidden effects', () => {
    assert.equal(typeof useEntry, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-entry-composable.js'), 'utf8');
    const browser = {};
    vm.runInNewContext(source, browser, { filename: 'qisi-entry-composable.js' });

    assert.equal(typeof browser.Qisi.EntryComposable.useEntry, 'function');
    assert.doesNotMatch(source, /\b(?:window|document|fetch|indexedDB|localStorage|sessionStorage)\b/);
    assert.doesNotMatch(source, /\bdb\s*\./);
    assert.doesNotMatch(source, /\bDate\b|Math\.random/);
});

test('construction owns fresh legacy entry state with stable reactive and ref identities', () => {
    const first = createEntry();
    const second = createEntry();

    assert.strictEqual(first.entry.entryForm, first.reactiveInputs[0]);
    assert.deepEqual(first.entry.entryForm, {
        grade: '高一',
        diff: '中等',
        type: '解答题',
        knowledge: '',
        knowledgeType: 'system',
        systemKnowledge: '',
        personalKnowledge: '',
        tags: '',
        stem: '',
        options: ['', '', '', ''],
        answer: '',
        solution: '',
        images: []
    });
    assert.equal(first.entry.entryTab.value, 'stem');
    assert.equal(first.entry.showEntryKnowledge.value, false);
    assert.equal(first.entry.showEntryPersonalKnowledge.value, false);
    assert.equal(first.entry.hoverL1.value, null);
    assert.deepEqual(first.refInputs, ['stem', false, false, null]);
    assert.equal(first.computedGetters.length, 3);

    assert.notStrictEqual(first.entry.entryForm, second.entry.entryForm);
    assert.notStrictEqual(first.entry.entryForm.options, second.entry.entryForm.options);
    assert.notStrictEqual(first.entry.entryForm.images, second.entry.entryForm.images);
    assert.notStrictEqual(first.entry.entryTab, second.entry.entryTab);
});

test('construction triggers zero preview, clipboard, or notification effects', () => {
    const calls = { preview: 0, project: 0, split: 0, copy: 0, notify: 0 };
    const harness = createVueHarness();
    const dependencies = Object.freeze({
        EntryViewState: Object.freeze({
            buildEntryPreview() {
                calls.preview += 1;
                return { stem: '', options: [] };
            },
            projectEntryKnowledge() {
                calls.project += 1;
                return { knowledge: '', knowledgeType: 'system' };
            }
        }),
        splitQuestionForStorage() {
            calls.split += 1;
        },
        copyText() {
            calls.copy += 1;
            return true;
        },
        notify() {
            calls.notify += 1;
        }
    });
    const contextKeys = Object.keys(harness.context);
    const dependencyKeys = Object.keys(dependencies);

    const entry = useEntry(Object.freeze(harness.context), dependencies);

    assert.deepEqual(calls, { preview: 0, project: 0, split: 0, copy: 0, notify: 0 });
    assert.deepEqual(Object.keys(harness.context), contextKeys);
    assert.deepEqual(Object.keys(dependencies), dependencyKeys);
    assert.equal(typeof entry.entryPreview.value, 'object');
    assert.equal(calls.preview, 1);
    assert.equal(calls.project, 0);
    assert.equal(calls.copy, 0);
    assert.equal(calls.notify, 0);
});

test('preview computeds preserve the EntryViewState projection and injected splitter identity', () => {
    const calls = [];
    const parsedOptions = ['甲', '乙', '丙', '丁'];
    const splitter = () => ({ stem: 'unused' });
    const result = createEntry({
        EntryViewState: {
            ...EntryViewState,
            buildEntryPreview(form, dependencies) {
                calls.push({ form, splitter: dependencies.splitQuestionForStorage });
                return { parsed: { source: true }, stem: '预览题干', options: parsedOptions };
            }
        },
        splitQuestionForStorage: splitter
    });

    result.entry.entryForm.stem = '原题干';
    assert.equal(result.entry.entryPreview.value.stem, '预览题干');
    assert.equal(result.entry.entryPreviewStem.value, '预览题干');
    assert.strictEqual(result.entry.entryPreviewOptions.value, parsedOptions);
    assert.equal(calls.length, 3);
    calls.forEach(call => {
        assert.strictEqual(call.form, result.entry.entryForm);
        assert.strictEqual(call.splitter, splitter);
    });
});

test('knowledge selection preserves personal-first legacy projection and closes both menus', () => {
    const { entry } = createEntry();

    entry.showEntryKnowledge.value = true;
    entry.showEntryPersonalKnowledge.value = true;
    assert.equal(entry.selectKnowledge('函数', 'system'), undefined);
    assert.equal(entry.entryForm.systemKnowledge, '函数');
    assert.equal(entry.entryForm.personalKnowledge, '');
    assert.equal(entry.entryForm.knowledge, '函数');
    assert.equal(entry.entryForm.knowledgeType, 'system');
    assert.equal(entry.showEntryKnowledge.value, false);
    assert.equal(entry.showEntryPersonalKnowledge.value, false);

    entry.showEntryKnowledge.value = true;
    entry.showEntryPersonalKnowledge.value = true;
    entry.selectKnowledge('我的易错题', 'personal');
    assert.equal(entry.entryForm.systemKnowledge, '函数');
    assert.equal(entry.entryForm.personalKnowledge, '我的易错题');
    assert.equal(entry.entryForm.knowledge, '我的易错题');
    assert.equal(entry.entryForm.knowledgeType, 'personal');
    assert.equal(entry.showEntryKnowledge.value, false);
    assert.equal(entry.showEntryPersonalKnowledge.value, false);

    entry.selectKnowledge(null, 'personal');
    assert.equal(entry.entryForm.personalKnowledge, '');
    assert.equal(entry.entryForm.knowledge, '函数');
    assert.equal(entry.entryForm.knowledgeType, 'system');
});

test('syncEntryLegacyKnowledge returns the exact projection and rewrites only legacy fields', () => {
    const { entry } = createEntry();
    entry.entryForm.knowledge = '旧知识点';
    entry.entryForm.knowledgeType = 'personal';
    entry.entryForm.systemKnowledge = '立体几何';
    entry.entryForm.personalKnowledge = '';
    const optionsIdentity = entry.entryForm.options;
    const imagesIdentity = entry.entryForm.images;

    const projection = entry.syncEntryLegacyKnowledge();

    assert.deepEqual(projection, {
        knowledge: '立体几何',
        knowledgeType: 'system',
        systemKnowledge: '立体几何',
        personalKnowledge: ''
    });
    assert.equal(entry.entryForm.knowledge, '立体几何');
    assert.equal(entry.entryForm.knowledgeType, 'system');
    assert.strictEqual(entry.entryForm.options, optionsIdentity);
    assert.strictEqual(entry.entryForm.images, imagesIdentity);
});

test('changeEntryAlign preserves image-token and includegraphics replacement across all fields', () => {
    const { entry } = createEntry();
    const id = 'img.1+[x]';
    const otherToken = '[[IMAGE:other]]';
    entry.entryForm.images.push(
        { id, align: 'center' },
        { id: 'other', align: 'center' }
    );
    entry.entryForm.stem = `甲\\begin{center}[[FORMULA_IMAGE:${id}]]\\end{center}乙 ${otherToken}`;
    entry.entryForm.answer = `甲\\includegraphics[width=0.5\\linewidth]{${id}}乙`;
    entry.entryForm.solution = `\\begin{flushright}\\includegraphics{${id}}\\end{flushright}`;

    entry.changeEntryAlign(id, 'flushleft');

    const replacement = `\\begin{flushleft}[[IMAGE:${id}]]\\end{flushleft}`;
    assert.equal(entry.entryForm.images[0].align, 'flushleft');
    assert.equal(entry.entryForm.images[1].align, 'center');
    assert.equal(entry.entryForm.stem, `甲${replacement}乙 ${otherToken}`);
    assert.equal(entry.entryForm.answer, `甲${replacement}乙`);
    assert.equal(entry.entryForm.solution, replacement);
});

test('removeEntryImage preserves legacy block and inline cleanup in stem, answer, and solution', () => {
    const { entry } = createEntry();
    const id = 'figure(2).png';
    const kept = { id: 'kept', align: 'center' };
    const removed = { id, align: 'center' };
    const originalImages = [kept, removed];
    entry.entryForm.images = originalImages;
    entry.entryForm.stem = `题干\n\\begin{center}[[IMAGE:${id}]]\\end{center}\n继续`;
    entry.entryForm.answer = `答案 [[FORMULA_IMAGE:${id}]] 保留`;
    entry.entryForm.solution = `解析\n\\includegraphics[width=.4\\linewidth]{${id}}\n\n\n结束`;

    entry.removeEntryImage(id);

    assert.notStrictEqual(entry.entryForm.images, originalImages);
    assert.deepEqual(entry.entryForm.images, [kept]);
    assert.equal(entry.entryForm.stem, '题干\n继续');
    assert.equal(entry.entryForm.answer, '答案  保留');
    assert.equal(entry.entryForm.solution, '解析\n\n结束');
});

test('copyMainSnippet preserves aligned short code and exact success/failure messages', async () => {
    const success = createEntry();
    success.entry.entryForm.images.push({ id: 'main', align: 'flushright' });

    assert.equal(await success.entry.copyMainSnippet('main'), undefined);
    assert.deepEqual(success.copied, ['\\begin{flushright}[[IMAGE:main]]\\end{flushright}']);
    assert.deepEqual(success.notifications, [COPY_SUCCESS_MESSAGE]);

    const failure = createEntry({ copyText: async value => {
        failure.copied.push(value);
        return false;
    } });
    assert.equal(await failure.entry.copyMainSnippet('missing'), undefined);
    assert.deepEqual(failure.copied, ['\\begin{center}[[IMAGE:missing]]\\end{center}']);
    assert.deepEqual(failure.notifications, [COPY_FAILURE_MESSAGE]);
});

test('missing dependencies fail loudly only when their path is exercised', async () => {
    assert.throws(() => useEntry(), /context\.ref/);
    assert.throws(
        () => useEntry({ ref() {} }),
        /context\.reactive/
    );
    assert.throws(
        () => useEntry({ ref() {}, reactive() {} }),
        /context\.computed/
    );

    const harness = createVueHarness();
    const entry = useEntry(harness.context, {});
    assert.throws(() => entry.entryPreview.value, /EntryViewState\.buildEntryPreview/);
    assert.throws(() => entry.syncEntryLegacyKnowledge(), /EntryViewState\.projectEntryKnowledge/);
    await assert.rejects(() => entry.copyMainSnippet('x'), /copyText/);

    const missingSplitter = useEntry(createVueHarness().context, { EntryViewState });
    assert.throws(() => missingSplitter.entryPreview.value, /splitQuestionForStorage/);

    let copyCalls = 0;
    const missingNotify = useEntry(createVueHarness().context, {
        copyText() {
            copyCalls += 1;
            return true;
        }
    });
    await assert.rejects(() => missingNotify.copyMainSnippet('x'), /notify/);
    assert.equal(copyCalls, 0);
});

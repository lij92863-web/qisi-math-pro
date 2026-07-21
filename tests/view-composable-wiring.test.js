const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const MAIN_SOURCE = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
const { browserScriptOrder } = require('../scripts/production-entry-manifest');

const COMPOSABLES = Object.freeze([
    Object.freeze({ owner: 'Settings', file: 'qisi-settings-composable.js' }),
    Object.freeze({ owner: 'Entry', file: 'qisi-entry-composable.js' }),
    Object.freeze({ owner: 'Library', file: 'qisi-library-composable.js' }),
    Object.freeze({ owner: 'Exam', file: 'qisi-exam-composable.js' }),
    Object.freeze({ owner: 'Review', file: 'qisi-review-composable.js' })
]);

test('all five composables have one production call and load before app.js', () => {
    const appIndex = browserScriptOrder.indexOf('app.js');
    assert.ok(appIndex >= 0);

    for (const item of COMPOSABLES) {
        const call = new RegExp(`\\.Qisi\\.${item.owner}Composable\\.use${item.owner}\\(`, 'g');
        assert.equal((APP_SOURCE.match(call) || []).length, 1, `${item.owner} must have one composition call`);
        const scriptIndex = browserScriptOrder.indexOf(item.file);
        assert.ok(scriptIndex >= 0 && scriptIndex < appIndex, `${item.file} must load before app.js`);
        assert.match(MAIN_SOURCE, new RegExp(`<script src="\\./${item.file.replace('.', '\\.')}\\?v=`));
    }
});

test('runtime startup names every composable as an explicit required module', () => {
    for (const item of COMPOSABLES) {
        assert.match(APP_SOURCE, new RegExp(`'${item.owner}Composable'`));
    }
});

test('moved definitions are absent from the coordinator', () => {
    const forbiddenDefinitions = [
        /const entryForm\s*=\s*reactive/,
        /const buildQuestionFingerprintMaps\s*=/,
        /const getExamGroupsForQuestions\s*=/,
        /const savePersonalKnowledge\s*=/,
        /const activeDraftEditorDirty\s*=\s*computed/,
        /const toggleImagePositionMenu\s*=/
    ];
    for (const pattern of forbiddenDefinitions) {
        assert.doesNotMatch(APP_SOURCE, pattern);
    }
});

test('view composables contain no hidden infrastructure or recognition dependencies', () => {
    const forbidden = /\b(?:window|document|fetch|indexedDB|localStorage|sessionStorage|XMLHttpRequest|navigator)\b|\bdb\.|Date\.now|Math\.random|setTimeout|setInterval|\/api\/(?:ai|ocr)/;
    for (const item of COMPOSABLES) {
        const source = fs.readFileSync(path.join(ROOT, item.file), 'utf8');
        assert.doesNotMatch(source, forbidden, `${item.file} must stay deterministic and explicitly injected`);
    }
});

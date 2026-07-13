const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Normalizer = require('../qisi-candidate-normalizer.js');
const SupportRepair = require('../qisi-support-repair.js');
const ROOT = path.resolve(__dirname, '..');

const productionHelpers = Object.freeze({
    hasUnescapedLatexCommandInJsonString:
        SupportRepair.hasUnescapedLatexCommandInJsonString,
    escapeLatexBackslashesInJsonCandidate:
        SupportRepair.escapeLatexBackslashesInJsonCandidate,
    tryRepairedCandidate:
        SupportRepair.tryRepairedCandidate
});

test('cleans wrappers and converts direct, nested, and array question contracts', () => {
    const fenced = Normalizer.normalizeCandidates([
        '```json\n{"data":{"questions":[{"questionNumber":"1","stem":"alpha"}]}}\n```'
    ], productionHelpers);
    assert.equal(fenced.ok, true);
    assert.equal(fenced.method, 'JSON.parse');
    assert.deepEqual(fenced.questions, [{ questionNumber: '1', stem: 'alpha' }]);

    const array = Normalizer.normalizeCandidates([
        [{ questionNumber: '2', stem: 'beta' }]
    ], productionHelpers);
    assert.equal(array.ok, true);
    assert.deepEqual(array.questions, [{ questionNumber: '2', stem: 'beta' }]);
});

test('delegates malformed formula JSON to the real production repair owner', () => {
    let repairCalls = 0;
    const helpers = {
        ...productionHelpers,
        tryRepairedCandidate(input) {
            repairCalls += 1;
            return SupportRepair.tryRepairedCandidate(input);
        }
    };
    const raw = String.raw`{"questions":[{"questionNumber":"1","stem":"in \triangle ABC","options":{"A":"\frac{1}{2}"}}]}`;
    const result = Normalizer.normalizeCandidates([raw], helpers);

    assert.equal(repairCalls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.method, 'json-latex-backslash-repair');
    assert.equal(result.questions[0].stem, String.raw`in \triangle ABC`);
    assert.equal(result.questions[0].options.A, String.raw`\frac{1}{2}`);
});

test('preserves legal JSON escapes without invoking repair', () => {
    let repairCalls = 0;
    const helpers = {
        ...productionHelpers,
        tryRepairedCandidate(input) {
            repairCalls += 1;
            return SupportRepair.tryRepairedCandidate(input);
        }
    };
    const result = Normalizer.normalizeCandidates([
        String.raw`{"questions":[{"stem":"line1\n2 and \\triangle ABC"}]}`
    ], helpers);

    assert.equal(result.ok, true);
    assert.equal(result.questions[0].stem, 'line1\n2 and \\triangle ABC');
    assert.equal(repairCalls, 0);
});

test('keeps immutable raw evidence without mutating caller candidates', () => {
    const candidate = { questions: [{ questionNumber: '3', stem: 'gamma' }] };
    const snapshot = structuredClone(candidate);
    const result = Normalizer.normalizeCandidates([candidate], productionHelpers);

    assert.deepEqual(candidate, snapshot);
    assert.notEqual(result.parsed, candidate);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.questions), true);
    assert.equal(Object.isFrozen(result.rawEvidence), true);
    assert.equal(Object.isFrozen(result.rawEvidence.candidates), true);
    assert.deepEqual(result.rawEvidence.candidates, [snapshot]);
    assert.equal(Reflect.set(result.questions[0], 'stem', 'mutated'), false);
});

test('fails closed for empty, invalid, or helper-less candidates', () => {
    assert.equal(
        Normalizer.normalizeCandidates([], productionHelpers).reason,
        'empty-response'
    );
    assert.equal(
        Normalizer.normalizeCandidates(['not json'], productionHelpers).reason,
        'invalid-json'
    );
    assert.throws(
        () => Normalizer.normalizeCandidates(['{}'], {}),
        error => error.code === 'CANDIDATE_NORMALIZER_HELPER_UNAVAILABLE'
    );
});

test('production shell delegates strict payload normalization and keeps frozen owners separate', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-candidate-normalizer.js'),
        'utf8'
    );

    assert.match(app, /Qisi\.CandidateNormalizer\.normalizeCandidates\s*\(/);
    assert.ok(html.indexOf('qisi-support-repair.js') < html.indexOf('qisi-candidate-normalizer.js'));
    assert.ok(html.indexOf('qisi-candidate-normalizer.js') < html.indexOf('app.js'));
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|fetch\s*\(|XMLHttpRequest/);
    assert.doesNotMatch(implementation, /FormalAdmission|controlledWrite|answerOwnership|saveQuestion|db\.|\.put\s*\(|\.add\s*\(/i);
    assert.doesNotMatch(implementation, /LATEX_JSON_BACKSLASH_REPAIR_COMMANDS|readLatexJsonCommandAt/);
    assert.match(implementation, /helpers\.tryRepairedCandidate/);
});

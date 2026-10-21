const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { readSuite } = require('../scripts/golden/run.cjs');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../golden/synthetic-suite.json')));
test('changed source bytes, duplicate cases and undocumented human verification fail before browser launch', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-golden-input-'));
    const edits = [
        suite => { suite.cases[0].sources[0].sha256 = '0'.repeat(64); },
        suite => { suite.cases.push(structuredClone(suite.cases[0])); },
        suite => { suite.annotation = { kind: 'human-reviewed' }; },
        suite => { suite.cases[0].sources[0].file = '.env'; },
        suite => { delete suite.cases[0].expected[0].answer; },
        suite => { delete suite.cases[0].expectedAutomaticAnswers; }
    ];
    for (const [index, edit] of edits.entries()) {
        const suite = structuredClone(base); edit(suite);
        const file = path.join(directory, index + '.json'); fs.writeFileSync(file, JSON.stringify(suite));
        assert.throws(() => readSuite(file), /GOLDEN_/);
    }
});

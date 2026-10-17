'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {suites}=require('../scripts/verify-personal-stable.js');
const root=path.resolve(__dirname,'..');

test('every explicit personal-stable JS entry exists after PDF retirement',()=>{
    const files=suites.flatMap(s=>s.args.filter(a=>/^(?:tests|scripts)\/.+\.js$/.test(a)));
    assert.ok(files.length>10);
    for(const file of files)assert.ok(fs.existsSync(path.join(root,file)),'missing stable entry: '+file);
});

test('stable verification uses current PDF ownership, raw-order evaluation and isolated persistence',()=>{
    const args=suites.flatMap(s=>s.args);
    for(const file of ['tests/pdf-multimodal-v1.test.js','tests/pdf-external-evaluation.test.js','tests/e2e/pdf-projection-browser-shadow.test.js'])assert.ok(args.includes(file),file);
    assert.ok(!args.includes('scripts/pdf-master-browser-runner.js'),'historical runner is not a current production gate');
    assert.ok(suites.some(s=>s.args.includes('verify:docx-stable')));
    assert.ok(args.includes('tests/import-cutover-persistence-transaction.test.js'));
    assert.ok(args.includes('tests/formal-submit-duplicate-race.test.js'));
});

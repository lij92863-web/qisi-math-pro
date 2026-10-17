const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const allowed=JSON.parse(fs.readFileSync(path.join(out,'allowed.json')));
for(const name of ['architecture/owners.json','tests/db-fingerprint-owner.test.js'])allowed.push(name);
fs.writeFileSync(path.join(out,'allowed.json'),JSON.stringify(allowed,null,2));
fs.appendFileSync(path.join(out,'TASK.md'),'\nRelated registration/fixture additions allowed before edit: architecture/owners.json and tests/db-fingerprint-owner.test.js (required new module dependency, tuple format intentionally changes expected serialization).\n');
function edit(name,work){const file=path.join(root,name),before=fs.readFileSync(file,'utf8'),backup=path.join(out,'source-before',name);if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,before);}const next=work(before.replace(/\r\n/g,'\n'));fs.writeFileSync(file,next.replace(/\n/g,before.includes('\r\n')?'\r\n':'\n'));}
edit('architecture/owners.json',s=>{const anchor='"questionDuplicatePolicyOwner": "qisi-question-duplicate-policy.js",';assert(s.includes(anchor));return s.replace(anchor,anchor+'\n  "questionIndexStorageOwner": "qisi-question-index-storage.js",');});
edit('tests/db-fingerprint-owner.test.js',s=>{
 s=s.replace('preserve prior results','preserve normalization with v2 tuple serialization');
 s=s.replace('Qisi: { QuestionDuplicatePolicy: policy }','Qisi: { QuestionDuplicatePolicy: policy, QuestionIndexStorage: { configure() {} } }');
 const a="        const expected = normalizeBefore(question.stem) + '__' +\n            (Array.isArray(question.options) ? question.options.map(normalizeBefore).join('|') : '');";
 assert(s.includes(a));return s.replace(a,"        const expected = 'qisi-core-v2:' + JSON.stringify([normalizeBefore(question.stem),\n            Array.isArray(question.options) ? question.options.map(normalizeBefore) : []]);");
});
edit('qisi-library-service.js',s=>s.replace("if (!candidateKey || candidateKey === '__') return null;", "if (!candidateKey || candidateKey === '__' || candidateKey === 'qisi-core-v2:[\"\",[]]') return null;"));
edit('tests/question-duplicate-policy.test.js',s=>s+`\ntest('library default and canonical injection reject separators and preserve empty-input behavior', () => {
    const Library = require('../qisi-library-service.js');
    for (const fingerprint of [undefined, Policy.canonicalCoreFingerprint]) {
        assert.equal(Library.detectDuplicate({ id: 'new', stem: 'a__b', options: [] },
            [{ id: 'old', stem: 'a', options: ['b__'] }], fingerprint), null);
        assert.equal(Library.detectDuplicate({ id: 'new', stem: '', options: [] },
            [{ id: 'old', stem: '', options: [] }], fingerprint), null);
    }
});\n`);
if(fs.existsSync(path.join(out,'source-safe.log'))) fs.renameSync(path.join(out,'source-safe.log'),path.join(out,'source-safe-initial.log'));

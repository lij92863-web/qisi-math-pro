const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const source='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统',desktop='C:/Users/Administrator/Desktop/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(git(desktop,'rev-parse','HEAD'),'21ac97fb005fd78c215a6fcd916acc4bf61f0493');
assert.equal(git(source,'status','--porcelain'),'');
const phase1=JSON.parse(fs.readFileSync(path.join(out,'deployment-manifest.json')));
const files=['app.js','main.html','tests/e2e/legacy-fingerprint-package.test.js'];
assert.deepEqual(git(source,'diff','--name-only',phase1.sourceCommit,'HEAD').split('\n').sort(),files.sort());
const entries=files.map(name=>{
 const target=path.join(desktop,name),added=name.startsWith('tests/e2e/legacy-');
 if(added)assert(!fs.existsSync(target));
 else if(name==='main.html')assert.equal(sha(target),phase1.files.find(f=>f.name===name).sourceSha256);
 else {const original=git(source,'rev-parse',phase1.sourceCommit+':'+name);assert.equal(git(desktop,'rev-parse','HEAD:'+name),original);assert.equal(git(desktop,'hash-object','--path='+name,'--',name),original);}
 return{name,beforeSha256:added?null:sha(target),sourceSha256:sha(path.join(source,name)),backup:added?null:path.join(out,'desktop-package-before',name)};
});
for(const entry of entries)if(entry.backup){assert(!fs.existsSync(entry.backup));fs.mkdirSync(path.dirname(entry.backup),{recursive:true});fs.copyFileSync(path.join(desktop,entry.name),entry.backup);assert.equal(sha(entry.backup),entry.beforeSha256);}
fs.writeFileSync(path.join(out,'package-deployment-manifest.json'),JSON.stringify({sourceCommit:git(source,'rev-parse','HEAD'),paidCalls:0,entries},null,2));
for(const entry of entries){fs.copyFileSync(path.join(source,entry.name),path.join(desktop,entry.name));assert.equal(sha(path.join(desktop,entry.name)),entry.sourceSha256);}
console.log(JSON.stringify({synced:entries.length,sourceCommit:git(source,'rev-parse','HEAD')}));

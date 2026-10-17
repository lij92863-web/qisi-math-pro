const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const source='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统',desktop='C:/Users/Administrator/Desktop/题库系统',backup='E:/备份/题库系统';
const out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance',evidence=path.join(desktop,'deliverables/stage28-30-maintenance-evidence-2026-10-01');
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),sha=file=>digest(fs.readFileSync(file));
(async()=>{
 assert.equal(git(source,'status','--porcelain'),'');assert.equal(git(backup,'status','--porcelain'),'');
 assert.equal(git(backup,'rev-parse','HEAD'),'ef2ad10c16cf4743573d1f3352a164ed91c9d995');
 assert.equal(git(desktop,'status','--porcelain','--untracked-files=no'),'');
 const desktopStatus=git(desktop,'-c','core.quotepath=false','status','--porcelain');
 assert.deepEqual(desktopStatus.split('\n').map(s=>s.slice(3)).sort(),['.workbuddy/','deliverables/','启动奇思数学.bat'].sort());
 const report='ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md';
 const reportSha=sha(path.join(source,report));assert.equal(sha(path.join(desktop,report)),reportSha);assert.equal(sha(path.join(desktop,'deliverables/code-audit-recheck-2026-09-30.md')),reportSha);
 assert.equal(sha(path.join(desktop,'deliverables/code-audit-findings-2026-09-28.md')),'4d7924d9a1e4c19c3ef29a6b250b8ae848710332e5a4509fdb8c895109122650');
 const expectedLedgers=['879a8cefe25cd139529149e000f06f22c9da778d60237e2b021d5ad3194b26ec','2b8489db3273c29423950150af27802cf12f7acc01bb59cca84c37d64ef12779'];
 const ledgers=['round1','round2'].map((name,i)=>{const hash=sha(path.join(desktop,'deliverables/handoff-evidence-2026-09-30',name,'ledger.json'));assert.equal(hash,expectedLedgers[i]);return{name,sha256:hash};});
 const names=JSON.parse(fs.readFileSync(path.join(out,'allowed.json')));assert.equal(names.length,18);
 assert.deepEqual(git(source,'diff','--name-only','e522a7098e6fa3373c8fd4cb6c3851d528322d13','HEAD').split('\n').sort(),[...names,report].sort());
 assert.deepEqual(git(desktop,'diff','--name-only','21ac97fb005fd78c215a6fcd916acc4bf61f0493','HEAD').split('\n').sort(),[...names,report].sort());
 const files=names.map(name=>{const hash=sha(path.join(source,name));assert.equal(sha(path.join(desktop,name)),hash);
  assert.equal(git(source,'rev-parse','HEAD:'+name),git(desktop,'rev-parse','HEAD:'+name));
  assert.equal(git(desktop,'hash-object','--path='+name,'--',name),git(desktop,'rev-parse','HEAD:'+name));return{name,sha256:hash};});
 const health=await(await fetch('http://127.0.0.1:3000/api/health')).json();assert.equal(health.ok,true);assert.equal(health.instanceId,'ce044d1cda2d2ce316ce');
 const http=[];
 for(const name of ['main.html','app.js','qisi-question-duplicate-policy.js','qisi-library-service.js','qisi-question-index-storage.js','qisi-db.js','qisi-storage-repository.js','qisi-draft-persistence-service.js']){
  const response=await fetch('http://127.0.0.1:3000/'+name);assert.equal(response.status,200);const hash=digest(Buffer.from(await response.arrayBuffer()));assert.equal(hash,sha(path.join(source,name)));http.push({name,status:200,sha256:hash});
 }
 const acceptance=JSON.parse(fs.readFileSync(path.join(out,'desktop-acceptance.json'))),native=JSON.parse(fs.readFileSync(path.join(out,'desktop-native-index-validation.json')));
 assert.deepEqual(acceptance.errors,[]);assert.deepEqual(acceptance.consoleErrors,[]);assert.deepEqual(acceptance.blockedRequests,[]);assert.equal(acceptance.legacyPackage.importCount,2);assert.equal(acceptance.modules.schemaVersion,9);assert.equal(native.result.batchVersion,2);
 const gates=['source-safe-complete.log','source-doc-safe.log','desktop-program-commit-final.log','desktop-doc-commit-final.log'];
 for(const name of gates){const text=fs.readFileSync(path.join(out,name),'utf8');assert(text.includes('ℹ pass 1764'),name);assert(text.includes('ℹ pass 20'),name);assert(!/ℹ fail [1-9]/.test(text),name);assert(text.includes('[verify-no-real-ai] passed'),name);}
 assert(fs.readFileSync(path.join(out,'source-batch-safety.log'),'utf8').includes('[verify-batch-safety] passed'));
 const summary={date:'2026-10-01',completed:['other-batch-write-concurrency','formal-index-and-draft-count-performance','collision-free-fingerprint-and-old-ZIP-compatibility'],shenzhenWholePaperPassed:false,paidCalls:0,qwenRound2:{used:4,remaining:16,haltUnchanged:true},
  repositories:[{root:source,branch:git(source,'branch','--show-current'),head:git(source,'rev-parse','HEAD'),status:''},{root:desktop,branch:git(desktop,'branch','--show-current'),head:git(desktop,'rev-parse','HEAD'),status:desktopStatus},{root:backup,branch:git(backup,'branch','--show-current'),head:git(backup,'rev-parse','HEAD'),status:''}],
  programCommits:{source:['cc11be9d8b67d4b7eaa2741995993c41ffb2481b','f74aa1a7cd9d617d813ae4d991aa687b06655ce9'],desktop:'12ad7570e7c36c387e2c0b6d6c576c723313ebc2'},
  programFiles:files,reportSha256:reportSha,ledgers,health,http,verification:{tests:1764,failed:0,batchMock:20,gates,batchSafety:true},
  migration:{agentOpenedUserProfile:false,fixtureUpgradeValidated:true,version:9,nextNormalAppOpenUpgradesIndexes:true,existingWindowsNeedRefresh:true},
  preservedFailures:['source-safe-initial.log: owner and VM dependency adaptation','baseline-native-races.log: old code incorrectly accepts three stale writers','legacy-package-before.log and desktop-acceptance-debug2.log: existing Vue proxy import clone failure','workflow-debug2.log: measurement callback adaptation','desktop-program-commit.log: old static allowlist during service restart, stable rerun passed','desktop-doc-initial-failure.log: evidence .test.js copies accidentally discovered, archived as .txt, real tests retained']};
 for(const name of fs.readdirSync(out))if(fs.statSync(path.join(out,name)).isFile()&&!name.startsWith('server-')&&name!=='isolated-empty-database-backup.zip'&&name!=='report-before.md')fs.copyFileSync(path.join(out,name),path.join(evidence,name));
 for(const name of fs.readdirSync(__dirname).filter(n=>n.startsWith('stage28-')))fs.copyFileSync(path.join(__dirname,name),path.join(evidence,'scripts',name));
 fs.copyFileSync(path.join(source,'tests/question-index-transaction.test.js'),path.join(evidence,'scripts/question-index-transaction.test.js.txt'));
 fs.copyFileSync(path.join(source,'tests/e2e/legacy-fingerprint-package.test.js'),path.join(evidence,'scripts/legacy-fingerprint-package.test.js.txt'));
 fs.writeFileSync(path.join(out,'completion.json'),JSON.stringify(summary,null,2));fs.writeFileSync(path.join(evidence,'completion.json'),JSON.stringify(summary,null,2));
 console.log(JSON.stringify({completed:summary.completed,heads:summary.repositories.map(r=>({root:r.root,head:r.head,trackedClean:true})),files:18,httpVerified:8,tests:1764,batchMock:20,reportSha256:reportSha,paidCalls:0,evidence}));
})().catch(e=>{console.error(e);process.exitCode=1;});

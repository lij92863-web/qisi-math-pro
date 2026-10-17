const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const source='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const desktop='C:/Users/Administrator/Desktop/题库系统';
const base='092bae4', head='f05cffb1578e1707184a40a708dcde4979d51f42',old='da4fd0039b9b3611479bc2758c9b8fb851cc4e53';
const out='C:/Users/Administrator/AppData/Local/Temp/qisi-desktop-sync-2026-09-30';
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function safe(root,file){const result=path.resolve(root,file);if(!result.startsWith(path.resolve(root)+path.sep))throw Error('path outside root');return result;}
function preflight(){
 if(git(source,['rev-parse','HEAD'])!==head||git(desktop,['rev-parse','HEAD'])!==old)throw Error('HEAD changed');
 if(git(source,['status','--porcelain']))throw Error('source dirty');
 if(git(desktop,['diff','--name-only'])||git(desktop,['diff','--cached','--name-only']))throw Error('desktop tracked changes');
 const others=git(desktop,['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
 if(others.some(f=>!f.startsWith('.workbuddy/')&&!f.startsWith('deliverables/')&&f!=='启动奇思数学.bat'))throw Error('unexpected untracked files');
}
if(process.argv[2]==='prepare'){
 preflight();if(fs.existsSync(path.join(out,'manifest.json')))throw Error('backup already prepared');
 const tokens=git(source,['diff','--name-status','-z',base,head]).split('\0');const files=[];
 for(let i=0;i<tokens.length&&tokens[i];i+=2){const status=tokens[i],file=tokens[i+1];if(!['A','M','D'].includes(status))throw Error('unsupported diff');
  const from=safe(source,file),to=safe(desktop,file);
  if(status==='A'){if(fs.existsSync(to))throw Error('new file collision '+file);}else{
   const original=git(source,['rev-parse',`${base}:${file}`]);
   if(git(desktop,['rev-parse',`HEAD:${file}`])!==original||git(desktop,['hash-object','--path',file,to])!==original)throw Error('baseline mismatch '+file);
  }
  if(status!=='D'&&git(source,['hash-object','--path',file,from])!==git(source,['rev-parse',`${head}:${file}`]))throw Error('source blob mismatch');
  const entry={status,file,oldSha256:status==='A'?null:sha(to),newSha256:status==='D'?null:sha(from)};files.push(entry);
 }
 if(files.length!==44)throw Error('unexpected diff count');fs.mkdirSync(out,{recursive:true});
 for(const entry of files){if(entry.oldSha256){const dest=safe(path.join(out,'program-before'),entry.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(safe(desktop,entry.file),dest);if(sha(dest)!==entry.oldSha256)throw Error('backup checksum mismatch');}}
 const dependencies=path.join(out,'dependencies-new');fs.mkdirSync(dependencies);for(const f of ['package.json','package-lock.json'])fs.copyFileSync(path.join(source,f),path.join(dependencies,f));
 const ledgerHashes={};for(const round of ['round1','round2']){const f=path.join(desktop,'deliverables/handoff-evidence-2026-09-30',round,'ledger.json');ledgerHashes[round]=sha(f);}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({source,desktop,base,head,old,files,ledgerHashes},null,2));
 fs.writeFileSync(path.join(out,'TASK.md'),'# Stage 23 desktop sync and acceptance\nUser explicitly authorizes exact stage 15–22 deployment to C desktop, dependencies, isolated acceptance, scoped commit, then audit report update.\nAllowed program files: manifest.json exact 44 paths including one D; app.js only existing verified 14 additions/1 deletion glue; node_modules replacement after external backup. Reports: existing ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md and deliverables recheck mirror. No E runtime edits, no .env, production database, original materials, ledger changes, real AI/OCR, broad refactor or cleanup. Preserve original untracked items.\nAcceptance: verify:safe, batch-safety, architecture/runtime, diff-scope, actual port3000 isolated browser resources/navigation/SRI/errors. Stop on new user changes, unknown process, out-of-scope failures or rejected escalation.\n');
 console.log(JSON.stringify({prepared:files.length,out,ledgerHashes}));
}else if(process.argv[2]==='apply'){
 preflight();const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
 for(const e of m.files){const target=safe(desktop,e.file);if(e.oldSha256?sha(target)!==e.oldSha256:fs.existsSync(target))throw Error('desktop changed '+e.file);if(e.newSha256&&sha(safe(source,e.file))!==e.newSha256)throw Error('source changed');}
 for(const e of m.files){const target=safe(desktop,e.file);if(e.status==='D')fs.unlinkSync(target);else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(safe(source,e.file),target);if(sha(target)!==e.newSha256)throw Error('copy checksum mismatch');}}
 console.log('Applied and SHA256 verified exact 44 paths; original untracked items untouched');
}else throw Error('use prepare or apply');

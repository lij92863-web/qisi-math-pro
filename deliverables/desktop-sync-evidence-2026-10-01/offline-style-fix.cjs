const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const source='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统',desktop='C:/Users/Administrator/Desktop/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-desktop-sync-2026-09-30';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [root,head] of [[source,'f05cffb1578e1707184a40a708dcde4979d51f42'],[desktop,'b6aac9615021c5b8ddef66ce36935014dfa08862']]){
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==head)throw Error('HEAD changed');
 if(execFileSync('git',['diff','--name-only'],{cwd:root,encoding:'utf8'}).trim()||execFileSync('git',['diff','--cached','--name-only'],{cwd:root,encoding:'utf8'}).trim())throw Error('new tracked changes');
}
const files=['main.html','app.css','app.js'],manifest=[];
function replaceOnce(s,old,next){if(s.split(old).length!==2)throw Error('unexpected replacement anchor');return s.replace(old,next);}
for(const file of files){
 const original=fs.readFileSync(path.join(source,file)),before=fs.readFileSync(path.join(desktop,file));let text=original.toString('utf8');
 if(file==='main.html')text=text.replace(/^    <link[^\r\n]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^\r\n]*\r?\n/gm,'');
 if(file==='app.css')text=replaceOnce(text,"font-family: 'Inter', 'Noto Sans SC', sans-serif;","font-family: 'Inter', 'Noto Sans SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;");
 if(file==='app.js'){
  text=replaceOnce(text,'<link rel="stylesheet" href="https://unpkg.com/katex@0.16.8/dist/katex.min.css"/>','<link rel="stylesheet" href="${escapeHtml(new URL(\'./vendor/katex/katex.min.css\', window.location.href).href)}"/>');
  text=replaceOnce(text,'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap">\n','');
  text=text.replace('backupWorkspace, backupStatus, view, questions, filteredQuestions, cart, currentPage, ','backupWorkspace, backupStatus, view, questions, filteredQuestions, cart, currentPage,');
 }
 // Keep the source's line endings; only named replacements are changed.
 const backup=path.join(out,'stage24-before');fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'source-'+file),original);fs.writeFileSync(path.join(backup,'desktop-'+file),before);
 manifest.push({file,sourceBefore:sha(original),desktopBefore:sha(before),after:sha(Buffer.from(text))});
 fs.writeFileSync(path.join(source,file),text);fs.writeFileSync(path.join(desktop,file),text);
}
fs.writeFileSync(path.join(out,'stage24-manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(out,'stage24-TASK.md'),'# Stage 24 offline interface and print resources\nConfirmed failure: actual port3000 isolated browser blocks Google font CSS and logs resource error. Print template also references remote font and mismatched KaTeX0.16.8 CSS.\nAllowed: main.html remove3 remote font links; app.css Windows system fallback; app.js openPrintWindow replace remote KaTeX link with absolute same-origin existing0.16.47 CSS and remove Google font link, trim existing glue trailing space. No new algorithms, app business logic, schema or test expectations. Exact source and desktop backups/SHA manifest preserved.\nRequired: isolated actual navigation/backup/SRI/print/math/no-external-request acceptance; verify:safe, batch-safety, architecture/runtime/diff scope; scoped commits. No real AI/OCR, no production IndexedDB, no E changes, no ledger edits.\n');
console.log(JSON.stringify(manifest));

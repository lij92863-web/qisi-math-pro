const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
if(process.argv[2]==='prepare'){
 const names=JSON.parse(fs.readFileSync(path.join(out,'allowed.json')));names.push('app.js','tests/e2e/legacy-fingerprint-package.test.js');
 fs.writeFileSync(path.join(out,'allowed.json'),JSON.stringify(names,null,2));
 fs.appendFileSync(path.join(out,'TASK.md'),'\nConfirmed legacy ZIP compatibility bug: Vue proxy options cause DataCloneError in actual desktop import. Before edit, allow app.js one line in confirmImportBankPreview (toRaw outer preview), app cache token, and tests/e2e/legacy-fingerprint-package.test.js at isolated port32228. app-js-boundary read; no parsing/business algorithm added.\n');
 fs.copyFileSync(path.join(__dirname,'legacy-fingerprint-package.test.js'),path.join(root,'tests/e2e/legacy-fingerprint-package.test.js'));exit=0;
}else{
 const file=path.join(root,'app.js'),before=fs.readFileSync(file,'utf8'),anchor='await importQuestionBankPackage(pendingImportPreview.value);';assert.equal(before.split(anchor).length,2);
 const backup=path.join(out,'source-before','app.js');assert(!fs.existsSync(backup));fs.writeFileSync(backup,before);fs.writeFileSync(file,before.replace(anchor,'await importQuestionBankPackage(toRaw(pendingImportPreview.value));'));
 const main=path.join(root,'main.html');fs.writeFileSync(main,fs.readFileSync(main,'utf8').replace('./app.js?v=atomic-batch-stats-01','./app.js?v=tuple-index-v2-01'));
}

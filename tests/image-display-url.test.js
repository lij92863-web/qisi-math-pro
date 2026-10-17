const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const policy=require('../qisi-question-image-policy');
const root=path.resolve(__dirname,'..');
const valid=['data:image/png;base64,aGVsbG8=','data:image/svg+xml;base64,PHN2Zy8+','blob:http://127.0.0.1:3000/abc-123','blob:null/abc-123','https://example.test/a.png','http://127.0.0.1:3000/a.png','./a.png','/images/a.png'];
const hostile=['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html;base64,PHNjcmlwdD4=','file:///C:/secret.png','vbscript:msgbox(1)','https://user:password@example.test/a.png','java\nscript:alert(1)','http:\\example.test\\a.png','blob:javascript:alert(1)','data:image/png;base64,aGVsbG8=\n',null,{}];
test('display policy permits existing image sources and rejects unsafe schemes without mutating evidence',()=>{
 for(const url of valid)assert.equal(policy.displayImageUrl(url),url);
 for(const url of hostile)assert.equal(policy.displayImageUrl(url),'',String(url));
 const image={id:'raw',url:hostile[0]};
 assert.equal(policy.normalizeInlineImageList([image])[0].url,hostile[0]);assert.equal(image.url,hostile[0]);
});
function owners(){
 const utils=require('../qisi-utils');
 const context=vm.createContext({window:{Qisi:{QuestionImagePolicy:policy,Utils:utils}},URL,console,tokenizeLatexSource:utils.tokenizeLatexSource});
 vm.runInContext(fs.readFileSync(path.join(root,'qisi-components.js'),'utf8')+'\nthis.preview=Qisi.Components.renderLatexPreviewHtml;',context);
 const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const start=source.indexOf('                const escapeHtml = (text)');
 const end=source.indexOf('                const applyPrintWritingRules',start);
 assert.ok(start>0&&end>start);
 vm.runInContext(source.slice(start,end)+'\nthis.print=printImageHtml;',context);
 return context;
}
test('actual preview and print owners refuse malicious image addresses while retaining allowed ones',()=>{
 const {preview,print}=owners();
 for(const url of hostile){
  const image={id:'img1',url};
  assert.doesNotMatch(preview('[[IMAGE:img1]]',[image]),/<img\s/);
  assert.doesNotMatch(print(image),/<img\s/);
 }
 for(const url of valid){
  const image={id:'img1',url};assert.match(preview('[[IMAGE:img1]]',[image]),/<img\s/);assert.match(print(image),/<img\s/);
 }
});
test('accepted HTTP URL attribute punctuation is escaped in actual image rendering',()=>{
 const {preview,print}=owners(),image={id:'img1',url:'https://example.test/a?x=" onerror="bad'};
 for(const html of [preview('[[IMAGE:img1]]',[image]),print(image)]){
  assert.match(html,/&quot;/);assert.doesNotMatch(html,/\sonerror="/);
 }
});

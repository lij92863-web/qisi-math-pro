const test=require('node:test'),assert=require('node:assert/strict');
const Source=require('../qisi-browser-document-source.js'),Renderer=require('../qisi-browser-pdf-renderer.js');
test('PDF text, layout, primary renderer and fallback all disable font code evaluation',async()=>{
 const previous=global.pdfjsLib,utils=global.Qisi.Utils;const calls=[];let failPrimary=false;
 global.Qisi.Utils={expandPageRange:()=>[]};global.pdfjsLib={GlobalWorkerOptions:{},getDocument:options=>{calls.push(options);return {promise:failPrimary?(failPrimary=false,Promise.reject(new Error('worker unavailable'))):Promise.resolve({numPages:0})};}};
 try{
  const file={filename:'fixture.pdf',uploadPath:'memory'},dataUrlToBlob=async()=>new Blob(['%PDF']);
  const source=Source.createBrowserDocumentSource({makeBatchId:()=>'',dataUrlToBlob,resolveFormulaImageTokens:x=>x,blockImageToken:()=>''});
  await source.extractPdfTextWithPdfJs(file);await source.extractPdfLayoutWithPdfJs(file);
  const renderer=Renderer.createBrowserPdfRenderer({dataUrlToBlob,getBatchFileRoles:()=>[],logBatchPdfDiag:()=>{},batchHasQuestionRole:()=>true,estimateVisionCalls:()=>0,recordRenderedPages:()=>{},showBatchToast:()=>{},getRecognitionMode:()=>''});
  failPrimary=true;await assert.rejects(renderer.renderPdfFilePages(file),/页码范围为空/);
  assert.equal(calls.length,4);assert.equal(calls.at(-1).disableWorker,true);assert.ok(calls.every(options=>options.isEvalSupported===false));
 }finally{global.pdfjsLib=previous;global.Qisi.Utils=utils;}
});

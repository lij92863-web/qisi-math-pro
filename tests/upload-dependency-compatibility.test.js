const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const express=require('express'),multer=require('multer');
const {assertDocxUploadType}=require('../qisi-docx-upload-policy.js');
test('patched multipart upload preserves diskStorage and rejects an invalid document MIME',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'qisi-upload-patch-'));
 const app=express();const upload=multer({storage:multer.diskStorage({destination:directory,filename:(_req,_file,cb)=>cb(null,'accepted.docx')}),fileFilter:(_req,file,cb)=>{try{assertDocxUploadType(file);cb(null,true);}catch(e){cb(e);}},limits:{fileSize:1024}});
 app.post('/upload',upload.single('file'),(req,res)=>res.json({size:req.file.size}));app.use((err,req,res,next)=>res.status(400).json({error:err.code}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const send=async(type,content)=>{const form=new FormData();form.append('file',new Blob([content],{type}),'sample.docx');return fetch('http://127.0.0.1:'+server.address().port+'/upload',{method:'POST',body:form});};
  const response=await send('application/vnd.openxmlformats-officedocument.wordprocessingml.document','zip-bytes');assert.equal(response.status,200);assert.equal((await response.json()).size,9);assert.equal(fs.readFileSync(path.join(directory,'accepted.docx'),'utf8'),'zip-bytes');
  const rejected=await send('text/html','<html>');assert.equal(rejected.status,400);assert.equal(fs.readFileSync(path.join(directory,'accepted.docx'),'utf8'),'zip-bytes');
 }finally{await new Promise(resolve=>server.close(resolve));fs.unlinkSync(path.join(directory,'accepted.docx'));fs.rmdirSync(directory);}
});

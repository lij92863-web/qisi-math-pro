(function(root,factory){const api=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=api;root.Qisi=root.Qisi||{};root.Qisi.PdfExternalProducer=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const pageEvidence=root.Qisi?.PdfPageEvidence || (typeof module!=='undefined'&&module.exports?require('./qisi-pdf-page-evidence.js'):null);
const DEFAULT_CONFIG=Object.freeze({enabled:false,wireVersion:'pdf-external-v2.2',mode:'direct',model:'',reviewModel:'',profileVersion:'unconfigured',windowMode:'document',outputPages:5,contextPages:2,renderScale:2,cropScale:3,jpegQuality:0.94,maxTokens:32768,maxConcurrency:6,timeoutMs:180000,maxCalls:80,maxQueries:20,maxPageAppearances:1000,maxYuan:20,maxRequestYuan:0.25,maxQueryYuan:0.25,maxResourceYuan:0.25});
const activeRuns=new Set();
// Typography repair is owned here, not in the app shell: only the normalizer is
// used, so the instance is built with inert ports instead of shell wiring.
let typography=null;
const typeset=()=>{if(typography!==null)return typography;const api=root.Qisi?.QuestionContentPolicy;if(!api?.createQuestionContentPolicy)return typography=null;try{typography=api.createQuestionContentPolicy({recognizeFormulaText:()=>'',blockImageToken:()=>'',getDefaultType:()=>''}).normalizeMathTextForLatexSafe;}catch(_){typography=null;}return typography;};
const copy=v=>JSON.parse(JSON.stringify(v));
const error=(code,message,details)=>Object.assign(Error(message||code),{code,details});
const active=signal=>{if(signal?.aborted)throw Object.assign(Error('PDF任务已取消'),{name:'AbortError'});};
function tasks(pages,config=DEFAULT_CONFIG){
 if(!Number.isSafeInteger(config.outputPages)||config.outputPages<1||!Number.isSafeInteger(config.contextPages)||config.contextPages<0)throw error('PDF_EXTERNAL_PAGE_CONFIG_INVALID');
 const result=[],runs=[];
 for(const [i,page]of pages.entries()){if(!Number.isSafeInteger(page.pageNo)||page.pageNo<1||i&&page.pageNo<=pages[i-1].pageNo)throw error('PDF_EXTERNAL_PAGE_CONFIG_INVALID');if(!i||page.pageNo!==pages[i-1].pageNo+1)runs.push([]);runs.at(-1).push(page);}
 for(const run of runs){
  if(config.windowMode==='document'&&config.wireVersion!=='pdf-external-v2.1'){result.push({pages:run,outputPages:run.map(p=>p.pageNo),contextPages:[]});continue;}
  for(let i=0;i<run.length;i+=config.outputPages){const output=run.slice(i,i+config.outputPages),input=run.slice(Math.max(0,i-config.contextPages),Math.min(run.length,i+config.outputPages+config.contextPages));result.push({pages:input,outputPages:output.map(p=>p.pageNo),contextPages:input.filter(p=>!output.includes(p)).map(p=>p.pageNo)});}
 }
 return result;
}
async function digest(value){const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
function requestDigest(operation,input){return digest({operation,metadata:input.metadata,model:input.model,assetId:input.assetId,prompt:input.prompt,systemPrompt:input.systemPrompt,parsedPages:input.parsedPages,pages:input.pages?.map(p=>[p.pageNo,p.url]),crops:input.crops,parseReceipt:input.parseReceipt,maxTokens:input.maxTokens,responseFormat:input.responseFormat});}
function attemptCost(contract,operation,result,config){
 // A completed-job receipt describes the original parse, not the status query's price.
 const billing=operation==='query'?result?.queryBilling:result?.billing;
 if(billing?.currency==='CNY'&&billing.known===true&&Number.isFinite(billing.yuan)&&billing.yuan>=0)return{known:true,yuan:billing.yuan,note:'Provider-adapter billing receipt'};
 if(operation==='query')return Number.isFinite(config.queryYuanPerCall)&&config.queryYuanPerCall>=0?{known:true,yuan:config.queryYuanPerCall}:{known:false,yuan:null};
 if(operation==='resource')return Number.isFinite(config.resourceYuanPerCall)&&config.resourceYuanPerCall>=0?{known:true,yuan:config.resourceYuanPerCall}:{known:false,yuan:null};
 const tiers=['parse','transcribe','locate'].includes(operation)?config.parserPriceTiers:operation==='review'?config.reviewPriceTiers:config.priceTiers;
 return contract.calculateUsageCost(result?.usage||result?.rawResponse?.usage,Array.isArray(tiers)?tiers:[]);
}
function refreshCharges(record){
 if(!record.attempts?.length)return;
 record.actualSubmission=true;record.calls=record.attempts.filter(a=>a.operation!=='query').reduce((n,a)=>n+(a.calls||1),0);
 record.reservedYuan=record.attempts.reduce((n,a)=>n+a.reservedYuan,0);
 const cost=operation=>{const rows=record.attempts.filter(a=>operation.includes(a.operation)),known=rows.every(a=>a.cost?.known);return{known,yuan:known?rows.reduce((n,a)=>n+a.cost.yuan,0):null};};
 record.cost={known:record.attempts.every(a=>a.cost?.known),yuan:record.attempts.every(a=>a.cost?.known)?record.attempts.reduce((n,a)=>n+a.cost.yuan,0):null,modelCost:cost(['direct','organize','revise']),parserCost:cost(['parse','transcribe','locate']),reviewCost:cost(['review'])};
}
function createProducer(ports={},initial={}){
 for(const name of ['renderPages','renderRegion','execute','getRoles'])if(typeof ports[name]!=='function')throw error('PDF_EXTERNAL_PORT_REQUIRED',name);
 const contract=ports.contract||root.Qisi.PdfExternalContract,identity=ports.identityContract||root.Qisi.DocxProducerIdentityContract;
 const run=async function run(context,signal){
  const config={...DEFAULT_CONFIG,...initial,...ports.getConfig?.()};
  const simple=config.profileVersion===pageEvidence.PROFILE,windowOnly=config.profileVersion===pageEvidence.PROFILE_WINDOW,pageLed=simple||windowOnly;
  const windowRule=simple?config.windowMode==='document':config.windowMode==='window'&&Number.isSafeInteger(config.outputPages)&&config.outputPages>=1&&config.outputPages<=6&&Number.isSafeInteger(config.contextPages)&&config.contextPages>=0&&config.contextPages<=2;
  if(config.enabled!==true||!config.model)throw error('PDF_EXTERNAL_NOT_CONFIGURED','PDF识别服务待配置。软件链路已准备，提供接口后再启用。');
  if(root.document&&config.requireCrossWindowLock===true&&typeof root.navigator?.locks?.request!=='function')throw error('PDF_EXTERNAL_LOCK_NOT_AVAILABLE','当前浏览器不支持跨窗口导入保护，请使用本地应用的 Chromium 浏览器');
  if(!['direct','parse-organize','parse-organize-text'].includes(config.mode)||!['document','window'].includes(config.windowMode)||![contract.WIRE_VERSION,contract.LEGACY_WIRE_VERSION].includes(config.wireVersion)||!Number.isSafeInteger(config.maxCalls)||config.maxCalls<1||!Number.isSafeInteger(config.maxQueries)||config.maxQueries<0||!Number.isSafeInteger(config.maxPageAppearances)||config.maxPageAppearances<1||!Number.isSafeInteger(config.maxConcurrency)||config.maxConcurrency<1||config.maxConcurrency>8||![config.maxYuan,config.maxRequestYuan,config.maxQueryYuan,config.maxResourceYuan].every(v=>Number.isFinite(v)&&v>=0))throw error('PDF_EXTERNAL_CONFIG_INVALID');
  if(config.wireVersion===contract.WIRE_VERSION&&(!config.reviewModel||ports.execute.supportsReview?.()===false))throw error('PDF_EXTERNAL_REVIEW_NOT_CONFIGURED','独立原页复核模型和接口待配置，尚未提交识别请求');
  if(config.mode!=='direct'&&!ports.execute.stageLedger)throw error('PDF_EXTERNAL_STAGE_LEDGER_REQUIRED','分阶段接口必须登记每次实际请求');
  if(pageLed&&(config.mode!=='parse-organize-text'||!windowRule||config.wireVersion!==contract.WIRE_VERSION||config.model!==pageEvidence.MODEL||config.reviewModel!==pageEvidence.MODEL))throw error('PDF_EXTERNAL_SIMPLE_SCOPE_INVALID',simple?'固定流程要求完整document、v2.2和指定千问模型':'分窗流程要求 window 模式、每窗1-6页、最多2页上下文、v2.2 和指定千问模型');
  const files=[...context.sources,...(context.supplementalSources||[])].filter((f,i,a)=>a.findIndex(x=>x.id===f.id)===i);
  const isQuestionSource=file=>ports.getRoles(file).some(role=>role==='question'||role==='full');
  files.sort((left,right)=>Number(isQuestionSource(right))-Number(isQuestionSource(left)));
  const observations=[],errors=[],warnings=[],unassigned=[],allPages=new Map();
  // Requests in flight right now. A persisted 'registered' attempt that is not in
  // this set survived a crash and is genuinely ambiguous; one that is in this set
  // is simply concurrent work.
  const inFlight=new Set();
  const previous=await ports.getExistingDrafts?.(context.batchId)||[];
  if(previous.some(q=>!contract.isExternal(q)))throw error('PDF_EXTERNAL_EXISTING_PROTOCOL','历史草稿继续使用原审核协议；新识别请建立新任务，保留原草稿');
  let fatal=false;
  const evidence=files.flatMap(f=>f.pdfExternalEvidence?.tasks||[]).map(copy);
  // Windowed tasks run at the same time, so their bookkeeping shares one queue:
  // budget checks, evidence scans and ledger writes must never interleave.
  const stageQueue={queue:Promise.resolve()};
  let requestSeq=0,persistQueue=Promise.resolve();
  // A window owns only its own evidence records. Reading another window's live
  // 'registered' state as an ambiguous submission would abort a healthy run.
  const ownsWindow=(record,outputPages)=>!windowOnly||!Array.isArray(record.metadata?.sources?.[0]?.output_pages)||record.metadata.sources[0].output_pages.some(page=>outputPages.includes(page));
  // Tasks buffer their own findings; the caller merges them in page order.
  const persistFile=(file,pending={})=>{
   const pendingErrors=[...(pending.errors||[])],pendingUnassigned=[...(pending.unassigned||[])];
   const write=async()=>{file.pdfExternalEvidence={protocol:contract.PROTOCOL,tasks:evidence.filter(e=>e.sourceId===file.id),unassigned:copy([...unassigned,...pendingUnassigned].filter(u=>u.source_id===file.id)),errors:copy([...errors,...pendingErrors].filter(e=>e.sourceId===file.id))};await ports.persistSourceEvidence?.(file,copy(file.pdfExternalEvidence));};
   const next=persistQueue.then(write,write);persistQueue=next.then(()=>undefined,()=>undefined);return next;
  };
  for(const file of files){
   active(signal);
   if(String(file.fileType||'').toLowerCase()!=='pdf'||file.convertedFromDocx)throw error('PDF_EXTERNAL_SOURCE_NOT_PDF');
   if(fatal){errors.push({sourceId:file.id,pages:[],code:'PDF_EXTERNAL_HALTED',message:'此前致命错误，来源未处理'});await persistFile(file);continue;}
   const roles=ports.getRoles(file),allowed=roles.includes('full')?['questions','answers','solutions']:[['question','questions'],['answer','answers'],['solution','solutions']].filter(([r])=>roles.includes(r)).map(([,s])=>s);
   const source={sourceId:file.id,format:'pdf',filename:file.filename,mimeType:'application/pdf',sourceOrder:files.indexOf(file)};
   const pages=await ports.renderPages(file,{scale:config.renderScale,jpegQuality:config.jpegQuality,sequential:true,requireAllPages:true,suppressCostEstimate:true});allPages.set(file.id,pages);
   const totalPages=pages.totalPages||file.pdfPageCount||(pages.every((p,i)=>p.pageNo===i+1)?pages.length:0);
   if(!Number.isSafeInteger(totalPages)||totalPages<1)throw error('PDF_EXTERNAL_SOURCE_PAGE_COUNT_MISSING','缺少原卷总页数，不能把选中页数当作原页映射');
   if(pageLed&&(pages.length!==totalPages||pages.some((p,i)=>p.pageNo!==i+1)))throw error('PDF_EXTERNAL_SIMPLE_SCOPE_INVALID','固定流程必须输入原卷全部连续页');
   if(pages.some((page,i)=>i&&page.pageNo!==pages[i-1].pageNo+1))errors.push({sourceId:file.id,pages:pages.map(p=>p.pageNo),code:'PDF_EXTERNAL_SELECTED_PAGE_GAPS',message:'已选页码存在间隔，仅处理已选范围，请对照原卷确认本题范围'});
   const projectTasks=tasks(pages,config);
   // One window is one task. Findings stay task-local until the caller merges them
   // in page order, so completion order can never reorder observations.
   const executeTask=async(index,task,prior)=>{
    const observations=[],errors=[],warnings=[],unassigned=[];
    const persist=file=>persistFile(file,{errors,warnings,unassigned});
    const done=()=>({observations,errors,warnings,unassigned});
    active(signal);if(fatal)return done();
    const metadata={sources:[{source_id:file.id,scope_id:context.batchId,document_role:allowed.includes('questions')?(allowed.length===1?'question':'full'):'support',allowed_streams:allowed,total_pages:totalPages,input_pages:task.pages.map(p=>p.pageNo),output_pages:task.outputPages,context_only_pages:task.contextPages}],assets:[]};
    if(!contract.validateRequest(metadata).valid)throw error('PDF_EXTERNAL_METADATA_INVALID');
    const parserProfile=config.mode==='direct'?null:ports.execute.getParserProfile?.(config)||null;
    const cacheKey=await digest({metadata,config,parserProfile,schema:contract.getWireSchema(config.wireVersion),reviewSchema:contract.REVIEW_SCHEMA,prompts:['SYSTEM','DIRECT','ORGANIZE','SYSTEM_V22','ORGANIZE_TEXT','REVIEW_VISUAL','REVIEW_SYSTEM','REVIEW_CROPS','REVISE',...(pageLed?['SIMPLE_ORGANIZE','SIMPLE_REVIEW']:[])].map(k=>root.Qisi.PdfExternalProvider?.[k]),pages:task.pages.map(p=>[p.pageNo,p.url])});
    const parseMetadata=parserProfile?{sources:metadata.sources.map(s=>({source_id:s.source_id,total_pages:s.total_pages,input_pages:s.input_pages}))}:metadata;
    const parseKey=await digest({sourceId:file.id,pages:task.pages.map(p=>[p.pageNo,p.url]),metadata:parseMetadata,parserVersion:config.parserVersion||'unconfigured',parserConfig:config.parserConfig||null,parserProfile,model:parserProfile?config.model:null,maxTokens:parserProfile?config.maxTokens:null});
    const requestId=context.batchId+':'+file.id+':'+index+':external:'+(windowOnly?++requestSeq:evidence.length);
    const unknown=evidence.find(e=>e.sourceId===file.id&&ownsWindow(e,task.outputPages)&&(['submission_unknown','registered'].includes(e.state)||e.attempts?.some(a=>['registered','submission_unknown'].includes(a.state))));
    if(unknown){errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:'PDF_EXTERNAL_SUBMISSION_UNKNOWN',message:'此前提交状态未知，不能自动重复发送'});fatal=true;await persist(file);return done();}
    const cached=evidence.findLast(e=>e.sourceId===file.id&&e.cacheKey===cacheKey&&['validated','received'].includes(e.state)&&e.finishReason==='stop');
    const pending=evidence.findLast(e=>e.sourceId===file.id&&ownsWindow(e,task.outputPages)&&e.state==='parse_pending');
    if(pending&&pending.parseKey!==parseKey)throw error('PDF_EXTERNAL_PARSE_PENDING','已有解析任务与当前选页/解析配置不同，请先处理原任务');
    const cachedParse=evidence.findLast(e=>e.sourceId===file.id&&e.parseKey===parseKey&&e.parseValidated)?.parseResult;
    if(pageLed){
     const stopped=evidence.find(e=>e.sourceId===file.id&&e.cacheKey===cacheKey&&!['received','validated'].includes(e.state));
     if(stopped){errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:'PDF_EXTERNAL_SIMPLE_STOPPED',message:'当前固定流程已失败，保留证据；不会自动重发或修复'});fatal=true;return done();}
     const calls=evidence.flatMap(e=>e.attempts||[]).filter(a=>a.operation!=='query').length,planned=cached?0:cachedParse?2:0;
     if(calls+planned>config.maxCalls)throw error('PDF_EXTERNAL_BUDGET_EXHAUSTED','固定路径调用数超过上限，尚未提交新的模型请求');
    }
    let record=cached,result;
    const abortIfCancelled=async cause=>{
     if(signal?.aborted||cause.name==='AbortError'){
      if(pageLed){record.state=record.attempts?.some(a=>['registered','submission_unknown'].includes(a.state))?'submission_unknown':'cancelled';await persist(file);}
      throw cause;
     }
    };
    context.reportStage?.({stage:'pdf-external-task-start',engine:config.model,counts:{task:index+1,totalTasks:tasks(pages,config).length},pages:metadata.sources[0].input_pages});
    // Every physical request is registered and persisted before its adapter is invoked.
    const onStage=async event=>{
     if(event.stage==='page-plan'){
      const physical=evidence.flatMap(e=>e.attempts||[]),reused=[];
      record.reusedAttempts=[];
      for(const entry of event.requests){
       active(signal);
       const hash=await requestDigest(entry.operation,entry.input);
       const saved=physical.findLast(a=>a.operation===entry.operation&&a.requestHash===hash&&a.state==='received'&&a.responseHash);
       let response=null;
       if(saved){
        if(await digest(saved.response)!==saved.responseHash)throw error('PDF_PAGE_EVIDENCE_CACHE_INVALID','已收回执内容与保存的摘要不符');
        const page=entry.input.pages[0].pageNo,sourceId=entry.input.metadata.sources[0].source_id;
        if(saved.response.model===pageEvidence.MODEL){
         try{
          if(entry.operation==='transcribe')pageEvidence.receiveRaw(saved.response,sourceId,page,entry.pageImageHash);
          else pageEvidence.receiveLocation(saved.response,sourceId,page,contract);
          response={...copy(saved.response),attemptId:saved.requestId};
         }catch(cause){if(!['PDF_PAGE_RAW_INVALID','PDF_PAGE_REGIONS_INVALID'].includes(cause.code))throw cause;}
        }
        if(response)record.reusedAttempts.push({requestId:saved.requestId,operation:saved.operation,requestHash:hash,responseHash:saved.responseHash});
       }
       reused.push(response);
      }
      const calls=physical.filter(a=>a.operation!=='query').reduce((n,a)=>n+(a.calls||1),0);
      if(calls+reused.filter(r=>!r).length+2>config.maxCalls)throw error('PDF_EXTERNAL_BUDGET_EXHAUSTED','剩余固定步骤超过调用上限，尚未提交新的模型请求');
      await persist(file);
      return reused;
     }
     if(event.stage==='request-start'){
      active(signal);
      // 'registered' means in-flight while a worker is running, and ambiguous
      // only when it survived a crash. Only the latter may stop later dispatch.
      if(record.attempts?.some(a=>a.state==='submission_unknown'||(a.state==='registered'&&!inFlight.has(a.requestId))))throw error('PDF_EXTERNAL_SUBMISSION_UNKNOWN','本任务有接受未知的请求，后续提交已停止');
      // Preserve conservative charges from historical aggregated records when resuming a job.
      if(record.actualSubmission&&!record.attempts){record.attempts=[{requestId:record.requestId+':legacy',operation:'legacy',state:'received',calls:record.calls||1,pageAppearances:record.pages?.length||0,reservedYuan:record.reservedYuan||0,cost:record.cost||{known:false,yuan:null}}];}
      const physical=evidence.flatMap(e=>e.attempts?.length?e.attempts:e.actualSubmission?[{operation:'legacy',calls:e.calls||1,pageAppearances:e.pages?.length||0,reservedYuan:e.reservedYuan||0,cost:e.cost}]:[]);
      const queries=physical.filter(a=>a.operation==='query').length,calls=physical.filter(a=>a.operation!=='query').reduce((n,a)=>n+(a.calls||1),0),spent=physical.reduce((n,a)=>n+(a.cost?.known?a.cost.yuan:a.reservedYuan),0);
      const query=event.operation==='query',reservedYuan=query?config.maxQueryYuan:event.operation==='resource'?config.maxResourceYuan:config.maxRequestYuan;
      const pageAppearances=query||event.operation==='resource'?0:(event.input.pages?.length||event.input.parsedPages?.length||metadata.sources[0].input_pages.length)+(event.input.crops?.length||0);
      if((query?queries+1>config.maxQueries:calls+1>config.maxCalls)||physical.reduce((n,a)=>n+a.pageAppearances,0)+pageAppearances>config.maxPageAppearances||spent+reservedYuan>config.maxYuan+Number.EPSILON)throw error('PDF_EXTERNAL_BUDGET_EXHAUSTED','达到调用次数、页数或金额上限，后续请求已停止');
      const attempt={requestId:record.requestId+':'+event.operation+':'+(record.attempts||[]).length,operation:event.operation,state:'registered',inputMode:event.input.inputMode||null,model:event.input.model||config.model,parserVersion:config.parserVersion||null,wireVersion:config.wireVersion,pageAppearances,reservedYuan,cost:{known:false,yuan:null},registeredAt:Date.now(),requestHash:await requestDigest(event.operation,event.input)};
      record.attempts=record.attempts||[];record.attempts.push(attempt);inFlight.add(attempt.requestId);record.currentAttemptId=attempt.requestId;record.state='registered';refreshCharges(record);await persist(file);return{requestId:attempt.requestId};
     }
     if(['request-finish','request-error'].includes(event.stage)){
      const attempt=record.attempts.find(a=>a.requestId===(event.requestId||record.currentAttemptId)),cause=event.cause;
      if(attempt)inFlight.delete(attempt.requestId);
      const response=event.result||{rawResponse:cause?.rawResponse||null,usage:cause?.usage||cause?.rawResponse?.usage||null,billing:cause?.billing,queryBilling:cause?.queryBilling};
      if(!attempt||attempt.operation!==event.operation)throw error('PDF_EXTERNAL_ATTEMPT_STATE_INVALID');
      Object.assign(attempt,{state:event.stage==='request-finish'||cause?.externalResponseReceived?'received':cause?.submissionAccepted===false||cause?.definitelyNotSubmitted===true?'rejected':'submission_unknown',finishedAt:Date.now(),elapsedMs:Date.now()-attempt.registeredAt,response:copy(response),cost:attemptCost(contract,event.operation,response,config)});
      attempt.responseHash=await digest(attempt.response);
      if(cause){attempt.error={code:cause.code||cause.name,message:cause.message,status:cause.status||null};if(cause.definitelyNotSubmitted===true)attempt.cost={known:true,yuan:0};}
      refreshCharges(record);await persist(file);return;
     }
     record.parseEvidence=record.parseEvidence||[];record.parseEvidence.push(copy(event));
     if(event.result!==undefined)record.parseResult=copy(event.result);
     if(event.stage==='parse-pending'){record.parseReceipt=copy(event.result);record.state='parse_pending';}
     if(event.validated)record.parseValidated=true;
     if(event.stage==='parse'||event.validated){const original=record.attempts?.find(a=>a.operation==='parse');if(original){original.finalBilling={usage:event.result?.usage||event.result?.rawResponse?.usage||null,billing:event.result?.billing||null};original.cost=attemptCost(contract,'parse',event.result,config);refreshCharges(record);}}
     await persist(file);
    };
    // Ledger writes are serialized so concurrent page requests cannot interleave
    // a half-written evidence record; the network calls themselves stay parallel.
    // Windowed tasks share one queue because they are dispatched at the same time.
    const queue=windowOnly?stageQueue:{queue:Promise.resolve()};
    const serialStage=event=>{const next=queue.queue.then(()=>onStage(event),()=>onStage(event));queue.queue=next.then(()=>undefined,()=>undefined);return next;};
    const execute=async taskInput=>{
     if(ports.execute.stageLedger)return ports.execute({...taskInput,trackRequests:true,maxConcurrency:config.maxConcurrency},serialStage);
     const registration=await onStage({stage:'request-start',operation:taskInput.mode==='review-visual'?'review':'direct',input:taskInput});
     let output;
     try{output=await ports.execute({...taskInput,requestId:registration.requestId});}catch(cause){await onStage({stage:'request-error',operation:taskInput.mode==='review-visual'?'review':'direct',cause,requestId:registration.requestId});throw cause;}
     await onStage({stage:'request-finish',operation:taskInput.mode==='review-visual'?'review':'direct',result:output,requestId:registration.requestId});return output;
    };
    if(cached)result={text:cached.text,model:cached.model,finishReason:cached.finishReason,usage:cached.usage,ok:cached.ok,refusal:cached.refusal,metadata:cached.metadata||metadata,parseResult:cached.parseResult,rawResponse:cached.rawResponse};
    else{
     if(pending){record=pending;Object.assign(record,{cacheKey,metadata,model:config.model});}
     else{record={requestId,cacheKey,parseKey,sourceId:file.id,pages:metadata.sources[0].input_pages,metadata,model:config.model,state:'registered',actualSubmission:false,calls:0,reservedYuan:0,attempts:[],registeredAt:Date.now()};evidence.push(record);}
     await persist(file);
     try{
      const started=Date.now();
     result=await execute({...task,metadata,file,model:config.model,mode:config.mode,profileVersion:config.profileVersion,maxPromptBytes:config.maxPromptBytes,maxRequestImages:config.maxRequestImages,wireVersion:config.wireVersion,strictTextSchema:config.strictTextSchema,parserVersion:config.parserVersion,parserConfig:config.parserConfig,maxTokens:config.maxTokens,timeoutMs:config.timeoutMs,requestId:record.requestId,signal,cachedParse,parseReceipt:pending?.parseReceipt});
      Object.assign(record,{state:'received',text:result.text,rawResponse:result.rawResponse||null,ok:result.ok!==false,refusal:result.refusal||null,finishReason:result.finishReason||null,usage:result.usage||null,model:result.model||config.model,metadata:result.metadata||metadata,elapsedMs:Date.now()-started,parseResult:result.parseResult||record.parseResult});await persist(file);
      active(signal);
     }catch(cause){
      if(cause.externalResponseReceived)record.state='invalid';
      else if(cause.code!=='PDF_EXTERNAL_PARSE_PENDING'&&['registered','parse_pending'].includes(record.state))record.state=record.attempts?.some(a=>a.state==='submission_unknown')?'submission_unknown':record.parseReceipt?.jobId&&!record.parseValidated?'parse_pending':record.attempts?.at(-1)?.state==='rejected'||!record.actualSubmission||cause.definitelyNotSubmitted?'rejected':cause.code==='PDF_EXTERNAL_BUDGET_EXHAUSTED'?'rejected':'submission_unknown';
      record.error={code:cause.code||cause.name||'PDF_EXTERNAL_FAILED',message:cause.message,...(cause.details?{details:copy(cause.details)}:{})};await persist(file);
      if(cause.rawResponse){record.rawResponse=copy(cause.rawResponse);await persist(file);}
      await abortIfCancelled(cause);
      errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:record.error.code,message:cause.message});fatal=pageLed||['submission_unknown','parse_pending'].includes(record.state)||[400,401,402,403].includes(cause.status);return done();
     }
    }
    if(parserProfile){
     try{
      const restored=ports.execute.restoreParse(result.parseResult,metadata);
      const assets=restored.assets.map(a=>({asset_id:a.asset_id,source_id:a.source_id,page:a.page,...(pageLed?{kind:a.kind,anchor:a.anchor}:{})})),blocks=restored.parsedPages.flatMap(p=>p.blocks.map(b=>({block_id:b.block_id,source_id:p.source_id,page:p.page})));
      if(JSON.stringify(assets)!==JSON.stringify(result.metadata?.assets)||JSON.stringify(blocks)!==JSON.stringify(result.metadata?.blocks))throw error('PDF_PAGE_EVIDENCE_CACHE_INVALID','页文资源/块命名空间与候选来源不一致');
     }catch(cause){record.state='invalid';record.error={code:cause.code||'PDF_PAGE_EVIDENCE_CACHE_INVALID',message:cause.message};errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:record.error.code,message:cause.message});if(pageLed)fatal=true;await persist(file);return done();}
    }
    const responseMetadata=result.metadata||metadata;
    const checked=JSON.stringify(responseMetadata.sources)!==JSON.stringify(metadata.sources)?{valid:false,errors:['provider-source-metadata-changed']}:pageLed&&result.model&&result.model!==pageEvidence.MODEL?{valid:false,errors:['provider-model-changed']}:contract.validateWireResult(result.text,responseMetadata,{ok:result.ok!==false,refusal:result.refusal,finishReason:result.finishReason,expectedWireVersion:config.wireVersion});
    if(!checked.valid||pageLed&&['questions','answers','solutions','unassigned'].some(stream=>checked.result[stream].some(item=>item.figures.some(fig=>fig.bbox!==null)))){record.state='invalid';record.validationErrors=checked.valid?['text-organizer-bbox-forbidden']:checked.errors;errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:'PDF_EXTERNAL_WIRE_INVALID',message:record.validationErrors.join(', ')});if(pageLed)fatal=true;await persist(file);return done();}
    // A window owns only the items whose printed number sits on its output pages;
    // whatever the model also emitted for a context page belongs to its neighbour.
    if(windowOnly){const own=new Set(metadata.sources[0].output_pages);for(const stream of ['questions','answers','solutions'])checked.result[stream]=checked.result[stream].filter(item=>own.has(item.number_page));}
    if(record.state!=='validated'){
     record.state='validated';
     refreshCharges(record);
     await persist(file);
    }
    const transcriptionIssues=copy(result.parseResult?.pageEvidence?.issues||[]);
    for(const issue of transcriptionIssues)errors.push({sourceId:issue.source_id||file.id,pages:issue.page?[issue.page]:[],code:'PDF_EXTERNAL_TRANSCRIPTION_REVIEW_REQUIRED',message:'原页转写待核对：'+issue.message});
    const observation={result:checked.result,metadata:result.metadata||metadata,source,requestId:record.requestId,model:record.model,transcriptionIssues,images:[],cropErrors:[]},reviewCrops=[];
    if(pageLed){
     const complete=[...prior,...observations,observation],expected=complete.flatMap(o=>o.result.questions.map(q=>q.question_no));
     const required=[...new Set(complete.flatMap(o=>o.metadata.sources.flatMap(s=>s.allowed_streams.filter(v=>v!=='questions'))))];
     const gate=contract.evaluateSequences(complete.map(o=>o.result),expected,required.length?required:['answers','solutions']);
     if(gate.errors.length||required.length&&gate.mode==='fail-closed'){record.state='invalid';record.error={code:'PDF_EXTERNAL_SEQUENCE_INVALID',message:'来源题号或答案解析序列不可靠，固定流程已停止'};errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,...record.error});fatal=true;await persist(file);return done();}
    }
    unassigned.push(...checked.result.unassigned);warnings.push(...checked.result.warnings);
    for(const page of checked.result.pages)if(page.state==='unreadable')errors.push({sourceId:file.id,pages:[page.page],code:'PDF_EXTERNAL_UNREADABLE_PAGE',message:'原页不可读'});
    if(pageLed){
     for(const region of record.parseResult.assets){
      const placements=['questions','answers','solutions','unassigned'].flatMap(stream=>checked.result[stream].flatMap(item=>item.figures.filter(fig=>fig.asset_id===region.asset_id).map(fig=>({item_id:item.item_id,placement_id:fig.id,field:fig.field,option_label:fig.option_label}))));
      try{
       active(signal);
       const saved=record.resolvedAssets?.find(a=>a.assetId===region.asset_id);
       // Existing review evidence fences refresh recovery; no silent recrop/re-review.
       if(!saved&&record.modelReview)throw error('PDF_EXTERNAL_IMAGE_BYTES_MISSING','已复核资源缺失，需人工处理');
       const asset=saved?.value||await ports.renderRegion(file,{pageNo:region.page,bbox:pageEvidence.cropBox(region,file.id,region.page),scale:config.cropScale});
       if(!asset?.url?.startsWith('data:image/'))throw error('PDF_EXTERNAL_IMAGE_BYTES_MISSING');
       if(!saved){record.resolvedAssets=record.resolvedAssets||[];record.resolvedAssets.push({assetId:region.asset_id,value:copy(asset)});await persist(file);}
       reviewCrops.push({asset_id:region.asset_id,source_id:region.source_id,page:region.page,placements,url:asset.url});
      }catch(cause){await abortIfCancelled(cause);observation.cropErrors.push({assetId:region.asset_id,error:cause.message});}
     }
    }
    for(const stream of ['questions','answers','solutions','unassigned'])for(const item of checked.result[stream])for(const fig of item.figures){
     const itemKey=JSON.stringify([stream,item.question_no]);
     try{
      active(signal);
      const box=fig.bbox?.map(v=>v*1000);
      const savedAsset=fig.asset_id?record.resolvedAssets?.find(a=>a.assetId===fig.asset_id)?.value:null;
      let asset=savedAsset;
      const localBox=pageEvidence.cropBox(record.parseResult?.assets?.find(a=>a.asset_id===fig.asset_id),item.source_id,fig.page);
      if(pageLed&&!asset)throw error('PDF_EXTERNAL_IMAGE_BYTES_MISSING','声明的定位资源未裁取成功');
      if(!asset&&localBox)asset=await ports.renderRegion(file,{pageNo:fig.page,bbox:localBox,scale:config.cropScale});
      if(!asset&&fig.asset_id){
       if(typeof ports.resolveAsset!=='function')throw error('PDF_EXTERNAL_IMAGE_BYTES_MISSING');
       const registration=await onStage({stage:'request-start',operation:'resource',input:{metadata:responseMetadata,assetId:fig.asset_id}});
       try{asset=await ports.resolveAsset(fig.asset_id,result,{signal,requestId:registration.requestId});}catch(cause){await onStage({stage:'request-error',operation:'resource',cause});throw cause;}
       await onStage({stage:'request-finish',operation:'resource',result:asset||{}});record.state='validated';
      }
      if(!asset&&!fig.asset_id)asset=await ports.renderRegion(file,{pageNo:fig.page,bbox:box,scale:config.cropScale});
      if(!asset?.url?.startsWith('data:image/'))throw error('PDF_EXTERNAL_IMAGE_BYTES_MISSING');
      if(fig.asset_id&&!savedAsset){record.resolvedAssets=record.resolvedAssets||[];record.resolvedAssets.push({assetId:fig.asset_id,value:copy(asset)});await persist(file);}
      const position=fig.field==='option'?'option:'+fig.option_label:fig.field;
      observation.images.push({id:record.requestId+':image:'+fig.id,figureId:fig.id,itemKey,filename:file.filename+' 第'+fig.page+'页 '+position,url:asset.url,source:'pdf-layout-figure-crop',sourceFileId:file.id,sourceFileName:file.filename,sourcePage:fig.page,bbox:box||localBox||asset.bbox,position,width:asset.width,height:asset.height,status:'bound',protocol:contract.PROTOCOL});
      if(!pageLed)reviewCrops.push({placement_id:fig.id,item_id:item.item_id,source_id:item.source_id,page:fig.page,field:fig.field,option_label:fig.option_label,url:asset.url});
     }catch(cause){await abortIfCancelled(cause);if(record.attempts?.some(a=>['registered','submission_unknown'].includes(a.state))){record.state='submission_unknown';fatal=true;}else if(record.state==='registered')record.state='validated';observation.cropErrors.push({itemKey,figure:fig,error:cause.message});}
    }
    if(config.wireVersion===contract.WIRE_VERSION){
     const candidateHash=await digest(checked.result),cropHash=await digest({crops:reviewCrops,errors:observation.cropErrors});
     if(record.modelReview?.result){
      const terminal=record.attempts?.findLast(a=>a.operation==='review')?.response;
      const replay=contract.validateReviewResult(JSON.stringify(record.modelReview.result),responseMetadata,checked.result,candidateHash,{ok:terminal?.ok!==false&&!(pageLed&&terminal?.model&&terminal.model!==pageEvidence.MODEL),finishReason:terminal?.finishReason,refusal:terminal?.refusal});
      record.modelReview.state=replay.valid&&!observation.cropErrors.length&&record.modelReview.cropHash===cropHash?(replay.passed?'pass':'fail'):'invalid';record.modelReview.errors=replay.errors;
      if(record.modelReview.cropHash!==cropHash)record.modelReview.errors.push('review-crop-version');
      await persist(file);
     }else if(record.modelReview?.state==='pass'){record.modelReview.state='invalid';record.modelReview.errors=['review-cache-result-missing'];await persist(file);}
     if(!record.modelReview){
      try{
       if(fatal||observation.cropErrors.length)throw error('PDF_EXTERNAL_REVIEW_CROPS_REQUIRED','原图裁取未完成，不能宣称已复核实际裁图');
       const reviewed=await execute({mode:'review-visual',profileVersion:config.profileVersion,maxPromptBytes:config.maxPromptBytes,maxRequestImages:config.maxRequestImages,locationPages:record.parseResult?.locations,wireVersion:config.wireVersion,metadata:responseMetadata,pages:task.pages,crops:reviewCrops,model:config.reviewModel,maxTokens:config.maxTokens,timeoutMs:config.timeoutMs,requestId:record.requestId,signal,candidate:checked.result,candidateHash});
       const verified=contract.validateReviewResult(reviewed.text,responseMetadata,checked.result,candidateHash,{ok:reviewed.ok!==false&&!(pageLed&&reviewed.model&&reviewed.model!==pageEvidence.MODEL),finishReason:reviewed.finishReason,refusal:reviewed.refusal});
       record.modelReview={state:verified.valid?(verified.passed?'pass':'fail'):'invalid',candidateHash,cropHash,result:verified.result,rawResponse:reviewed.rawResponse||null,errors:verified.errors};record.state='validated';if(pageLed&&!verified.valid)fatal=true;
      }catch(cause){
       await abortIfCancelled(cause);
       const unknownReview=record.attempts?.some(a=>['registered','submission_unknown'].includes(a.state));
       record.state=unknownReview?'submission_unknown':'validated';record.modelReview={state:'pending',candidateHash,cropHash,error:{code:cause.code||cause.name,message:cause.message}};
       if(pageLed||unknownReview)fatal=true;
       errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:cause.code||'PDF_EXTERNAL_REVIEW_FAILED',message:cause.message});
      }
      await persist(file);
     }
     if(record.modelReview.state!=='pass')errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:'PDF_EXTERNAL_REVIEW_REQUIRED',message:'独立模型复核未通过或未完成，请对照原页处理'});
     if(pageLed&&['invalid','pending'].includes(record.modelReview.state))fatal=true;
     if(checked.result.requests.length)errors.push({sourceId:file.id,pages:metadata.sources[0].input_pages,code:'PDF_EXTERNAL_CONTEXT_REQUIRED',message:'模型请求补充原页；本阶段保留请求，不自动追加调用'});
     observation.modelReview=record.modelReview;
    }
    observations.push(observation);await persist(file);
    return done();
   };
   if(windowOnly){
    // Bounded concurrency for page windows. Slots are merged by index, never by
    // completion: buildDrafts/evaluateSequences treat observations as trusted page
    // order. A fatal window stops new dispatch; in-flight windows may finish.
    const slots=new Array(projectTasks.length);
    let cursor=0;
    const drain=async()=>{for(;;){const index=cursor++;if(index>=projectTasks.length||fatal)return;slots[index]=await executeTask(index,projectTasks[index],observations);}};
    await Promise.all(Array.from({length:Math.max(1,Math.min(config.maxConcurrency,projectTasks.length))},()=>drain()));
    for(const slot of slots){if(!slot)continue;observations.push(...slot.observations);errors.push(...slot.errors);warnings.push(...slot.warnings);unassigned.push(...slot.unassigned);}
    await persistFile(file);
   }else{
    for(const [index,task]of projectTasks.entries()){
     if(fatal)break;
     const slot=await executeTask(index,task,observations);
     observations.push(...slot.observations);errors.push(...slot.errors);warnings.push(...slot.warnings);unassigned.push(...slot.unassigned);
    }
   }
  }
  active(signal);
  if(!observations.length&&errors.length)throw error(errors[0].code,errors[0].message,{evidence,errors,unassigned,warnings});
  const taskProblems=[...errors.map(e=>e.message),...(unassigned.length?['有 '+unassigned.length+' 段内容无法归属，请对照原页']:[])];
  let built;
  try{built=contract.buildDrafts(observations,{batchId:context.batchId,identityContract:identity,taskProblems});}catch(cause){cause.details={...cause.details,evidence,errors,unassigned,warnings};throw cause;}
  for(const draft of built.drafts){
   // Typeset repair happens before the gate: only fields that still carry typed
   // math are touched, so already-correct model LaTeX is never rewritten.
   const normalizeMath=typeof ports.normalizeMath==='function'?ports.normalizeMath:typeset();
   if(typeof normalizeMath==='function'){const fix=text=>{const value=String(text??'');return contract.bareMath(value)?normalizeMath(value):value;};draft.stem=fix(draft.stem);draft.options=(draft.options||[]).map(fix);if(draft.answer)draft.answer=fix(draft.answer);if(draft.solution)draft.solution=fix(draft.solution);}
   const refs=new Set();for(const field of ['question','answer','solution'])for(const variant of draft.pdfExternal.candidates[field])for(const page of variant.item.source_pages){const k=JSON.stringify([variant.source.sourceId,page]);if(refs.has(k))continue;refs.add(k);const rendered=allPages.get(variant.source.sourceId).find(p=>p.pageNo===page);draft.pdfExternal.sourcePageImages.push({pageNo:page,sourcePage:page,sourceFileId:variant.source.sourceId,sourceFileName:variant.source.filename,filename:variant.source.filename,url:rendered.url});}
   draft.sourcePageImage=draft.pdfExternal.sourcePageImages[0]?.url||'';draft.sourceTrace.sourcePageImage=draft.sourcePageImage;
   draft.pdfExternal.responses=evidence.filter(e=>['question','answer','solution'].some(f=>draft.pdfExternal.candidates[f].some(v=>v.evidence.some(r=>r.requestId===e.requestId))));
   for(const problem of contract.mathProblems(draft,ports.renderMath)){Object.assign(draft.fieldProvenance[problem.field],{kind:'rejected',status:'rejected',controlledWriteAccepted:false});draft.warnings.push(problem.message);}
  }
  built.drafts=contract.retainReviewDrafts(built.drafts,previous);
  contract.validateCanonical(built.drafts,context.batchId,identity);
  context.reportStage?.({stage:'pdf-external-canonical-produced',engine:config.model,counts:{drafts:built.drafts.length,errors:errors.length,unassigned:unassigned.length}});
  return{pdfProtocol:contract.PROTOCOL,drafts:built.drafts,draftImages:built.drafts.flatMap(d=>d.images),warnings,unmatched:[...built.unmatched,...unassigned],unassigned,windowErrors:errors,evidence,safePartialCandidates:built.drafts.map(draft=>({isSafePartial:true,isComplete:false,draft}))};
 };
 return async(context,signal)=>{
  if(activeRuns.has(context.batchId))throw error('PDF_EXTERNAL_RUN_ACTIVE','本任务已有识别请求运行中');
  activeRuns.add(context.batchId);
  try{return await run(context,signal);}finally{activeRuns.delete(context.batchId);}
 };
}
 return Object.freeze({DEFAULT_CONFIG,tasks,createProducer});
});

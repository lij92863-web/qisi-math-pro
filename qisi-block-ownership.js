(function(root,factory){ const api=factory(root); if(typeof module!=='undefined'&&module.exports)module.exports=api; root.Qisi=root.Qisi||{}; root.Qisi.BlockOwnership=api; })(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const PROTOCOL='block-ownership-v1';
const TYPES=Object.freeze(['single_choice','multiple_choice','fill_blank','free_response','unknown']);
const ARRAY_FIELDS=Object.freeze(['stem','answer','solution','figures']);
const PLACEHOLDER_ALT=Object.freeze({image:'图',chart:'图',table:'表格'});
const DEFAULT_MAX_TEXT_CHARS=4000;
const DEFAULT_HEAD_RATIO=0.75;
const clone=value=>JSON.parse(JSON.stringify(value));
const isPlainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const basename=value=>String(value).split(/[\\/]/).pop();
const blockKind=block=>typeof block.type==='string'&&block.type?block.type:'text';

function blockIndex(source){
    if(!source) return null;
    if(source instanceof Map) return source;
    if(Array.isArray(source)){
        const map=new Map();
        for(const block of source){
            if(block&&typeof block.id==='string'&&block.id) map.set(block.id,block);
        }
        return map;
    }
    if(typeof source==='object'){
        const map=new Map();
        for(const key of Object.keys(source)) map.set(key,source[key]);
        return map;
    }
    return null;
}
function numberList(value){
    if(!Array.isArray(value)) return null;
    return value.map(item=>String(item).trim()).filter(Boolean);
}
function truncateText(text,limit){
    if(!Number.isFinite(limit)||limit<=0||text.length<=limit) return {text,truncated:false};
    const head=Math.max(1,Math.ceil(limit*DEFAULT_HEAD_RATIO));
    const tail=Math.max(0,limit-head);
    return {text:text.slice(0,head)+'\n…[truncated '+String(text.length-limit)+' chars]…\n'+(tail?text.slice(text.length-tail):''),truncated:true};
}

// §2：只给编号清单 + 文本，图/表/图表只给占位描述。
function buildOwnershipPayload(input,options={}){
    const source=input||{}, pages=source.pages;
    if(!Array.isArray(pages)) throw new Error('BLOCK_OWNERSHIP_PAGES_REQUIRED');
    const limit=Number.isFinite(options.maxTextChars)?options.maxTextChars:DEFAULT_MAX_TEXT_CHARS;
    const numbers=numberList(source.questionNumbers);
    const blocks=[];
    const seenIds=new Set();
    pages.forEach((page,index)=>{
        const pageNo=Number.isSafeInteger(page&&page.page)?page.page:index+1;
        const list=Array.isArray(page&&page.blocks)?page.blocks:[];
        for(const block of list){
            if(!block||typeof block.id!=='string'||!block.id) throw new Error('BLOCK_OWNERSHIP_BLOCK_ID_REQUIRED');
            // id 全局唯一是 §1 的硬约束；重复会让后续按 id 取块静默取错，必须当场 fail fast。
            if(seenIds.has(block.id)) throw new Error('BLOCK_OWNERSHIP_DUPLICATE_BLOCK_ID:'+block.id);
            seenIds.add(block.id);
            const kind=blockKind(block);
            if(kind==='image'||kind==='chart'||kind==='table'){
                blocks.push({id:block.id,p:pageNo,kind,alt:PLACEHOLDER_ALT[kind]});
                continue;
            }
            const text=typeof block.text==='string'?block.text:'';
            const cut=truncateText(text,limit);
            const entry={id:block.id,p:pageNo,kind,text:cut.text};
            if(cut.truncated) entry.truncated=true;
            blocks.push(entry);
        }
    });
    return {
        exam:{pages:pages.length,question_numbers:numbers||[]},
        answer_table:source.answerTable&&typeof source.answerTable==='object'?source.answerTable:null,
        blocks
    };
}

function checkIdArray(value,tag,known,errors){
    if(value===undefined) return;
    if(!Array.isArray(value)){ errors.push(tag+':not-array'); return; }
    const seen=new Set();
    for(const id of value){
        if(typeof id!=='string'||!id){ errors.push(tag+':invalid-block-id'); continue; }
        if(seen.has(id)){ errors.push(tag+':duplicate-block:'+id); continue; }
        seen.add(id);
        if(known&&!known.has(id)) errors.push(tag+':unknown-block:'+id);
    }
}

// §3 校验：一律返回 {valid,errors,result}，不向调用方抛异常。
function validateOwnership(value,options={}){
    const errors=[];
    const known=blockIndex(options&&(options.blocksById||options.blocks));
    if(!known) errors.push('blocks-by-id-required');
    const allowedNumbers=numberList(options&&options.questionNumbers);
    const allowed=allowedNumbers?new Set(allowedNumbers):null;
    if(!isPlainObject(value)) return {valid:false,errors:['result-not-object'],result:null};
    if(value.protocol===undefined) errors.push('missing-protocol');
    else if(value.protocol!==PROTOCOL) errors.push('protocol-version:'+String(value.protocol));
    if(!Array.isArray(value.questions)) errors.push('questions-not-array');
    else{
        const numbers=new Set();
        value.questions.forEach((item,index)=>{
            const tag='questions['+index+']';
            if(!isPlainObject(item)){ errors.push(tag+':not-object'); return; }
            const qno=item.question_no;
            if(typeof qno!=='string'||!qno.trim()) errors.push(tag+':question-no');
            else{
                if(numbers.has(qno)) errors.push(tag+':duplicate-question-no:'+qno);
                else numbers.add(qno);
                if(allowed&&!allowed.has(qno)) errors.push(tag+':question-no-not-allowed:'+qno);
            }
            if(item.type!==undefined&&!TYPES.includes(item.type)) errors.push(tag+':invalid-type:'+String(item.type));
            for(const field of ARRAY_FIELDS) checkIdArray(item[field],tag+'.'+field,known,errors);
            if(item.options!==undefined){
                if(!isPlainObject(item.options)) errors.push(tag+'.options:not-object');
                else for(const label of Object.keys(item.options)) checkIdArray(item.options[label],tag+'.options.'+label,known,errors);
            }
            if(item.issues!==undefined&&!Array.isArray(item.issues)) errors.push(tag+'.issues:not-array');
        });
    }
    if(value.unassigned!==undefined){
        if(!Array.isArray(value.unassigned)) errors.push('unassigned-not-array');
        else value.unassigned.forEach((group,index)=>{
            const tag='unassigned['+index+']';
            if(!isPlainObject(group)){ errors.push(tag+':not-object'); return; }
            if(!Array.isArray(group.blocks)){ errors.push(tag+'.blocks:not-array'); return; }
            checkIdArray(group.blocks,tag+'.blocks',known,errors);
        });
    }
    const valid=errors.length===0;
    return {valid,errors,result:valid?clone(value):null};
}

function renderBlock(block,id,context,issues,images){
    const kind=blockKind(block);
    if(kind==='image'||kind==='chart'){
        const name=typeof block.image==='string'?basename(block.image):'';
        if(!name){ issues.push(context+':missing-image-name:'+id); return ''; }
        images.push({blockId:id,name});
        return '[[IMAGE:'+name+']]';
    }
    if(kind==='table'){
        const html=typeof block.text==='string'?block.text:'';
        if(!html.trim()){ issues.push(context+':missing-block-text:'+id); return ''; }
        return html;
    }
    const text=typeof block.text==='string'?block.text:'';
    if(!text.trim()){ issues.push(context+':missing-block-text:'+id); return ''; }
    return text;
}

function renderIds(ids,context,known,issues,images){
    if(!Array.isArray(ids)){
        if(ids!==undefined) issues.push(context+':not-array');
        return '';
    }
    const seen=new Set(), parts=[];
    for(const id of ids){
        if(typeof id!=='string'||!id){ issues.push(context+':invalid-block-id'); continue; }
        if(seen.has(id)){ issues.push(context+':duplicate-block:'+id); continue; }
        seen.add(id);
        const block=known&&known.get(id);
        // 不存在的块只报错，绝不拿别的块顶替。
        if(!block){ issues.push(context+':unknown-block:'+id); continue; }
        const text=renderBlock(block,id,context,issues,images);
        if(text.trim()) parts.push(text);
    }
    return parts.join('\n').trim();
}

function answerLabel(text){
    const trimmed=String(text).trim();
    if(/^[A-Ha-h]+$/.test(trimmed)) return trimmed.toUpperCase();
    const match=trimmed.match(/^[（(]?([A-Ha-h])(?:[)）.．、:：]|\s)/);
    return match?match[1].toUpperCase():null;
}

// §3 拼装：text 取原文，image/chart → [[IMAGE:<文件名>]]，table → HTML。不做任何公式规范化。
function assembleQuestion(ownershipItem,blocksById,options={}){
    const issues=[];
    const known=blockIndex(blocksById);
    if(!isPlainObject(ownershipItem)) return {questionNo:'',type:'unknown',stem:'',options:[],answer:'',solution:'',images:[],issues:['invalid-ownership-item']};
    const item=ownershipItem;
    const questionNo=item.question_no==null?'':String(item.question_no).trim();
    const type=TYPES.includes(item.type)?item.type:'unknown';
    if(item.type===undefined) issues.push('missing-type');
    else if(!TYPES.includes(item.type)) issues.push('invalid-type:'+String(item.type));
    const images=[];
    const seenImages=new Set();
    const addImage=image=>{
        if(!image||seenImages.has(image.blockId)) return;
        seenImages.add(image.blockId);
        images.push(image);
    };
    const render=(ids,context)=>{
        const local=[];
        const text=renderIds(ids,context,known,issues,local);
        local.forEach(addImage);
        return text;
    };
    const stem=render(item.stem,'stem');
    const optionEntries=[];
    if(item.options!==undefined){
        if(!isPlainObject(item.options)) issues.push('options:not-object');
        else for(const label of Object.keys(item.options).sort()){
            optionEntries.push({label,text:render(item.options[label],'options.'+label)});
        }
    }
    const modelAnswer=render(item.answer,'answer');
    const solution=render(item.solution,'solution');
    if(Array.isArray(item.figures)) for(const id of item.figures){
        if(typeof id!=='string'||!id){ issues.push('figures:invalid-block-id'); continue; }
        if(seenImages.has(id)) continue;
        const block=known&&known.get(id);
        if(!block){ issues.push('figures:unknown-block:'+id); continue; }
        const kind=blockKind(block);
        if(kind!=='image'&&kind!=='chart'){ issues.push('figures:not-image:'+id); continue; }
        const name=typeof block.image==='string'?basename(block.image):'';
        if(!name){ issues.push('figures:missing-image-name:'+id); continue; }
        seenImages.add(id);
        images.push({blockId:id,name});
    }
    const tableValue=options&&options.answerTable&&Object.prototype.hasOwnProperty.call(options.answerTable,questionNo)?options.answerTable[questionNo]:undefined;
    const hasTable=tableValue!==undefined&&tableValue!==null&&String(tableValue).trim()!=='';
    const choice=type==='single_choice'||type==='multiple_choice';
    let answer=modelAnswer;
    if(hasTable&&choice){
        const fromTable=String(tableValue).trim();
        answer=fromTable;
        if(modelAnswer){
            const label=answerLabel(modelAnswer);
            if(label===null) issues.push('answer-table-unverifiable');
            else if(label!==fromTable.replace(/\s+/g,'').toUpperCase()) issues.push('answer-table-conflict');
        }
    }else if(hasTable&&!choice&&!modelAnswer){
        answer=String(tableValue).trim();
    }
    if(choice&&!answer) issues.push('missing-answer');
    if(choice&&optionEntries.length>0&&optionEntries.length<2) issues.push('options-incomplete');
    if(!stem&&!optionEntries.length&&!images.length) issues.push('empty-stem');
    if(Array.isArray(item.issues)) issues.unshift(...item.issues.filter(issue=>typeof issue==='string'));
    return {questionNo,type,stem,options:optionEntries,answer,solution,images,issues};
}

function referencedIds(questions){
    const ids=new Set();
    const push=value=>{ if(Array.isArray(value)) value.forEach(id=>{ if(typeof id==='string'&&id) ids.add(id); }); };
    for(const item of questions){
        if(!isPlainObject(item)) continue;
        for(const field of ARRAY_FIELDS) push(item[field]);
        if(isPlainObject(item.options)) Object.keys(item.options).forEach(label=>push(item.options[label]));
    }
    return ids;
}

// 批量拼装 + 全卷题号连续性检查（缺号/重号只报告，不补号）。
function assembleExam(ownership,blocksById,options={}){
    const value=isPlainObject(ownership)?ownership:{};
    const items=Array.isArray(value.questions)?value.questions:[];
    const drafts=items.map(item=>assembleQuestion(item,blocksById,options));
    const issues=[];
    const counts=new Map();
    for(const draft of drafts){
        if(!draft.questionNo){ issues.push('missing-question-no'); continue; }
        counts.set(draft.questionNo,(counts.get(draft.questionNo)||0)+1);
    }
    for(const [qno,count] of counts) if(count>1) issues.push('duplicate-question-no:'+qno);
    const expected=numberList(options&&options.questionNumbers)||numberList(value.exam&&value.exam.question_numbers);
    if(expected){
        const allowed=new Set(expected);
        for(const [qno] of counts) if(!allowed.has(qno)) issues.push('unexpected-question-no:'+qno);
        const seen=new Set();
        for(const qno of expected){ if(seen.has(qno)) continue; seen.add(qno); if(!counts.has(qno)) issues.push('missing-question-no:'+qno); }
    }
    const unassigned=[];
    const reported=new Set();
    const index=blockIndex(blocksById);
    if(Array.isArray(value.unassigned)) for(const group of value.unassigned){
        if(!isPlainObject(group)||!Array.isArray(group.blocks)) continue;
        const blocks=[];
        for(const id of group.blocks){
            if(typeof id!=='string'||!id) continue;
            if(index&&!index.has(id)) issues.push('unassigned-unknown-block:'+id);
            blocks.push(id);
            reported.add(id);
        }
        unassigned.push({blocks,reason:typeof group.reason==='string'?group.reason:''});
    }
    if(index&&options.reportUnreferenced!==false){
        const used=referencedIds(items);
        const orphans=[];
        for(const id of index.keys()) if(!used.has(id)&&!reported.has(id)) orphans.push(id);
        if(orphans.length){
            orphans.forEach(id=>issues.push('unreferenced-block:'+id));
            unassigned.push({blocks:orphans,reason:'unreferenced-block'});
        }
    }
    return {drafts,issues,unassigned};
}

return Object.freeze({PROTOCOL,TYPES,buildOwnershipPayload,validateOwnership,assembleQuestion,assembleExam,blockIndex});
});

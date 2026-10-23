const test=require('node:test'),assert=require('node:assert/strict');
const Resources=require('../qisi-print-resources'),Parts=require('../qisi-exam-paper-parts');
function outputHarness(changes={}){
    let sequence=0,timerSequence=0,stopped=0;const channels=[],created=[],revoked=[],opened=[],timers=new Map();
    const ports={createChannel:name=>{const channel={name,onmessage:null,closed:0,sent:[],postMessage(value){this.sent.push(value);},close(){this.closed++;}};channels.push(channel);return channel;},
        createBlob:(parts,options)=>({parts,options}),createUrl:blob=>{const url='blob:document-'+created.length;created.push({url,blob});return url;},revokeUrl:url=>revoked.push(url),openLink:url=>opened.push(url),makeId:()=> 'id-'+(++sequence),schedule:(callback,delay)=>{const id=++timerSequence;timers.set(id,{callback,delay});return id;},cancelScheduled:id=>timers.delete(id),assetUrl:'http://localhost/vendor/katex/katex.min.css',escapeHtml:Parts.escapeHtml,observePageHide:()=>()=>stopped++};
    const workspace=Resources.createOutputWorkspace({...ports,...changes});
    const send=(kind,token='id-2')=>channels[0].onmessage?.({data:{kind,token}});
    const fire=delay=>{const found=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(found,'scheduled '+delay);timers.delete(found[0]);found[1].callback();};
    return {workspace,ports,channels,created,revoked,opened,timers,send,fire,stopped:()=>stopped};
}
const paper={config:{fontFamily:'思源宋体',fontSize:'小四',paperSize:'A4'},mode:'questions',questions:[{id:'q',stem:'captured'}]};
test('document output accepts only its token, retains a loaded lease and releases after explicit closed probe has no consumer',async()=>{
    const h=outputHarness(),first=h.workspace.publish([{content:'body',title:'test'}],paper),same=h.workspace.publish([{content:'body',title:'test'}],paper);assert.equal(first,same);assert.equal(h.opened.length,1);
    h.send('closed','foreign');assert.equal(h.workspace.activeCount(),1);h.send('loaded');h.send('ready');assert.equal((await first).ok,true);assert.equal(h.revoked.length,0);
    h.send('closed');h.fire(500);assert.equal(h.channels[0].sent[0].kind,'probe');h.send('alive');assert.equal(h.workspace.activeCount(),1);
    h.send('closed');h.fire(500);h.fire(500);assert.deepEqual(h.revoked,['blob:document-0']);assert.equal(h.workspace.activeCount(),0);assert.equal(h.channels[0].closed,1);h.workspace.dispose();assert.equal(h.stopped(),1);
});
test('an unconfirmed blocked popup and resource error release their URLs without claiming readiness',async()=>{
    const blocked=outputHarness(),pending=blocked.workspace.publish([{content:'body',title:'test'}],paper);blocked.fire(30000);assert.deepEqual((await pending).results,[{ok:false,reason:'open-unconfirmed'}]);assert.equal(blocked.revoked.length,1);blocked.workspace.dispose();
    const broken=outputHarness(),failed=broken.workspace.publish([{content:'body',title:'test'}],paper);broken.send('loaded');broken.send('resource-error');assert.equal((await failed).ok,false);assert.equal(broken.revoked.length,1);broken.workspace.dispose();
});
test('disposing during split output cancels unopened documents and releases every created channel, URL and timer once',async()=>{
    const h=outputHarness(),pending=h.workspace.publish([{content:'q',title:'q'},{content:'a',title:'a'}],paper);assert.equal(h.opened.length,1);h.workspace.dispose();h.workspace.dispose();assert.equal((await pending).ok,false);assert.equal(h.opened.length,1);assert.equal(h.revoked.length,1);assert.equal(h.channels[0].closed,1);assert.equal(h.timers.size,0);
});
test('window HTML retains layout but escapes title and refuses injected CSS values',()=>{
    const html=Resources.buildWindowHtml({content:'<main>generated</main>',title:'<img onerror="bad">',paper:{config:{themeColor:'red;</style><script>bad()</script>',paperSize:'A4;</style><script>bad()</script>'}},assetUrl:'http://localhost/style.css',lease:{channel:'channel',token:'token'},escapeHtml:Parts.escapeHtml});
    assert.match(html,/&lt;img onerror=&quot;bad&quot;&gt;/);assert.doesNotMatch(html,/<script>bad\(\)/);assert.match(html,/@page \{ size:A4;/);assert.match(html,/printMathStyles/);assert.match(html,/new window.BroadcastChannel/);
});
test('print workspace captures before async preparation, deduplicates clicks and uses the same paper in validation and output',async()=>{
    let release;const gate=new Promise(resolve=>release=resolve),calls=[],state=structuredClone(paper),busy={value:false};
    const workspace=Resources.createPrintWorkspace({busy,capture:()=>structuredClone(state),hydrate:async command=>{calls.push(['hydrate',command]);await gate;return command.questions;},validateFormulas:(qs,flags)=>{calls.push(['validate',qs,flags]);return true;},builder:{buildPaper(input){calls.push(['build',input]);return {documents:[{content:'paper',title:'paper'}]};}},output:{async publish(documents,snapshot){calls.push(['publish',snapshot]);return {ok:true,results:[]};},dispose(){}},notify:message=>calls.push(['notify',message])});
    const first=workspace.print(),same=workspace.print();assert.equal(first,same);state.questions[0].stem='later';state.mode='split';state.config.fontSize='三号';await Promise.resolve();release();assert.equal(await first,true);assert.equal(busy.value,false);
    assert.equal(calls.filter(call=>call[0]==='hydrate').length,1);assert.equal(calls.find(call=>call[0]==='build')[1].paper.questions[0].stem,'captured');assert.equal(calls.find(call=>call[0]==='publish')[1].mode,'questions');workspace.dispose();
});
test('formula refusal and dispose stop before output, and image encoder abort removes its callbacks',async()=>{
    let published=0;const workspace=Resources.createPrintWorkspace({busy:{value:false},capture:()=>paper,hydrate:async()=>paper.questions,validateFormulas:()=>false,builder:{buildPaper(){throw new Error('must not generate');}},output:{publish(){published++;},dispose(){}},notify(){}});assert.equal(await workspace.print(),false);assert.equal(published,0);workspace.dispose();
    let reader;class Reader{constructor(){reader=this;}readAsDataURL(){}abort(){this.onabort?.();}}
    const encoder=Resources.createBlobEncoder({FileReader:Reader}),pending=encoder.read({});encoder.dispose();await assert.rejects(pending,/PRINT_ENCODER_DISPOSED/);assert.equal(reader.onload,null);assert.equal(reader.onerror,null);assert.equal(reader.onabort,null);
});

test('synchronous browser opening failure releases its lease and gives print feedback',async()=>{
    const h=outputHarness({openLink(){throw new Error('LINK_OPEN_REFUSED');}}),messages=[];
    const workspace=Resources.createPrintWorkspace({busy:{value:false},capture:()=>paper,hydrate:async()=>paper.questions,validateFormulas:()=>true,builder:{buildPaper(){return {documents:[{content:'q',title:'q'}]};}},output:h.workspace,notify:message=>messages.push(message)});
    assert.equal(await workspace.print(),false);assert.equal(h.revoked.length,1);assert.equal(h.channels[0].closed,1);assert.equal(messages.length,1);assert.match(messages[0],/未能打开/);workspace.dispose();
});

test('actual print preparation never falls back to a network or old blob URL when stored bytes are missing',async()=>{
    const original={...paper,questions:[{id:'q',stem:'[[IMAGE:missing]]',images:[{id:'missing',url:'https://example.test/old.png'},{id:'stale',url:'blob:old'}]}]},before=structuredClone(original);let prepared;
    const workspace=Resources.createPrintWorkspace({busy:{value:false},capture:()=>original,loadImageRows:async()=>[],blobToDataUrl:async()=>{throw new Error('no stored bytes');},validateFormulas:()=>true,
        builder:{buildPaper(input){prepared=input.questions;return {documents:[{content:'missing image error',title:'q'}]};}},output:{async publish(){return {ok:false,results:[{reason:'resource-error'}]};},dispose(){}},notify(){}});
    assert.equal(await workspace.print(),false);assert.deepEqual(prepared[0].images.map(image=>image.url),['','']);assert.deepEqual(original,before);workspace.dispose();
});

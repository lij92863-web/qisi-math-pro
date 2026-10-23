const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('./browser-harness'),files=require('../harness/app-split-owner-inventory'),{collectNamespaceOwners}=require('../../scripts/verify-qisi-runtime-dependencies');
test('the actual browser registers each split owner once before app startup with the same public exports as Node',{timeout:35000},async()=>{
    const expected=files.map(file=>{const namespaces=collectNamespaceOwners(fs.readFileSync(path.join(H.ROOT||path.resolve(__dirname,'../..'),file),'utf8'));assert.equal(namespaces.length,1,file);return {file,name:namespaces[0],keys:Object.keys(require(path.resolve(__dirname,'../..',file))).sort()};});
    const h=await H.startBrowserApp(32912);try{
        await h.page.addInitScript(expected=>{window.Qisi=window.Qisi||{};window.fixtureOwnerRegistrations={};for(const row of expected){let value;Object.defineProperty(window.Qisi,row.name,{configurable:true,get(){return value;},set(api){window.fixtureOwnerRegistrations[row.name]=(window.fixtureOwnerRegistrations[row.name]||0)+1;value=api;}});}},expected);
        await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.editTplName);
        const observed=await h.page.evaluate(expected=>{const scripts=[...document.scripts].filter(script=>script.src).map(script=>new URL(script.src).pathname.split('/').pop());return expected.map(row=>({name:row.name,registrations:window.fixtureOwnerRegistrations[row.name],keys:Object.keys(Qisi[row.name]).sort(),scriptCount:scripts.filter(file=>file===row.file).length,beforeApp:scripts.indexOf(row.file)<scripts.indexOf('app.js')}));},expected);
        for(let index=0;index<expected.length;index++)assert.deepEqual(observed[index],{name:expected[index].name,registrations:1,keys:expected[index].keys,scriptCount:1,beforeApp:true});H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});

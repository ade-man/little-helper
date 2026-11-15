import {test} from 'node:test';
import assert from 'node:assert/strict';
test('A child can preview, save and reuse a device voice, including voices loaded after opening the dialog',async()=>{
 const handlers={},store=new Map(),spoken=[];let voices=[],changed;let fields={};
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const node=()=>({innerHTML:'',classList:{add(){},remove(){}},querySelector:()=>null,addEventListener(){},append(){},setAttribute(){}});
 const app=node(),modal=node(),toast=node();modal.open=false;modal.showModal=()=>{modal.open=true;};modal.close=()=>{modal.open=false;};
 const inputs={voice:{value:''},rate:{value:'.7'},volume:{value:'.65'}};inputs.voice.innerHTML='';
 const form={querySelector:s=>inputs[s.match(/name=(\w+)/)?.[1]]};
 modal.querySelector=s=>modal.open&&modal.innerHTML.includes('id="speech-form"')?(s==='#speech-form'?form:s==='#speech-voice'?inputs.voice:null):null;
 const synth={getVoices:()=>voices,cancel(){},speak:u=>spoken.push(u),addEventListener:(name,fn)=>{if(name==='voiceschanged')changed=fn;}};
 globalThis.document={querySelector:s=>({'#app':app,'#modal':modal,'#toast':toast}[s]),addEventListener:(n,f)=>{handlers[n]=f;},visibilityState:'visible'};
 globalThis.window={speechSynthesis:synth,addEventListener(){}};globalThis.localStorage=storage;globalThis.sessionStorage=storage;globalThis.location={href:'https://family.example/?demo=1',origin:'https://family.example',pathname:'/'};
 const original={FormData:globalThis.FormData,SpeechSynthesisUtterance:globalThis.SpeechSynthesisUtterance,setInterval:globalThis.setInterval,setTimeout:globalThis.setTimeout};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};globalThis.FormData=class{[Symbol.iterator](){return Object.entries(fields)[Symbol.iterator]();}};globalThis.setTimeout=()=>0;globalThis.setInterval=()=>0;
 const click=async(action,extra={})=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action,...extra}};}}});
 try{
   await import('../dist/app.mjs');await Promise.resolve();assert.match(app.innerHTML,/Choose read-aloud voice/);
   await click('voice-settings');assert.match(modal.innerHTML,/A gentler reading voice/);assert.match(modal.innerHTML,/saved on this device/);
   const natural={name:'Sonia Natural',voiceURI:'sonia',lang:'en-GB'};voices=[{name:'Basic English',voiceURI:'basic',lang:'en-GB'},natural];changed();assert.match(inputs.voice.innerHTML,/Sonia Natural/);
   inputs.voice.value='sonia';handlers.change({target:{name:'voice'}});await click('preview-voice');assert.equal(spoken.at(-1).voice,natural);assert.equal(spoken.at(-1).rate,.7);assert.equal(spoken.at(-1).volume,.65);assert.match(spoken.at(-1).text,/You’ve got this/);
   fields={voice:'sonia',rate:'.7',volume:'.65'};await handlers.submit({preventDefault(){},target:{id:'speech-form',querySelector:()=>({disabled:false})}});
   assert.equal(modal.open,false);assert.equal(JSON.parse(store.get('little-helpers-speech-v1')).voiceURI,'sonia');
   await click('listen',{id:'reading'});assert.equal(spoken.at(-1).voice,natural);assert.match(spoken.at(-1).text,/Read for 10 minutes/);assert.equal(spoken.at(-1).rate,.7);
   await import('../dist/app.mjs?voice-reload');await Promise.resolve();await click('listen',{id:'reading'});assert.equal(spoken.at(-1).voice,natural);assert.equal(spoken.at(-1).volume,.65);
 }finally{Object.assign(globalThis,original);}
});

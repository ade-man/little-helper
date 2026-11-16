import {test} from 'node:test';
import assert from 'node:assert/strict';
// A lightweight DOM adapter checks template rendering and the event-driven
// demo workflow. It is not a layout, browser, accessibility or tablet test.
test('Demo UI records early work, releases rewards and records gifts and partial payments',async()=>{
 const handlers={};const store=new Map();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const node=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){}},querySelector:()=>null,addEventListener(){},append(){},setAttribute(){}});
 const app=node(),modal=node(),toast=node();modal.open=false;modal.showModal=()=>{modal.open=true;};modal.close=()=>{modal.open=false;};
 globalThis.document={querySelector:s=>({'#app':app,'#modal':modal,'#toast':toast}[s]),addEventListener:(name,fn)=>{handlers[name]=fn;},visibilityState:'visible',body:{append(){}}};
 globalThis.window={addEventListener(){}};globalThis.localStorage=storage;globalThis.sessionStorage=storage;
 globalThis.location={href:'https://example.test/?demo=1',origin:'https://example.test',pathname:'/'};globalThis.scrollTo=()=>{};
 globalThis.matchMedia=()=>({matches:true});
 const interval=globalThis.setInterval,timeout=globalThis.setTimeout;globalThis.setInterval=()=>0;globalThis.setTimeout=()=>0;
 try{
   await import('../dist/app.mjs');await Promise.resolve();
   assert.match(app.innerHTML,/My everyday essentials/);assert.match(app.innerHTML,/Help now. Reward after essentials/);assert.match(app.innerHTML,/My money waiting to be paid/);
   const click=async(action,extra={})=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action,...extra}};}}});
   await click('parent');assert.match(app.innerHTML,/Review completed tasks/);assert.match(app.innerHTML,/data-area="parent"/);assert.match(app.innerHTML,/Parent administration/);assert.doesNotMatch(app.innerHTML,/My adventure|My week|My money/);
   await click('admin-tab',{tab:'tasks'});assert.match(app.innerHTML,/Add task/);assert.match(app.innerHTML,/data-action="edit-task"/);assert.doesNotMatch(app.innerHTML,/I did it!/);
   await click('admin-tab',{tab:'settings'});assert.match(app.innerHTML,/id="settings-form"/);assert.match(app.innerHTML,/4 essential tasks/);assert.doesNotMatch(app.innerHTML,/name="threshold"/);
   await click('admin-tab',{tab:'payouts'});assert.match(app.innerHTML,/All money waiting to be paid/);
   await click('child-view');
   await click('submit',{id:'table'});assert.equal(modal.open,true);assert.match(modal.innerHTML,/essentials/);
   await click('close');await click('parent');await click('admin-tab',{tab:'review'});
   let updated=JSON.parse(store.get('little-helpers-demo-v1'));const claim=updated.completions.find(c=>c.taskId==='table');
   await click('approve',{id:claim.id});assert.match(app.innerHTML,/Rewards waiting for essentials/);assert.match(app.innerHTML,/Release reward anyway/);
   updated=JSON.parse(store.get('little-helpers-demo-v1'));assert.equal(updated.completions.find(c=>c.id===claim.id).rewardReleased,false);
   await click('release-reward',{id:claim.id});assert.match(modal.innerHTML,/id="release-reward-form"/);await click('close');
   await click('approve',{id:'example-review'});assert.doesNotMatch(app.innerHTML,/Rewards waiting for essentials/);
   await click('child-view');assert.match(app.innerHTML,/Your adventure is unlocked/);
   assert.doesNotMatch(app.innerHTML,/data-area="parent"|Parent administration|Approve<\/button>/);
   await click('nav',{view:'money'});assert.match(app.innerHTML,/£0.25/);assert.match(app.innerHTML,/New weeks bring new jobs/);
   const form=async(id,values,dataset={})=>{
     const original=globalThis.FormData;
     globalThis.FormData=class{[Symbol.iterator](){return Object.entries(values)[Symbol.iterator]();}has(k){return Object.hasOwn(values,k);}};
     try{await handlers.submit({preventDefault(){},target:{id,dataset,querySelector:()=>({disabled:false})}});}finally{globalThis.FormData=original;}
   };
   await click('parent');await click('admin-tab',{tab:'payouts'});
   await click('add-money');assert.match(modal.innerHTML,/She has already received this money/);
   await form('add-money-form',{title:'Gift from Grandma',amount:'2.00',date:updated.completions[0].date},{entryId:'00000000-0000-4000-8000-000000000001'});
   updated=JSON.parse(store.get('little-helpers-demo-v1'));assert.equal(updated.credits[0].amount,200);assert.equal(updated.credits[0].received,false);
   await click('add-money');await form('add-money-form',{title:'School report',amount:'1.00',date:updated.completions[0].date,received:'on'},{entryId:'00000000-0000-4000-8000-000000000002'});
   await click('payout');assert.match(modal.innerHTML,/value="2.25"/);
   await form('payment-form',{amount:'0.25'},{paymentId:'00000000-0000-4000-8000-000000000003'});
   updated=JSON.parse(store.get('little-helpers-demo-v1'));assert.equal(updated.payouts[0].amount,25);
   await click('child-view');await click('nav',{view:'money'});assert.match(app.innerHTML,/Gift from Grandma|School report/);assert.match(app.innerHTML,/£2.00/);assert.match(app.innerHTML,/already received/i);
   await click('goal-open');assert.match(modal.innerHTML,/Paste your toy’s link/);
   await click('goal-example');assert.match(modal.innerHTML,/Rainbow building blocks/);
   const originalFormData=globalThis.FormData;
   globalThis.FormData=class{[Symbol.iterator](){return Object.entries({name:'Rainbow building blocks',price:'19.99',description:'My next little dream',image:''})[Symbol.iterator]();}};
   try{await handlers.submit({preventDefault(){},target:{id:'goal-form',querySelector:()=>({disabled:false})}});}finally{globalThis.FormData=originalFormData;}
   assert.equal(modal.open,false);assert.match(app.innerHTML,/I’m saving for Rainbow building blocks/);assert.match(app.innerHTML,/toy-blocks.svg/);assert.match(app.innerHTML,/£19.99/);
   location.href='https://example.test/?demo=1&area=parent';
   await import('../dist/app.mjs?direct-parent-demo');await Promise.resolve();
   assert.match(app.innerHTML,/data-area="parent"/);assert.doesNotMatch(app.innerHTML,/My adventure|My week|My money/);
 }finally{globalThis.setInterval=interval;globalThis.setTimeout=timeout;}
});

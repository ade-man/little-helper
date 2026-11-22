import {test} from 'node:test';
import assert from 'node:assert/strict';
// A lightweight DOM adapter checks template rendering and the event-driven
// demo workflow. It is not a layout, browser, accessibility or tablet test.
test('Demo UI records early work, releases rewards and records gifts and partial payments',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00Z')});
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
   const extras=app.innerHTML.slice(app.innerHTML.indexOf('A little extra help'));
   const cards=[...extras.matchAll(/<article class="task-card[\s\S]*?<\/article>/g)].map(m=>m[0]);assert.ok(cards.length>=6);
   for(const card of cards){assert.ok(card.indexOf('task-picture')<card.indexOf('task-listen'));assert.ok(card.indexOf('task-listen')<card.indexOf('class="reward"'));assert.equal((card.match(/data-action="listen"/g)||[]).length,1);assert.doesNotMatch(card,/position:absolute/);}
   const click=async(action,extra={})=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action,...extra}};}}});
   await click('nav',{view:'week'});
   assert.match(app.innerHTML,/data-date="2026-11-20"[^>]*disabled/);
   await click('week-day',{date:'2026-11-18'});
   assert.match(app.innerHTML,/data-date="2026-11-18" aria-pressed="true"/);
   assert.match(app.innerHTML,/Jobs for Wednesday 18 Nov/);
   assert.match(app.innerHTML,/data-id="plants" data-date="2026-11-18"/);
   await click('submit',{id:'plants',date:'2026-11-18'});
   assert.match(modal.innerHTML,/for Wednesday 18 Nov/);
   assert.doesNotMatch(app.innerHTML,/data-id="plants" data-date="2026-11-18"/);
   const late=JSON.parse(store.get('little-helpers-demo-v1')).completions.at(-1);
   assert.equal(late.date,'2026-11-18');
   await click('close');
   await click('parent');assert.match(app.innerHTML,/Review completed tasks/);assert.match(app.innerHTML,/data-area="parent"/);assert.match(app.innerHTML,/Parent administration/);assert.doesNotMatch(app.innerHTML,/My adventure|My week|My money/);
   assert.match(app.innerHTML,/Wed 18 Nov · Extra helping · £0.50/);
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
   let dreams=JSON.parse(store.get('little-helpers-demo-v1')),big=dreams.goals[0];const financial=JSON.stringify([dreams.completions,dreams.credits,dreams.payouts]);
   await click('dream-add');await click('goal-manual');assert.doesNotMatch(modal.innerHTML,/value="Rainbow building blocks"/);
   await form('goal-form',{name:'A tiny toy',price:'2.00',description:'A little treat',image:''});
   dreams=JSON.parse(store.get('little-helpers-demo-v1'));const cheap=dreams.goals[1];assert.equal(dreams.goals.length,2);
   assert.match(app.innerHTML,/role="tablist"/);assert.match(app.innerHTML,/Rainbow building…/);assert.match(app.innerHTML,/aria-label="Rainbow building blocks, £19.99"/);
   assert.match(app.innerHTML,/I could choose this toy!/);assert.match(app.innerHTML,/I’ll have £1.25 left/);assert.match(app.innerHTML,/Each toy compares the same money/);
   await click('dream-tab',{id:big.id});assert.match(app.innerHTML,/£16.74 more to go/);
   handlers.keydown({key:'ArrowRight',preventDefault(){},target:{closest(){return {dataset:{id:big.id}};}}});assert.match(app.innerHTML,/I’m saving for A tiny toy/);
   await click('dream-edit',{id:cheap.id});assert.match(modal.innerHTML,/value="A tiny toy"/);
   await form('goal-form',{name:'A tiny toy',price:'2.50',description:'Still a little treat',image:''});
   dreams=JSON.parse(store.get('little-helpers-demo-v1'));assert.equal(dreams.goals.length,2);assert.equal(dreams.goals[0].price,1999);assert.equal(dreams.goals[1].price,250);
   assert.match(app.innerHTML,/I’ll have £0.75 left/);
   await click('dream-remove',{id:cheap.id});assert.match(modal.innerHTML,/Your money stays in your pot/);await click('close');assert.equal(JSON.parse(store.get('little-helpers-demo-v1')).goals.length,2);
   await click('dream-remove',{id:cheap.id});await click('confirm-dream-remove',{id:cheap.id});
   dreams=JSON.parse(store.get('little-helpers-demo-v1'));assert.equal(dreams.goals.length,1);assert.equal(JSON.stringify([dreams.completions,dreams.credits,dreams.payouts]),financial);
   await import('../dist/app.mjs?dreams-reload');await Promise.resolve();await click('nav',{view:'money'});assert.match(app.innerHTML,/Rainbow building blocks/);assert.match(app.innerHTML,/£16.74 more to go/);
   location.href='https://example.test/?demo=1&area=parent';
   await import('../dist/app.mjs?direct-parent-demo');await Promise.resolve();
   assert.match(app.innerHTML,/data-area="parent"/);assert.doesNotMatch(app.innerHTML,/My adventure|My week|My money/);
 }finally{globalThis.setInterval=interval;globalThis.setTimeout=timeout;}
});

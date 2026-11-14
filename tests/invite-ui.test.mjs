import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState} from '../shared/domain.mjs';
test('Invited parent signs in and explicitly joins before opening the existing family',async()=>{
 const handlers={},calls=[];let fields={},attempts=0;
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const node=()=>({innerHTML:'',classList:{add(){},remove(){}},querySelector:()=>null,addEventListener(){},append(){},setAttribute(){}});
 const app=node(),modal=node(),toast=node();modal.open=false;
 globalThis.document={querySelector:s=>({'#app':app,'#modal':modal,'#toast':toast}[s]),addEventListener:(n,f)=>{handlers[n]=f;},visibilityState:'visible'};
 globalThis.window={addEventListener(){}};globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.scrollTo=()=>{};
 globalThis.location={href:'https://family.example/?parentInvite='+'a'.repeat(43),origin:'https://family.example',pathname:'/'};
 const original={fetch:globalThis.fetch,FormData:globalThis.FormData,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval};
 globalThis.FormData=class{[Symbol.iterator](){return Object.entries(fields)[Symbol.iterator]();}};globalThis.setTimeout=()=>0;globalThis.setInterval=()=>0;
 const shared=blankState();shared.settings.name='Our daughter';
 globalThis.fetch=async(url,options={})=>{
   calls.push({url,options});
   if(url==='/.netlify/functions/config')return Response.json({configured:true,url:'https://test.supabase.co',anonKey:'publishable'});
   if(url.includes('/auth/v1/token'))return Response.json({access_token:'token',refresh_token:'refresh',expires_in:3600});
   const data=JSON.parse(options.body);
   if(data.action==='acceptParentInvite'){attempts++;return attempts===1?Response.json({error:'Sign in with the email address the original parent invited.'},{status:400}):Response.json({familyId:'shared-family'});}
   if(data.action==='snapshot')return Response.json({state:shared,role:'parent',familyId:'shared-family',memberRole:'parent'});
   if(data.action==='parentAccess')return Response.json({parents:[{user_id:'owner',email:'owner@example.test',role:'owner'},{user_id:'partner',email:'partner@example.test',role:'parent'}],invites:[],memberRole:'parent',familyId:'shared-family'});
   throw new Error('Unexpected request '+url);
 };
 const click=async(action,extra={})=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action,...extra}};}}});
 try{
   await import('../dist/app.mjs');await new Promise(r=>setImmediate(r));
   assert.match(app.innerHTML,/You have a family invitation/);assert.equal(sessionStorage.getItem('lh-parent-invite'),'a'.repeat(43));
   await click('auth-mode',{mode:'login'});fields={email:'partner@example.test',password:'test-password'};
   await handlers.submit({preventDefault(){},target:{id:'login-form',querySelector:()=>({disabled:false})}});
   assert.match(app.innerHTML,/Join your shared family/);assert.equal(calls.filter(c=>c.options.body&&JSON.parse(c.options.body).action==='snapshot').length,0);
   await click('accept-parent-invite');assert.match(app.innerHTML,/email address the original parent invited/);assert.equal(sessionStorage.getItem('lh-parent-invite'),'a'.repeat(43));
   await click('accept-parent-invite');assert.match(app.innerHTML,/Parent dashboard/);assert.equal(sessionStorage.getItem('lh-parent-invite'),null);
   const snapshot=calls.find(c=>c.options.body&&JSON.parse(c.options.body).action==='snapshot');assert.equal(JSON.parse(snapshot.options.body).familyId,'shared-family');
   await click('admin-tab',{tab:'settings'});assert.match(app.innerHTML,/Parents & access/);assert.match(app.innerHTML,/You are an additional parent/);assert.doesNotMatch(app.innerHTML,/data-action="invite-parent"|data-action="remove-parent"|data-action="revoke-devices"/);
 }finally{Object.assign(globalThis,original);}
});

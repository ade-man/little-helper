import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState} from '../shared/domain.mjs';
function setup(href){
 const handlers={},calls=[],errors=[];let fields={};
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const node=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){}},querySelector:()=>null,addEventListener(){},append(el){errors.push(el);},setAttribute(){}});
 const app=node(),modal=node(),toast=node(),form=node();app.querySelector=s=>s==='form'?form:null;modal.open=false;
 globalThis.document={querySelector:s=>({'#app':app,'#modal':modal,'#toast':toast}[s]),createElement:node,addEventListener:(n,f)=>{handlers[n]=f;},visibilityState:'visible'};
 globalThis.window={addEventListener(){}};globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.location={href,origin:'https://family.example',pathname:'/'};
 let cleaned='';const original={fetch:globalThis.fetch,FormData:globalThis.FormData,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval,history:globalThis.history};
 globalThis.history={replaceState(_a,_b,path){cleaned=path;}};globalThis.FormData=class{[Symbol.iterator](){return Object.entries(fields)[Symbol.iterator]();}};globalThis.setTimeout=()=>0;globalThis.setInterval=()=>0;
 globalThis.fetch=async(url,options={})=>{
   calls.push({url,options});
   if(url==='/.netlify/functions/config')return Response.json({configured:true,url:'https://test.supabase.co',anonKey:'publishable'});
   if(url.endsWith('/auth/v1/user'))return Response.json(options.method==='PUT'?{id:'parent'}:{id:'parent',email:'parent@example.test'});
   if(url.includes('/auth/v1/recover'))return Response.json({});
   if(url==='/.netlify/functions/api')return Response.json({state:blankState(),role:'parent',familyId:'family',memberRole:'owner'});
   throw new Error('Unexpected request: '+url);
 };
 return {app,calls,errors,getCleaned:()=>cleaned,restore:()=>Object.assign(globalThis,original),click:async(action,extra={})=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action,...extra}};}}}),submit:async(id,data)=>{fields=data;await handlers.submit({preventDefault(){},target:{id,querySelector:()=>({disabled:false})}});}};
}
test('Forgot-password form requests a reset to the app origin without changing account data',async()=>{
 const t=setup('https://family.example/');try{
   await import('../dist/app.mjs?forgot-password');await new Promise(r=>setImmediate(r));
   await t.click('auth-mode',{mode:'login'});assert.match(t.app.innerHTML,/Forgot your password/);
   await t.click('auth-mode',{mode:'forgot'});assert.match(t.app.innerHTML,/id="forgot-password-form"/);
   await t.submit('forgot-password-form',{email:'parent@example.test'});
   const request=t.calls.find(c=>c.url.includes('/recover'));assert.deepEqual(JSON.parse(request.options.body),{email:'parent@example.test'});assert.equal(new URL(request.url).searchParams.get('redirect_to'),'https://family.example/?flow=password-reset');
   assert.match(t.app.innerHTML,/Password reset requested/);assert.match(t.app.innerHTML,/If an account exists/);assert.equal(sessionStorage.getItem('lh-parent'),null);
 }finally{t.restore();}
});
test('Recovery callback verifies the session, removes URL secrets and saves only a matching new password',async()=>{
 const t=setup('https://family.example/?flow=password-reset#access_token=test-access&refresh_token=test-refresh&expires_in=3600&type=recovery');try{
   await import('../dist/app.mjs?password-recovery');await new Promise(r=>setImmediate(r));
   assert.equal(t.getCleaned(),'/');assert.match(t.app.innerHTML,/id="new-password-form"/);assert.equal(sessionStorage.getItem('lh-password-recovery'),'1');
   const verify=t.calls.find(c=>c.url.endsWith('/auth/v1/user'));assert.equal(verify.options.headers.Authorization,'Bearer test-access');
   await t.submit('new-password-form',{password:'new-password',confirmPassword:'different'});assert.match(t.errors.at(-1).textContent,/passwords don’t match/);assert.equal(t.calls.filter(c=>c.options.method==='PUT').length,0);
   await t.submit('new-password-form',{password:'new-password',confirmPassword:'new-password'});
   const update=t.calls.find(c=>c.options.method==='PUT');assert.equal(update.options.headers.Authorization,'Bearer test-access');assert.deepEqual(JSON.parse(update.options.body),{password:'new-password'});
   assert.match(t.app.innerHTML,/Your new password is ready/);assert.equal(sessionStorage.getItem('lh-password-recovery'),null);assert.equal(sessionStorage.getItem('lh-parent'),null);
 }finally{t.restore();}
});
test('Expired email callback shows a durable explanation and recovery choices',async()=>{
 const t=setup('https://family.example/#error=access_denied&error_code=otp_expired');try{
   await import('../dist/app.mjs?expired-email');await new Promise(r=>setImmediate(r));assert.match(t.app.innerHTML,/expired or was already used/);assert.match(t.app.innerHTML,/Request a new password-reset link/);assert.equal(t.getCleaned(),'/');assert.equal(sessionStorage.getItem('lh-parent'),null);
 }finally{t.restore();}
});
test('Successful email confirmation opens the verified parent session without another link click',async()=>{
 const t=setup('https://family.example/#access_token=test-access&refresh_token=test-refresh&expires_in=3600&type=signup');try{
   await import('../dist/app.mjs?confirmed-email');await new Promise(r=>setImmediate(r));assert.match(t.app.innerHTML,/Parent dashboard/);assert.ok(sessionStorage.getItem('lh-parent'));assert.equal(sessionStorage.getItem('lh-password-recovery'),null);assert.ok(!t.getCleaned().includes('test-access'));
 }finally{t.restore();}
});

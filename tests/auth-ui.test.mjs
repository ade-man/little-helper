import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState} from '../shared/domain.mjs';

test('Parent onboarding separates account creation, confirmation and sign-in requests',async()=>{
 const handlers={},calls=[],errors=[];let formData={};
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const node=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){}},querySelector:()=>null,addEventListener(){},append(el){errors.push(el);},setAttribute(){},focus(){}});
 const app=node(),modal=node(),toast=node(),form=node();
 app.querySelector=s=>s==='form'?form:null;modal.open=false;modal.showModal=()=>{modal.open=true;};modal.close=()=>{modal.open=false;};
 globalThis.document={querySelector:s=>({'#app':app,'#modal':modal,'#toast':toast}[s]),createElement:node,addEventListener:(name,fn)=>{handlers[name]=fn;},visibilityState:'visible'};
 globalThis.window={addEventListener(){}};globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.location={href:'https://family.example/',origin:'https://family.example',pathname:'/'};
 const original={fetch:globalThis.fetch,FormData:globalThis.FormData,setInterval:globalThis.setInterval,setTimeout:globalThis.setTimeout};
 globalThis.FormData=class{[Symbol.iterator](){return Object.entries(formData)[Symbol.iterator]();}};
 globalThis.setInterval=()=>0;globalThis.setTimeout=()=>0;
 globalThis.fetch=async(url,options={})=>{
   calls.push({url,options});
   if(url==='/.netlify/functions/config')return Response.json({configured:true,url:'https://test.supabase.co',anonKey:'publishable-test'});
   if(url.includes('/auth/v1/signup'))return Response.json({user:{id:'parent-1'}});
   if(url.includes('/auth/v1/token'))return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600});
   if(url==='/.netlify/functions/api'){
     if(JSON.parse(options.body).action==='createDevice')return Response.json({token:'a'.repeat(43)});
     return Response.json({state:blankState(),role:options.headers.Authorization.startsWith('Device ')?'child':'parent'});
   }
   throw new Error('Unexpected request: '+url);
 };
 const click=async(mode)=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action:'auth-mode',mode}};}}});
 const submit=async(id,data)=>{formData=data;await handlers.submit({preventDefault(){},target:{id,querySelector:()=>({disabled:false})}});};
 try{
   await import('../dist/app.mjs');await new Promise(resolve=>setImmediate(resolve));
   assert.match(app.innerHTML,/I’m new — set up my family/);assert.match(app.innerHTML,/I already have an account/);assert.doesNotMatch(app.innerHTML,/<form/);
   assert.match(app.innerHTML,/Try the demo — no account needed/);
   await click('signup');assert.match(app.innerHTML,/id="signup-form"/);assert.match(app.innerHTML,/Confirm your new password/);assert.match(app.innerHTML,/autocomplete="new-password"/);assert.doesNotMatch(app.innerHTML,/id="login-form"/);
   await submit('signup-form',{email:'parent@example.test',password:'new-password',confirmPassword:'different'});
   assert.equal(calls.filter(c=>c.url.includes('/signup')).length,0);assert.match(errors.at(-1).textContent,/passwords don’t match/);
   await submit('signup-form',{email:'parent@example.test',password:'new-password',confirmPassword:'new-password'});
   const signup=calls.find(c=>c.url.includes('/signup'));assert.deepEqual(JSON.parse(signup.options.body),{email:'parent@example.test',password:'new-password'});
   assert.match(app.innerHTML,/Check your inbox/);assert.match(app.innerHTML,/parent@example.test/);assert.match(app.innerHTML,/I’ve confirmed — go to sign in/);assert.doesNotMatch(app.innerHTML,/<form/);
   await click('login');assert.match(app.innerHTML,/id="login-form"/);assert.match(app.innerHTML,/autocomplete="current-password"/);assert.doesNotMatch(app.innerHTML,/Confirm your new password/);
   await submit('login-form',{email:'parent@example.test',password:'new-password'});
   assert.equal(calls.filter(c=>c.url.includes('/signup')).length,1);assert.equal(calls.filter(c=>c.url.includes('grant_type=password')).length,1);
   assert.match(app.innerHTML,/Parent dashboard/);assert.ok(sessionStorage.getItem('lh-parent'));
   // An existing parent session opens the parent dashboard on a fresh load.
   await import('../dist/app.mjs?existing-parent');await new Promise(resolve=>setImmediate(resolve));assert.match(app.innerHTML,/Parent dashboard/);
   assert.match(app.innerHTML,/Parent administration/);assert.doesNotMatch(app.innerHTML,/My adventure|My week|My money/);
   const action=async(a)=>handlers.click({preventDefault(){},target:{closest(){return {dataset:{action:a}};}}});
   await action('child-view');assert.match(app.innerHTML,/My everyday essentials/);assert.doesNotMatch(app.innerHTML,/Parent administration/);assert.equal(sessionStorage.getItem('lh-parent'),null);
   await action('parent');assert.match(app.innerHTML,/Sign in to your family/);assert.doesNotMatch(app.innerHTML,/data-area="parent"/);
   location.href='https://family.example/?area=parent';
   await import('../dist/app.mjs?parent-link-on-child-device');await new Promise(resolve=>setImmediate(resolve));
   assert.match(app.innerHTML,/Sign in to your family/);assert.doesNotMatch(app.innerHTML,/Parent administration|My everyday essentials/);
   assert.match(app.innerHTML,/<button type="button" class="btn secondary auth-child-return" data-action="back-child">/);
   const originalHistory=globalThis.history;
   globalThis.history={replaceState(_state,_title,path){location.href=new URL(path,location.href).href;}};
   try{
     await action('back-child');
     assert.match(app.innerHTML,/My everyday essentials/);
     assert.equal(new URL(location.href).searchParams.get('area'),'child');
     assert.equal(calls.at(-1).options.headers.Authorization,'Device '+'a'.repeat(43));
     await import('../dist/app.mjs?child-return-reload');await new Promise(resolve=>setImmediate(resolve));
     assert.match(app.innerHTML,/My everyday essentials/);
   }finally{globalThis.history=originalHistory;}

 }finally{Object.assign(globalThis,original);}
});

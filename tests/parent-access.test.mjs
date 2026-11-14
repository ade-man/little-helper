import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState} from '../shared/domain.mjs';
import {createHandler} from '../netlify/functions/api.mjs';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
const family='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';const partner='33333333-3333-4333-8333-333333333333';
const req=(action,data={},who='owner',familyId=family)=>new Request('https://family.example/api',{method:'POST',headers:{Authorization:who==='child'?'Device '+'a'.repeat(43):'Bearer '+who,'Content-Type':'application/json'},body:JSON.stringify({action,data,familyId})});
function setup(){
 let joined=false,removed=false,consumed=false;const calls=[];let state=blankState();const inviteCode='b'.repeat(43);
 const fetcher=async(url,options={})=>{
   const u=new URL(url),method=options.method||'GET';calls.push({url,options});
   if(u.pathname==='/auth/v1/user'){const isOwner=options.headers.Authorization==='Bearer owner';return Response.json({id:isOwner?owner:partner,email:isOwner?'owner@example.test':'partner@example.test',email_confirmed_at:'2026-11-14T10:00Z'});}
   if(u.pathname.endsWith('/lh_devices'))return Response.json(method==='GET'?[{family_id:family}]:[]);
   if(u.pathname.endsWith('/rpc/lh_accept_parent_invite')){
     if(consumed)return Response.json({error:'This invitation has expired or was already used.'});
     consumed=true;joined=true;return Response.json({familyId:family});
   }
   if(u.pathname.endsWith('/lh_parent_members')){
     if(method==='DELETE'){removed=true;return Response.json([]);}
     if(method==='POST')return Response.json([]);
     if(u.searchParams.get('user_id')==='eq.'+owner)return Response.json([{family_id:family,user_id:owner,role:'owner',email:'owner@example.test'}]);
     if(u.searchParams.get('user_id')==='eq.'+partner)return Response.json(joined&&!removed?[{family_id:family,user_id:partner,role:'parent',email:'partner@example.test'}]:[]);
     if(u.searchParams.get('role')==='eq.parent')return Response.json(joined&&!removed?[{user_id:partner,email:'partner@example.test'}]:[]);
     return Response.json([{user_id:owner,role:'owner',email:'owner@example.test'},...(joined&&!removed?[{user_id:partner,role:'parent',email:'partner@example.test'}]:[])]);
   }
   if(u.pathname.endsWith('/lh_families')){
     if(method==='PATCH'){state=JSON.parse(options.body).state;return Response.json([{state}]);}
     return Response.json([{id:family,state,revision:0}]);
   }
   if(u.pathname.endsWith('/lh_parent_invites'))return Response.json([]);
   if(u.pathname.endsWith('/lh_pairings'))return Response.json([]);
   throw new Error('Unexpected '+url);
 };
 return {handler:createHandler(env,fetcher),calls,inviteCode};
}
test('Original parent creates a private email-bound invite without emailing anyone',async()=>{
 const t=setup();const r=await t.handler(req('inviteParent',{email:'Partner@Example.test'}));assert.equal(r.status,200);const result=await r.json();assert.match(result.code,/^[A-Za-z0-9_-]{43}$/);assert.equal(result.email,'partner@example.test');
 const insert=t.calls.find(c=>c.url.endsWith('/lh_parent_invites')&&c.options.method==='POST');const stored=JSON.parse(insert.options.body);assert.equal(stored.created_by,owner);assert.equal(stored.email,'partner@example.test');assert.equal(stored.token_hash.length,64);assert.ok(!insert.options.body.includes(result.code));
});
test('Partner accepts once, sees the same family, and can manage tasks and approvals',async()=>{
 const t=setup();const accepted=await t.handler(req('acceptParentInvite',{code:t.inviteCode},'partner',undefined));assert.equal(accepted.status,200);assert.equal((await accepted.json()).familyId,family);
 const snapshot=await t.handler(req('snapshot',{},'partner'));assert.equal(snapshot.status,200);const s=await snapshot.json();assert.equal(s.familyId,family);assert.equal(s.memberRole,'parent');
 const save=await t.handler(req('saveTask',{title:'Help with shopping',value:50,essential:false,frequency:'weekly',icon:'star'},'partner'));assert.equal(save.status,200);
 const submit=await t.handler(req('submit',{taskId:'reading'},'child'));const claim=(await submit.json()).state.completions[0];assert.ok(claim);
 assert.equal((await t.handler(req('review',{id:claim.id,status:'approved'},'partner'))).status,200);
 assert.equal((await t.handler(req('acceptParentInvite',{code:t.inviteCode},'partner'))).status,400);
});
test('Additional parent and child cannot manage parent ownership or invitations',async()=>{
 const t=setup();await t.handler(req('acceptParentInvite',{code:t.inviteCode},'partner'));
 for(const action of ['inviteParent','removeParent','revokeParentInvite','revokeDevices'])assert.equal((await t.handler(req(action,{},'partner'))).status,403);
 for(const action of ['parentAccess','inviteParent','acceptParentInvite','removeParent'])assert.equal((await t.handler(req(action,{},'child'))).status,403);
});
test('Original owner can remove a partner and future requests are denied without losing family history',async()=>{
 const t=setup();await t.handler(req('acceptParentInvite',{code:t.inviteCode},'partner'));
 assert.equal((await t.handler(req('removeParent',{userId:partner}))).status,200);
 const denied=await t.handler(req('snapshot',{},'partner'));assert.equal(denied.status,403);assert.equal((await denied.json()).code,'FAMILY_ACCESS');
 assert.equal((await t.handler(req('snapshot'))).status,200);
 const deletions=t.calls.filter(c=>c.options.method==='DELETE');assert.ok(deletions.some(c=>c.url.includes('/lh_devices?')&&c.url.includes('created_by=')));assert.ok(!deletions.some(c=>c.url.includes('/lh_families')));
});
test('A parent cannot select another family by changing the request body',async()=>{
 const t=setup();const r=await t.handler(req('snapshot',{},'owner','44444444-4444-4444-8444-444444444444'));assert.equal(r.status,403);
 assert.ok(!t.calls.some(c=>c.url.includes('/lh_families?')));
});

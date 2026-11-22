import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler} from '../netlify/functions/api.mjs';
import {blankState,localDate,addDays} from '../shared/domain.mjs';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
const parent='Bearer a-valid-user-jwt',child='Device '+'a'.repeat(43);
const post=(action,data={},auth=parent)=>new Request('https://family.example/.netlify/functions/api',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({action,data})});
function mockDb(){let state=blankState(localDate()),revision=0;let conflict=false;const calls=[];
 const fetcher=async(url,opts={})=>{calls.push({url,opts});const u=new URL(url);const m=opts.method||'GET';
 if(u.pathname==='/auth/v1/user')return Response.json({id:'parent-1'});
 if(u.pathname.endsWith('/lh_devices'))return Response.json([{family_id:'family-1'}]);
 if(u.pathname.endsWith('/lh_families')){
 if(u.searchParams.has('owner_id'))return Response.json([{id:'family-1'}]);
 if(m==='PATCH'){if(conflict){conflict=false;revision++;return Response.json([]);}const d=JSON.parse(opts.body);state=d.state;revision=d.revision;return Response.json([{state,revision}]);}
 return Response.json([{state,revision}]);}
 return Response.json([]);};
 return {fetcher,calls,conflict:()=>{conflict=true;},getState:()=>state};
}
test('Unauthenticated API requests are rejected',async()=>{const m=mockDb();const r=await createHandler(env,m.fetcher)(post('snapshot',{},''));assert.equal(r.status,401);});
test('Child credentials cannot access parent operations',async()=>{const m=mockDb();for(const a of ['review','saveTask','payout','settings','pair','revokeDevices','createDevice','addMoney','releaseReward']){const r=await createHandler(env,m.fetcher)(post(a,{},child));assert.equal(r.status,403);}});
test('API verifies parent identity and applies domain rules',async()=>{const m=mockDb();const h=createHandler(env,m.fetcher);const r=await h(post('submit',{taskId:'table'}));assert.equal(r.status,200);assert.equal(m.getState().completions[0].rewardReleased,false);assert.ok(m.calls.some(c=>c.url.endsWith('/auth/v1/user')));});
test('Concurrent updates retry without losing the winning revision',async()=>{const m=mockDb();m.conflict();const r=await createHandler(env,m.fetcher)(post('submit',{taskId:'reading'},child));assert.equal(r.status,200);assert.equal(m.getState().completions.length,1);assert.equal(m.calls.filter(c=>c.opts.method==='PATCH').length,2);});
test('Repeated submissions from separate API calls cannot add duplicates',async()=>{const m=mockDb();const h=createHandler(env,m.fetcher);assert.equal((await h(post('submit',{taskId:'reading'},child))).status,200);assert.equal((await h(post('submit',{taskId:'reading'},child))).status,400);assert.equal(m.getState().completions.length,1);});
test('Opaque backend keys never go in a JWT Authorization header',async()=>{const m=mockDb();await createHandler(env,m.fetcher)(post('snapshot'));const db=m.calls.find(c=>c.url.includes('/rest/v1/'));assert.equal(db.opts.headers.apikey,'sb_secret_test');assert.equal(db.opts.headers.Authorization,undefined);});
test('Expired or consumed pairing links cannot create a device',async()=>{const m=mockDb();const r=await createHandler(env,m.fetcher)(post('redeemPair',{code:'a'.repeat(22)},''));assert.equal(r.status,400);assert.match((await r.json()).error,/expired/);const call=m.calls[0];assert.equal(call.opts.method,'DELETE');assert.ok(call.url.includes(createHash('sha256').update('a'.repeat(22)).digest('hex')));assert.ok(!call.url.includes('a'.repeat(22)));});
test('A child device can choose a savings target without changing reward rules',async()=>{const m=mockDb();const r=await createHandler(env,m.fetcher)(post('setGoal',{name:'My dream toy',price:2450,image:'https://images.example.com/toy.jpg',threshold:0},child));assert.equal(r.status,200);assert.equal(m.getState().goal.price,2450);assert.equal(m.getState().settings.threshold,undefined);assert.equal(m.getState().tasks.filter(t=>t.active&&t.essential).length,4);});
test('Product lookup requires authentication and never forwards its credential',async()=>{const m=mockDb();let shopHeaders;const fetcher=async(url,opts)=>{if(url.startsWith('https://www.lego.com/')){shopHeaders=opts.headers;return new Response('<meta property="og:title" content="A building toy"><meta property="product:price:currency" content="GBP"><meta property="product:price:amount" content="14.99">',{headers:{'Content-Type':'text/html'}});}return m.fetcher(url,opts);};const handler=createHandler(env,fetcher);assert.equal((await handler(post('importProduct',{url:'https://www.lego.com/example'},''))).status,401);const r=await handler(post('importProduct',{url:'https://www.lego.com/example'},child));assert.equal(r.status,200);assert.equal((await r.json()).product.price,1499);assert.equal(shopHeaders.Authorization,undefined);});
test('Live API records early work using the server date and holds its reward until that date’s essentials',async()=>{
 const m=mockDb(),h=createHandler(env,m.fetcher),today=localDate(),yesterday=addDays(today,-1);
 for(const t of m.getState().tasks.filter(t=>t.essential))m.getState().completions.push({id:'old-'+t.id,taskId:t.id,title:t.title,date:yesterday,status:'approved',essential:true,value:0});
 const early=await h(post('submit',{taskId:'table',date:yesterday},child));assert.equal(early.status,200);const claim=m.getState().completions.at(-1);assert.equal(claim.date,today);assert.equal((await h(post('review',{id:claim.id,status:'approved'}))).status,200);assert.equal(m.getState().completions.find(c=>c.id===claim.id).rewardReleased,false);
 for(const t of m.getState().tasks.filter(t=>t.active&&t.essential)){
   const submitted=await h(post('submit',{taskId:t.id},child));assert.equal(submitted.status,200);const data=await submitted.json();const c=data.state.completions.at(-1);assert.equal(c.date,today);
   assert.equal((await h(post('review',{id:c.id,status:'approved'}))).status,200);
 }
 assert.equal(m.getState().completions.find(c=>c.id===claim.id).rewardReleased,true);
});

test('Paired children can add and remove dream toys without touching financial records',async()=>{
 const m=mockDb(),h=createHandler(env,m.fetcher),before=structuredClone(m.getState());
 for(let n=1;n<=2;n++){
  const r=await h(post('setGoal',{mode:'add',goalId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,name:`Dream ${n}`,price:n*200},child));assert.equal(r.status,200);
 }
 assert.equal(m.getState().goals.length,2);
 const removed=await h(post('removeGoal',{goalId:m.getState().goals[0].id,amount:99999},child));assert.equal(removed.status,200);assert.equal(m.getState().goals.length,1);
 for(const key of ['tasks','completions','payouts','credits'])assert.deepEqual(m.getState()[key],before[key]);
 assert.equal((await h(post('addMoney',{title:'My reward',amount:99999},child))).status,403);
});

test('Dated child submissions use the server clock in the family time zone',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-17T02:00:00Z')});
 const m=mockDb(),h=createHandler(env,m.fetcher);
 m.getState().settings.timeZone='America/New_York';
 const invalid=await h(post('submitForDate',{taskId:'reading',date:'2026-11-17'},child));
 assert.equal(invalid.status,400);
 assert.equal(m.calls.filter(c=>c.opts.method==='PATCH').length,0);
 m.getState().settings.timeZone='Europe/London';
 m.conflict();
 const monday=await h(post('submitForDate',{taskId:'reading',date:'2026-11-16'},child));
 assert.equal(monday.status,200);
 assert.equal(m.getState().completions[0].date,'2026-11-16');
 assert.equal(m.calls.filter(c=>c.opts.method==='PATCH').length,2);
});

test('Sibling device tokens scope reads and writes and a parent can review across profiles',async()=>{
 const childId='11111111-1111-4111-8111-111111111111';
 const otherId='22222222-2222-4222-8222-222222222222';
 const primary=blankState(),sibling=blankState();
 primary.settings.name='Alex';sibling.settings.name='Sam';
 primary.settings.timeZone='America/New_York';
 let siblingRow={state:sibling,revision:0},newProfile,paired,deviceProfile,tokenHash,memberRole='owner';
 const handler=createHandler(env,async(url,opts)=>{
   const u=new URL(url),table=u.pathname.split('/').at(-1),method=opts.method,query=u.searchParams;
   if(table==='user')return Response.json({id:'parent-1'});
   if(table==='lh_parent_members')return Response.json([{family_id:'family-1',role:memberRole}]);
   if(table==='lh_devices'){
     if(method==='POST'){const d=JSON.parse(opts.body);deviceProfile=d.child_id;tokenHash=d.token_hash;return Response.json([]);}
     return Response.json([{family_id:'family-1',child_id:query.get('token_hash')==='eq.'+tokenHash?deviceProfile:null}]);
   }
   if(table==='lh_pairings'){
     if(method==='POST'){paired=JSON.parse(opts.body);return Response.json([]);}
     return Response.json([{family_id:paired.family_id,created_by:paired.created_by,child_id:paired.child_id}]);
   }
   if(table==='lh_families'){
     const select=query.get('select');
     if(select.includes('timeZone'))return Response.json([{timeZone:primary.settings.timeZone,payday:'2'}]);
     if(select.includes('tasks'))return Response.json([{tasks:primary.tasks}]);
     return Response.json([{state:primary,revision:0}]);
   }
   if(table==='lh_children'){
     if(method==='POST'){newProfile=JSON.parse(opts.body);return new Response(null,{status:201});}
     if(query.get('family_id')!=='eq.family-1'||query.get('id')!=='eq.'+childId)return Response.json([]);
     if(method==='DELETE'){
       assert.equal(opts.headers.Prefer,'return=minimal');
       siblingRow=null;
       return new Response(null,{status:204});
     }
     if(method==='PATCH')siblingRow=JSON.parse(opts.body);
     return Response.json(siblingRow?[siblingRow]:[]);
   }
   if(table==='lh_parent_dashboard')return Response.json({
     children:[{id:'primary',name:'Alex'},{id:childId,name:'Sam'}],
     inbox:siblingRow.state.completions.filter(c=>c.status==='pending').map(c=>({...c,childId}))
   });
   throw Error('Unexpected request '+table);
 });
 const send=(action,data={},auth=parent,profile=childId,extras={})=>handler(new Request('https://example.test/api',{
   method:'POST',headers:{Authorization:auth},body:JSON.stringify({action,data,childId:profile,...extras})
 }));
 primary.tasks[0].active=false;
 assert.equal((await send('addChild',{id:otherId,name:'Taylor',copyTasks:true},parent,'primary')).status,200);
 assert.equal(newProfile.state.settings.name,'Taylor');
 assert.deepEqual(newProfile.state.tasks,primary.tasks.filter(t=>t.active));
 for(const key of ['completions','payouts','credits','goals'])assert.deepEqual(newProfile.state[key],[]);
 const starterId='33333333-3333-4333-8333-333333333333';
 const starter=await send('addChild',{id:starterId,name:'Robin',copyTasks:false},parent,'primary');
 assert.equal(starter.status,200);
 assert.deepEqual(await starter.json(),{ok:true});
 assert.deepEqual(newProfile.state.tasks,blankState().tasks);
 assert.equal((await send('pair',{},parent,otherId)).status,404);
 const pair=await (await send('pair')).json();
 assert.equal(paired.child_id,childId);
 const redeemed=await (await send('redeemPair',{code:pair.code},'')).json();
 const tablet='Device '+redeemed.token;
 const legacy=await (await send('snapshot',{},child,childId,{dashboard:true})).json();
 assert.equal(legacy.state.settings.name,'Alex');
 assert.equal(legacy.children,undefined);
 const childSnapshot=await (await send('snapshot',{},tablet,'primary',{dashboard:true,inbox:true})).json();
 assert.equal(childSnapshot.state.settings.name,'Sam');
 assert.equal(childSnapshot.state.settings.timeZone,'America/New_York');
 assert.equal(childSnapshot.state.settings.payday,2);
 assert.equal(childSnapshot.children,undefined);
 assert.equal(childSnapshot.inbox,undefined);
 assert.equal((await send('addChild',{name:'Child'},tablet)).status,403);
 assert.equal((await send('submit',{taskId:'reading'},tablet,'primary')).status,200);
 assert.equal(primary.completions.length,0);
 const dashboard=await (await send('snapshot',{},parent,'primary',{dashboard:true,inbox:true})).json();
 assert.equal(dashboard.state.settings.name,'Alex');
 assert.equal(dashboard.inbox[0].childId,childId);
 assert.equal((await send('review',{id:dashboard.inbox[0].id,status:'approved'})).status,200);
 assert.equal(siblingRow.state.completions[0].status,'approved');
 assert.equal((await send('deleteChild',{},tablet)).status,403);
 assert.equal((await send('deleteChild',{},parent,'primary')).status,400);
 memberRole='parent';
 assert.equal((await send('deleteChild')).status,403);
 memberRole='owner';
 assert.equal((await send('deleteChild',{},parent,otherId)).status,200);
 assert.ok(siblingRow);
 assert.deepEqual(await (await send('deleteChild')).json(),{ok:true});
 assert.equal(siblingRow,null);
 const removed=await send('snapshot');
 assert.equal(removed.status,404);
 assert.equal((await removed.json()).code,'CHILD_PROFILE_MISSING');
 assert.deepEqual(await (await send('deleteChild')).json(),{ok:true});
 assert.equal((await (await send('snapshot',{},parent,'primary')).json()).state.settings.name,'Alex');

});

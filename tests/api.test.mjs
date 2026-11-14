import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler} from '../netlify/functions/api.mjs';
import {blankState,localDate} from '../shared/domain.mjs';
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
test('Child credentials cannot access parent operations',async()=>{const m=mockDb();for(const a of ['review','saveTask','payout','settings','pair','revokeDevices','createDevice']){const r=await createHandler(env,m.fetcher)(post(a,{},child));assert.equal(r.status,403);}});
test('API verifies parent identity and applies domain rules',async()=>{const m=mockDb();const h=createHandler(env,m.fetcher);const r=await h(post('submit',{taskId:'table'}));assert.equal(r.status,400);assert.match((await r.json()).error,/essential/);assert.ok(m.calls.some(c=>c.url.endsWith('/auth/v1/user')));});
test('Concurrent updates retry without losing the winning revision',async()=>{const m=mockDb();m.conflict();const r=await createHandler(env,m.fetcher)(post('submit',{taskId:'reading'},child));assert.equal(r.status,200);assert.equal(m.getState().completions.length,1);assert.equal(m.calls.filter(c=>c.opts.method==='PATCH').length,2);});
test('Repeated submissions from separate API calls cannot add duplicates',async()=>{const m=mockDb();const h=createHandler(env,m.fetcher);assert.equal((await h(post('submit',{taskId:'reading'},child))).status,200);assert.equal((await h(post('submit',{taskId:'reading'},child))).status,400);assert.equal(m.getState().completions.length,1);});
test('Opaque backend keys never go in a JWT Authorization header',async()=>{const m=mockDb();await createHandler(env,m.fetcher)(post('snapshot'));const db=m.calls.find(c=>c.url.includes('/rest/v1/'));assert.equal(db.opts.headers.apikey,'sb_secret_test');assert.equal(db.opts.headers.Authorization,undefined);});
test('Expired or consumed pairing links cannot create a device',async()=>{const m=mockDb();const r=await createHandler(env,m.fetcher)(post('redeemPair',{code:'a'.repeat(22)},''));assert.equal(r.status,400);assert.match((await r.json()).error,/expired/);const call=m.calls[0];assert.equal(call.opts.method,'DELETE');assert.ok(call.url.includes(createHash('sha256').update('a'.repeat(22)).digest('hex')));assert.ok(!call.url.includes('a'.repeat(22)));});
test('A child device can choose a savings target without changing reward rules',async()=>{const m=mockDb();const r=await createHandler(env,m.fetcher)(post('setGoal',{name:'My dream toy',price:2450,image:'https://images.example.com/toy.jpg',threshold:0},child));assert.equal(r.status,200);assert.equal(m.getState().goal.price,2450);assert.equal(m.getState().settings.threshold,8);});
test('Product lookup requires authentication and never forwards its credential',async()=>{const m=mockDb();let shopHeaders;const fetcher=async(url,opts)=>{if(url.startsWith('https://www.lego.com/')){shopHeaders=opts.headers;return new Response('<meta property="og:title" content="A building toy"><meta property="product:price:currency" content="GBP"><meta property="product:price:amount" content="14.99">',{headers:{'Content-Type':'text/html'}});}return m.fetcher(url,opts);};const handler=createHandler(env,fetcher);assert.equal((await handler(post('importProduct',{url:'https://www.lego.com/example'},''))).status,401);const r=await handler(post('importProduct',{url:'https://www.lego.com/example'},child));assert.equal(r.status,200);assert.equal((await r.json()).product.price,1499);assert.equal(shopHeaders.Authorization,undefined);});

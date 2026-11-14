import {createHandler} from './api.mjs';
const named=(name,fallback)=>{try{return JSON.parse(Deno.env.get(name)||'{}').default||Deno.env.get(fallback);}catch{return Deno.env.get(fallback);}};
const env={SUPABASE_URL:Deno.env.get('SUPABASE_URL'),SUPABASE_PUBLISHABLE_KEY:named('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),SUPABASE_SECRET_KEY:named('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY')};
const handle=createHandler(env);
const origins=new Set(['https://little-helpers-family-quest.plainpapaya4.chatgpt.site']);
Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 const cors={'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, apikey, x-client-info','Access-Control-Max-Age':'3600'};
 if(origin&&origins.has(origin))cors['Access-Control-Allow-Origin']=origin;
 if(origin&&!origins.has(origin))return Response.json({error:'Origin not allowed.'},{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const r=await handle(req);const headers=new Headers(r.headers);for(const [k,v] of Object.entries(cors))headers.set(k,v);
 return new Response(r.body,{status:r.status,headers});
});


import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {applyAction,blankState,localDate} from '../../shared/domain.mjs';
import {importProduct} from '../../shared/product-import.mjs';

class HttpError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const hash=v=>createHash('sha256').update(v).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export function createHandler(env=process.env,fetcher=fetch){
 const url=env.SUPABASE_URL?.replace(/\/$/,'');
 const publicKey=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
 const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 async function db(path,method='GET',body,prefer='return=representation'){
   const headers={apikey:secret,'Content-Type':'application/json',Prefer:prefer};
   // Opaque sb_secret keys belong only in apikey; legacy JWT keys also need Bearer.
   if(!secret.startsWith('sb_secret_'))headers.Authorization='Bearer '+secret;
   const res=await fetcher(url+'/rest/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
   if(!res.ok)throw new HttpError('The family database could not be reached. Please try again.',503);
   if(res.status===204||prefer.split(',').includes('return=minimal'))return [];
   return res.json();
 }
 async function device(family,creator,childId){const t=token();await db('lh_devices','POST',{token_hash:hash(t),family_id:family,created_by:creator,...(childId?{child_id:childId}:{}),expires_at:new Date(Date.now()+30*86400000).toISOString()});return t;}
 return async function handler(req){
   if(req.method!=='POST')return json({error:'Use POST.'},405);
   if(!url||!publicKey||!secret)return json({error:'Family syncing is not configured yet.'},503);
   try{
     const raw=await req.text();if(raw.length>30000)throw new HttpError('This request is too large.',413);
     let body;try{body=JSON.parse(raw);}catch{throw new HttpError('Send a valid request.');}
     const {action,data={}}=body;
     if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpError('Send valid task data.');
     if(action==='redeemPair'){
       if(typeof data.code!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(data.code))throw new HttpError('This pairing link is not valid.');
       // DELETE ... RETURNING is atomic: only one tablet can consume a link.
       const rows=await db(`lh_pairings?code_hash=eq.${hash(data.code)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,'DELETE');
       if(!rows.length)throw new HttpError('This pairing link has expired or was already used. Ask your grown-up for a new one.');
       return json({token:await device(rows[0].family_id,rows[0].created_by,rows[0].child_id)});
     }
     const authorization=req.headers.get('Authorization')||'';let role,familyId,userId,email,memberRole,childId;
     if(authorization.startsWith('Bearer ')){
       const res=await fetcher(url+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:authorization},signal:AbortSignal.timeout(10000)});
       if(!res.ok)throw new HttpError('Please sign in to the parent area again.',401);
       const user=await res.json();if(!user.id||user.is_anonymous)throw new HttpError('A parent account is needed.',403);
       userId=user.id;email=String(user.email||'').toLowerCase();role='parent';
       if(action==='acceptParentInvite'){
         if(typeof data.code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.code))throw new HttpError('This parent invitation is not valid.');
         if(!user.email_confirmed_at)throw new HttpError('Confirm your email before joining this family.',403);
         const joined=await db('rpc/lh_accept_parent_invite','POST',{p_hash:hash(data.code),p_user_id:userId,p_email:email});
         if(joined.error)throw new HttpError(joined.error);
         return json(joined);
       }
       const owner=encodeURIComponent(userId);
       let members=await db(`lh_parent_members?user_id=eq.${owner}&select=family_id,role&order=created_at.desc`);
       if(body.familyId){
         const selected=members.find(m=>m.family_id===body.familyId);
         if(!selected)return json({error:'Your access to this family has changed. Sign in again or ask the original parent for an invitation.',code:'FAMILY_ACCESS'},403);
         familyId=selected.family_id;memberRole=selected.role;
       }else if(members.length){familyId=members[0].family_id;memberRole=members[0].role;}
       else{
         let families=await db(`lh_families?owner_id=eq.${owner}&select=id`);
         if(!families.length){await db('lh_families?on_conflict=owner_id','POST',{owner_id:userId,state:blankState()},'resolution=ignore-duplicates,return=representation');families=await db(`lh_families?owner_id=eq.${owner}&select=id`);}
         familyId=families[0]?.id;memberRole='owner';
         if(familyId)await db('lh_parent_members?on_conflict=family_id,user_id','POST',{family_id:familyId,user_id:userId,role:'owner',email},'resolution=ignore-duplicates,return=representation');
       }
     }else if(authorization.startsWith('Device ')){
       const t=authorization.slice(7);if(!/^[A-Za-z0-9_-]{43}$/.test(t))throw new HttpError('Pair this tablet again.',401);
       const devices=await db(`lh_devices?token_hash=eq.${hash(t)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=family_id,child_id`);
       if(!devices.length)throw new HttpError('This tablet’s connection has expired. Ask a grown-up to pair it again.',401);
       familyId=devices[0].family_id;childId=devices[0].child_id;role='child';
     }else throw new HttpError('Sign in or pair a tablet to continue.',401);
     if(!familyId)throw new HttpError('The family space could not be opened.',503);
     if(role==='child'&&!['snapshot','submit','submitForDate','importProduct','setGoal','removeGoal'].includes(action))throw new HttpError('A grown-up needs to do this.',403);
     if(['inviteParent','revokeParentInvite','removeParent','revokeDevices'].includes(action)&&memberRole!=='owner')throw new HttpError('Only the original parent can manage family access.',403);
     if(action==='parentAccess'){
       if(role!=='parent')throw new HttpError('A grown-up needs to do this.',403);
       const parents=await db(`lh_parent_members?family_id=eq.${familyId}&select=user_id,role,email`);
       const invites=memberRole==='owner'?await db(`lh_parent_invites?family_id=eq.${familyId}&accepted_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,email,expires_at`):[];
       return json({parents,invites,memberRole,familyId});
     }
     if(action==='inviteParent'){
       const invited=String(data.email||'').trim().toLowerCase();
       if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invited)||invited.length>254)throw new HttpError('Enter your partner’s email address.');
       if(invited===email)throw new HttpError('Use your partner’s email address, rather than your own.');
       const parents=await db(`lh_parent_members?family_id=eq.${familyId}&role=eq.parent&select=user_id`);
       if(parents.length)throw new HttpError('An additional parent already has access. Manage their access below.');
       const code=token();await db('lh_parent_invites','POST',{token_hash:hash(code),family_id:familyId,email:invited,created_by:userId,expires_at:new Date(Date.now()+7*86400000).toISOString()});
       return json({code,email:invited});
     }
     if(action==='revokeParentInvite'){
       await db(`lh_parent_invites?family_id=eq.${familyId}&id=eq.${encodeURIComponent(String(data.id))}`,'DELETE');return json({ok:true});
     }
     if(action==='removeParent'){
       const id=encodeURIComponent(String(data.userId));
       const target=await db(`lh_parent_members?family_id=eq.${familyId}&user_id=eq.${id}&role=eq.parent&select=email`);
       if(!target.length)throw new HttpError('Choose an additional parent to remove. The original parent cannot be removed.');
       await db(`lh_parent_invites?family_id=eq.${familyId}&email=eq.${encodeURIComponent(target[0].email)}`,'DELETE');
       await db(`lh_devices?family_id=eq.${familyId}&created_by=eq.${id}`,'DELETE');
       await db(`lh_pairings?family_id=eq.${familyId}&created_by=eq.${id}`,'DELETE');
       await db(`lh_parent_members?family_id=eq.${familyId}&user_id=eq.${id}&role=eq.parent`,'DELETE');return json({ok:true});
     }
     if(role==='parent'&&body.childId!==undefined&&body.childId!=='primary'){
       if(typeof body.childId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.childId))throw new HttpError('Choose a child profile.');
       childId=body.childId;
     }
     const familyPath=`lh_families?id=eq.${familyId}`;
     const profilePath=childId?`lh_children?family_id=eq.${familyId}&id=eq.${childId}`:familyPath;
     if(action==='deleteChild'){
       if(memberRole!=='owner')throw new HttpError('Only the original parent can delete a child profile.',403);
       if(!childId)throw new HttpError('Choose an additional child profile to delete.');
       // The foreign keys remove this profile's devices and pairing links atomically.
       await db(profilePath,'DELETE',undefined,'return=minimal');
       return json({ok:true});
     }
     const profileResponse=async state=>{
       const dashboard=role==='parent'&&body.dashboard===true
         ? await db('rpc/lh_parent_dashboard','POST',{p_family:familyId,p_inbox:body.inbox===true})
         : {};
       return json({state,role,familyId,memberRole,childId:childId||'primary',...dashboard});
     };
     if(action==='addChild'){
       const name=typeof data.name==='string'?data.name.trim():'';
       if(!name||name.length>30)throw new HttpError('Enter a name of up to 30 characters.');
       if(typeof data.id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.id))throw new HttpError('Reopen the Add child form.');
       const state=blankState();
       state.settings.name=name;
       if(data.copyTasks===true){
         const [source]=await db(profilePath+'&select=tasks:state->tasks');
         if(!source)throw new HttpError('Child profile not found.',404);
         state.tasks=source.tasks.filter(task=>task.active);
       }
       await db('lh_children?on_conflict=id','POST',{id:data.id,family_id:familyId,state},'resolution=ignore-duplicates,return=minimal');
       return json({ok:true});
     }
     if(childId&&['pair','createDevice'].includes(action)){
       const [child]=await db(profilePath+'&select=id');
       if(!child)throw new HttpError('Child profile not found.',404);
     }
     if(action==='importProduct')return json({product:await importProduct(data.url,fetcher)});
     if(action==='pair'){
       const code=randomBytes(16).toString('base64url');
       await db('lh_pairings','POST',{code_hash:hash(code),family_id:familyId,created_by:userId,...(childId?{child_id:childId}:{}),expires_at:new Date(Date.now()+10*60000).toISOString()});
       return json({code});
     }
     if(action==='createDevice')return json({token:await device(familyId,userId,childId)});
     if(action==='revokeDevices'){
       await db(`lh_devices?family_id=eq.${familyId}`,'DELETE');
       await db(`lh_pairings?family_id=eq.${familyId}`,'DELETE');return json({ok:true});
     }
     const mutationId=randomUUID();
     const [familySettings]=childId?await db(familyPath+'&select=timeZone:state->settings->>timeZone,payday:state->settings->>payday'):[];

     for(let attempt=0;attempt<5;attempt++){
       const rows=await db(profilePath+'&select=state,revision');const row=rows[0];
       if(!row&&childId)return json({error:'This child profile is no longer available.',code:'CHILD_PROFILE_MISSING'},404);
       if(!row)throw new HttpError('Family space not found.',404);
       if(childId){
         if(!familySettings?.timeZone)throw new HttpError('Family settings could not be loaded.',503);
         row.state.settings.timeZone=familySettings.timeZone;
         row.state.settings.payday=Number(familySettings.payday);
       }
       if(action==='snapshot')return await profileResponse(row.state);
       const date=localDate(new Date(),row.state.settings.timeZone);
       const settings=childId&&action==='settings'
         ? {...data,timeZone:row.state.settings.timeZone,payday:row.state.settings.payday}
         : data;
       const next=applyAction(row.state,action,settings,role,date,mutationId);
       const saved=await db(`${profilePath}&revision=eq.${row.revision}`,'PATCH',{state:next,revision:row.revision+1,updated_at:new Date().toISOString()});
       if(saved.length)return await profileResponse(next);
       // A competing tablet won this revision. Re-read and re-apply every rule.
     }
     throw new HttpError('Another device is updating your adventure. Please try again.',409);
   }catch(e){
     if(e instanceof HttpError)return json({error:e.message},e.status);
     if(e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError)return json({error:'Could not connect. Your last saved progress is safe. Try again.'},503);
     return json({error:e.message||'Something went wrong. Please try again.'},400);
   }
 };
}
export default createHandler();

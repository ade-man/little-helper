// Supabase's implicit email flow returns its session in the URL fragment.
// Read it once, verify it with Auth, then remove it from browser history.
export function authCallback(href){
  const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
  const error=hash.get('error_code')||url.searchParams.get('error_code')||hash.get('error')||url.searchParams.get('error');
  if(error)return {kind:'error',code:error,message:hash.get('error_description')||url.searchParams.get('error_description')||'This email link could not be used.'};
  if(hash.has('access_token')||hash.has('refresh_token')){
    if(!hash.get('access_token')||!hash.get('refresh_token'))return {kind:'error',code:'incomplete_link',message:'This email link is incomplete. Please request a new one.'};
    const duration=Number(hash.get('expires_in'));
    return {kind:hash.get('type')==='recovery'?'recovery':'confirmation',session:{access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number.isFinite(duration)&&duration>0?Math.min(duration,86400):3600}};
  }
  return null;
}
export function cleanAuthUrl(href){
  const url=new URL(href);url.hash='';
  for(const key of ['error','error_code','error_description','flow'])url.searchParams.delete(key);
  return url.pathname+url.search;
}
export function authLinkMessage(code){
  return code==='otp_expired'||code==='access_denied'?'This email link has expired or was already used. If you confirmed your email earlier, sign in. To reset a password, request a new reset link.':'This email link could not be used. Sign in, or request a new password-reset link.';
}

export default async function () {
  const url=process.env.SUPABASE_URL;
  const anonKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
  const configured=!!(url&&anonKey&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY));
  return Response.json(configured?{configured,url,anonKey}:{configured:false},{headers:{'Cache-Control':'no-store'}});
}

import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const dir='supabase/edge';mkdirSync(dir,{recursive:true});
const api=readFileSync('netlify/functions/api.mjs','utf8').replaceAll("'../../shared/","'./").replace('export default createHandler();','');
writeFileSync(dir+'/api.mjs',api);
writeFileSync(dir+'/domain.mjs',readFileSync('shared/domain.mjs','utf8'));
writeFileSync(dir+'/product-import.mjs',readFileSync('shared/product-import.mjs','utf8'));
console.log('Edge API and rules refreshed. Redeploy the little-helpers-api function.');

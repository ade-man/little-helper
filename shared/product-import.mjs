// Only established retailers are fetched. Never turn a user-supplied URL into
// an unrestricted server-side HTTP proxy (including through redirects).
export const shops=['amazon.co.uk','amazon.com','lego.com','smythstoys.com','argos.co.uk','thetoyshop.com','johnlewis.com','hamleys.com','disneystore.co.uk','disneystore.com','shopdisney.co.uk','very.co.uk','next.co.uk','elc.co.uk','kidly.co.uk','selfridges.com','mattel.com','brio.net','haba-play.com','jadlamracingmodels.com'];
export function shopUrl(input) {
  let u;try{u=new URL(String(input));}catch{throw new Error('Paste the full product link, starting with https://.');}
  const h=u.hostname.toLowerCase().replace(/\.$/,'');
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!shops.some(s=>h===s||h.endsWith('.'+s)))throw new Error('This shop is not supported for automatic lookup yet. You can still add your toy’s details below.');
  u.hash='';return u;
}
const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',pound:'£',euro:'€',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“'};
export function textOnly(value,max=300) {
  return String(value??'').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
    if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
    return entities[key.toLowerCase()]??all;
  }).replace(/\s+/g,' ').trim().slice(0,max);
}
function attrs(tag){const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))a[m[1].toLowerCase()]=m[2]??m[3]??m[4];return a;}
function products(root,result=[],depth=0){
  if(!root||typeof root!=='object'||depth>20||result.length>100)return result;
  if(Array.isArray(root)){for(const value of root)products(value,result,depth+1);return result;}
  const types=[root['@type']].flat().filter(Boolean).map(t=>String(t).split('/').pop());
  if(types.some(t=>['Product','ProductGroup','IndividualProduct'].includes(t)))result.push(root);
  for(const value of Object.values(root))if(typeof value==='object')products(value,result,depth+1);
  return result;
}
function price(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>0?Math.round(value*100):null;
  let s=String(value??'').trim();
  if(!/^\s*[£$€]?\s*\d[\d,. ]*\s*(?:GBP|USD|EUR)?\s*$/i.test(s))return null;
  s=s.replace(/[£$€\s]|GBP|USD|EUR/gi,'');
  if(/,\d{2}$/.test(s)&&!s.includes('.'))s=s.replace(',','.');else s=s.replace(/,/g,'');
  const n=Number(s);return Number.isFinite(n)&&n>0?Math.round(n*100):null;
}
function imageUrl(value,base){
  const v=Array.isArray(value)?value[0]:value;
  const raw=typeof v==='object'&&v?(v.url||v.contentUrl):v;
  if(!raw)return '';
  try {const u=new URL(textOnly(raw,2048),base);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
  return '';
}
export function extractProduct(html,url) {
  const meta={};for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const a=attrs(m[0]);const key=(a.property||a.name||a.itemprop||'').toLowerCase();if(key&&a.content&&!meta[key])meta[key]=textOnly(a.content,2048);}
  const candidates=[];
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    const a=attrs(m[1]);if(!/application\/ld\+json/i.test(a.type||''))continue;
    try{products(JSON.parse(m[2].trim()),candidates);}catch{/* A malformed block does not hide other metadata. */}
  }
  const product=candidates[0]||{};
  const offers=[product.offers||[]].flat().flatMap(o=>Array.isArray(o?.offers)?[o,...o.offers]:[o]);
  const offer=offers.find(o=>(o.priceCurrency||o.priceSpecification?.priceCurrency||'').toUpperCase()==='GBP')||offers[0]||{};
  const rawPrice=offer.price??offer.lowPrice??offer.priceSpecification?.price??meta['product:price:amount']??meta['og:price:amount']??meta.price;
  let currency=String(offer.priceCurrency||offer.priceSpecification?.priceCurrency||meta['product:price:currency']||meta['og:price:currency']||meta.pricecurrency||'').toUpperCase();
  if(!currency&&String(rawPrice).includes('£'))currency='GBP';
  const amount=currency==='GBP'?price(rawPrice):null;
  const name=textOnly(product.name||meta['og:title']||meta['twitter:title']||html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'',60);
  const description=textOnly(product.description||meta['og:description']||meta.description||'',300);
  const image=imageUrl(product.image||meta['og:image:secure_url']||meta['og:image']||meta['twitter:image'],url);
  const warnings=[];
  if(!name)warnings.push('Add your toy’s name.');if(!image)warnings.push('This shop did not share a picture.');
  if(!amount||amount>100000)warnings.push(currency&&currency!=='GBP'?`This shop lists ${currency}. Enter the price in pounds.`:'Check the shop and enter the price in pounds.');
  return {name,description,image,price:amount&&amount<=100000?amount:null,currency:currency||null,url,importedAt:new Date().toISOString(),warning:warnings.join(' ')};
}
export async function importProduct(input,fetcher=fetch) {
  let url=shopUrl(input);const signal=AbortSignal.timeout(12000);
  try{
    for(let redirects=0;redirects<=4;redirects++){
      const res=await fetcher(url.href,{redirect:'manual',signal,headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'LittleHelpersProductPreview/1.0'}});
      if([301,302,303,307,308].includes(res.status)){
        await res.body?.cancel();const location=res.headers.get('Location');if(!location)break;
        url=shopUrl(new URL(location,url).href);continue;
      }
      if(!res.ok)throw new Error('This shop could not share its product details. You can add them below.');
      const type=res.headers.get('Content-Type')||'';
      if(!/text\/html|application\/xhtml\+xml/i.test(type))throw new Error('That link is not a product page. Try the shop’s product link, or add the details below.');
      const reader=res.body.getReader();const decoder=new TextDecoder();let html='',bytes=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2_000_000)break;html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel();}
      const data=extractProduct(html,url.href);
      if(/^(access denied|just a moment|robot check|captcha|attention required)/i.test(data.name))throw new Error('This shop could not share its product details. You can add them below.');
      if(!data.name&&!data.image&&!data.price)throw new Error('This shop needs a browser to show its toys. You can add your toy’s details below.');
      return data;
    }
    throw new Error('This link redirects too many times. Try copying the product page link again.');
  }catch(e){if(signal.aborted)throw new Error('This shop took too long to reply. You can try again or add the details below.');throw e;}
}

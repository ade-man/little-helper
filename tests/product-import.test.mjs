import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractProduct,importProduct,shopUrl} from '../shared/product-import.mjs';
import {applyAction,blankState} from '../shared/domain.mjs';
const url='https://www.lego.com/en-gb/product/example-123';
const page=data=>`<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;
const product={ '@context':'https://schema.org','@type':'Product',name:'Colourful blocks',description:'A <b>brilliant</b> set &amp; a great gift.',image:['https://images.example.com/toy.jpg'],offers:{'@type':'Offer',price:'19.99',priceCurrency:'GBP'}};

test('Extracts product image, integer-penny price and plain description from JSON-LD',()=>{
 const p=extractProduct(page(product),url);assert.equal(p.name,'Colourful blocks');assert.equal(p.price,1999);assert.equal(p.description,'A brilliant set & a great gift.');assert.equal(p.image,'https://images.example.com/toy.jpg');assert.equal(p.warning,'');
});
test('Finds Product in @graph and prefers GBP over a different currency',()=>{
 const p=extractProduct(page({'@graph':[{'@type':'WebPage'}, {...product,'@type':['Thing','Product'],offers:[{price:'25',priceCurrency:'USD'},{price:'21.50',priceCurrency:'GBP'}]}]}),url);assert.equal(p.price,2150);
});
test('Falls back to Open Graph when JSON-LD is broken; never guesses a missing price',()=>{
 const p=extractProduct('<script type="application/ld+json">{broken</script><meta content="Rainbow &amp; friends" property="og:title"><meta property="og:image" content="/toy.jpg"><meta name="description" content="A toy."><meta property="product:price:amount" content="12.49"><meta property="product:price:currency" content="GBP">',url);
 assert.equal(p.price,1249);assert.equal(p.name,'Rainbow & friends');assert.equal(p.image,'https://www.lego.com/toy.jpg');
 const missing=extractProduct('<meta property="og:title" content="My toy">',url);assert.equal(missing.image,'');assert.equal(missing.price,null);assert.match(missing.warning,/enter the price/);
});
test('Foreign or unlabelled currencies require entering a GBP target',()=>{
 for(const currency of ['USD','EUR','']){const p=extractProduct(page({...product,offers:{price:'19.99',priceCurrency:currency}}),url);assert.equal(p.price,null);}
});
test('Rejects local URLs, credentials, lookalike domains and unsupported redirects before fetching',async()=>{
 for(const u of ['http://www.lego.com/toy','https://127.0.0.1/','https://localhost/','https://www.lego.com.evil.example/toy','https://user:pass@lego.com/toy','https://lego.com:8443/toy','https://evil.example/'])assert.throws(()=>shopUrl(u));
 let calls=0;await assert.rejects(importProduct(url,async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://169.254.169.254/'}});}),/not supported/);assert.equal(calls,1);
});
test('Does not forward family credentials to shops, follows supported redirects, handles blocked shops',async()=>{
 const calls=[];const p=await importProduct(url,async(u,opts)=>{calls.push({u,opts});return calls.length===1?new Response(null,{status:301,headers:{Location:'/en-gb/product/new'}}):new Response(page(product),{headers:{'Content-Type':'text/html'}});});
 assert.equal(p.price,1999);assert.equal(calls[0].opts.redirect,'manual');assert.equal(calls[0].opts.headers.Authorization,undefined);assert.equal(p.url,'https://www.lego.com/en-gb/product/new');
 await assert.rejects(importProduct(url,async()=>new Response('Blocked',{status:403})),/could not share/);
 await assert.rejects(importProduct(url,async()=>new Response('<title>Robot Check</title>',{headers:{'Content-Type':'text/html'}})),/could not share/);
});
test('Child can set only the savings target and keeps earnings and reward rules',()=>{
 const s=blankState();const next=applyAction(s,'setGoal',{name:'My building set',price:1999,image:'https://images.example.com/toy.jpg',url,description:'A colourful toy',threshold:0},'child');
 assert.equal(next.settings.savingGoal,1999);assert.equal(next.settings.goalName,'My building set');assert.equal(next.goal.image,'https://images.example.com/toy.jpg');assert.deepEqual(next.tasks,s.tasks);assert.deepEqual(next.completions,s.completions);assert.equal(next.settings.threshold,undefined);assert.equal(next.tasks.filter(t=>t.active&&t.essential).length,4);
});
test('Saving goal rejects invalid prices and executable image/product links',()=>{
 const s=blankState();const base={name:'My toy',price:2000};
 for(const price of [0,-1,1.3,100001,NaN])assert.throws(()=>applyAction(s,'setGoal',{...base,price},'child'),/target price/);
 for(const image of ['javascript:alert(1)','data:image/svg+xml,test','http://example.com/toy.jpg','https://localhost/toy.jpg'])assert.throws(()=>applyAction(s,'setGoal',{...base,image},'child'),/public picture/);
 assert.throws(()=>applyAction(s,'setGoal',{...base,url:'javascript:alert(1)'},'child'));
});
test('Parent changing a named goal clears stale product details; price edits keep the picture',()=>{
 let s=applyAction(blankState(),'setGoal',{name:'My toy',price:1999,image:'https://images.example.com/toy.jpg'},'child');
 const same=applyAction(s,'settings',{...s.settings,savingGoal:2500},'parent');assert.equal(same.goal.price,2500);assert.equal(same.goal.image,s.goal.image);
 const changed=applyAction(s,'settings',{...s.settings,goalName:'Another toy'},'parent');assert.equal(changed.goal,null);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,applyAction,stats,taskStatus,moneyLedger} from '../shared/domain.mjs';
const friday='2026-11-13',monday='2026-11-16';
const act=(s,a,d={},day=friday)=>applyAction(s,a,d,'parent',day);
function approve(s,taskId,day=friday){s=act(s,'submit',{taskId},day);return act(s,'review',{id:taskStatus(s,s.tasks.find(t=>t.id===taskId),day).id,status:'approved'},day);}
function essentials(s,day=friday){for(const t of s.tasks.filter(t=>t.essential&&t.active))s=approve(s,t.id,day);return s;}
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('Held jobs survive rollover and require their original day, with a parent exception',()=>{
 let s=approve(blankState(friday),'table');const job=s.completions[0];
 s=essentials(s,monday);assert.equal(stats(s,monday).unpaid,0);assert.equal(stats(s,monday).totalHeld,25);
 assert.throws(()=>act(s,'payout',{},monday),/no unpaid money/);
 s=act(s,'releaseReward',{id:job.id,note:'A helpful morning'},monday);
 assert.equal(stats(s,monday).unpaid,25);assert.equal(stats(s,monday).previousUnpaid,25);
 assert.equal(s.completions[0].releaseKind,'parent');
 assert.equal(act(s,'releaseReward',{id:job.id},monday).completions[0].value,25);
});
test('Late approval of original essentials releases earlier rewards without unlocking today',()=>{
 let s=approve(blankState(friday),'table');
 for(const t of s.tasks.filter(t=>t.essential))s=act(s,'submit',{taskId:t.id});
 for(const c of s.completions.filter(c=>c.essential))s=act(s,'review',{id:c.id,status:'approved'},monday);
 assert.equal(stats(s,monday).unlocked,false);assert.equal(stats(s,monday).previousUnpaid,25);
});
test('Current-day requirements follow task changes; historical requirements and released money stay stable',()=>{
 let s=approve(blankState(friday),'table');const original=s.completions[0].requiredEssentialIds.slice();
 s=act(s,'saveTask',{title:'Make bed',essential:true,frequency:'daily',value:0});const bed=s.tasks.at(-1);
 assert.ok(s.completions[0].requiredEssentialIds.includes(bed.id));
 s=act(s,'archiveTask',{id:bed.id});assert.deepEqual(s.completions[0].requiredEssentialIds,original);
 s=act(s,'archiveTask',{id:'reading'},monday);assert.deepEqual(s.completions[0].requiredEssentialIds,original);
 s=act(s,'releaseReward',{id:s.completions[0].id},monday);
 s=act(s,'saveTask',{title:'Another routine',essential:true,frequency:'daily',value:0},monday);
 assert.equal(stats(s,monday).unpaid,25);
});
test('Retrying a weekly job on another day uses the new day’s essentials',()=>{
 let s=act(blankState(friday),'submit',{taskId:'plants'});const id=s.completions[0].id;
 s=act(s,'review',{id,status:'retry'});s=act(s,'submit',{taskId:'plants'},'2026-11-14');
 assert.equal(s.completions.length,1);assert.equal(s.completions[0].date,'2026-11-14');
 s=act(s,'review',{id,status:'approved'},'2026-11-14');s=essentials(s,friday);
 assert.equal(stats(s,friday).held,50);s=essentials(s,'2026-11-14');assert.equal(stats(s,friday).unpaid,50);
});
test('Legacy approved money and existing payouts remain intact across a new week',()=>{
 const s=blankState(friday);s.completions.push({id:'legacy',taskId:'table',date:friday,essential:false,value:75,status:'approved'});
 s.payouts.push({id:'old-payment',week:'2026-11-09',amount:25,date:friday});
 const st=stats(s,monday);assert.equal(st.remaining,0);assert.equal(st.previousUnpaid,50);assert.equal(st.unpaid,50);assert.equal(st.saved,25);
});
test('Gifts add to unpaid money without essentials; received gifts never add a debt',()=>{
 let s=act(blankState(friday),'addMoney',{title:'Grandma',amount:500,entryId:uuid(1)});
 s=act(s,'addMoney',{title:'Teacher report',amount:200,received:true,entryId:uuid(2)});
 assert.equal(stats(s,monday).unpaid,500);assert.equal(stats(s,monday).previousUnpaid,500);
 assert.equal(stats(s,monday).saved,200);assert.equal(stats(s,monday).totalEarned,700);
 s=act(s,'payout',{amount:500,paymentId:uuid(3)},monday);
 assert.equal(stats(s,monday).unpaid,0);assert.equal(stats(s,monday).saved,700);
});
test('Global partial payments allocate oldest first, include all weeks and allow supplemental payments',()=>{
 let s=act(blankState(friday),'addMoney',{title:'Previous week',amount:200});
 s=act(s,'addMoney',{title:'New week',amount:300},monday);
 s=act(s,'payout',{amount:250,paymentId:uuid(4)},monday);
 assert.deepEqual(moneyLedger(s).weeks.map(w=>[w.week,w.paid,w.remaining]),[['2026-11-09',200,0],['2026-11-16',50,250]]);
 assert.equal(stats(s,monday).unpaid,250);
 s=act(s,'addMoney',{title:'Late previous gift',amount:100,date:friday},monday);
 s=act(s,'payout',{week:'2026-11-09',amount:100,paymentId:uuid(5)},monday);
 assert.equal(stats(s,monday).previousUnpaid,0);assert.equal(stats(s,monday).unpaid,250);
 s=act(s,'payout',{},monday);assert.equal(stats(s,monday).unpaid,0);assert.equal(stats(s,monday).saved,600);
});
test('Retried gift and payment requests are idempotent and conflicts are rejected',()=>{
 const gift={title:'Grandparents',amount:400,entryId:uuid(6)};
 let s=act(blankState(friday),'addMoney',gift);s=act(s,'addMoney',gift);assert.equal(s.credits.length,1);
 assert.throws(()=>act(s,'addMoney',{...gift,amount:500}),/already recorded/);
 const payment={amount:150,paymentId:uuid(7)};s=act(s,'payout',payment);s=act(s,'payout',payment);
 assert.equal(s.payouts.length,1);assert.equal(stats(s,friday).unpaid,250);
 assert.throws(()=>act(s,'payout',{...payment,amount:200}),/already been recorded/);
});
test('Money validation prevents invalid amounts, dates, overdrafts and unapproved releases',()=>{
 const s=blankState(friday);
 for(const amount of [-1,0,1.5,NaN,Infinity,100001])assert.throws(()=>act(s,'addMoney',{title:'Gift',amount}),/amount/);
 for(const date of ['2026-02-30','2026-11-14','garbage'])assert.throws(()=>act(s,'addMoney',{title:'Gift',amount:100,date}),/earlier date/);
 assert.throws(()=>act(s,'addMoney',{title:'',amount:100}),/description/);
 assert.throws(()=>act(s,'addMoney',{title:'Gift',amount:100,entryId:'bad'}),/reference/);
 assert.throws(()=>act(s,'releaseReward',{id:'missing'}),/Approve/);
 const money=act(s,'addMoney',{title:'Gift',amount:100});
 assert.throws(()=>act(money,'payout',{amount:101}),/exceeds/);
 assert.throws(()=>act(money,'payout',{amount:1.5}),/no unpaid money/);
 assert.throws(()=>act(money,'payout',{week:'2026-11-10'}),/existing week/);
});

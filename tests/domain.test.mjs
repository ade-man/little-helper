import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,demoState,applyAction,stats,taskStatus,weekOf,localDate,moneyLedger,rewardIsReleased} from '../shared/domain.mjs';
const date='2026-11-14',nextDay='2026-11-15';
const act=(s,a,d={},r='parent',day=date)=>applyAction(s,a,d,r,day);
function finishEssentials(s,day=date){for(const t of s.tasks.filter(t=>t.active&&t.essential)){if(taskStatus(s,t,day)?.status==='approved')continue;s=act(s,'submit',{taskId:t.id},'child',day);s=act(s,'review',{id:taskStatus(s,t,day).id,status:'approved'},'parent',day);}return s;}
function ready(){return finishEssentials(blankState(date));}
function earn(s,id='table',day=date){s=act(s,'submit',{taskId:id},'child',day);return act(s,'review',{id:taskStatus(s,s.tasks.find(t=>t.id===id),day).id,status:'approved'},'parent',day);}

test('Jobs can be claimed early but all daily essentials and parent approval are required to earn',()=>{
 let s=blankState(date);s.settings.threshold=1;
 s=act(s,'submit',{taskId:'table'},'child');const paid=s.completions[0];
 assert.equal(stats(s,date).waiting,25);assert.equal(stats(s,date).unpaid,0);
 assert.throws(()=>act(s,'review',{id:paid.id,status:'approved'},'child'),/grown-up/);
 s=act(s,'review',{id:paid.id,status:'approved'});
 assert.equal(stats(s,date).held,25);assert.equal(stats(s,date).approved,0);
 for(const t of s.tasks.filter(t=>t.essential))s=act(s,'submit',{taskId:t.id},'child');
 for(const c of s.completions.filter(c=>c.essential).slice(0,3))s=act(s,'review',{id:c.id,status:'approved'});
 assert.equal(stats(s,date).essentialsDone,3);assert.equal(stats(s,date).unlocked,false);assert.equal(stats(s,date).held,25);
 s=act(s,'review',{id:s.completions.at(-1).id,status:'approved'});
 assert.equal(stats(s,date).unlocked,true);assert.equal(stats(s,date).held,0);assert.equal(stats(s,date).unpaid,25);
 assert.equal(s.completions[0].releaseKind,'essentials');
});
test('Tomorrow starts fresh essentials without removing earned money or preventing early jobs',()=>{
 let s=earn(ready());assert.equal(stats(s,date).unlocked,true);
 const tomorrow=stats(s,nextDay);assert.equal(tomorrow.essentialsDone,0);assert.equal(tomorrow.unlocked,false);assert.equal(tomorrow.approved,25);
 s=earn(s,'toys',nextDay);assert.equal(stats(s,nextDay).held,50);assert.equal(stats(s,nextDay).unpaid,25);
 s=finishEssentials(s,nextDay);assert.equal(stats(s,nextDay).unlocked,true);assert.equal(stats(s,nextDay).stars,8);assert.equal(stats(s,nextDay).unpaid,75);
});
test('Duplicate historical or same-task stars cannot substitute for another essential',()=>{
 let s=blankState(date);s.settings.threshold=0;s=act(s,'submit',{taskId:'reading'},'child');s=act(s,'review',{id:s.completions[0].id,status:'approved'});
 for(let i=0;i<10;i++)s.completions.push({...s.completions[0],id:'duplicate-'+i});
 assert.equal(stats(s,date).essentialsDone,1);assert.equal(stats(s,date).unlocked,false);assert.equal(stats(s,nextDay).essentialsDone,0);
});
test('Adding, archiving and reclassifying essentials automatically changes the current daily target',()=>{
 let s=ready();s=act(s,'saveTask',{title:'Make my bed',essential:true,value:0,frequency:'weekly',icon:'star'});
 const added=s.tasks.at(-1);assert.equal(added.frequency,'daily');assert.equal(stats(s,date).essentialsTotal,5);assert.equal(stats(s,date).essentialsDone,4);assert.equal(stats(s,date).unlocked,false);
 s=act(s,'archiveTask',{id:added.id});assert.equal(stats(s,date).essentialsTotal,4);assert.equal(stats(s,date).unlocked,true);
 s=act(s,'saveTask',{...s.tasks[0],essential:false,value:25,frequency:'weekly'});assert.equal(stats(s,date).essentialsTotal,3);assert.equal(stats(s,date).essentialsDone,3);
});
test('With no active essentials the zero-task daily requirement is satisfied',()=>{
 let s=blankState(date);for(const t of s.tasks.filter(t=>t.essential))s=act(s,'archiveTask',{id:t.id});
 assert.equal(stats(s,date).essentialsTotal,0);assert.equal(stats(s,date).essentialsDone,0);assert.equal(stats(s,date).unlocked,true);assert.doesNotThrow(()=>act(s,'submit',{taskId:'table'},'child'));
});
test('Legacy weekly essentials repeat daily and yesterday’s later approval does not unlock today',()=>{
 let s=blankState(date);s.tasks[0].frequency='weekly';s=act(s,'submit',{taskId:'reading'},'child');const yesterday=s.completions[0];
 s=act(s,'review',{id:yesterday.id,status:'approved'},'parent',nextDay);
 assert.equal(taskStatus(s,s.tasks[0],nextDay),undefined);assert.equal(stats(s,nextDay).essentialsDone,0);
 s=act(s,'submit',{taskId:'reading'},'child',nextDay);assert.equal(s.completions.length,2);assert.equal(s.completions.at(-1).date,nextDay);
});
test('Duplicate daily and weekly paid claims cannot inflate earnings after the daily unlock',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');assert.throws(()=>act(s,'submit',{taskId:'table'},'child'),/already/);
 s=act(s,'submit',{taskId:'plants'},'child');s=finishEssentials(s,nextDay);
 assert.throws(()=>act(s,'submit',{taskId:'plants'},'child',nextDay),/already/);assert.doesNotThrow(()=>act(s,'submit',{taskId:'table'},'child',nextDay));
});
test('A kind retry resubmits the same completion and snapshots agreed money',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');const claim=s.completions.at(-1),count=s.completions.length;
 s=act(s,'saveTask',{...s.tasks.find(t=>t.id==='table'),value:80});assert.equal(s.completions.at(-1).value,25);
 s=act(s,'review',{id:claim.id,status:'retry',note:'One more plate, please.'});s=act(s,'submit',{taskId:'table'},'child');
 assert.equal(s.completions.length,count);assert.equal(s.completions.at(-1).id,claim.id);assert.equal(s.completions.at(-1).value,80);assert.equal(s.completions.at(-1).status,'pending');
});
test('A valid earlier paid claim can be reviewed tomorrow without unlocking tomorrow’s essentials',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');s=act(s,'review',{id:s.completions.at(-1).id,status:'approved'},'parent',nextDay);
 assert.equal(stats(s,nextDay).approved,25);assert.equal(stats(s,nextDay).unlocked,false);
});
test('Children cannot edit tasks, settings, archive tasks or pay themselves',()=>{
 for(const a of ['saveTask','archiveTask','settings','payout','addMoney','releaseReward'])assert.throws(()=>act(ready(),a,{},'child'),/grown-up/);
});
test('Money actually given can be recorded any day, with later earnings paid separately',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');assert.throws(()=>act(s,'payout'),/no unpaid money/);
 s=act(s,'review',{id:s.completions.at(-1).id,status:'approved'});s=act(s,'payout');
 assert.equal(stats(s,date).paid,25);assert.throws(()=>act(s,'payout'),/no unpaid money/);
 s=earn(s,'toys');assert.equal(stats(s,date).unpaid,50);s=act(s,'payout');
 assert.equal(stats(s,date).paid,75);assert.equal(stats(s,'2026-11-16').saved,75);assert.equal(stats(s,'2026-11-16').unpaid,0);
});
test('Essentials remain usable and reviewable on a new day after a weekly payout',()=>{
 let s=earn(ready());s.settings.payday=6;s=act(s,'payout');s=act(s,'submit',{taskId:'teeth'},'child',nextDay);
 assert.doesNotThrow(()=>act(s,'review',{id:s.completions.at(-1).id,status:'approved'},'parent',nextDay));
});
test('Editing or archiving tasks and changing the daily target preserves approved money',()=>{
 let s=earn(ready());s=act(s,'saveTask',{...s.tasks.find(t=>t.id==='table'),essential:true,value:0,frequency:'weekly'});
 assert.equal(stats(s,date).essentialsTotal,5);assert.equal(stats(s,date).essentialsDone,5);assert.equal(stats(s,date).approved,25);
 s=act(s,'archiveTask',{id:'table'});assert.equal(stats(s,date).approved,25);assert.throws(()=>act(s,'submit',{taskId:'table'},'child'),/no longer available/);
});
test('Dates handle UK midnight, DST, Monday rollover, and year boundaries',()=>{
 assert.equal(localDate(new Date('2026-06-10T23:15:00Z'),'Europe/London'),'2026-06-11');assert.equal(localDate(new Date('2026-11-14T23:15:00Z'),'Europe/London'),'2026-11-14');
 assert.equal(weekOf('2027-01-01'),'2026-12-28');assert.equal(weekOf('2026-11-15'),'2026-11-09');assert.equal(weekOf('2026-11-16'),'2026-11-16');
 const s=finishEssentials(blankState('2026-06-10'),'2026-06-10');assert.equal(stats(s,localDate(new Date('2026-06-10T23:15:00Z'),'Europe/London')).unlocked,false);
});
test('Demo progress has no duplicate claims on any day and starts one approval short of unlocking',()=>{
 for(let d=9;d<=15;d++){const day='2026-11-'+d.toString().padStart(2,'0'),s=demoState(day),keys=s.completions.map(c=>c.taskId+c.date);assert.equal(new Set(keys).size,keys.length);assert.equal(stats(s,day).essentialsDone,3);assert.equal(stats(s,day).unlocked,false);}
});
test('Settings no longer accept a configurable unlock target; money validation is unchanged',()=>{
 const s=ready();assert.throws(()=>act(s,'saveTask',{title:'Bad money',frequency:'daily',value:1.25}),/amount/);
 const updated=act(s,'settings',{...s.settings,threshold:0});assert.equal(updated.settings.threshold,undefined);assert.equal(stats(updated,date).essentialsTotal,4);
 assert.throws(()=>act(s,'settings',{...s.settings,savingGoal:-1}),/Goals/);assert.equal(taskStatus(s,s.tasks[0],date).status,'approved');
});

test('Dated claims are restricted to today or past days of the current Monday–Sunday week',()=>{
 const today='2026-11-18',monday='2026-11-16',state=blankState(today);
 for(const date of [undefined,null,'2026-11-31','2026-11-15','2026-11-19']){
   assert.throws(()=>act(state,'submitForDate',{taskId:'reading',date},'child',today),/earlier day this week/);
 }
 const earlier=act(state,'submitForDate',{taskId:'reading',date:monday},'child',today);
 assert.equal(earlier.completions[0].date,monday);
 assert.throws(()=>act(earlier,'submitForDate',{taskId:'reading',date:monday},'child',today),/already sent/);
 const current=act(earlier,'submitForDate',{taskId:'reading',date:today},'child',today);
 assert.deepEqual(current.completions.map(c=>c.date),[monday,today]);
});

test('A returned weekly claim can be sent again from its original date in My week',()=>{
 const today='2026-11-18',monday='2026-11-16';
 let state=act(blankState(today),'submitForDate',{taskId:'plants',date:monday},'child',today);
 const {id}=state.completions[0];
 assert.throws(()=>act(state,'submitForDate',{taskId:'plants',date:today},'child',today),/already sent/);
 state=act(state,'review',{id,status:'retry'},'parent',today);
 assert.throws(()=>act(state,'submitForDate',{taskId:'plants',date:today},'child',today),/original day/);
 state=act(state,'submitForDate',{taskId:'plants',date:monday},'child',today);
 assert.deepEqual(state.completions.map(c=>[c.id,c.date,c.status]),[[id,monday,'pending']]);
 const nextWeek='2026-11-23';
 state=act(state,'review',{id,status:'approved'},'parent',nextWeek);
 assert.equal(stats(state,nextWeek).totalHeld,50);
 state=finishEssentials(state,today);
 assert.equal(stats(state,nextWeek).totalHeld,50);
 state=finishEssentials(state,monday);
 assert.equal(stats(state,nextWeek).previousUnpaid,50);
});

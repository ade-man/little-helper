import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,demoState,applyAction,stats,taskStatus,weekOf,localDate} from '../shared/domain.mjs';
const date='2026-11-14';
const act=(s,a,d={},r='parent',day=date)=>applyAction(s,a,d,r,day);
function ready(){let s=blankState(date);s.settings.threshold=1;s=act(s,'submit',{taskId:'reading'},'child');return act(s,'review',{id:s.completions[0].id,status:'approved'});}

test('Essentials unlock paid jobs only after parent approval',()=>{
 let s=blankState(date);s.settings.threshold=1;
 assert.throws(()=>act(s,'submit',{taskId:'table'},'child'),/essential stars/);
 s=act(s,'submit',{taskId:'reading'},'child');
 assert.equal(stats(s,date).stars,0);
 assert.throws(()=>act(s,'submit',{taskId:'table'},'child'),/essential stars/);
 assert.throws(()=>act(s,'review',{id:s.completions[0].id,status:'approved'},'child'),/grown-up/);
 s=act(s,'review',{id:s.completions[0].id,status:'approved'});
 assert.equal(stats(s,date).unlocked,true);
 s=act(s,'submit',{taskId:'table'},'child');assert.equal(stats(s,date).approved,0);assert.equal(stats(s,date).waiting,25);
 s=act(s,'review',{id:s.completions[1].id,status:'approved'});assert.equal(stats(s,date).approved,25);
});
test('Duplicate daily and weekly claims cannot inflate earnings',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');assert.throws(()=>act(s,'submit',{taskId:'table'},'child'),/already/);
 s=act(s,'submit',{taskId:'plants'},'child');assert.throws(()=>act(s,'submit',{taskId:'plants'},'child','2026-11-15'),/already/);
 assert.doesNotThrow(()=>act(s,'submit',{taskId:'table'},'child','2026-11-15'));
});
test('A kind retry resubmits the same completion, and snapshots agreed money',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');const id=s.completions[1].id;
 s=act(s,'saveTask',{...s.tasks.find(t=>t.id==='table'),value:80});
 assert.equal(s.completions[1].value,25);
 s=act(s,'review',{id,status:'retry',note:'One more plate, please.'});
 s=act(s,'submit',{taskId:'table'},'child');assert.equal(s.completions.length,2);assert.equal(s.completions[1].id,id);assert.equal(s.completions[1].value,80);assert.equal(s.completions[1].status,'pending');
});
test('Children cannot edit tasks, settings, archive tasks or pay themselves',()=>{
 for(const a of ['saveTask','archiveTask','settings','payout'])assert.throws(()=>act(ready(),a,{},'child'),/grown-up/);
});
test('Payouts require the right day, cleared reviews, and cannot be repeated',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');
 assert.throws(()=>act(s,'payout',{},'parent','2026-11-15'),/Review/);
 s=act(s,'review',{id:s.completions[1].id,status:'approved'});
 assert.throws(()=>act(s,'payout'),/chosen pocket-money day/);
 s=act(s,'payout',{},'parent','2026-11-15');assert.equal(stats(s,'2026-11-15').paid,25);
 assert.throws(()=>act(s,'payout',{},'parent','2026-11-15'),/already been paid/);
 assert.throws(()=>act(s,'submit',{taskId:'toys'},'child','2026-11-15'),/has been paid/);
 assert.equal(stats(s,'2026-11-16').stars,0);assert.equal(stats(s,'2026-11-16').approved,0);assert.equal(stats(s,'2026-11-16').saved,25);
});
test('Essentials remain usable and reviewable after a weekly payout',()=>{
 let s=ready();s.settings.payday=6;s=act(s,'submit',{taskId:'table'},'child');s=act(s,'review',{id:s.completions[1].id,status:'approved'});s=act(s,'payout');
 s=act(s,'submit',{taskId:'teeth'},'child');assert.doesNotThrow(()=>act(s,'review',{id:s.completions[2].id,status:'approved'}));
});
test('Editing/archiving a task preserves approved history',()=>{
 let s=ready();s=act(s,'submit',{taskId:'table'},'child');s=act(s,'review',{id:s.completions[1].id,status:'approved'});s=act(s,'archiveTask',{id:'table'});
 assert.equal(stats(s,date).approved,25);assert.throws(()=>act(s,'submit',{taskId:'table'},'child'),/no longer available/);
});
test('Dates handle UK midnight, DST, Monday rollover, and year boundaries',()=>{
 assert.equal(localDate(new Date('2026-06-10T23:15:00Z'),'Europe/London'),'2026-06-11');
 assert.equal(localDate(new Date('2026-11-14T23:15:00Z'),'Europe/London'),'2026-11-14');
 assert.equal(weekOf('2027-01-01'),'2026-12-28');assert.equal(weekOf('2026-11-15'),'2026-11-09');assert.equal(weekOf('2026-11-16'),'2026-11-16');
});
test('Demo progress has no duplicate claims on any day of the week',()=>{
 for(let d=9;d<=15;d++){const s=demoState('2026-11-'+d.toString().padStart(2,'0'));const keys=s.completions.map(c=>c.taskId+c.date);assert.equal(new Set(keys).size,keys.length);}
});
test('Money and target validation rejects fractional pennies and invalid goals',()=>{
 const s=ready();assert.throws(()=>act(s,'saveTask',{title:'Bad money',frequency:'daily',value:1.25}),/amount/);
 assert.throws(()=>act(s,'settings',{...s.settings,threshold:0}),/unlock target/);
 assert.throws(()=>act(s,'settings',{...s.settings,savingGoal:-1}),/Goals/);
 assert.equal(taskStatus(s,s.tasks[0],date).status,'approved');
});

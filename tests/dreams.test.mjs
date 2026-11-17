import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,applyAction,dreamToys,dreamProgress,moneyLedger} from '../shared/domain.mjs';
const date='2026-11-17';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const act=(s,a,data={},role='child')=>applyAction(s,a,data,role,date);
const toy=(n,price=200)=>({goalId:id(n),mode:'add',name:`Toy ${n}`,price,image:'',url:'',description:''});

test('Legacy product and manually entered targets survive adding multiple toys',()=>{
 const legacy=blankState(date);delete legacy.goals;
 legacy.goal={name:'Old dream',price:2000,image:'https://images.example.com/toy.jpg',url:'https://www.lego.com/toy',description:'Keep me'};
 let s=act(legacy,'setGoal',toy(1));
 assert.equal(s.goals.length,2);assert.equal(s.goals[0].id,'legacy-goal');assert.equal(s.goals[0].image,legacy.goal.image);assert.equal(s.goals[0].description,'Keep me');
 assert.equal(s.settings.goalName,'Old dream');assert.equal(s.goal.name,'Old dream');
 const manual=blankState(date);delete manual.goals;manual.settings.goalName='A scooter';manual.settings.savingGoal=4500;
 s=act(manual,'setGoal',toy(2));assert.equal(s.goals[0].name,'A scooter');assert.equal(s.goals[0].price,4500);
 assert.equal(legacy.goals,undefined);
});
test('Cheap and expensive toys compare the same pot, exclude held work, and never allocate money',()=>{
 let s=act(blankState(date),'addMoney',{title:'Grandma',amount:500,received:true},'parent');
 s=act(s,'addMoney',{title:'Report',amount:150},'parent');
 s.completions.push({id:'held',date,taskId:'table',essential:false,value:100,status:'approved',rewardReleased:false,requiredEssentialIds:['teeth']});
 s.completions.push({id:'pending',date,taskId:'toys',essential:false,value:100,status:'pending'});
 s=act(s,'setGoal',toy(1,200));s=act(s,'setGoal',toy(2,2000));
 const before=moneyLedger(s);
 assert.deepEqual(dreamProgress(s,s.goals[0]),{pot:650,needed:0,left:450,percent:100,affordable:true});
 assert.deepEqual(dreamProgress(s,s.goals[1]),{pot:650,needed:1350,left:0,percent:32,affordable:false});
 assert.equal(dreamProgress(s,{price:651}).percent,99);assert.deepEqual(moneyLedger(s),before);
});
test('Editing, removing, retrying a save and old-client saves preserve all other toys and financial state',()=>{
 let s=act(blankState(date),'setGoal',toy(1));s=act(s,'setGoal',toy(2,2000));s=act(s,'setGoal',toy(2,2000));assert.equal(s.goals.length,2);
 const financial={tasks:s.tasks,completions:s.completions,payouts:s.payouts,credits:s.credits};
 s=act(s,'setGoal',{...toy(2,2500),mode:'edit',name:'Bigger toy'});assert.equal(s.goals[0].name,'Toy 1');assert.equal(s.goals[1].price,2500);
 s=act(s,'setGoal',{name:'Old app changed first',price:300});assert.equal(s.goals.length,2);assert.equal(s.goals[1].name,'Bigger toy');
 s=act(s,'removeGoal',{goalId:id(1)});assert.equal(s.goal.name,'Bigger toy');assert.equal(s.settings.savingGoal,2500);
 s=act(s,'removeGoal',{goalId:id(2)});assert.equal(dreamToys(s).length,0);assert.equal(s.goal,null);
 for(const [key,value] of Object.entries(financial))assert.deepEqual(s[key],value);
 assert.throws(()=>act(s,'setGoal',{...toy(2),mode:'edit'}),/removed/);
});
test('Parent settings edit the first target and preserve all additional dreams',()=>{
 let s=act(blankState(date),'setGoal',{...toy(1),image:'https://images.example.com/first.jpg'});s=act(s,'setGoal',toy(2,2000));
 const other=structuredClone(s.goals[1]);
 s=act(s,'settings',{...s.settings,savingGoal:250},'parent');assert.equal(s.goals[0].image,'https://images.example.com/first.jpg');assert.equal(s.goals[0].price,250);assert.deepEqual(s.goals[1],other);
 s=act(s,'settings',{...s.settings,goalName:'A different first toy'},'parent');assert.equal(s.goals[0].image,'');assert.deepEqual(s.goals[1],other);
 const fresh=blankState(date);const custom=act(fresh,'settings',{...fresh.settings,goalName:'A scooter'},'parent');assert.equal(dreamToys(custom)[0].name,'A scooter');
});
test('Multiple dream validation rejects unsafe links, prices and IDs; the shelf has a bounded size',()=>{
 let s=blankState(date);
 for(const price of [0,-1,1.5,NaN,100001])assert.throws(()=>act(s,'setGoal',toy(1,price)),/target price/);
 assert.throws(()=>act(s,'setGoal',{...toy(1),goalId:'bad-id'}),/reference/);
 assert.throws(()=>act(s,'setGoal',{...toy(1),image:'javascript:alert(1)'}),/public picture/);
 assert.throws(()=>act(s,'setGoal',{...toy(1),mode:'oops'}),/add or edit/);
 for(let n=1;n<=20;n++)s=act(s,'setGoal',toy(n));
 assert.throws(()=>act(s,'setGoal',toy(21)),/shelf is full/);
 s=act(s,'removeGoal',{goalId:id(3)});assert.doesNotThrow(()=>act(s,'setGoal',toy(21)));
});

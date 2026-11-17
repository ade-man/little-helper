export const money = p => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(p/100);
export function localDate(now=new Date(),timeZone='Europe/London') {
  return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function weekOf(date) {
  const d=new Date(date+'T12:00:00Z'); const day=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-day); return d.toISOString().slice(0,10);
}
export function addDays(date,n) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function rewardIsReleased(c){return !c.essential&&c.status==='approved'&&c.rewardReleased!==false;}
export function moneyLedger(s){
  const map=new Map();const entry=week=>{if(!map.has(week))map.set(week,{week,earned:0,gifts:0,paid:0,held:0,waiting:0,remaining:0});return map.get(week);};
  for(const c of s.completions){if(c.essential)continue;const row=entry(weekOf(c.date));if(rewardIsReleased(c))row.earned+=c.value;else if(c.status==='approved')row.held+=c.value;else if(c.status==='pending')row.waiting+=c.value;}
  for(const c of s.credits||[]){const row=entry(weekOf(c.date));row.earned+=c.amount;row.gifts+=c.amount;if(c.received)row.paid+=c.amount;}
  for(const p of s.payouts)entry(p.week).paid+=p.amount;
  const weeks=[...map.values()].sort((a,b)=>a.week.localeCompare(b.week));for(const row of weeks)row.remaining=Math.max(0,row.earned-row.paid);
  const sum=key=>weeks.reduce((n,w)=>n+w[key],0);
  return {weeks,totalEarned:sum('earned'),totalPaid:sum('paid'),unpaid:sum('remaining'),totalHeld:sum('held'),totalWaiting:sum('waiting')};
}
export function dreamToys(s){
  if(Array.isArray(s.goals))return s.goals;
  if(s.goal)return [{...s.goal,id:s.goal.id||'legacy-goal'}];
  return s.settings?.goalName?[{id:'legacy-goal',name:s.settings.goalName,price:s.settings.savingGoal,image:'',url:'',description:''}]:[];
}
export function dreamProgress(s,toy){
  const pot=moneyLedger(s).totalEarned;
  return {pot,needed:Math.max(0,toy.price-pot),left:Math.max(0,pot-toy.price),percent:Math.min(100,Math.floor(pot/toy.price*100)),affordable:pot>=toy.price};
}
function syncFirstDream(s){
  s.goal=s.goals[0]||null;
  if(s.goal){s.settings.goalName=s.goal.name;s.settings.savingGoal=s.goal.price;}
}
export function stats(s,date) {
  const week=weekOf(date); const c=s.completions.filter(c=>weekOf(c.date)===week);
  const stars=c.filter(c=>c.essential&&c.status==='approved').length;
  const ledger=moneyLedger(s),row=ledger.weeks.find(w=>w.week===week)||{earned:0,paid:0,held:0,waiting:0,remaining:0};
  const essentials=s.tasks.filter(t=>t.active&&t.essential);
  const approvedToday=new Set(s.completions.filter(c=>c.date===date&&c.status==='approved').map(c=>c.taskId));
  const essentialsTotal=essentials.length,essentialsDone=essentials.filter(t=>approvedToday.has(t.id)).length;
  return {week,stars,essentialsTotal,essentialsDone,unlocked:essentialsDone===essentialsTotal,approved:row.earned,waiting:row.waiting,held:row.held,paid:row.paid,saved:ledger.totalPaid,remaining:row.remaining,unpaid:ledger.unpaid,previousUnpaid:ledger.unpaid-row.remaining,totalHeld:ledger.totalHeld,totalWaiting:ledger.totalWaiting,totalEarned:ledger.totalEarned};
}
export function taskStatus(s,t,date) {
  return s.completions.find(c=>c.taskId===t.id&&(!t.essential&&t.frequency==='weekly'?weekOf(c.date)===weekOf(date):c.date===date));
}
export function blankState(date=localDate()) {
  return {settings:{name:'little helper',weeklyGoal:500,savingGoal:1000,goalName:'an art set',payday:0,timeZone:'Europe/London'},tasks:[
    {id:'reading',title:'Read for 10 minutes',detail:'A little reading, a big adventure.',icon:'book',category:'Homework',essential:true,value:0,frequency:'daily',active:true},
    {id:'teeth',title:'Brush my teeth',detail:'Morning and bedtime. Sparkly clean!',icon:'tooth',category:'My routines',essential:true,value:0,frequency:'daily',active:true},
    {id:'tidy',title:'Shoes & coat away',detail:'Give them a home, ready for tomorrow.',icon:'coat',category:'My routines',essential:true,value:0,frequency:'daily',active:true},
    {id:'homework',title:'Finish my homework',detail:'Do the homework set by your grown-up.',icon:'pencil',category:'Homework',essential:true,value:0,frequency:'daily',active:true},
    {id:'table',title:'Set the table',detail:'Help get everything ready for dinner.',icon:'plate',category:'Family team',essential:false,value:25,frequency:'daily',active:true},
    {id:'toys',title:'Tidy the toys',detail:'Put the toys back in their happy homes.',icon:'blocks',category:'Family team',essential:false,value:50,frequency:'daily',active:true},
    {id:'plants',title:'Water the plants',detail:'Give our thirsty green friends a drink.',icon:'plant',category:'Family team',essential:false,value:50,frequency:'weekly',active:true},
    {id:'socks',title:'Match the socks',detail:'Find a matching friend for each sock.',icon:'sock',category:'Extra mile',essential:false,value:75,frequency:'weekly',active:true},
    {id:'towels',title:'Fold the towels',detail:'Make a neat, cosy stack together.',icon:'towel',category:'Extra mile',essential:false,value:75,frequency:'weekly',active:true},
    {id:'car',title:'Help wash the car',detail:'A big helping hand for a big job.',icon:'car',category:'Extra mile',essential:false,value:150,frequency:'weekly',active:true}
  ],completions:[],payouts:[],credits:[],goals:[],created:date};
}
export function demoState(date=localDate()) {
  const s=blankState(date); const week=weekOf(date);
  // Example progress always stays inside this week, even on Mondays.
  const day=Math.round((new Date(date+'T12:00Z')-new Date(week+'T12:00Z'))/86400000);
  for(let i=0;i<Math.min(6,day*4);i++) s.completions.push({id:'example-'+i,taskId:s.tasks[i%4].id,title:s.tasks[i%4].title,icon:s.tasks[i%4].icon,date:addDays(week,Math.floor(i/4)),essential:true,value:0,status:'approved',note:''});
  for(const t of s.tasks.filter(t=>t.essential&&t.id!=='teeth'))s.completions.push({id:t.id==='reading'?'example-today':'example-today-'+t.id,taskId:t.id,title:t.title,icon:t.icon,date,essential:true,value:0,status:'approved',note:''});
  s.completions.push({id:'example-review',taskId:'teeth',title:s.tasks[1].title,icon:'tooth',date,essential:true,value:0,status:'pending',note:''});
  return s;
}
function requireParent(role) {if(role!=='parent') throw new Error('A grown-up needs to do this.');}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(new Date(value+'T12:00:00Z').getTime())&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function reference(value,fallback){if(value===undefined)return fallback;if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new Error('This entry reference is not valid. Please reopen the form.');return value;}
function releaseEligibleRewards(s,date){
  const approvedByDate=new Map();for(const c of s.completions)if(c.status==='approved'){if(!approvedByDate.has(c.date))approvedByDate.set(c.date,new Set());approvedByDate.get(c.date).add(c.taskId);}
  for(const c of s.completions)if(!c.essential&&c.status==='approved'&&c.rewardReleased===false&&Array.isArray(c.requiredEssentialIds)&&c.requiredEssentialIds.every(id=>approvedByDate.get(c.date)?.has(id))){c.rewardReleased=true;c.releasedOn=date;c.releaseKind='essentials';}
}
function goalUrl(value) {
  if(!value)return '';
  try{const u=new URL(String(value));if(u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2048&&!/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)&&! /\.(local|internal|localhost)$/.test(u.hostname))return u.href;}catch{}
  throw new Error('Use a public picture or product link starting with https://.');
}
export function applyAction(state,action,data={},role='child',date=localDate(),id=globalThis.crypto.randomUUID()) {
  const s=structuredClone(state); const current=stats(s,date);
  if(action==='submit') {
    const t=s.tasks.find(t=>t.id===data.taskId&&t.active);
    if(!t) throw new Error('This job is no longer available.');
    const old=taskStatus(s,t,date);
    if(old&&old.status!=='retry') throw new Error('You have already sent this job for review.');
    const requirements=s.tasks.filter(t=>t.active&&t.essential).map(t=>t.id);
    if(old) {old.status='pending';old.note='';old.value=t.essential?0:t.value;old.date=date;if(!t.essential){old.rewardReleased=false;old.requiredEssentialIds=requirements;}}
    else s.completions.push({id,taskId:t.id,title:t.title,icon:t.icon,date,essential:t.essential,value:t.essential?0:t.value,status:'pending',note:'',...(!t.essential?{rewardReleased:false,requiredEssentialIds:requirements}:{})});
  } else if(action==='review') {
    requireParent(role); const c=s.completions.find(c=>c.id===data.id);
    if(!c||c.status!=='pending') throw new Error('This job has already been reviewed.');
    if(!['approved','retry'].includes(data.status)) throw new Error('Choose approve or try again.');
    c.status=data.status;c.note=String(data.note||'').trim().slice(0,180);
  } else if(action==='releaseReward') {
    requireParent(role);const c=s.completions.find(c=>c.id===data.id);
    if(!c||c.essential||c.status!=='approved')throw new Error('Approve the completed paid job before releasing its reward.');
    if(rewardIsReleased(c))return s;
    c.rewardReleased=true;c.releasedOn=date;c.releaseKind='parent';c.releaseNote=String(data.note||'Parent exception').trim().slice(0,180);
  } else if(action==='addMoney') {
    requireParent(role);const amount=Number(data.amount),title=String(data.title||'').trim(),on=data.date||date,entryId=reference(data.entryId,id);
    if(!Number.isSafeInteger(amount)||amount<1||amount>100000)throw new Error('Enter an amount between £0.01 and £1,000.');
    if(!title||title.length>100)throw new Error('Add a short description, such as Gift from Grandma.');
    if(!validDate(on)||on>date)throw new Error('Choose today or an earlier date.');
    if(data.received!==undefined&&typeof data.received!=='boolean')throw new Error('Choose whether the money has already been received.');
    const credit={id:entryId,amount,title,date:on,received:data.received===true};s.credits=s.credits||[];
    const old=s.credits.find(c=>c.id===entryId);if(old){if(old.amount!==credit.amount||old.title!==credit.title||old.date!==credit.date||old.received!==credit.received)throw new Error('This entry is already recorded. Refresh before adding another.');return s;}
    s.credits.push(credit);
  } else if(action==='saveTask') {
    requireParent(role);
    const title=String(data.title||'').trim(); const value=Number(data.value);
    if(!title||title.length>70) throw new Error('Give the job a name (up to 70 characters).');
    if(!Number.isInteger(value)||value<0||value>10000) throw new Error('Use an amount between £0 and £100.');
    if(!['daily','weekly'].includes(data.frequency)) throw new Error('Choose daily or weekly.');
    const t={id:data.id||id,title,detail:String(data.detail||'').trim().slice(0,180),icon:['book','tooth','coat','pencil','plate','blocks','plant','sock','towel','car','broom','star'].includes(data.icon)?data.icon:'star',category:data.essential?'My essentials':'Family team',essential:!!data.essential,value:data.essential?0:value,frequency:data.essential?'daily':data.frequency,active:true};
    const idx=s.tasks.findIndex(t=>t.id===data.id);if(idx>=0)s.tasks[idx]=t;else s.tasks.push(t);
  } else if(action==='archiveTask') {
    requireParent(role); const t=s.tasks.find(t=>t.id===data.id);if(!t)throw new Error('Job not found.');t.active=false;
  } else if(action==='setGoal') {
    const name=String(data.name||'').trim(),amount=Number(data.price);
    if(!name||name.length>60)throw new Error('Give your toy a short name (up to 60 letters).');
    if(!Number.isInteger(amount)||amount<1||amount>100000)throw new Error('Use a target price between £0.01 and £1,000.');
    const image=data.image==='/assets/toy-blocks.svg'?data.image:goalUrl(data.image);
    const goals=dreamToys(s),mode=data.mode||'legacy';
    if(!['add','edit','legacy'].includes(mode))throw new Error('Choose a toy to add or edit.');
    const goalId=data.goalId==='legacy-goal'?data.goalId:reference(data.goalId,mode==='legacy'?(goals[0]?.id||id):id);
    const index=goals.findIndex(g=>g.id===goalId);
    if(mode==='edit'&&index<0)throw new Error('This toy has been removed. Choose another dream.');
    if(index<0&&goals.length>=20)throw new Error('Your dream shelf is full! Remove a toy before adding another.');
    const goal={id:goalId,name,price:amount,image,url:goalUrl(data.url),description:String(data.description||'').trim().slice(0,300),updatedAt:date};
    if(index<0)goals.push(goal);else goals[index]=goal;
    s.goals=goals;syncFirstDream(s);
    // Dream choices never change earned money, payments or reward rules.
  } else if(action==='removeGoal') {
    s.goals=dreamToys(s).filter(g=>g.id!==data.goalId);syncFirstDream(s);
  } else if(action==='settings') {
    requireParent(role);
    const n={name:String(data.name||'').trim(),weeklyGoal:Number(data.weeklyGoal),savingGoal:Number(data.savingGoal),goalName:String(data.goalName||'').trim(),payday:Number(data.payday),timeZone:data.timeZone||s.settings.timeZone};
    if(!n.name||n.name.length>30||!n.goalName||n.goalName.length>60)throw new Error('Add a name and a short savings goal.');
    if(![n.weeklyGoal,n.savingGoal].every(v=>Number.isInteger(v)&&v>=1&&v<=100000))throw new Error('Goals must be between £0.01 and £1,000.');
    if(!Number.isInteger(n.payday)||n.payday<0||n.payday>6)throw new Error('Choose a payout day.');
    try {localDate(new Date(),n.timeZone);}catch {throw new Error('Choose a valid time zone.');}
    const goals=dreamToys(s);
    if(!goals.length&&(n.goalName!==s.settings.goalName||n.savingGoal!==s.settings.savingGoal))goals.push({id,name:n.goalName,price:n.savingGoal,image:'',url:'',description:'',updatedAt:date});
    if(goals.length){const first=goals[0],renamed=n.goalName!==first.name;goals[0]={...first,name:n.goalName,price:n.savingGoal,updatedAt:date,...(renamed?{image:'',url:'',description:''}:{})};s.goals=goals;}
    s.settings=n;if(goals.length)syncFirstDream(s);
  } else if(action==='payout') {
    requireParent(role);
    if(data.week&&(!validDate(data.week)||data.week!==weekOf(data.week)||data.week>current.week))throw new Error('Choose an existing week.');
    const ledger=moneyLedger(s),rows=ledger.weeks.filter(w=>!data.week||w.week===data.week),available=rows.reduce((n,w)=>n+w.remaining,0);
    const paymentId=reference(data.paymentId,id),amount=Number(data.amount??available),note=String(data.note||'Pocket money given').trim().slice(0,180);
    const existing=s.payouts.filter(p=>p.paymentId===paymentId);if(existing.length){if(existing.reduce((n,p)=>n+p.amount,0)!==amount)throw new Error('This payment has already been recorded.');return s;}
    if(!Number.isSafeInteger(amount)||amount<1)throw new Error('There is no unpaid money ready to be paid.');
    if(amount>available)throw new Error('That exceeds the unpaid money ready to be paid. Waiting rewards are not included.');
    let left=amount;for(const row of rows){const paid=Math.min(left,row.remaining);if(paid>0)s.payouts.push({id:paymentId+':'+row.week,paymentId,week:row.week,amount:paid,date,note});left-=paid;if(!left)break;}
  } else throw new Error('Unknown action.');
  if(action==='saveTask'||action==='archiveTask'){
    const requirements=s.tasks.filter(t=>t.active&&t.essential).map(t=>t.id);
    for(const c of s.completions)if(!c.essential&&c.date===date&&c.rewardReleased===false)c.requiredEssentialIds=requirements.slice();
  }
  releaseEligibleRewards(s,date);
  return s;
}

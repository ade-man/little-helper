export const money = p => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(p/100);
export function localDate(now=new Date(),timeZone='Europe/London') {
  return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function weekOf(date) {
  const d=new Date(date+'T12:00:00Z'); const day=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-day); return d.toISOString().slice(0,10);
}
export function addDays(date,n) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function stats(s,date) {
  const week=weekOf(date); const c=s.completions.filter(c=>weekOf(c.date)===week);
  const stars=c.filter(c=>c.essential&&c.status==='approved').length;
  const approved=c.filter(c=>!c.essential&&c.status==='approved').reduce((n,c)=>n+c.value,0);
  const waiting=c.filter(c=>!c.essential&&c.status==='pending').reduce((n,c)=>n+c.value,0);
  const paid=s.payouts.find(p=>p.week===week)?.amount||0;
  const saved=s.payouts.reduce((n,p)=>n+p.amount,0);
  return {week,stars,unlocked:stars>=s.settings.threshold,approved,waiting,paid,saved,remaining:Math.max(0,approved-paid)};
}
export function taskStatus(s,t,date) {
  return s.completions.find(c=>c.taskId===t.id&&(t.frequency==='weekly'?weekOf(c.date)===weekOf(date):c.date===date));
}
export function blankState(date=localDate()) {
  return {settings:{name:'little helper',threshold:8,weeklyGoal:500,savingGoal:1000,goalName:'an art set',payday:0,timeZone:'Europe/London'},tasks:[
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
  ],completions:[],payouts:[],created:date};
}
export function demoState(date=localDate()) {
  const s=blankState(date); const week=weekOf(date);
  // Example progress always stays inside this week, even on Mondays.
  const day=Math.round((new Date(date+'T12:00Z')-new Date(week+'T12:00Z'))/86400000);
  for(let i=0;i<Math.min(6,day*4);i++) s.completions.push({id:'example-'+i,taskId:s.tasks[i%4].id,title:s.tasks[i%4].title,icon:s.tasks[i%4].icon,date:addDays(week,Math.floor(i/4)),essential:true,value:0,status:'approved',note:''});
  s.completions.push({id:'example-today',taskId:'reading',title:s.tasks[0].title,icon:'book',date,essential:true,value:0,status:'approved',note:''});
  s.completions.push({id:'example-review',taskId:'teeth',title:s.tasks[1].title,icon:'tooth',date,essential:true,value:0,status:'pending',note:''});
  return s;
}
function requireParent(role) {if(role!=='parent') throw new Error('A grown-up needs to do this.');}
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
    if(!t.essential&&!current.unlocked) throw new Error('Finish your essential stars to unlock extra jobs.');
    if(s.payouts.some(p=>p.week===current.week)&&!t.essential) throw new Error('This week has been paid. More adventures start on Monday!');
    const old=taskStatus(s,t,date);
    if(old&&old.status!=='retry') throw new Error('You have already sent this job for review.');
    if(old) {old.status='pending';old.note='';old.value=t.essential?0:t.value;}
    else s.completions.push({id,taskId:t.id,title:t.title,icon:t.icon,date,essential:t.essential,value:t.essential?0:t.value,status:'pending',note:''});
  } else if(action==='review') {
    requireParent(role); const c=s.completions.find(c=>c.id===data.id);
    if(!c||c.status!=='pending') throw new Error('This job has already been reviewed.');
    if(!['approved','retry'].includes(data.status)) throw new Error('Choose approve or try again.');
    if(!c.essential&&s.payouts.some(p=>p.week===weekOf(c.date))) throw new Error('This week is already closed.');
    c.status=data.status;c.note=String(data.note||'').trim().slice(0,180);
  } else if(action==='saveTask') {
    requireParent(role);
    const title=String(data.title||'').trim(); const value=Number(data.value);
    if(!title||title.length>70) throw new Error('Give the job a name (up to 70 characters).');
    if(!Number.isInteger(value)||value<0||value>10000) throw new Error('Use an amount between £0 and £100.');
    if(!['daily','weekly'].includes(data.frequency)) throw new Error('Choose daily or weekly.');
    const t={id:data.id||id,title,detail:String(data.detail||'').trim().slice(0,180),icon:['book','tooth','coat','pencil','plate','blocks','plant','sock','towel','car','star'].includes(data.icon)?data.icon:'star',category:data.essential?'My essentials':'Family team',essential:!!data.essential,value:data.essential?0:value,frequency:data.frequency,active:true};
    const idx=s.tasks.findIndex(t=>t.id===data.id);if(idx>=0)s.tasks[idx]=t;else s.tasks.push(t);
  } else if(action==='archiveTask') {
    requireParent(role); const t=s.tasks.find(t=>t.id===data.id);if(!t)throw new Error('Job not found.');t.active=false;
  } else if(action==='setGoal') {
    const name=String(data.name||'').trim(),amount=Number(data.price);
    if(!name||name.length>60)throw new Error('Give your toy a short name (up to 60 letters).');
    if(!Number.isInteger(amount)||amount<1||amount>100000)throw new Error('Use a target price between £0.01 and £1,000.');
    const image=data.image==='/assets/toy-blocks.svg'?data.image:goalUrl(data.image);
    s.goal={name,price:amount,image,url:goalUrl(data.url),description:String(data.description||'').trim().slice(0,300),updatedAt:date};
    // This action intentionally changes only the child's savings target.
    s.settings.goalName=name;s.settings.savingGoal=amount;
  } else if(action==='settings') {
    requireParent(role);
    const n={name:String(data.name||'').trim(),threshold:Number(data.threshold),weeklyGoal:Number(data.weeklyGoal),savingGoal:Number(data.savingGoal),goalName:String(data.goalName||'').trim(),payday:Number(data.payday),timeZone:data.timeZone||s.settings.timeZone};
    if(!n.name||n.name.length>30||!n.goalName||n.goalName.length>60)throw new Error('Add a name and a short savings goal.');
    if(!Number.isInteger(n.threshold)||n.threshold<1||n.threshold>100)throw new Error('Choose an unlock target from 1 to 100 stars.');
    if(![n.weeklyGoal,n.savingGoal].every(v=>Number.isInteger(v)&&v>=1&&v<=100000))throw new Error('Goals must be between £0.01 and £1,000.');
    if(!Number.isInteger(n.payday)||n.payday<0||n.payday>6)throw new Error('Choose a payout day.');
    try {localDate(new Date(),n.timeZone);}catch {throw new Error('Choose a valid time zone.');}
    if(s.goal&&n.goalName!==s.settings.goalName)s.goal=null;
    else if(s.goal)s.goal={...s.goal,price:n.savingGoal};
    s.settings=n;
  } else if(action==='payout') {
    requireParent(role);
    const week=data.week||current.week;
    if(week!==weekOf(week)||week>current.week)throw new Error('Choose an existing week.');
    const st=stats(s,week);
    if(week===current.week&&new Date(date+'T12:00:00Z').getUTCDay()!==s.settings.payday)throw new Error('This week can be paid on your chosen pocket-money day.');
    if(s.payouts.some(p=>p.week===week))throw new Error('This week has already been paid.');
    if(s.completions.some(c=>weekOf(c.date)===week&&c.status==='pending'))throw new Error('Review the waiting jobs for this week first.');
    if(st.approved<=0)throw new Error('There is no approved pocket money to pay yet.');
    s.payouts.push({id,week,amount:st.approved,date});
  } else throw new Error('Unknown action.');
  return s;
}

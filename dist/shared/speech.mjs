export const DEFAULT_SPEECH={voiceURI:'',voiceName:'',voiceLang:'',rate:0.84,pitch:1.04,volume:0.85};
export function speechSettings(input={}){
 const number=(key,min,max)=>{const n=Number(input[key]);return Number.isFinite(n)&&input[key]!==undefined?Math.max(min,Math.min(max,n)):DEFAULT_SPEECH[key];};
 return {voiceURI:String(input.voiceURI||'').slice(0,300),voiceName:String(input.voiceName||'').slice(0,160),voiceLang:String(input.voiceLang||'').slice(0,30),rate:number('rate',0.65,1.1),pitch:number('pitch',0.85,1.2),volume:number('volume',0.5,1)};
}
export function chooseVoice(voices=[],preferences={}){
 const p=speechSettings(preferences);
 const selected=(p.voiceURI&&voices.find(v=>v.voiceURI===p.voiceURI))||(p.voiceName&&voices.find(v=>v.name===p.voiceName&&(!p.voiceLang||v.lang===p.voiceLang)));
 if(selected)return selected;
 const english=voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
 const score=v=>(/^en[-_]GB$/i.test(v.lang)?40:20)+(/natural|neural|enhanced|premium/i.test(v.name)?60:0)+(/sonia|serena|samantha|google uk english female/i.test(v.name)?30:0)+(v.default?2:0);
 return english.slice().sort((a,b)=>score(b)-score(a))[0]||null;
}
export function makeUtterance(text,preferences,voices,Utterance){
 const p=speechSettings(preferences),u=new Utterance(text),voice=chooseVoice(voices,p);
 if(voice)u.voice=voice;
 u.lang=voice?.lang||'en-GB';u.rate=p.rate;u.pitch=p.pitch;u.volume=p.volume;
 return u;
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseVoice,speechSettings,makeUtterance} from '../shared/speech.mjs';
const basic={name:'Basic English',voiceURI:'basic',lang:'en-GB',default:true};
const natural={name:'Sonia Natural',voiceURI:'natural',lang:'en-GB'};
const other={name:'US Natural',voiceURI:'us',lang:'en-US'};
test('Gentle automatic prefers a natural British English voice over basic and other-accent voices',()=>{
 assert.equal(chooseVoice([basic,other,natural]),natural);assert.equal(chooseVoice([basic,other]),other);assert.equal(chooseVoice([other]),other);assert.equal(chooseVoice([{name:'French',lang:'fr-FR'}]),null);assert.equal(chooseVoice([]),null);
});
test('A chosen voice is respected and an unavailable saved voice falls back gracefully',()=>{
 assert.equal(chooseVoice([basic,other,natural],{voiceURI:'us'}),other);
 assert.equal(chooseVoice([basic,other,natural],{voiceURI:'missing',voiceName:'Basic English',voiceLang:'en-GB'}),basic);
 assert.equal(chooseVoice([basic,natural],{voiceURI:'not-on-this-tablet'}),natural);
});
test('Read-aloud uses gentle defaults and applies the chosen pace and volume',()=>{
 class Utterance{constructor(text){this.text=text;}}
 const u=makeUtterance('Read my book.',{},[basic,natural],Utterance);assert.equal(u.voice,natural);assert.equal(u.lang,'en-GB');assert.equal(u.rate,.84);assert.equal(u.volume,.85);assert.equal(u.pitch,1.04);
 const custom=makeUtterance('Take your time.',{voiceURI:'basic',rate:.7,volume:.65},[basic,natural],Utterance);assert.equal(custom.voice,basic);assert.equal(custom.rate,.7);assert.equal(custom.volume,.65);
 const fallback=makeUtterance('My task.',{},[],Utterance);assert.equal(fallback.voice,undefined);assert.equal(fallback.lang,'en-GB');
});
test('Malformed device preferences cannot set an invalid speech speed or volume',()=>{
 const p=speechSettings({rate:99,volume:-1,pitch:99});assert.equal(p.rate,1.1);assert.equal(p.volume,.5);assert.equal(p.pitch,1.2);assert.equal(speechSettings({rate:'bad'}).rate,.84);
});

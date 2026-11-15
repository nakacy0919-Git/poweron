const test=require('node:test');const assert=require('node:assert/strict');const core=require('../js/practiceCore.js');
test('scenes maintain paragraph boundaries and sentence order',()=>{
 const p=[{key:'L01_P1_p1',number:1,english:'First. Second. Third.',japanese:'段落訳'},{key:'L01_P1_p2',number:2,english:'Fourth. Fifth.'}];
 const s=core.buildScenes(p,core.splitSentences);
 assert.deepEqual(s.map(x=>x.id),['L01_P1_p1_s01','L01_P1_p1_s03','L01_P1_p2_s01']);
 assert.deepEqual(s.flatMap(x=>x.sentences),['First.','Second.','Third.','Fourth.','Fifth.']);
 assert.equal(s[0].japanese,'段落訳');
});
test('long sentence remains separate and slide progress is stored',()=>{
 const long=Array(33).fill('word').join(' ')+'.';
 const s=core.buildScenes([{key:'L01_P1_p1',number:1,english:long+' Short.'}],core.splitSentences);
 assert.equal(s.length,2);
 const db=core.createProgressStore(null);const sig=core.fingerprint(s.map(x=>x.english));
 assert.equal(db.record('standard:L01_P1_full','slides',0,s.length,sig,{complete:true}),true);
 assert.equal(db.get('standard:L01_P1_full','slides',2,sig).completed[0],true);
});

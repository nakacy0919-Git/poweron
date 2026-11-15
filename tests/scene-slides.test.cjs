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


test('Lesson 8 Part 1 uses eight curated scenes and registered paths',()=>{
 const fs=require('node:fs'); const vm=require('node:vm'); const path=require('node:path');
 const dir=path.join(__dirname,'..','lessons');
 const source=fs.readFileSync(path.join(dir,'lessonData.js'),'utf8');
 const ctx=vm.createContext({});
 vm.runInContext(source+'\n;this.__lessonScripts=lessonScripts;',ctx);
 const paras=[1,2].map(number=>({number,key:'L08_P1_p'+number,english:ctx.__lessonScripts['L08_P1_p'+number]}));
 const scenes=core.buildScenes(paras,core.splitSentences,core.LESSON8_SCENE_SIZES);
 assert.deepEqual(scenes.map(s=>[s.paragraph,s.firstSentence,s.lastSentence]),[[1,1,2],[1,3,4],[2,1,1],[2,2,3],[2,4,5],[2,6,6],[2,7,8],[2,9,9]]);
 assert.deepEqual(scenes.flatMap(s=>s.sentences),paras.flatMap(p=>core.splitSentences(p.english)));
 const mediaContext=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(dir,'sceneMedia.js'),'utf8'),mediaContext);
 const plan=JSON.parse(fs.readFileSync(path.join(dir,'scene-plan.json'),'utf8')).scenes.filter(s=>s.part==='L08_P1');
 assert.deepEqual(plan.map(s=>s.id),scenes.map(s=>s.id));
 scenes.forEach((s,i)=>assert.equal(mediaContext.window.PowerOnSceneMedia[s.id].image,'lessons/lesson8/part1/images/L08_P1_'+String(i+1).padStart(2,'0')+'.webp'));
});

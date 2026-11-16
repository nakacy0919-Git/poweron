const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const core=require('../js/practiceCore.js'),games=require('../js/storyGameCore.js'),bank=require('../lessons/comprehensionData.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const data=vm.runInNewContext(read('lessons/lessonData.js')+';({lessonScripts,lessonTranslations})');
const structures={8:{1:[1,2],2:[3,4,5],3:[6,7,8],4:[9,10]},1:{1:[1,2,3]}};
function harness(){
 const mem=new Map(),nodes=Object.fromEntries(['targetTextDisplay','mainOverlay','speechResultWindow','overlayTitle','po-audio-status'].map(k=>[k,{style:{},innerHTML:'',textContent:''}]));
 const window={PowerOnPracticeCore:core,PowerOnStoryGameCore:games,PowerOnComprehension:bank,localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)}};
 vm.runInNewContext(read('lessons/sceneMedia.js'),{window});
 const ctx={window,document:{body:{classList:{add(){},remove(){}}},getElementById:k=>nodes[k]||null},currentLesson:8,currentKey:'L08_P1_full',currentLevel:'standard',currentMode:'',lessonStructure:structures,...data};
 ctx.resetAppMode=()=>{window.PowerOnPractice?.stop();ctx.currentMode='';};
 vm.runInNewContext(read('js/practice.js'),ctx);
 return {p:window.PowerOnPractice,ctx,html:()=>nodes.targetTextDisplay.innerHTML};
}
test('all Lesson 8 banks have ten distinct questions, four distinct choices and exact passage evidence',()=>{
 for(const [part,sets] of Object.entries(bank)){
  for(const rows of Object.values(sets)){
   assert.equal(rows.length,10);assert.equal(new Set(rows.map(q=>q.id)).size,10);
   for(const q of rows){
    assert.ok(data.lessonScripts[part+'_p'+q.paragraph].includes(q.evidence),q.id);
    for(const choices of Array.isArray(q.choices[0])?[q.choices.map(c=>c[0]),q.choices.map(c=>c[1])]:[q.choices])assert.equal(new Set(choices).size,4);
   }
  }
 }
});
test('all 12 quizzes gate progression, score one answer per question, allow review and record best by Part and language',()=>{
 const {p,ctx,html}=harness();
 for(let part=1;part<=4;part++){
  ctx.currentKey='L08_P'+part+'_full';
  for(const mode of ['compEn','compJa','contextVocab']){
   p.open(mode);
   for(let i=0;i<10;i++){
    assert.match(html(),new RegExp('QUESTION '+(i+1)+' / 10'));
    const ids=[...html().matchAll(/knowledgeAnswer\((\d+),(\d+)\)/g)].map(m=>Number(m[2]));
    assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
    p.knowledgeNext(i);assert.match(html(),new RegExp('QUESTION '+(i+1)+' / 10'));
    p.knowledgeAnswer(i,i===0?1:0);p.knowledgeAnswer(i,0);assert.match(html(),/本文の根拠/);p.knowledgeNext(i);
   }
   assert.match(html(),/9 \/ 10 正解/);assert.match(html(),/MISSION CLEAR/);
   const row=p.getProgress().scopes['standard:L08_P'+part+'_full'][mode];assert.equal(row.bestAccuracy,90);assert.equal(row.attempts,1);
   p.knowledgeReview();assert.match(html(),/あなたの解答/);
  }
 }
 ctx.currentKey='L08_P2_p3';p.open('compEn');for(let i=0;i<10;i++){p.knowledgeAnswer(i,0);p.knowledgeNext(i);}
 assert.equal(p.getProgress().scopes['standard:L08_P2_full'].compEn.bestAccuracy,100);
 p.open('knowledgeHub');assert.match(html(),/3 \/ 3/);
 p.open('progress');assert.match(html(),/CONTENT & VOCABULARY/);
 ctx.currentLevel='pre1';p.open('compEn');assert.match(html(),/Standard に切り替える/);
 ctx.currentLevel='standard';ctx.currentLesson=1;ctx.currentKey='L01_P1_full';p.open('compJa');assert.match(html(),/Lesson 8 へ/);
});

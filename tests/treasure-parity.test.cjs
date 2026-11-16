const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const core=require('../js/practiceCore.js');
test('Treasure style scene reading, listening and profile isolation',()=>{
 const nodes=Object.fromEntries(['mainOverlay','targetTextDisplay','speechResultWindow','overlayTitle','po-audio-status'].map(k=>[k,{style:{},innerHTML:'',textContent:''}]));
 const mem=new Map(),storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 let mic,player;class Mic{constructor(){mic=this}start(){}stop(){this.onend?.()}abort(){}}
 class Audio{constructor(url){this.url=url;player=this}play(){return Promise.resolve()}pause(){}}
 const window={PowerOnPracticeCore:core,localStorage:storage,SpeechRecognition:Mic};
 const ctx={window,Audio,document:{body:{classList:{add(){},remove(){}}},getElementById:id=>nodes[id]||null},currentLesson:1,currentKey:'L01_P1_full',currentLevel:'standard',currentMode:'',lessonStructure:{1:{1:[1,2]}},lessonScripts:{L01_P1_full:'We learn English today. Students work together to solve puzzles.',L01_P1_p1:'We learn English today.',L01_P1_p2:'Students work together to solve puzzles.'},lessonTranslations:{L01_P1_p1:'今日は英語を学びます。'}};
 ctx.resetAppMode=()=>{window.PowerOnPractice?.stop();ctx.currentMode='';};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8'),ctx);
 const p=window.PowerOnPractice,scope='standard:L01_P1_full',row=mode=>p.getProgress().scopes[scope]?.[mode];
 p.open('sceneReading');p.sceneNext(false);assert.match(nodes.targetTextDisplay.innerHTML,/Scene 1 \/ 2/);
 p.microphone();mic.onresult({results:[[{transcript:'We learn English today'}]]});mic.onend();assert.equal(row('sceneReading').scores[0],100);
 p.sceneNext(false);assert.match(nodes.targetTextDisplay.innerHTML,/Scene 2 \/ 2/);p.microphone();mic.onresult({results:[[{transcript:'Students'}]]});mic.onend();assert.ok(!row('sceneReading').completed[1]);
 p.open('listening');p.play();const stale=player.onended;p.cancelPracticeAudio();stale();assert.equal(row('listening'),undefined);
 for(let i=0;i<3;i++){p.play();player.onended();}assert.equal(row('listening').counts[0],3);assert.equal(row('listening').completed[0],true);
 p.open('progress');assert.match(nodes.targetTextDisplay.innerHTML,/th-analytics-hero/);
 function register(name){p.register({preventDefault(){},currentTarget:{elements:{namedItem:k=>({value:{class:'3-2',number:'1',name}[k]})}}});}
 register('A');assert.equal(Object.keys(p.getProgress().scopes).length,0);p.open('reading');p.markRead(true);p.open('progress');register('B');assert.equal(Object.keys(p.getProgress().scopes).length,0);p.anonymous();assert.equal(row('sceneReading').scores[0],100);
});

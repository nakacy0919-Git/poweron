const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const core=require('../js/practiceCore.js'),games=require('../js/storyGameCore.js');
test('Story Match selects, scores, and isolates stale audio',()=>{
 const nodes=Object.fromEntries(['targetTextDisplay','mainOverlay','speechResultWindow','overlayTitle','po-audio-status'].map(x=>[x,{style:{},innerHTML:'',textContent:''}]));
 const sentences=['We learn English today.','She walks to school.','They play baseball.','He likes oranges.'];let speech;
 const window={PowerOnPracticeCore:core,PowerOnStoryGameCore:games,localStorage:{getItem:()=>null,setItem(){}},speechSynthesis:{cancel(){},speak(u){speech=u}},SpeechSynthesisUtterance:class{constructor(t){this.text=t}},PowerOnSceneMedia:Object.fromEntries(sentences.map((_,i)=>['L08_P1_p'+(i+1)+'_s01',{image:'test'+i+'.webp'}]))};
 const ctx={window,document:{body:{classList:{add(){},remove(){}}},getElementById:k=>nodes[k]||null},setInterval:()=>1,clearInterval(){},currentLesson:8,currentKey:'L08_P1_full',currentLevel:'standard',currentMode:'',lessonStructure:{8:{1:[1,2,3,4]}},lessonScripts:Object.fromEntries([...sentences.map((s,i)=>['L08_P1_p'+(i+1),s]),['L08_P1_full',sentences.join(' ')]]),lessonTranslations:{}};
 ctx.resetAppMode=()=>{window.PowerOnPractice?.stop();ctx.currentMode='';};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8'),ctx);
 const p=window.PowerOnPractice,html=()=>nodes.targetTextDisplay.innerHTML,row=m=>p.getProgress().scopes['standard:L08_P1_full'][m];
 p.open('storyPuzzle');p.gameStart(3);p.gamePick(0);p.gamePlace(1);assert.match(html(),/もう一度/);for(let i=0;i<4;i++){p.gamePick(i);p.gamePlace(i)}assert.match(html(),/MISSION CLEAR/);assert.ok(Number.isFinite(row('storyPuzzle').bestSeconds));
 p.open('storyRandom');p.gameStart(3);for(let i=0;i<4;i++){const s=html().match(/<div class="po-game-prompt">([^<]+)<\/div>/)[1];p.gameAnswer(sentences.indexOf(s))}assert.ok(row('storyRandom').bestPoints>=games.target(4));
 p.open('storyListen');p.gameStart(3);assert.match(html(),/disabled/);for(let i=0;i<4;i++){p.gameSpeak();const id=sentences.indexOf(speech.text);p.gameAnswer(id);speech.onend();p.gameAnswer(id)}assert.ok(row('storyListen').bestPoints>=games.target(4));
 p.open('storyListen');p.gameStart(3);p.gameSpeak();const stale=speech.onend;p.open('progress');stale();assert.equal(p.mode(),'progress');
});

const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const core=require('../js/practiceCore.js'),games=require('../js/storyGameCore.js'),reading=require('../js/storyReading.js');
const sentences=['We learn English today.','She walks to school.','They play baseball.','He likes oranges.'];
function harness(withAudio=false,apple=false){
 let now=100000,timers=new Map(),seq=0,mic,speech;
 const nodes=Object.fromEntries(['targetTextDisplay','mainOverlay','speechResultWindow','overlayTitle','po-audio-status'].map(k=>[k,{style:{},innerHTML:'',textContent:''}]));
 const storage=new Map(),timer=(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},cancel=id=>timers.delete(id);
 class Mic{constructor(){mic=this;this.stopCalls=0;this.abortCalls=0}start(){this.onstart?.()}stop(){this.stopCalls++;this.onend?.()}abort(){this.abortCalls++;this.aborted=true}}
 class Audio{constructor(url){this.url=url}play(){this.onerror?.();return Promise.resolve()}pause(){}}
 const window={navigator:apple?{userAgent:'iPad',platform:'MacIntel',maxTouchPoints:5}:{userAgent:'Chrome',platform:'Win32',maxTouchPoints:0},PowerOnPracticeCore:core,PowerOnStoryGameCore:games,PowerOnReadingScore:reading,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},SpeechRecognition:Mic,SpeechSynthesisUtterance:class{constructor(t){this.text=t}},speechSynthesis:{cancel(){},speak(u){speech=u}},setTimeout:timer,clearTimeout:cancel,PowerOnSceneMedia:Object.fromEntries(sentences.map((s,i)=>['L08_P1_p'+(i+1)+'_s01',{image:'s'+i+'.webp',...(withAudio?{audio:'broken.mp3'}:{})}]))};
 const document={body:{classList:{add(){},remove(){}}},getElementById:k=>nodes[k]||null};
 const ctx={window,document,Audio,Date:class extends Date{static now(){return now;}},setTimeout:timer,clearTimeout:cancel,setInterval:()=>999,clearInterval(){},currentLesson:8,currentKey:'L08_P1_full',currentLevel:'standard',currentMode:'',lessonStructure:{8:{1:[1,2,3,4]}},lessonScripts:Object.fromEntries([...sentences.map((s,i)=>['L08_P1_p'+(i+1),s]),['L08_P1_full',sentences.join(' ')]]),lessonTranslations:{}};
 ctx.resetAppMode=()=>{window.PowerOnPractice?.stop();ctx.currentMode='';};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8'),ctx);
 const p=window.PowerOnPractice,html=()=>nodes.targetTextDisplay.innerHTML,run=(ms)=>{const job=[...timers.entries()].find(([,x])=>x.ms===ms);assert.ok(job,'timer '+ms);timers.delete(job[0]);job[1].fn();},advance=ms=>{now+=ms;};
 return {p,html,run,advance,mic:()=>mic,speech:()=>speech,ctx,nodes};
}
test('puzzle starts on interaction, counts hint once and rejects invalid ids',()=>{const {p,html,advance}=harness();p.open('storyHub');assert.match(html(),/Select Game Mode/);p.open('storyPuzzle');p.gameStart(3);advance(40000);p.gamePick(99);p.gamePlace(99);p.gameHint(0);p.closeHint();p.gameHint(0);p.closeHint();p.gamePick(0);p.gamePlace(1);assert.match(html(),/ミス 1回/);for(let i=0;i<4;i++){p.gamePick(i);p.gamePlace(i)}assert.match(html(),/MISSION CLEAR/);assert.equal(p.getProgress().scopes['standard:L08_P1_full'].storyPuzzle.bestSeconds,10);});
test('random ignores double answer; short practice is separate from full mission',()=>{const {p,html,run}=harness();p.open('storyRandom');p.gameStart(3,3);for(let i=0;i<3;i++){const id=sentences.indexOf(html().match(/<div class="po-game-prompt">([^<]+)<\/div>/)[1]);p.gameAnswer(id);p.gameAnswer(id);assert.match(html(),/po-answer-correct/);run(650);}const row=p.getProgress().scopes['standard:L08_P1_full'].storyRandom;assert.equal(row.bestByCount[3],300);assert.equal(row.bestPoints??null,null);assert.ok(!row.completed[0]);});
test('listening autoplay, answer lock, replay timer, wrong retry, skip and stale callback',()=>{const {p,html,run,advance,speech}=harness();p.open('storyListen');p.gameStart(3,'ALL');assert.ok(speech());let id=sentences.indexOf(speech().text);p.gameAnswer(id);assert.match(html(),/SCORE: 0/);speech().onend();advance(2000);p.gameSpeak();speech().onend();p.gameAnswer(id);assert.match(html(),/SCORE: 70/);run(650);speech().onend();id=sentences.indexOf(speech().text);const options=[...html().matchAll(/gameAnswer\((\d+)\)/g)].map(m=>Number(m[1]));p.gameAnswer(options.find(x=>x!==id));p.gameAnswer(options.find(x=>x!==id));assert.match(html(),/SCORE: 50/);run(450);p.gameAnswer(id);run(650);p.gameSkip();assert.match(html(),/Progress: 4 \/ 5/);const stale=speech().onend;p.open('storyHub');stale();assert.equal(p.mode(),'storyHub');});
test('registered audio failure falls back to speech, no premature answer',()=>{const {p,html,speech}=harness(true);p.open('storyListen');p.gameStart(3);assert.ok(speech());p.gameAnswer(sentences.indexOf(speech().text));assert.match(html(),/SCORE: 0/);speech().onend();p.gameAnswer(sentences.indexOf(speech().text));assert.match(html(),/SCORE: 100/);});
test('scene mic reconnects and accumulates speech; explicit stop; old callback ignored',()=>{const {p,html,run,mic}=harness();p.open('sceneReading');p.microphone();assert.match(html(),/終了・判定/);let a=mic();a.onresult({results:[Object.assign([{transcript:'We learn'}],{isFinal:true})]});a.onend();run(250);let b=mic();b.onresult({results:[Object.assign([{transcript:'English today'}],{isFinal:true})]});p.microphone();assert.equal(p.getProgress().scopes['standard:L08_P1_full'].sceneReading.scores[0],100);p.microphone();const stale=mic().onend;p.open('storyHub');stale();assert.equal(p.mode(),'storyHub');});
test('score names/numbers, extra words and all-name transcripts',()=>{assert.equal(reading.score('Harriet Tubman was born in 1820.','Harriet was born in eighteen twenty').percent,100);assert.equal(reading.score('We have 70 books.','We have seventy books.').percent,100);assert.ok(reading.score('We learn English today.','We learn English today extra extra extra').percent<80);assert.equal(reading.score('Harriet Tubman','Harriet Tubman').percent,0);});

test('consecutive scenes use fresh recognition and never leak earlier transcripts',()=>{
 const {p,html,mic,nodes}=harness();p.open('sceneReading');
 for(let i=0;i<sentences.length;i++){
  assert.match(html(),new RegExp('Scene '+(i+1)+' / 4'));p.microphone();const r=mic();const oldResult=r.onresult;
  r.onresult({results:[Object.assign([{transcript:sentences[i]}],{isFinal:true})]});
  p.microphone();assert.equal(p.getProgress().scopes['standard:L08_P1_full'].sceneReading.scores[i],100);
  p.sceneNext(false);oldResult({results:[Object.assign([{transcript:'old transcript'}],{isFinal:true})]});
  if(i<3){assert.match(html(),new RegExp('Scene '+(i+2)+' / 4'));assert.ok(!html().includes('old transcript'));}
 }
 assert.equal(p.mode(),'storyHub');
});
test('Part selector is direct, whole-Part and has no redundant dropdown',()=>{
 const {p,html,ctx}=harness();ctx.lessonStructure[8][2]=[1,2];p.open('storyHub');
 assert.match(html(),/storyPart\(1\)/);assert.match(html(),/storyPart\(2\)/);assert.ok(!html().includes('aria-label="段落"'));assert.ok(!html().includes('aria-label="活動を変更"'));assert.ok(!html().includes('▦ Progress'));
 p.storyPart(2);assert.match(html(),/L.*PART|LESSON 8 · P2/);assert.match(html(),/aria-pressed="true" onclick="PowerOnPractice.storyPart\(2\)/);
});
test('central feedback shows correct / retry and removes previous effect',()=>{
 const {p,ctx}=harness();let children=[];ctx.document.createElement=()=>({setAttribute(){},remove(){children=children.filter(n=>n!==this)}});ctx.document.body.appendChild=n=>children.push(n);
 p.answerFeedback(true);assert.equal(children.length,1);assert.match(children[0].innerHTML,/Correct!/);
 p.answerFeedback(false);assert.equal(children.length,1);assert.match(children[0].innerHTML,/Try Again/);
 p.stop();assert.equal(children.length,0);
});

test('iPad natural recognizer completes four successive scenes without stop or abort',()=>{
 const {p,html,mic,speech}=harness(false,true);p.open('sceneReading');assert.match(html(),/自動判定モード/);
 for(let i=0;i<4;i++){
  assert.match(html(),new RegExp('Scene '+(i+1)+' / 4'));p.microphone();
  const cue=speech();assert.equal(cue.text,'Read aloud.');cue.onend();
  const rec=mic();assert.equal(rec.continuous,false);
  rec.onaudiostart();rec.onspeechstart();const oldResult=rec.onresult;
  rec.onresult({results:[Object.assign([{transcript:sentences[i]}],{isFinal:true})]});
  assert.match(html(),/音読中・自動判定/);p.microphone();assert.equal(rec.stopCalls,0);
  rec.onend();assert.equal(p.getProgress().scopes['standard:L08_P1_full'].sceneReading.scores[i],100);
  p.sceneNext(false);assert.equal(rec.abortCalls,0);oldResult({results:[Object.assign([{transcript:'old transcript'}],{isFinal:true})]});
  assert.ok(!html().includes('old transcript'));
 }
 assert.equal(p.mode(),'storyHub');
});
test('iPad natural mode warns on missing results and supports reconnect and normal switch',()=>{
 const {p,html,mic,speech,run}=harness(false,true);p.open('sceneReading');p.microphone();speech().onend();const first=mic();run(12000);
 // A real DOM updates the status element directly; check no silent score or forced end.
 assert.equal(first.stopCalls,0);assert.equal(first.abortCalls,0);first.onend();assert.match(html(),/文字起こしがありません/);
 p.toggleMicStyle();assert.match(html(),/通常モード/);p.microphone();assert.equal(mic().continuous,true);
 mic().onresult({results:[Object.assign([{transcript:sentences[0]}],{isFinal:true})]});p.microphone();assert.equal(p.getProgress().scopes['standard:L08_P1_full'].sceneReading.scores[0],100);
});
test('cancelled speech cue cannot start an old scene recognizer',()=>{
 const {p,speech,mic}=harness(false,true);p.open('sceneReading');p.microphone();const late=speech().onend;p.open('storyHub');late();assert.equal(mic(),undefined);assert.equal(p.mode(),'storyHub');
});

test('reviewed proper nouns and regional names are excluded even at the beginning or as full expressions',()=>{for(const [expected,heard] of [["St. Catharines is a small city along the shore of Lake Ontario.","is a small city along the shore of"],["St. Catharines is a small city along the shore of Lake Ontario.","Saint Catherine is a small city along the shore of Lake Onterio"],["The city is close to the world-famous Niagara Falls.","The city is close to the world famous"],["The American Civil War started.","The started"],["Harriet Tubman was born in Maryland around 1820.","was born in around eighteen twenty"],["She used the North Star to guide her.","She used the to guide her"],["She was awarded a silver medal for bravery by Queen Victoria in 1897.","She was awarded a silver medal for bravery by in eighteen ninety seven"],["Quakers living in Philadelphia helped them.","living in helped them"],["Abraham Lincoln signed the Emancipation Proclamation in 1863.","signed the in eighteen sixty three"],["The Fugitive Slave Law of 1850 prohibited anyone from helping escaping slaves.","The of 1850 prohibited anyone from helping escaping slaves"],["Musashino Place is in Tokyo.","is in"],["Matsumoto Norio wanted to take a photo of Mt. Denali.","wanted to take a photo of"],["Shohei Otani is a baseball player.","is a baseball player"],["Halloween is celebrated in Japan.","is celebrated in"],["The Oxford English Dictionary contains many entries.","The contains many entries"]])assert.equal(reading.score(expected,heard).percent,100,expected);assert.ok(reading.score('Harriet was no longer a slave.','Harriet was a slave.').percent<100);assert.ok(reading.score('Secret stations were set up.','stations were set up.').percent<100);assert.ok(reading.score('We learn English today.','We learn today.').percent<100);assert.equal(reading.score('Harriet Tubman','Harriet Tubman').percent,0);});

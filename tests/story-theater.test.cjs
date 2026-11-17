const test=require('node:test'),fs=require('node:fs'),path=require('node:path');
const theater=require('../js/storyTheater.js');
const core=require('../js/practiceCore.js'),games=require('../js/storyGameCore.js'),reading=require('../js/storyReading.js');
test('Story Theater: manual and continuous playback, speed, captions, error, skip and stale events',()=>{

const scenes=[{english:'First scene.',japanese:'最初。'},{english:'Second scene.',japanese:'次。'}];
function eq(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(label+': '+JSON.stringify(actual)+' != '+JSON.stringify(expected));}
function sessionFixture(){
 let timers=new Map(),id=0,views=[],calls=[],stops=0,finishes=0,backs=0;
 const session=theater.createSession({scenes,rate:.85,play:(scene,rate,end,error)=>calls.push({scene,rate,end,error}),stop:()=>stops++,update:s=>views.push(s),finish:()=>finishes++,back:()=>backs++,setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:i=>timers.delete(i)});
 const run=ms=>{const e=[...timers].find(([,v])=>v.ms===ms);if(!e)throw Error('timer missing '+ms);timers.delete(e[0]);e[1].fn();};
 return {session,calls,views,run,timers,finishes:()=>finishes,backs:()=>backs,stops:()=>stops};
}
{
 const f=sessionFixture();f.session.paint();eq(f.views.at(-1).index,0,'starts first');f.session.changeRate(.65);f.session.autoplay();eq(f.calls[0].rate,.65,'rate');f.calls[0].end();f.calls[0].end();f.run(650);eq(f.calls.length,2,'advances exactly once');eq(f.calls[1].scene.english,'Second scene.','second narration');f.calls[1].end();eq(f.session.snapshot().finished,true,'completed');eq(f.session.snapshot().playing,false,'stopped');f.session.close('finish');eq(f.finishes(),1,'finish');
}
{
 const f=sessionFixture();f.session.autoplay();const late=f.calls[0].end;f.session.close('finish');late();eq(f.finishes(),1,'skip');eq(f.timers.size,0,'no stale timers');eq(f.calls.length,1,'no next narration');f.session.close('back');eq(f.backs(),0,'close idempotent');
}
{
 const f=sessionFixture();f.session.manual();let late=f.calls[0].end;f.session.navigate(1);late();eq(f.session.snapshot().index,1,'manual next');eq(f.calls.length,1,'manual does not autoplay');f.session.toggleJapanese();eq(f.session.snapshot().japanese,true,'Japanese');f.session.manual();f.calls[1].error();eq(f.session.snapshot().playing,false,'error stops');eq(Boolean(f.session.snapshot().error),true,'error shown');f.session.close('back');eq(f.backs(),1,'back');
}
{
 const f=sessionFixture();f.session.autoplay();f.run(35000);eq(f.session.snapshot().playing,false,'watchdog');eq(f.session.snapshot().index,0,'watchdog no skip');f.session.manual();f.session.pause();eq(f.timers.size,0,'pause clears timers');
}

});
test('PowerOn: selected Part, existing assets and score-free theater transition',()=>{
const practice=fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8');
new Function('core','games','reading',"\nconst sentences=['We learn English today.','She walks to school.','They play baseball.','He likes oranges.'];\nconst nodes=Object.fromEntries(['targetTextDisplay','mainOverlay','speechResultWindow','overlayTitle','po-audio-status'].map(k=>[k,{style:{},innerHTML:'',textContent:''}]));\nconst storage=new Map();let theaterConfig,disposed=0,paused=0,speech;\nconst window={PowerOnPracticeCore:core,PowerOnStoryGameCore:games,PowerOnReadingScore:reading,PowerOnStoryTheater:{open:o=>theaterConfig=o,dismiss:()=>disposed++,pause:()=>paused++},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},PowerOnSceneMedia:{L08_P1_p1_s01:{image:'s0.webp'}},SpeechSynthesisUtterance:class{constructor(t){this.text=t}},speechSynthesis:{cancel(){},speak(u){speech=u}}};\nconst document={body:{classList:{add(){},remove(){}}},getElementById:k=>nodes[k]||null};\nlet currentLesson=8,currentKey='L08_P1_full',currentLevel='standard',currentMode='';\nconst lessonStructure={8:{1:[1,2,3,4],2:[5]}},lessonScripts=Object.fromEntries([...sentences.map((s,i)=>['L08_P1_p'+(i+1),s]),['L08_P1_full',sentences.join(' ')],['L08_P2_p5','Next part.']]),lessonTranslations={L08_P1_p1:'今日は英語を学びます。'};\nfunction resetAppMode(){window.PowerOnPractice?.stop();currentMode='';}\n\n"+practice+"\nconst p=window.PowerOnPractice;\nfunction check(x,m){if(!x)throw Error(m);}\np.open('storyHub');check(nodes.targetTextDisplay.innerHTML.includes('PowerOnPractice.openTheater()'),'card launches theater');\np.openTheater();check(theaterConfig.recordedAudio==='lessons/lesson8/part1/audio/L08_P1_full.mp3','part1 recorded MP3 URL');check(theaterConfig.scenes.length===4,'whole part');check(theaterConfig.scenes[0].image==='s0.webp','registered image');check(theaterConfig.scenes[1].isCover===true,'cover fallback');check(theaterConfig.scenes[0].japanese==='今日は英語を学びます。','original Japanese');\ncheck(Object.keys(p.getProgress().scopes).length===0,'no score on opening');\ntheaterConfig.play(theaterConfig.scenes[0],.65,()=>{},()=>{});check(speech.rate===.65,'theater specific rate');theaterConfig.onFinish();check(p.mode()==='sceneReading','skip enters reading');check(nodes.targetTextDisplay.innerHTML.includes('Scene 1 / 4'),'reading starts at first unfinished');check(Object.keys(p.getProgress().scopes).length===0,'skip gives no score');\np.open('storyHub');p.storyPart(2);p.openTheater();check(theaterConfig.recordedAudio==='lessons/lesson8/part2/audio/L08_P2_full.mp3','part2 recorded MP3 URL');check(theaterConfig.title==='LESSON 8 · PART 2','part switch');check(theaterConfig.scenes[0].english==='Next part.','part content');p.stop();check(disposed>0,'teardown');\n")(core,games,reading);
});

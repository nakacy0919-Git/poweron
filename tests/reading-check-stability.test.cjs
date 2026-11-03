// node --test tests/reading-check-stability.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function app(){
 const nodes={},recognizers=[],classes=new Set(),timers=[],audio=[];
 let time=1000;
 function node(id){return nodes[id]||(nodes[id]={
  innerHTML:'',textContent:'',innerText:'',style:{},currentTime:0,
  classList:{add(){},remove(){},toggle(){}},
  addEventListener(){},play(){audio.push('play');return Promise.resolve()},
  pause(){audio.push('pause')}});}
 class Recognition{
  constructor(){recognizers.push(this)}start(){this.started=true}
  stop(){this.onend?.()}abort(){this.onend?.()}
 }
 const x={
  SpeechRecognition:Recognition,innerWidth:1024,Date:{now:()=>time},
  document:{getElementById:node,body:{classList:{
   add:s=>classes.add(s),remove:s=>classes.delete(s),
   toggle:(s,v)=>v?classes.add(s):classes.delete(s)}}},
  setTimeout(fn){const t={fn,cancelled:false};timers.push(t);return t},
  clearTimeout(t){if(t)t.cancelled=true},stopAudio(){audio.push('stop')},
  loopState:{active:false},checkCelebration(){},alert(msg){throw Error(msg)}
 };
 x.window=x;vm.createContext(x);
 for(const file of ['lessons/lessonData.js','js/state.js','js/speech.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),x,{filename:file});
 }
 vm.runInContext("function resetAppMode(){if(typeof abortSpeechSession==='function')abortSpeechSession();document.body.classList.remove('speech-active');currentMode='';}",x);
 const run=code=>vm.runInContext(code,x);
 const speak=(rec,text,final=true)=>rec.onresult({results:[{0:{transcript:text},isFinal:final}]});
 return {node,run,speak,recognizers,classes,audio,advance:n=>{time+=n},
  next:()=>{for(const t of timers.splice(0))if(!t.cancelled)t.fn();}};
}
test('Reading Check recognizes interim and final words, computes Accuracy/WPM only at finish',()=>{
 const a=app(),{run,recognizers,node,speak}=a;
 run("currentKey='L08_P1_p1';openSpeechOverlay('reading');toggleReadingRecording()");
 assert.equal(run('isMainRecording'),true);assert.equal(recognizers.length,1);
 const rec=recognizers[0];
 const results=[{0:{transcript:'St. Catharines is'},isFinal:true},{0:{transcript:'a small city'},isFinal:false}];
 rec.onresult({results});const once=run('lastSpokenText');
 rec.onresult({results});assert.equal(run('lastSpokenText'),once);
 assert.equal(node('hudAccValue').textContent,'---');
 assert.match(node('dynamicVoiceText').innerHTML,/matched-word/);
 a.advance(12000);run('toggleReadingRecording()');
 assert.equal(run('isMainRecording'),false);
 assert.notEqual(node('hudAccValue').textContent,'---');
 assert.notEqual(node('hudWpmValue').textContent,'---');
 assert.equal(node('micBtn').textContent,'RETRY');
});
test('recognizer restarts without duplicate transcript after an unexpected end',()=>{
 const a=app(),{run,recognizers,speak,next}=a;
 run("currentKey='L08_P1_p1';openSpeechOverlay('reading');toggleReadingRecording()");
 speak(recognizers[0],'St. Catharines');recognizers[0].onend();next();
 assert.equal(recognizers.length,2);
 speak(recognizers[1],'is a small city');
 assert.equal(run('lastSpokenText'),'St. Catharines is a small city');
});
test('permission denial supports retry and scope switches stop stale microphones',()=>{
 const a=app(),{run,recognizers,node,speak}=a;
 run("currentKey='L08_P1_p1';openSpeechOverlay('reading');toggleReadingRecording()");
 recognizers[0].onerror({error:'not-allowed'});
 assert.equal(run('isMainRecording'),false);
 assert.equal(node('micBtn').textContent,'RETRY');
 assert.match(node('dynamicVoiceText').textContent,/マイク/);
 run('toggleReadingRecording()');
 const old=recognizers[1];
 speak(old,'St. Catharines');
 run("currentKey='L08_P2_p4';openSpeechOverlay('reading')");
 assert.equal(run('lastSpokenText'),'');
 assert.equal(old.onresult,null);
});
test('scrambled words are not counted as a perfect reading',()=>{
 const a=app(),{run,recognizers,speak}=a;
 run("currentKey='L08_P1_p1';openSpeechOverlay('reading');targetText='The cat chased the dog';toggleReadingRecording()");
 speak(recognizers[0],'dog the chased cat the');a.advance(5000);
 run('toggleReadingRecording()');
 assert.ok(run('currentScore')<100);
});
test('Shadowing starts both microphone and model audio, then stops safely',()=>{
 const a=app(),{run,recognizers,speak,audio,node}=a;
 run("currentKey='L08_P1_p1';openSpeechOverlay('shadowing');startShadowing()");
 assert.equal(run('isMainRecording'),true);assert.ok(audio.includes('play'));
 speak(recognizers[0],'St. Catharines is a small city');
 run('stopShadowing()');
 assert.equal(run('isMainRecording'),false);
 assert.equal(node('bigShadowBtn').textContent,'RETRY');
 assert.ok(audio.includes('stop'));
});
test('iPad CSS, scope selections, competing stats and Part 4 audio path',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.match(read('css/mobile.css'),/body\.speech-active #speechResultWindow/);
 assert.match(read('js/main.js'),/currentLesson === 8 && String\(part\) === '4'/);
 assert.doesNotMatch(read('js/main.js'),/const updateStats/);
 assert.match(read('js/ui.js'),/if \(!lesson \|\| !part \|\| !paragraph\)/);
 assert.match(read('js/mobile.js'),/if \(!lesson \|\| !part \|\| !para\)/);
});

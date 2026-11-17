const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../js/practiceCore.js'),theater=require('../js/storyTheater.js');
const root=path.join(__dirname,'..');
const data={};
vm.runInNewContext(fs.readFileSync(path.join(root,'lessons/lessonData.js'),'utf8')+';this.scripts=lessonScripts;',data);
const media={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'lessons/sceneMedia.js'),'utf8'),media);
const registry=media.window.PowerOnSceneMedia;
test('Lesson 8 Parts 1 and 2 map all 20 MP3 files to their unchanged scene IDs and images',()=>{
  let total=0;
  for(const [part,expected] of [[1,8],[2,12]]){
    const keys=Object.keys(core.LESSON8_SCENE_SIZES).filter(key=>key.startsWith('L08_P'+part+'_'));
    const paras=keys.map(key=>({key,number:Number(key.split('_p')[1]),english:data.scripts[key]}));
    const scenes=core.buildScenes(paras,core.splitSentences,core.LESSON8_SCENE_SIZES);
    assert.equal(scenes.length,expected);
    scenes.forEach((scene,i)=>{
      const filename='L08_P'+part+'_'+String(i+1).padStart(2,'0');
      const item=registry[scene.id];
      assert.ok(item,'Missing media for '+scene.id);
      assert.equal(item.image,'lessons/lesson8/part'+part+'/images/'+filename+'.webp');
      assert.equal(item.audio,'lessons/lesson8/part'+part+'/audio/scenes/'+filename+'.mp3');
      const binary=fs.readFileSync(path.join(root,item.audio));
      assert.ok(binary.length>5000,'Audio suspiciously small: '+filename);
      assert.ok(binary.toString('ascii',0,3)==='ID3'||(binary[0]===255&&(binary[1]&224)===224),'Invalid MP3: '+filename);
      total++;
    });
  }
  assert.equal(total,20);
  // No changes to the unreleased audio of Parts 3 and 4.
  for(const [id,entry] of Object.entries(registry)){
    if(/^L08_P[34]_/.test(id))assert.equal(entry.audio,undefined,'Part 3/4 unchanged '+id);
  }
});
test('Story Theater plays each scene-specific MP3 and advances only when that MP3 ends',()=>{
  const clips=Array.from({length:3},(_,i)=>({english:'Scene '+(i+1)+'.',audio:'L08_P1_0'+(i+1)+'.mp3'}));
  const calls=[],recorded=[],views=[],timers=new Map();let timerId=0,stops=0;
  const session=theater.createSession({scenes:clips,
    play:(scene,rate,onEnd,onError)=>calls.push({scene,rate,onEnd,onError}),
    playRecorded:(...args)=>recorded.push(args),
    stop:()=>stops++,update:s=>views.push(s),finish:()=>{},back:()=>{},
    setTimer:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},
    clearTimer:id=>timers.delete(id)
  });
  const advance=()=>{
    const match=[...timers].find(([,item])=>item.ms===650);
    assert.ok(match,'Auto-advance timer missing');
    timers.delete(match[0]);match[1].fn();
  };
  session.autoplay();
  assert.equal(recorded.length,0,'Part-level MP3 must not override scene MP3');
  assert.equal(calls.length,1);assert.equal(calls[0].scene.audio,clips[0].audio);
  calls[0].onEnd();assert.equal(calls.length,1,'Next scene must wait for the current MP3 to end');
  advance();assert.equal(calls[1].scene.audio,clips[1].audio);
  calls[1].onEnd();advance();assert.equal(calls[2].scene.audio,clips[2].audio);
  calls[2].onEnd();assert.equal(session.snapshot().finished,true);
  session.navigate(-1);session.manual();
  assert.equal(calls[3].scene.audio,clips[1].audio);
  session.pause();calls[3].onEnd();
  assert.equal(calls.length,4,'Late callbacks must not start another MP3');
  assert.equal(timers.size,0);
  assert.ok(stops>=4);
});
test('existing Part recording remains the fallback when per-scene MP3 is not registered',()=>{
  const recorded=[],tts=[];
  const session=theater.createSession({scenes:[{english:'Unregistered scene.'}],
    play:(...args)=>tts.push(args),playRecorded:(...args)=>recorded.push(args),stop:()=>{},update:()=>{},finish:()=>{},back:()=>{},
    setTimer:()=>1,clearTimer:()=>{}});
  session.manual();assert.equal(recorded.length,1);assert.equal(tts.length,0);
});

test('reuses one Audio element for sequential scene MP3s (Safari/iPad) and ignores stale completion',()=>{
  const created=[],calls=[];
  class Audio {
    constructor(){created.push(this);this.paused=true;this.onended=null;this.onerror=null;}
    play(){this.paused=false;calls.push(this.src);return Promise.resolve();}
    pause(){this.paused=true;}
  }
  const player=theater.createSceneClipPlayer({Audio});
  let finished=0,failed=0;
  player.play({url:'L08_P1_01.mp3',rate:.85,onEnd:()=>finished++,onError:()=>failed++});
  assert.equal(created.length,1);assert.equal(calls[0],'L08_P1_01.mp3');
  const stale=created[0].onended;
  player.play({url:'L08_P1_02.mp3',rate:1,onEnd:()=>finished++,onError:()=>failed++});
  assert.equal(created.length,1,'Do not create a new Audio element');
  assert.equal(created[0].src,'L08_P1_02.mp3');
  stale();assert.equal(finished,0,'Old ended event must not advance current scene');
  created[0].onended();assert.equal(finished,1);
  player.play({url:'L08_P1_03.mp3',rate:.65,onEnd:()=>finished++,onError:()=>failed++});
  player.stop();assert.equal(created[0].paused,true);
  assert.equal(created[0].onended,null);assert.equal(failed,0);
});

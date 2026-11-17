const test=require('node:test'),assert=require('node:assert/strict');
const theater=require('../js/storyTheater.js');
const scenes=[{english:"The first example sentence is very short."},{english:"The second is a much longer sentence, with more words."},{english:"The third is the final one."}];
class FakeAudio{
  static created=[];
  constructor(url){this.src=url;this.currentTime=0;this.duration=100;this.playbackRate=1;this.paused=true;FakeAudio.created.push(this);}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
}
test('recorded narration uses a single real MP3 across an entire Part and changes scenes',()=>{
  FakeAudio.created.length=0;
  const cuts=theater.sceneBoundaries(scenes);
  assert.equal(cuts.length,scenes.length+1);
  assert.ok(cuts[0]===0&&cuts.at(-1)===1&&cuts[1]<cuts[2]);
  const indexes=[];let complete=0,errors=0;
  const stream=theater.playRecordedAudio({Audio:FakeAudio},{url:'lessons/lesson8/part1/audio/L08_P1_full.mp3',scenes,startIndex:0,endIndex:3,rate:.85,onScene:i=>indexes.push(i),onEnd:()=>complete++,onError:()=>errors++});
  assert.equal(FakeAudio.created.length,1);
  assert.equal(stream.player.src,'lessons/lesson8/part1/audio/L08_P1_full.mp3');
  assert.equal(stream.player.playbackRate,.85);
  stream.player.onloadedmetadata();
  for(let i=1;i<3;i++){stream.player.currentTime=stream.player.duration*(cuts[i]+cuts[i+1])/2;stream.player.ontimeupdate();}
  stream.player.onended();
  assert.deepEqual(indexes,[0,1,2]);assert.equal(complete,1);assert.equal(errors,0);
  assert.equal(stream.player.paused,true);stream.stop();assert.equal(complete,1);
});
test('manual recorded playback seeks to the selected estimated scene and stops at its boundary',()=>{
  const cuts=theater.sceneBoundaries(scenes);let complete=0;
  const stream=theater.playRecordedAudio({Audio:FakeAudio},{url:'lesson.mp3',scenes,startIndex:1,endIndex:2,rate:.65,onScene:()=>{},onEnd:()=>complete++,onError:e=>{throw e}});
  stream.player.onloadedmetadata();
  assert.ok(Math.abs(stream.player.currentTime-100*cuts[1])<.01);
  stream.player.currentTime=100*cuts[2];stream.player.ontimeupdate();
  assert.equal(complete,1);assert.equal(stream.player.paused,true);
});
test('failed recorded audio falls back to scene speech and closed sessions ignore stale events',()=>{
  const callbacks=[],recorded=[],timers=new Map();let id=0,closed=0,stops=0;
  const run=theater.createSession({scenes,rate:.85,
    play:(scene,rate,end,error)=>callbacks.push({scene,rate,end,error}),
    playRecorded:(start,end,rate,onScene,onEnd,onError)=>recorded.push({start,end,rate,onScene,onEnd,onError}),
    stop:()=>stops++,update:()=>{},finish:()=>closed++,back:()=>{},
    setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:i=>timers.delete(i)
  });
  run.autoplay();assert.equal(recorded.length,1);assert.equal(recorded[0].end,3);
  recorded[0].onScene(1);assert.equal(run.snapshot().index,1);
  recorded[0].onError(new Error('NotFound'));
  assert.equal(callbacks.length,1);assert.equal(run.snapshot().playing,true);
  callbacks[0].end();assert.equal(run.snapshot().index,1);
  run.close('finish');recorded[0].onEnd();assert.equal(closed,1);assert.ok(stops>=1);
  assert.equal(timers.size,0);
});
test('cancelled media promise or late error never alters completed session',async()=>{
  let rejectPlay,errors=0;class RejectAudio extends FakeAudio{play(){return new Promise((resolve,reject)=>{rejectPlay=reject;});}}
  const media=theater.playRecordedAudio({Audio:RejectAudio},{url:'part.mp3',scenes,startIndex:0,endIndex:3,rate:1,onScene:()=>{},onEnd:()=>{},onError:()=>errors++});
  media.stop();rejectPlay(new Error('NotAllowedError'));await Promise.resolve();await Promise.resolve();
  assert.equal(errors,0);
});

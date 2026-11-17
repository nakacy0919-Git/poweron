const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../js/practiceCore.js');
const fs=require('node:fs');
const path=require('node:path');

const SCOPE='standard:L08_P3_full';
function fixture(profile='3-2/01'){
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  const key='poweron_study_progress_v1:'+profile;
  const store=core.createProgressStore(storage,key);
  return {data,storage,key,store};
}
function record(store,mode,sig,options,{scope=SCOPE,count=1,index=0}={}){
  assert.equal(store.record(scope,mode,index,count,sig,options),true);
}
test('legacy progress schema is kept; opening the new store never deletes or resets learner scores',()=>{
  const {data,storage,key}=fixture();
  const old={version:1,scopes:{[SCOPE]:{
    storyPuzzle:{fingerprint:'old',total:1,completed:{0:true},attempts:2,bestSeconds:14.2,bestByLevel:{3:14.2}},
    storyRandom:{fingerprint:'old',total:1,completed:{0:true},attempts:3,bestPoints:420,bestByCount:{12:420}},
    storyListen:{fingerprint:'old',total:1,completed:{0:true},attempts:1,bestPoints:390,bestByCount:{12:390}},
    sceneReading:{fingerprint:'text',total:2,completed:{0:true,1:true},attempts:9,bestAccuracy:94,scores:{0:88,1:94}}
  }}};
  data.set(key,JSON.stringify(old));
  const reopened=core.createProgressStore(storage,key);
  assert.equal(reopened.get(SCOPE,'storyPuzzle',1,'old').bestSeconds,14.2);
  assert.equal(reopened.get(SCOPE,'storyRandom',1,'old').bestPoints,420);
  assert.equal(reopened.get(SCOPE,'storyListen',1,'old').bestPoints,390);
  assert.deepEqual(reopened.get(SCOPE,'sceneReading',2,'text').scores,{0:88,1:94});
  assert.equal(reopened.snapshot().version,1);
  assert.equal(data.get(key),JSON.stringify(old));
});
test('Story Puzzle keeps the best (lowest) time through bad retries and changed images/text',()=>{
  const {store,storage,key}=fixture();
  record(store,'storyPuzzle','image-v1',{attempt:true,complete:true,seconds:12.7,gameLevel:3});
  record(store,'storyPuzzle','image-v1',{attempt:true,complete:false,seconds:60,gameLevel:3});
  record(store,'storyPuzzle','image-v1',{attempt:true,complete:false,seconds:20.1,gameLevel:1});
  assert.equal(store.get(SCOPE,'storyPuzzle',1,'image-v1').bestSeconds,12.7);
  assert.equal(store.get(SCOPE,'storyPuzzle',1,'image-v1').bestByLevel[1],20.1);
  record(store,'storyPuzzle','image-v2',{attempt:true,complete:false,seconds:43,gameLevel:3});
  const now=store.get(SCOPE,'storyPuzzle',1,'image-v2'),before=store.get(SCOPE,'storyPuzzle',1,'image-v1');
  assert.equal(now.bestSeconds,12.7);
  assert.equal(now.bestByLevel[3],12.7);
  assert.equal(now.bestByLevel[1],20.1);
  assert.equal(now.completed[0],undefined,'old lessons cannot falsely mark new scenes complete');
  assert.equal(before.completed[0],true,'original scene is still completed');
  assert.equal(before.attempts,3,'original three attempts retained');
  assert.ok(store.snapshot().archives[SCOPE].storyPuzzle['v1:image-v1']);
  assert.equal(JSON.parse(storage.getItem(key)).scopes[SCOPE].storyPuzzle.fingerprint,'image-v2');
  record(store,'storyPuzzle','image-v1',{attempt:true,complete:false,seconds:15,gameLevel:3});
  assert.equal(store.get(SCOPE,'storyPuzzle',1,'image-v1').attempts,4,'original version resumes old count');
  assert.equal(store.get(SCOPE,'storyPuzzle',1,'image-v2').attempts,1,'new version still preserved');
  assert.equal(store.get(SCOPE,'storyPuzzle',1,'image-v2').bestSeconds,12.7);
});
test('Story Random keeps highest points for full missions and by question count, even across versions',()=>{
  const {store}=fixture();
  record(store,'storyRandom','v1',{attempt:true,complete:true,points:560,full:true,questionCount:12});
  record(store,'storyRandom','v1',{attempt:true,complete:false,points:210,full:true,questionCount:12});
  record(store,'storyRandom','v2',{attempt:true,complete:false,points:380,full:true,questionCount:12});
  record(store,'storyRandom','v2',{attempt:true,points:420,full:false,questionCount:5});
  const best=store.get(SCOPE,'storyRandom',1,'v2');
  assert.equal(best.bestPoints,560);
  assert.equal(best.bestByCount[12],560);
  assert.equal(best.bestByCount[5],420);
  assert.equal(store.get(SCOPE,'storyRandom',1,'v1').attempts,2);
});
test('Story Listening preserves all-time high points and short/long course records',()=>{
  const {store}=fixture();
  record(store,'storyListen','v1',{attempt:true,complete:true,points:510,full:true,questionCount:12});
  record(store,'storyListen','v1',{attempt:true,complete:false,points:260,full:false,questionCount:5});
  record(store,'storyListen','v2',{attempt:true,complete:false,points:330,full:true,questionCount:12});
  const row=store.get(SCOPE,'storyListen',1,'v2');
  assert.equal(row.bestPoints,510);
  assert.equal(row.bestByCount[12],510);
  assert.equal(row.bestByCount[5],260);
  assert.equal(store.history(SCOPE,'storyListen').length,2);
});
test('Reading preserves per-scene personal bests, and archives old text without misassigning its scores',()=>{
  const {store}=fixture();
  record(store,'sceneReading','original',{attempt:true,accuracy:91,complete:true},{count:3,index:0});
  record(store,'sceneReading','original',{attempt:true,accuracy:56,complete:false},{count:3,index:0});
  record(store,'sceneReading','original',{attempt:true,accuracy:98,complete:true},{count:3,index:1});
  assert.deepEqual(store.get(SCOPE,'sceneReading',3,'original').scores,{0:91,1:98});
  assert.equal(store.get(SCOPE,'sceneReading',3,'original').bestAccuracy,98);
  record(store,'sceneReading','changed-text',{attempt:true,accuracy:79,complete:true},{count:3,index:0});
  const next=store.get(SCOPE,'sceneReading',3,'changed-text');
  assert.equal(next.bestAccuracy,98,'old bestAccuracy remains visible as historic best');
  assert.deepEqual(next.scores,{0:79},'old scene scores must not silently apply to different text');
  assert.equal(next.completed[1],undefined,'old scene completion must not falsely transfer');
  assert.deepEqual(store.get(SCOPE,'sceneReading',3,'original').scores,{0:91,1:98});
  assert.equal(store.history(SCOPE,'sceneReading').length,2);
});
test('Changes to scene count also preserve historic records; returning to old total restores them',()=>{
  const {store}=fixture();
  record(store,'sceneReading','same-text',{attempt:true,accuracy:87,complete:true},{count:2,index:1});
  record(store,'sceneReading','same-text',{attempt:true,accuracy:60,complete:false},{count:3,index:1});
  assert.equal(store.get(SCOPE,'sceneReading',2,'same-text').scores[1],87);
  assert.equal(store.get(SCOPE,'sceneReading',3,'same-text').scores[1],60);
  assert.equal(store.get(SCOPE,'sceneReading',3,'same-text').bestAccuracy,87);
});
test('The four histories and best scores remain intact after closing, reload, and other modes writing',()=>{
  const {store,storage,key}=fixture();
  for(const [mode,options] of [
    ['storyPuzzle',{attempt:true,seconds:19,gameLevel:3}],
    ['storyRandom',{attempt:true,points:450,full:true,questionCount:10}],
    ['storyListen',{attempt:true,points:390,full:true,questionCount:10}],
    ['sceneReading',{attempt:true,accuracy:93}]
  ])record(store,mode,'before',options);
  const snapshot=store.snapshot();
  record(store,'puzzle','independent',{attempt:true,complete:true});
  assert.deepEqual(store.snapshot().scopes[SCOPE].storyPuzzle,snapshot.scopes[SCOPE].storyPuzzle);
  const reloaded=core.createProgressStore(storage,key);
  assert.equal(reloaded.get(SCOPE,'storyPuzzle',1,'after').bestSeconds,19);
  assert.equal(reloaded.get(SCOPE,'storyRandom',1,'after').bestPoints,450);
  assert.equal(reloaded.get(SCOPE,'storyListen',1,'after').bestPoints,390);
  assert.equal(reloaded.get(SCOPE,'sceneReading',1,'after').bestAccuracy,93);
  assert.deepEqual(JSON.parse(storage.getItem(key)).scopes[SCOPE].sceneReading,snapshot.scopes[SCOPE].sceneReading);
});
test('Different learner and Part keys never receive another learner’s scores',()=>{
  const db=new Map(),storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)};
  const a=core.createProgressStore(storage,'poweron_study_progress_v1:["class A","1","A"]');
  const b=core.createProgressStore(storage,'poweron_study_progress_v1:["class A","2","B"]');
  record(a,'storyRandom','v1',{attempt:true,points:500,full:true,questionCount:10});
  assert.equal(b.get(SCOPE,'storyRandom',1,'v1').bestPoints,null);
  assert.equal(a.get('standard:L08_P4_full','storyRandom',1,'v1').bestPoints,null);
  assert.equal(a.get(SCOPE,'storyRandom',1,'v1').bestPoints,500);
});
test('A denied localStorage write is reported instead of claiming durable saving',()=>{
  const store=core.createProgressStore({
    getItem:()=>null,setItem:()=>{throw Error('quota or private mode');}
  },'denied');
  record(store,'storyPuzzle','v1',{attempt:true,seconds:30,gameLevel:3});
  assert.equal(store.get(SCOPE,'storyPuzzle',1,'v1').bestSeconds,30);
  assert.equal(store.isPersistent(),false);
});
test('Progress screen exposes an offline full JSON backup containing version histories',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8');
  assert.ok(code.includes("PowerOnPractice.exportBackup()"));
  assert.ok(code.includes("format:\"poweron-story-match-backup\""));
  assert.ok(code.includes("progress:store.snapshot()"));
  assert.ok(code.includes("exportBackup:exportBackup"));
});

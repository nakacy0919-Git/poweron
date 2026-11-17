/* Course mastery regression: run with node --test tests/course-mastery.test.cjs */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const core=require("../js/courseCore.js");
const theater=require("../js/storyTheater.js");
const legacy=require("../lessons/comprehensionData.js");
const source=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
function data(){
  const x={};vm.runInNewContext(source("lessons/courseQuestions.js"),x);
  vm.runInNewContext(source("lessons/lessonData.js")+"\n;globalThis.TEST_VOCAB=lessonVocab;",x);
  return {questions:x.PowerOnCourseQuestionBank,vocab:x.TEST_VOCAB};
}
function correct(quiz){return quiz.map(x=>x.correct);}
test("All 12 Lesson 8–10 Parts support a real 10-question content challenge and scored vocabulary quiz",()=>{
  const {questions,vocab}=data();
  assert.equal(questions.length,212);
  for(const lesson of [8,9,10])for(const part of [1,2,3,4]){
    const content=core.questionPool(lesson,part,questions,legacy),words=core.createVocabularyQuiz(lesson,part,vocab,()=>.31);
    assert.ok(content.length>=10,"L"+lesson+" P"+part+" content");
    assert.ok(words.length>=4,"L"+lesson+" P"+part+" vocabulary");
    for(const q of words){
      assert.equal(q.en[1].length,4);
      assert.equal(new Set(q.ja[1]).size,4);
      assert.equal(q.en[1][q.correct],q.ja[1][q.correct]);
    }
  }
});
test("10/10 clears; a 5/5 practice run does not unlock the mission",()=>{
  const {questions}=data(),pool=core.questionPool(9,1,questions,legacy);
  const state=core.initial(),five=core.createQuiz(pool,{count:5,random:()=>.24});
  assert.equal(core.updateQuiz(state,"mastery","comprehension",five,correct(five),[4,4,4,4,4]).clear,false);
  assert.equal(state.done.mastery.comprehension,undefined);
  const ten=core.createQuiz(pool,{count:10,random:()=>.33});
  assert.equal(core.updateQuiz(state,"mastery","comprehension",ten,correct(ten),Array(10).fill(4)).clear,true);
  assert.equal(state.done.mastery.comprehension,true);
});
test("Slow correct responses reduce mastery but cannot cause a fail; wrong retries lower current mastery and retain best",()=>{
  const {questions}=data(),pool=core.questionPool(10,2,questions,legacy),q=core.createQuiz(pool,{count:10,random:()=>.22});
  const state=core.initial();
  const slow=core.updateQuiz(state,"speed","comprehension",q,correct(q),Array(10).fill(90));
  assert.equal(slow.clear,true);
  const fast=core.updateQuiz(state,"speed","comprehension",q,correct(q),Array(10).fill(3));
  assert.ok(fast.mastery>slow.mastery);
  const answers=correct(q);answers[2]=(answers[2]+1)%4;
  const failed=core.updateQuiz(state,"speed","comprehension",q,answers,Array(10).fill(3));
  assert.ok(failed.mastery<fast.mastery);
  assert.equal(state.best.speed,100);
  assert.equal(state.done.speed.comprehension,false);
  assert.deepEqual(state.pendingWrong.speed,[q[2].id]);
});
test("Wrong answers are corrected by a real review quiz, not by checking a box",()=>{
  const {questions}=data(),pool=core.questionPool(8,3,questions,legacy),q=core.createQuiz(pool,{count:10,random:()=>.33});
  const state=core.initial(),answers=correct(q);answers[0]=(answers[0]+1)%4;
  core.updateQuiz(state,"speed","comprehension",q,answers,Array(10).fill(4));
  assert.equal(core.courseStatus(state,"speed",core.readingStatus(null)).steps.review.clear,false);
  core.updateQuiz(state,"speed","review",[q[0]],[q[0].correct],[4]);
  assert.deepEqual(state.pendingWrong.speed,[]);
  assert.equal(core.courseStatus(state,"speed",core.readingStatus(null)).steps.review.clear,false);
  core.updateQuiz(state,"speed","comprehension",q,correct(q),Array(10).fill(4));
  assert.equal(core.courseStatus(state,"speed",core.readingStatus(null)).steps.review.clear,true);
});
test("Full reading completion needs 75 percent or higher for EVERY scene",()=>{
  assert.deepEqual(core.readingStatus({total:2,completed:{"0":true,"1":true},scores:{"0":74,"1":100}}).clear,false);
  const r=core.readingStatus({total:2,completed:{"0":true,"1":true},scores:{"0":75,"1":90}});
  assert.equal(r.clear,true);assert.equal(r.mastery,83);
});
test("Old self-reported v1 flags cannot bypass new evidence-based completion",()=>{
  const legacyCourse={version:1,course:"mastery",done:{mastery:{vocabulary:true,theater:true,comprehension:true},speed:{}},best:{mastery:100}};
  const x=core.read({getItem:()=>JSON.stringify(legacyCourse)},"previous");
  const status=core.courseStatus(x,"mastery",core.readingStatus(null));
  assert.equal(status.finished,false);
  for(const s of ["vocabulary","theater","comprehension"])assert.equal(status.steps[s].clear,false);
  assert.equal(x.best.mastery,100);
});
test("Separate course keys never overwrite existing Story Match or learner records",()=>{
  const oldKey="poweron_study_progress_v1",profileKey="poweron_study_learner_v1";
  const profile={class:"3-2",number:"1",name:"Learner"};
  const oldValue=JSON.stringify({version:1,scopes:{"standard:L08_P1_full":{storyPuzzle:{bestSeconds:18.4},storyRandom:{bestPoints:400},storyListen:{bestPoints:350},sceneReading:{bestAccuracy:92}}}});
  const db=new Map([[oldKey,oldValue],[profileKey,JSON.stringify(profile)]]);
  const storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)};
  const key=core.storageKey(profile,core.scope({lesson:8,part:1})),state=core.initial();
  state.course="speed";assert.ok(core.write(storage,key,state));
  assert.equal(db.get(oldKey),oldValue);
  assert.equal(db.get(profileKey),JSON.stringify(profile));
  assert.notEqual(key,core.storageKey(profile,core.scope({lesson:9,part:1})));
});
test("Story Theater skipping cannot fake listening completion",()=>{
  const callbacks=[];let complete=0;
  const session=theater.createSession({scenes:[{english:"a"},{english:"b"}],
    play:(scene,rate,onEnd)=>callbacks.push(onEnd),stop:()=>{},update:()=>{},finish:()=>{},back:()=>{},
    onComplete:()=>complete++,setTimer:()=>1,clearTimer:()=>{}});
  session.manual();session.close("finish");callbacks[0]();
  assert.equal(complete,0);
});
test("Story Theater continuous narration can award completion only once after all scenes",()=>{
  const callbacks=[],timers=new Map();let complete=0,id=0;
  const session=theater.createSession({scenes:[{english:"a"},{english:"b"}],
    play:(scene,rate,onEnd)=>callbacks.push(onEnd),stop:()=>{},update:()=>{},finish:()=>{},back:()=>{},
    onComplete:()=>complete++,setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:i=>timers.delete(i)});
  session.autoplay();callbacks[0]();
  const [key,fn]=[...timers][0];timers.delete(key);fn();callbacks[1]();
  assert.equal(complete,1);assert.equal(session.snapshot().finished,true);
  session.close("finish");assert.equal(complete,1);
});
test("Course choice is the default entrance for Lessons 8–10, while Free Study retains existing modes",()=>{
  const html=source("index.html"),css=source("css/learningCourses.css"),course=source("js/learningCourses.js");
  for(const n of [8,9,10])assert.ok(html.includes("window.PowerOnCourses?.lessonChanged?.("+n+")"));
  assert.ok(css.includes("po-course-guided:not(.po-course-free-mode)"));
  for(const mode of ["storyPuzzle","storyRandom","storyListen","sceneReading"])
    assert.ok(source("js/practice.js").includes(mode));
  assert.equal(course.includes('case "mark":'),false);
  assert.ok(course.includes('newQuiz(20,"review")'));
  assert.ok(course.includes("questionStartedAt=clock()"));
});

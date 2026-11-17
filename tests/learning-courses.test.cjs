const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const core=require("../js/courseCore.js");
const repoFile=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const getBank=()=>{
  const sandbox={};vm.runInNewContext(repoFile("lessons/courseQuestions.js"),sandbox);
  return sandbox.PowerOnCourseQuestionBank;
};
const legacy=require("../lessons/comprehensionData.js");
test("Course steps are ordered as proposed and original Story Match modes are still present",()=>{
  assert.deepEqual(core.COURSES.mastery.steps,["vocabulary","theater","reading","comprehension"]);
  assert.deepEqual(core.COURSES.speed.steps,["reading","comprehension","review"]);
  assert.deepEqual(core.COURSES.free.steps,[]);
  const current=repoFile("js/practice.js");
  for(const mode of ["storyPuzzle","storyRandom","storyListen","sceneReading"])assert.ok(current.includes(mode));
});
test("Bilingual question bank includes 212 validated unique new IDs and preserves the 40 existing Lesson 8 questions",()=>{
  const bank=getBank();
  assert.equal(bank.length,212);
  assert.equal(new Set(bank.map(q=>q.id)).size,212);
  for(const lesson of [8,9,10]){
    const expected=lesson===8?72:70;
    assert.equal(bank.filter(q=>q.lesson===lesson).length,expected);
    for(const part of [1,2,3,4]){
      const group=core.questionPool(lesson,part,bank,legacy);
      assert.ok(group.length>=10,"L"+lesson+" P"+part);
      for(const q of group){
        assert.equal(q.en[1].length,4);assert.equal(q.ja[1].length,4);
        assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4);
        assert.ok(q.en[1][q.correct]);assert.ok(q.ja[1][q.correct]);
        assert.ok(q.evidence);
      }
    }
  }
  assert.equal(core.questionPool(8,1,bank,legacy).filter(q=>q.id.startsWith("L08_P1-c")).length,10);
  assert.equal(core.questionPool(8,3,bank,legacy).filter(q=>q.id.startsWith("L08_P3-c")).length,10);
  assert.equal(core.questionPool(9,1,bank,legacy).filter(q=>q.id.startsWith("L08")).length,0);
});
test("Quiz language switch has identical correct answers and 5, 10, or 20 questions",()=>{
  const pool=core.questionPool(10,2,getBank(),legacy);
  for(const count of [5,10,20]){
    const q=core.createQuiz(pool,{count,course:"speed",random:()=>.29});
    assert.equal(q.length,count);assert.equal(new Set(q.map(x=>x.id)).size,count);
    for(const item of q){
      assert.equal(item.en[1].length,4);assert.equal(item.ja[1].length,4);
      assert.ok(item.correct>=0&&item.correct<=3);
      assert.ok(item.en[1][item.correct]);assert.ok(item.ja[1][item.correct]);
    }
    const answers=q.map((x,i)=>i===0?(x.correct+1)%4:x.correct);
    const result=core.result(q,answers);
    assert.equal(result.score,count-1);assert.equal(result.wrong.length,1);
    assert.equal(result.wrong[0].id,q[0].id);
  }
});
test("Course progress is separate for each learner, lesson and part; existing score keys never change",()=>{
  const oldKey="poweron_study_progress_v1";
  const profileKey="poweron_study_learner_v1";
  const storage=new Map([[oldKey,JSON.stringify({version:1,scopes:{"standard:L08_P1_full":{storyPuzzle:{bestSeconds:18.4},storyRandom:{bestPoints:400},storyListen:{bestPoints:350},sceneReading:{bestAccuracy:92}}}})],[profileKey,JSON.stringify({class:"3-2",number:"1",name:"Learner"})]]);
  const adapter={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const oldScores=storage.get(oldKey);
  const a={class:"3-2",number:"1",name:"Learner"},b={class:"3-2",number:"2",name:"Learner"};
  const a1=core.storageKey(a,core.scope({lesson:8,part:1}));
  const a2=core.storageKey(a,core.scope({lesson:8,part:2}));
  const b1=core.storageKey(b,core.scope({lesson:8,part:1}));
  assert.notEqual(a1,a2);assert.notEqual(a1,b1);
  const state=core.initial();state.course="mastery";state.done.mastery.vocabulary=true;state.best.mastery=90;
  assert.ok(core.write(adapter,a1,state));assert.equal(core.read(adapter,a1).done.mastery.vocabulary,true);
  const independent=core.read(adapter,a1);independent.lastQuizByCourse.mastery={wrong:[{id:"mastery-question"}]};assert.ok(core.write(adapter,a1,independent));
  assert.equal(core.read(adapter,a1).lastQuizByCourse.speed,null);
  assert.equal(core.read(adapter,a2).course,null);assert.equal(core.read(adapter,b1).course,null);
  assert.equal(storage.get(oldKey),oldScores);assert.equal(storage.get(profileKey),JSON.stringify(a));
});
test("Course launcher only adds UI/assets; retains existing free-study buttons",()=>{
  const html=repoFile("index.html");
  assert.equal((html.match(/PowerOnCourses\.open\(\)/g)||[]).length,2);
  assert.equal((html.match(/class="po-step-primary"/g)||[]).length,8);
  assert.ok(html.includes("lessons/courseQuestions.js"));
  assert.ok(html.includes("js/courseCore.js"));
  assert.ok(html.includes("js/learningCourses.js"));
  assert.ok(html.includes("PowerOnPractice.launchStory()"));
});

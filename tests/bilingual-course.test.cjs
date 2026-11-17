/* Regression for the sequential Japanese -> English comprehension/vocabulary course. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const core=require("../js/courseCore.js");
const legacy=require("../lessons/comprehensionData.js");
const source=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
function data(){
  const sandbox={};
  vm.runInNewContext(source("lessons/courseVocabGlosses.js"),sandbox);
  vm.runInNewContext(source("lessons/courseQuestions.js"),sandbox);
  vm.runInNewContext(source("lessons/lessonData.js")+";globalThis.__VOCAB=lessonVocab;",sandbox);
  return {gloss:sandbox.PowerOnCourseVocabGlosses,questions:sandbox.PowerOnCourseQuestionBank,vocab:sandbox.__VOCAB};
}
const key=(l,p)=>"L"+String(l).padStart(2,"0")+"_P"+p;
const answers=questions=>questions.map(q=>q.correct);
test("All 117 Lesson 8–10 vocabulary words have meaningful English definitions",()=>{
  const {gloss,vocab}=data();
  const words=new Set();
  for(const lesson of [8,9,10])for(const part of [1,2,3,4]){
    for(const word of vocab[key(lesson,part)]){words.add(word.word);assert.ok(gloss[word.word],word.word);}
    const list=core.createVocabularyQuiz(lesson,part,vocab,()=>.22,gloss);
    assert.equal(list.length,Math.min(10,vocab[key(lesson,part)].length),key(lesson,part));
    for(const q of list){
      assert.equal(q.en[1].length,4);assert.equal(q.ja[1].length,4);
      assert.equal(new Set(q.en[1]).size,4);
      assert.equal(new Set(q.ja[1]).size,4);
      assert.ok(q.en[1].every(v=>!/[ぁ-んァ-ヶ一-龯]/.test(v)),"English options must not contain Japanese");
      assert.ok(q.ja[1].some(v=>/[ぁ-んァ-ヶ一-龯]/.test(v)),"Japanese options must be Japanese");
      const index=Number(q.id.match(/_(\d+)$/)[1])-1,term=vocab[key(lesson,part)][index];
      assert.equal(q.en[1][q.correct],gloss[term.word]);
      assert.equal(q.ja[1][q.correct],term.meaning);
    }
  }
  assert.equal(words.size,117);
});
test("Bilingual sequence is Japanese-first then English and answer letters are changed",()=>{
  const {questions}=data(),bank=core.questionPool(8,1,questions,legacy);
  const ten=core.createQuiz(bank,{count:10,random:()=>.32});
  const duo=core.createBilingualQuiz(ten,()=>.31);
  assert.equal(duo.length,20);
  for(let i=0;i<10;i++){
    assert.equal(duo[i].phase,"ja");assert.equal(duo[i+10].phase,"en");
    assert.equal(duo[i].id,duo[i+10].id);
    assert.notEqual(duo[i].correct,duo[i+10].correct,"Do not let learners copy A/B/C/D");
    assert.equal(duo[i].ja[1][duo[i].correct],ten[i].ja[1][ten[i].correct]);
    assert.equal(duo[i+10].en[1][duo[i+10].correct],ten[i].en[1][ten[i].correct]);
  }
});
test("Full Japanese and English mastery needs 10/10 + 10/10; 5/5 + 5/5 remains practice-only",()=>{
  const {questions}=data(),bank=core.questionPool(9,2,questions,legacy);
  const state=core.initial(),five=core.createBilingualQuiz(core.createQuiz(bank,{count:5,random:()=>.28}),()=>.37);
  const practice=core.updateQuiz(state,"mastery","comprehension",five,answers(five),five.map(()=>4),five.map(q=>q.phase));
  assert.equal(practice.score,10);assert.equal(practice.clear,false);
  assert.equal(core.courseStatus(state,"mastery").steps.comprehension.clear,false);
  const ten=core.createBilingualQuiz(core.createQuiz(bank,{count:10,random:()=>.28}),()=>.37);
  const result=core.updateQuiz(state,"mastery","comprehension",ten,answers(ten),ten.map(()=>4),ten.map(q=>q.phase));
  assert.equal(result.clear,true);assert.equal(result.total,20);
  assert.deepEqual([result.sections.ja.score,result.sections.en.score],[10,10]);
  assert.equal(core.courseStatus(state,"mastery").steps.comprehension.clear,true);
});
test("Japanese mistakes remain pending even when the English counterpart is correct",()=>{
  const {questions}=data(),bank=core.questionPool(10,3,questions,legacy);
  const questions20=core.createBilingualQuiz(core.createQuiz(bank,{count:10,random:()=>.24}),()=>.31);
  const state=core.initial(),responses=answers(questions20);
  responses[0]=(responses[0]+1)%4;
  const scored=core.updateQuiz(state,"speed","comprehension",questions20,responses,questions20.map(()=>5),questions20.map(q=>q.phase));
  assert.equal(scored.clear,false);assert.equal(scored.sections.ja.score,9);
  assert.equal(scored.sections.en.score,10);
  assert.ok(state.pendingWrong.speed.includes(questions20[0].id+"::ja"));
  assert.ok(!state.pendingWrong.speed.includes(questions20[0].id+"::en"));
  const one=core.createBilingualQuiz([questions20[0]],()=>.27);
  const review=core.updateQuiz(state,"speed","review",one,answers(one),[3,3],["ja","en"]);
  assert.equal(review.clear,true);assert.deepEqual(state.pendingWrong.speed,[]);
  assert.equal(core.courseStatus(state,"speed").steps.review.clear,false,"main test must be cleared separately");
  const correct=core.updateQuiz(state,"speed","comprehension",questions20,answers(questions20),questions20.map(()=>5),questions20.map(q=>q.phase));
  assert.equal(correct.clear,true);
  assert.equal(core.courseStatus(state,"speed").steps.review.clear,true);
});
test("Per-language question statistics and best scores survive failed retries without changing Story Match data",()=>{
  const {questions}=data(),bank=core.questionPool(8,2,questions,legacy);
  const duo=core.createBilingualQuiz(core.createQuiz(bank,{count:10,random:()=>.31}),()=>.35);
  const profile={class:"3-2",number:"1",name:"Learner"};
  const previous=JSON.stringify({scopes:{"standard:L08_P2_full":{storyPuzzle:{bestSeconds:23.5},storyRandom:{bestPoints:400}}}});
  const storage=new Map([["poweron_study_progress_v1",previous]]);
  const disk={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const state=core.initial(),key=core.storageKey(profile,core.scope({lesson:8,part:2}));
  const good=core.updateQuiz(state,"speed","comprehension",duo,answers(duo),Array(20).fill(3),duo.map(q=>q.phase));
  assert.ok(good.clear);assert.equal(state.best.speed,100);
  const responses=answers(duo);responses[0]=(responses[0]+1)%4;
  const wrong=core.updateQuiz(state,"speed","comprehension",duo,responses,Array(20).fill(3),duo.map(q=>q.phase));
  assert.ok(wrong.mastery<good.mastery);assert.equal(wrong.clear,false);
  assert.equal(state.best.speed,100);
  assert.ok(state.questionStats.speed.comprehension[duo[0].id+"::ja"]);
  assert.ok(state.questionStats.speed.comprehension[duo[0].id+"::en"]);
  assert.ok(core.write(disk,key,state));
  assert.equal(storage.get("poweron_study_progress_v1"),previous);
  assert.equal(core.read(disk,key).latest.speed.comprehension.bilingual,true);
});

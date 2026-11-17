const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const core=require("../js/courseCore.js");
const read=pathName=>fs.readFileSync(path.join(__dirname,"..",pathName),"utf8");
function fixture(){
  const dom=new Map(),timers=new Map(),stored=new Map();
  const originalScores=JSON.stringify({version:1,scopes:{"standard:L08_P1_full":{storyPuzzle:{bestSeconds:18.4},storyRandom:{bestPoints:400}}}});
  stored.set("poweron_study_progress_v1",originalScores);
  stored.set("poweron_study_learner_v1",JSON.stringify({class:"3-2",number:"1",name:"Tester"}));
  let nextTimer=0,time=1000;
  const uiClasses=new Set();
  const body={classList:{add:(...k)=>k.forEach(x=>uiClasses.add(x)),remove:(...k)=>k.forEach(x=>uiClasses.delete(x)),
    contains:k=>uiClasses.has(k),toggle:(k,v)=>{v?uiClasses.add(k):uiClasses.delete(k);return v;}},
    appendChild:e=>dom.set(e.id,e)};
  const doc={body,activeElement:null,hidden:false,events:{},
    addEventListener(name,fn){this.events[name]=fn;},
    createElement(tag){return {tag,id:"",innerHTML:"",style:{},events:{},
      setAttribute(){},addEventListener(type,fn){this.events[type]=fn;},
      focus(){doc.activeElement=this},remove(){dom.delete(this.id)},querySelectorAll(){return []}};},
    getElementById:id=>dom.get(id)||null};
  dom.set("partSelect",{value:"1"});dom.set("paraSelect",{value:"full"});dom.set("levelSelect",{value:"standard"});
  const vocab={L08_P1:Array.from({length:10},(_,i)=>({word:"word"+i,meaning:"意味"+i})),
    L08_P2:Array.from({length:10},(_,i)=>({word:"other"+i,meaning:"別の意味"+i}))};
  const questions=Array.from({length:20},(_,i)=>({
    id:"Q"+i,lesson:8,part:1,paragraph:1,difficulty:"Basic",skill:"Detail",
    en:["Question "+i,["A","B","C","D"]],ja:["問題 "+i,["ア","イ","ウ","エ"]],
    correct:i%4,evidence:"Example sentence",explanation:"日本語解説"
  }));
  const win={document:doc,PowerOnCourseCore:core,PowerOnCourseQuestionBank:questions,
    PowerOnComprehension:{},PowerOnPractice:{getProgress:()=>({scopes:{}}),open:()=>{},openTheater:()=>{}},
    performance:{now:()=>time},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},
    clearTimeout(id){timers.delete(id)}};
  const structure={8:{1:[1],2:[2],3:[3],4:[4]}};
  const appScript='let currentLesson=8,currentKey="L08_P1_full",currentLevel="standard";'+
    'function updateParaSelect(){};function resetAppMode(){};'+
    'function onScopeChange(){currentKey="L08_P"+window.document.getElementById("partSelect").value+"_full";window.PowerOnCourses?.scopeChanged();}'+
    read("js/learningCourses.js")+';return {currentKey:()=>currentKey};';
  const runtime=new Function("window","lessonVocab","lessonStructure",appScript)(win,vocab,structure);
  const course=win.PowerOnCourses;
  const html=()=>dom.get("po-course-overlay")?.innerHTML||"";
  function click(action,fields={}){
    const el=dom.get("po-course-overlay");assert.ok(el,"course overlay visible");
    el.events.click({target:{closest:()=>({dataset:{action,...fields},disabled:false})}});
  }
  function nextScheduled(){
    const next=[...timers][0];assert.ok(next,"auto-advance timer exists");
    timers.delete(next[0]);next[1].fn();return next[1].ms;
  }
  return {course,html,click,timers,stored,originalScores,dom,uiClasses,runtime,
    tick:(ms)=>{time+=ms},nextScheduled};
}
test("Course Part selector uses accessible buttons, never a dropdown",()=>{
  const f=fixture();f.course.open();
  const h=f.html();
  for(const n of [1,2,3,4])assert.ok(h.includes('data-part="'+n+'"'),"Part "+n);
  assert.ok(h.includes('aria-pressed="true"'));
  assert.ok(h.includes('role="group" aria-label="学習するPart"'));
  assert.equal(h.includes('data-course-part="true"'),false);
});
test("Mastery dashboard is a compact four-card path and speed has three cards",()=>{
  const f=fixture();f.course.open();f.course.choose("mastery");
  let h=f.html();assert.equal((h.match(/class="po-course-stage po-course-step-/g)||[]).length,4);
  for(let n=1;n<=4;n++)assert.ok(h.includes('po-course-step-'+n));
  assert.ok(h.includes("STEP 01")&&h.includes("NEXT"));
  assert.ok(h.includes("po-course-stage-list"));
  f.course.choose("speed");h=f.html();
  assert.equal((h.match(/class="po-course-stage po-course-step-/g)||[]).length,3);
  assert.ok(h.includes("3つのStep"));
});
test("Vocabulary shows fixed explanation and auto-advances without scrolling",()=>{
  const f=fixture();f.course.open();f.course.choose("mastery");f.course.launchStep("vocabulary");
  f.click("newQuiz",{count:"10"});
  const q=f.course._test.getQuiz();assert.equal(q.length,10);
  let h=f.html();assert.ok(h.includes('po-course-question is-vocabulary'));
  assert.ok(h.includes('po-course-answer-grid'));
  f.tick(5000);f.click("answer",{index:String(q[0].correct)});
  h=f.html();assert.ok(h.includes('po-course-answer-popup is-correct'));
  assert.ok(h.includes('Correct! 正解'));assert.ok(h.includes("正解："));
  assert.equal(f.timers.size,1);const ms=f.nextScheduled();assert.equal(ms,1500);
  h=f.html();assert.ok(h.includes("QUESTION 2 / 10"));assert.ok(!h.includes("po-course-feedback-backdrop"));
  assert.equal(f.dom.get("po-course-overlay").scrollTop,0);
  assert.equal(f.stored.get("poweron_study_progress_v1"),f.originalScores);
});
test("Wrong answer popup can be held for reading or advanced manually, never double advances",()=>{
  const f=fixture();f.course.open();f.course.choose("mastery");f.course.launchStep("vocabulary");f.click("newQuiz",{count:"10"});
  const q=f.course._test.getQuiz();
  f.tick(8000);f.click("answer",{index:String((q[0].correct+1)%4)});
  assert.ok(f.html().includes("Incorrect! 惜しい！"));
  assert.equal([...f.timers.values()][0].ms,2600);
  f.click("pauseFeedback");assert.equal(f.timers.size,0);assert.ok(f.html().includes("説明を確認したら次へ"));
  f.click("nextQuestion");assert.ok(f.html().includes("QUESTION 2 / 10"));assert.equal(f.timers.size,0);
  f.tick(1000);f.click("answer",{index:String(q[1].correct)});
  assert.equal(f.timers.size,1);
  f.click("dashboard");assert.equal(f.timers.size,0);
  assert.ok(f.html().includes("STEP 01"));
});
test("Responsive styles define 2 by 2 vocabulary answers and compact 2 by 2 course cards",()=>{
  const css=read("css/learningCourses.css");
  assert.match(css,/\.po-course-question\.is-vocabulary \.po-course-answer-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css,/\.po-course-stage-list\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.ok(css.includes("@media(max-width:620px)"));
  assert.ok(css.includes(".po-course-feedback-backdrop{position:fixed;"));
});

test("Switching Part buttons actually selects the new Part without overwriting existing progress",()=>{
  const f=fixture();f.course.open();f.course.choose("mastery");
  const key1=f.course.context().storageKey;
  const saved1=f.stored.get(key1);
  assert.ok(saved1);
  f.click("selectPart",{part:"2"});
  assert.equal(f.runtime.currentKey(),"L08_P2_full");
  assert.equal(f.course.context().part,2);
  assert.ok(f.html().includes('Part 2 · standard'));
  const key2=f.course.context().storageKey;
  assert.notEqual(key1,key2);
  assert.equal(f.stored.get(key1),saved1);
  assert.equal(f.stored.get("poweron_study_progress_v1"),f.originalScores);
  assert.equal(f.course._test.getView(),"choose");
});
test("Vocabulary auto-advance reaches the results only after the tenth answer",()=>{
  const f=fixture();f.course.open();f.course.choose("mastery");
  f.course.launchStep("vocabulary");f.click("newQuiz",{count:"10"});
  const questions=f.course._test.getQuiz();
  for(let i=0;i<questions.length;i++){
    f.tick(4000);f.click("answer",{index:String(questions[i].correct)});
    assert.equal(f.timers.size,1);
    f.nextScheduled();
  }
  assert.equal(f.course._test.getView(),"result");
  assert.ok(f.html().includes("MISSION CLEAR!"));
  assert.equal(f.course._test.getData().done.mastery.vocabulary,true);
  assert.equal(f.stored.get("poweron_study_progress_v1"),f.originalScores);
});

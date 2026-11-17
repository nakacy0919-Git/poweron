/* Course-specific learning state. Does not read or write Story Match scores. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PowerOnCourseCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const PREFIX="poweron_learning_course_v1:";
  const COURSES={
    mastery:{title:"じっくりマスター",en:"Mastery Course",steps:["vocabulary","theater","reading","comprehension"]},
    speed:{title:"スピードチャレンジ",en:"Challenge Course",steps:["reading","comprehension","review"]},
    free:{title:"自由学習",en:"Free Study",steps:[]}
  };
  const LABELS={
    vocabulary:{name:"Vocabulary Training",ja:"単語・チャンクから理解する",icon:"🔤"},
    theater:{name:"Story Theater",ja:"画像・音声で本文をつかむ",icon:"🎬"},
    reading:{name:"Reading Practice",ja:"Accuracy 75%以上を目指す",icon:"🎤"},
    comprehension:{name:"Comprehension Challenge",ja:"英語・日本語の4択で理解度確認",icon:"🧠"},
    review:{name:"Targeted Review",ja:"間違えた箇所だけを復習",icon:"🔁"}
  };
  function scope({lesson,part,level="standard"}){
    if(!Number.isInteger(Number(lesson))||!Number.isInteger(Number(part)))throw Error("Invalid lesson or part");
    return level+":L"+String(lesson).padStart(2,"0")+"_P"+part+"_full";
  }
  function storageKey(profile,partScope){
    const learner=profile&&profile.class&&profile.number&&profile.name?JSON.stringify([profile.class,profile.number,profile.name]):"anonymous";
    return PREFIX+encodeURIComponent(learner)+":"+partScope;
  }
  function initial(){return {version:1,course:null,done:{mastery:{},speed:{}},best:{},lastQuizByCourse:{mastery:null,speed:null},language:"en",count:10};}
  function read(storage,key){
    try{
      const value=JSON.parse(storage?.getItem(key)||"null");
      if(value&&value.version===1&&value.done&&value.best){
        return {...initial(),...value,done:{mastery:{...(value.done.mastery||{})},speed:{...(value.done.speed||{})}},lastQuizByCourse:{mastery:value.lastQuizByCourse?.mastery||null,speed:value.lastQuizByCourse?.speed||null}};
      }
    }catch(_){}
    return initial();
  }
  function write(storage,key,data){
    const clean={...initial(),...data,version:1};
    try{storage?.setItem(key,JSON.stringify(clean));return true;}catch(_){return false;}
  }
  function normalizeDraft(question){
    if(!question||!question.id||!question.en||!question.ja||!Array.isArray(question.en[1])||!Array.isArray(question.ja[1])||question.en[1].length!==4||question.ja[1].length!==4)return null;
    const correct=Number(question.correct);
    if(!Number.isInteger(correct)||correct<0||correct>3)return null;
    return {...question,correct};
  }
  function questionPool(lesson,part,newQuestions=[],legacyBank={}){
    const items=newQuestions.filter(q=>Number(q.lesson)===Number(lesson)&&Number(q.part)===Number(part)).map(normalizeDraft).filter(Boolean);
    const old=legacyBank?.["L"+String(lesson).padStart(2,"0")+"_P"+part]?.comprehension||[];
    for(const q of old){
      if(!q?.id||!q?.en||!q?.ja||!Array.isArray(q.choices)||q.choices.length!==4)continue;
      items.push({id:q.id,lesson:+lesson,part:+part,paragraph:q.paragraph,
        difficulty:"Basic",skill:"Detail",en:[q.en,q.choices.map(pair=>pair[0])],
        ja:[q.ja,q.choices.map(pair=>pair[1])],correct:0,
        evidence:q.evidence||"",explanation:q.explanation||""});
    }
    const ids=new Set();
    return items.filter(q=>{if(ids.has(q.id))return false;ids.add(q.id);return true;});
  }
  function shuffle(items,random=Math.random){
    const a=items.slice();
    for(let i=a.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function createQuiz(pool,{count=10,course="mastery",random=Math.random}={}){
    const order=shuffle(pool,random);
    const preferred=course==="speed"?["Advanced","Challenge","Standard","Basic"]:["Basic","Standard","Challenge","Advanced"];
    // Prefer appropriate levels, but keep every question eligible if a Part has fewer than 20.
    const selected=shuffle(order.map((q,i)=>({q,i})),random)
      .sort((a,b)=>preferred.indexOf(a.q.difficulty)-preferred.indexOf(b.q.difficulty))
      .slice(0,Math.min(Number(count)||10,20,pool.length)).map(({q})=>q);
    return selected.map(q=>{
      const order=shuffle([0,1,2,3],random);
      return {id:q.id,paragraph:q.paragraph,skill:q.skill,difficulty:q.difficulty,
        en:[q.en[0],order.map(i=>q.en[1][i])],
        ja:[q.ja[0],order.map(i=>q.ja[1][i])],
        correct:order.indexOf(q.correct),evidence:q.evidence,explanation:q.explanation};
    });
  }
  function result(quiz,answers){
    const wrong=quiz.map((q,i)=>({q,i,selected:answers[i]})).filter(({q,selected})=>selected!==q.correct);
    const score=quiz.length-wrong.length;
    return {score,total:quiz.length,percent:quiz.length?Math.round(score/quiz.length*100):0,
      wrong:wrong.map(({q,i,selected})=>({id:q.id,index:i,selected,correct:q.correct,skill:q.skill,evidence:q.evidence,explanation:q.explanation,en:q.en,ja:q.ja}))};
  }
  return {PREFIX,COURSES,LABELS,scope,storageKey,initial,read,write,questionPool,createQuiz,result,shuffle};
});

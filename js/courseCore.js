/* Evidence-based progress for PowerOn Learning Courses.
   This module has its own storage prefix and never writes Story Match records. */
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
    vocabulary:{name:"Vocabulary Training",ja:"日本語・英語の語彙を両方全問正解",icon:"🔤"},
    theater:{name:"Story Theater",ja:"全シーンの音声視聴で修了",icon:"🎬"},
    reading:{name:"Reading Practice",ja:"全シーンでAccuracy 75%以上",icon:"🎤"},
    comprehension:{name:"Comprehension Challenge",ja:"日英それぞれ10問以上・両方全問正解",icon:"🧠"},
    review:{name:"Targeted Review",ja:"間違えた問題を全問再正解",icon:"🔁"}
  };
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function scope({lesson,part,level="standard"}){
    if(!Number.isInteger(Number(lesson))||!Number.isInteger(Number(part)))throw Error("Invalid lesson or part");
    return level+":L"+String(lesson).padStart(2,"0")+"_P"+part+"_full";
  }
  function storageKey(profile,partScope){
    const learner=profile&&profile.class&&profile.number&&profile.name?JSON.stringify([profile.class,profile.number,profile.name]):"anonymous";
    return PREFIX+encodeURIComponent(learner)+":"+partScope;
  }
  function initial(){return {
    version:2,course:null,done:{mastery:{},speed:{}},best:{},lastQuizByCourse:{mastery:null,speed:null},
    latest:{mastery:{},speed:{}},questionStats:{mastery:{},speed:{}},pendingWrong:{mastery:[],speed:[]},
    watched:{mastery:false},language:"en",count:10,history:{mastery:[],speed:[]}
  };}
  function read(storage,key){
    try{
      const value=JSON.parse(storage?.getItem(key)||"null"),defaults=initial();
      if(value&&[1,2].includes(value.version)&&value.done&&value.best){
        return {...defaults,...value,version:2,
          done:{mastery:{...(value.done.mastery||{})},speed:{...(value.done.speed||{})}},
          latest:{mastery:{...(value.latest?.mastery||{})},speed:{...(value.latest?.speed||{})}},
          best:{...(value.best||{})},
          questionStats:{mastery:{...(value.questionStats?.mastery||{})},speed:{...(value.questionStats?.speed||{})}},
          pendingWrong:{mastery:[...(value.pendingWrong?.mastery||[])],speed:[...(value.pendingWrong?.speed||[])]},
          watched:{mastery:value.watched?.mastery===true},
          lastQuizByCourse:{mastery:value.lastQuizByCourse?.mastery||null,speed:value.lastQuizByCourse?.speed||null},
          history:{mastery:[...(value.history?.mastery||[])],speed:[...(value.history?.speed||[])]}
        };
      }
    }catch(_){}
    return initial();
  }
  function write(storage,key,data){
    try{storage?.setItem(key,JSON.stringify({...initial(),...data,version:2}));return true;}catch(_){return false;}
  }
  function normalizeDraft(question){
    if(!question||!question.id||!question.en||!question.ja||
      !Array.isArray(question.en[1])||!Array.isArray(question.ja[1])||
      question.en[1].length!==4||question.ja[1].length!==4)return null;
    const correct=Number(question.correct);
    if(!Number.isInteger(correct)||correct<0||correct>3)return null;
    return {...question,correct};
  }
  function questionPool(lesson,part,newQuestions=[],legacyBank={}){
    const items=newQuestions.filter(q=>Number(q.lesson)===Number(lesson)&&Number(q.part)===Number(part))
      .map(normalizeDraft).filter(Boolean);
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
    for(let i=a.length-1;i>0;i--){const j=clamp(Math.floor(random()*(i+1)),0,i);[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function createQuiz(pool,{count=10,course="mastery",random=Math.random,priorityIds=[]}={}){
    const preferred=course==="speed"?["Advanced","Challenge","Standard","Basic"]:["Basic","Standard","Challenge","Advanced"];
    const priority=new Set(priorityIds);
    const shuffled=shuffle(pool,random);
    const selected=shuffled.map(q=>({q,urgent:priority.has(q.id)?0:1,difficulty:Math.max(0,preferred.indexOf(q.difficulty))}))
      .sort((a,b)=>a.urgent-b.urgent||a.difficulty-b.difficulty)
      .slice(0,Math.min(clamp(Number(count)||10,1,20),pool.length)).map(x=>x.q);
    return selected.map(q=>{
      const order=shuffle([0,1,2,3],random);
      return {id:q.id,paragraph:q.paragraph,skill:q.skill,difficulty:q.difficulty,
        en:[q.en[0],order.map(i=>q.en[1][i])],ja:[q.ja[0],order.map(i=>q.ja[1][i])],
        correct:order.indexOf(q.correct),evidence:q.evidence,explanation:q.explanation};
    });
  }
  function vocabularyPool(lesson,part,lessonVocab={}){
    const id="L"+String(lesson).padStart(2,"0")+"_P"+part;
    const selected=lessonVocab[id]||[];
    const all=Object.entries(lessonVocab).filter(([key])=>key.startsWith("L"+String(lesson).padStart(2,"0")+"_P"))
      .flatMap(([,list])=>list);
    return selected.filter(x=>x&&x.word&&x.meaning).map((item,i)=>({
      id:"VOC_"+id+"_"+String(i+1).padStart(2,"0"),word:item.word,meaning:item.meaning,
      alternatives:all.map(x=>x.meaning).filter(x=>x&&x!==item.meaning)
    }));
  }
  function createVocabularyQuiz(lesson,part,lessonVocab={},random=Math.random,englishGlosses=null){
    const words=vocabularyPool(lesson,part,lessonVocab),selected=shuffle(words,random).slice(0,10);
    const allMeanings=[...new Set(words.flatMap(x=>[x.meaning,...x.alternatives]))];
    const prefix="L"+String(lesson).padStart(2,"0")+"_P";
    const source=Object.entries(lessonVocab).filter(([key])=>key.startsWith(prefix))
      .flatMap(([,list])=>list).filter(item=>item&&item.word&&item.meaning);
    return selected.map(w=>{
      if(englishGlosses){
        const gloss=englishGlosses[w.word];
        if(!gloss)return null; // Never mislabel Japanese choices as an English task.
        const candidates=shuffle(source.filter(x=>x.word!==w.word&&x.meaning!==w.meaning&&
          englishGlosses[x.word]&&englishGlosses[x.word]!==gloss),random);
        const distinct=new Set([w.meaning]),otherGlosses=new Set([gloss]),different=[];
        for(const x of candidates){
          if(distinct.has(x.meaning)||otherGlosses.has(englishGlosses[x.word]))continue;
          distinct.add(x.meaning);otherGlosses.add(englishGlosses[x.word]);different.push(x);
          if(different.length===3)break;
        }
        if(different.length!==3)return null;
        const shuffled=shuffle([{ja:w.meaning,en:gloss,correct:true},
          ...different.map(x=>({ja:x.meaning,en:englishGlosses[x.word],correct:false}))],random);
        const correct=shuffled.findIndex(x=>x.correct);
        return {id:w.id,paragraph:part,skill:"Vocabulary",difficulty:"Basic",
          en:['Which English explanation best describes "'+w.word+'"?',shuffled.map(x=>x.en)],
          ja:['「'+w.word+'」の意味は？',shuffled.map(x=>x.ja)],
          correct,evidence:w.word+" = "+w.meaning,explanation:"「"+w.word+"」は「"+w.meaning+"」を意味します。"};
      }
      // Legacy callers intentionally retain the original behavior.
      const different=shuffle(allMeanings.filter(value=>value!==w.meaning),random).slice(0,3);
      if(different.length<3)return null;
      const choices=shuffle([w.meaning,...different],random),correct=choices.indexOf(w.meaning);
      return {id:w.id,paragraph:part,skill:"Vocabulary",difficulty:"Basic",
        en:['What does "'+w.word+'" mean?',choices],
        ja:['「'+w.word+'」の意味は？',choices],
        correct,evidence:w.word+" = "+w.meaning,explanation:"「"+w.word+"」は「"+w.meaning+"」を意味します。"};
    }).filter(Boolean);
  }
  function createBilingualQuiz(questions,random=Math.random){
    if(!Array.isArray(questions)||!questions.length)throw Error("Missing bilingual questions");
    const japanese=[],english=[];
    for(const q of questions){
      if(!q.en||!q.ja||q.en[1].length!==4||q.ja[1].length!==4)throw Error("Missing bilingual choices");
      const japaneseOrder=shuffle([0,1,2,3],random),englishOrder=shuffle([0,1,2,3],random);
      // Avoid memorizing the Japanese answer's A/B/C/D position.
      const japaneseCorrect=japaneseOrder.indexOf(q.correct);
      const englishCorrect=englishOrder.indexOf(q.correct);
      if(japaneseCorrect===englishCorrect){
        const alternate=(englishCorrect+1)%4;
        [englishOrder[englishCorrect],englishOrder[alternate]]=
          [englishOrder[alternate],englishOrder[englishCorrect]];
      }
      const make=(phase,order)=>({...q,phase,
        en:[q.en[0],order.map(i=>q.en[1][i])],
        ja:[q.ja[0],order.map(i=>q.ja[1][i])],
        correct:order.indexOf(q.correct)});
      japanese.push(make("ja",japaneseOrder));
      english.push(make("en",englishOrder));
    }
    return [...japanese,...english];
  }
  function result(quiz,answers){
    const wrong=quiz.map((q,i)=>({q,i,selected:answers[i]})).filter(({q,selected})=>selected!==q.correct);
    const score=quiz.length-wrong.length;
    return {score,total:quiz.length,percent:quiz.length?Math.round(score/quiz.length*100):0,
      wrong:wrong.map(({q,i,selected})=>({id:q.phase?q.id+"::"+q.phase:q.id,baseId:q.id,phase:q.phase||null,index:i,selected,correct:q.correct,skill:q.skill,evidence:q.evidence,explanation:q.explanation,en:q.en,ja:q.ja}))};
  }
  function targetSeconds(question,language="en"){
    const content=question?.[language]||question?.en||["",[]];
    const len=([content[0],...(content[1]||[])].join(" "));
    const size=language==="ja"?len.length/2.3:len.split(/\s+/).filter(Boolean).length;
    const difficulty={Basic:0,Standard:4,Challenge:7,Advanced:9}[question?.difficulty]||0;
    return clamp(Math.round(8+size*.65+difficulty),12,55);
  }
  function updateQuiz(data,course,kind,quiz,answers,seconds=[],language="en"){
    if(!["mastery","speed"].includes(course)||!["vocabulary","comprehension","review"].includes(kind))
      throw Error("Invalid course quiz");
    if(!Array.isArray(quiz)||!quiz.length||answers.length!==quiz.length||quiz.some((q,i)=>!Number.isInteger(answers[i])||answers[i]<0||answers[i]>3))
      throw Error("Incomplete quiz");
    const res=result(quiz,answers);
    const bucket=kind==="vocabulary"?"vocabulary":"comprehension";
    const stats=data.questionStats[course][bucket]||{};
    let speedTotal=0,stabilityTotal=0,secondsTotal=0;
    for(let i=0;i<quiz.length;i++){
      const q=quiz[i],right=answers[i]===q.correct;
      const elapsed=clamp(Number.isFinite(seconds[i])?seconds[i]:targetSeconds(q,Array.isArray(language)?language[i]:language)*2,1,600);
      const questionId=q.phase?q.id+"::"+q.phase:q.id;
      const old=stats[questionId]||{attempts:0,streak:0,recent:[]};
      const streak=right?old.streak+1:0;
      const answerLanguage=Array.isArray(language)?language[i]:language;
      const speed=right?clamp(targetSeconds(q,answerLanguage)/elapsed,0,1):0;
      const stability=right?(old.streak>=1?1:.5):0;
      speedTotal+=speed;stabilityTotal+=stability;secondsTotal+=elapsed;
      stats[questionId]={attempts:(old.attempts||0)+1,streak,lastCorrect:right,lastSeconds:elapsed,
        recent:[...(old.recent||[]),{correct:right,seconds:elapsed}].slice(-5)};
    }
    data.questionStats[course][bucket]=stats;
    const speedRatio=speedTotal/quiz.length,retention=stabilityTotal/quiz.length;
    let mastery=Math.round(70*res.score/quiz.length+20*speedRatio+10*retention);
    // An accuracy drop must never be hidden by faster clicking or higher streaks.
    // Keep historical best separately, but make the current mastery reflect regression.
    const previous=data.latest?.[course]?.[kind];
    if(previous&&Number(previous.accuracy)>res.percent)
      mastery=Math.min(mastery,Math.max(0,Number(previous.mastery||0)-1));
    const bilingual=quiz.every(q=>q.phase==="ja"||q.phase==="en");
    const sections=bilingual?Object.fromEntries(["ja","en"].map(phase=>{
      const list=quiz.map((q,i)=>({q,i})).filter(x=>x.q.phase===phase);
      const score=list.filter(({q,i})=>answers[i]===q.correct).length;
      return [phase,{score,total:list.length,percent:list.length?Math.round(score/list.length*100):0}];
    })):{};
    const qualified=bilingual?
      (sections.ja.total>0&&sections.en.total>0&&
        (kind!=="comprehension"||(sections.ja.total>=10&&sections.en.total>=10))):
      (kind!=="comprehension"||quiz.length>=10);
    const clear=res.percent===100&&qualified;
    const summary={...res,kind,bilingual,sections,mastery,accuracy:res.percent,speed:Math.round(speedRatio*100),
      retention:Math.round(retention*100),averageSeconds:Math.round(secondsTotal/quiz.length*10)/10,clear};
    if(kind!=="review")data.latest[course][kind]=summary;
    else data.latest[course].review=summary;
    const bestKey=course+(kind==="vocabulary"?"Vocabulary":kind==="review"?"Review":"");
    data.best[bestKey]=Math.max(Number(data.best[bestKey])||0,res.percent);
    if(kind==="vocabulary")data.done[course].vocabulary=clear;
    if(kind==="comprehension"&&qualified)data.done[course].comprehension=clear;
    else if(kind==="comprehension"&&bilingual)data.done[course].comprehension=false;
    const pending=new Set(data.pendingWrong[course]||[]);
    if(kind!=="vocabulary"){
      for(let i=0;i<quiz.length;i++){
        const id=quiz[i].phase?quiz[i].id+"::"+quiz[i].phase:quiz[i].id;
        if(answers[i]===quiz[i].correct){
          pending.delete(id);if(quiz[i].phase)pending.delete(quiz[i].id);
        }else pending.add(id);
      }
      data.pendingWrong[course]=[...pending];
      data.done[course].review=pending.size===0&&data.done[course].comprehension===true;
    }
    data.history[course]=[...(data.history[course]||[]),{
      kind,correct:res.score,total:res.total,mastery,averageSeconds:summary.averageSeconds
    }].slice(-12);
    return summary;
  }
  function readingStatus(row){
    const total=Number(row?.total)||0;if(total<=0)return {clear:false,passed:0,total:0,mastery:0};
    let passed=0,sum=0;
    for(let i=0;i<total;i++){
      const accuracy=clamp(Number(row.scores?.[i])||0,0,100);
      if(row.completed?.[i]&&accuracy>=75)passed++;
      sum+=accuracy;
    }
    return {clear:passed===total,passed,total,mastery:Math.round(sum/total)};
  }
  function courseStatus(data,course,reading={clear:false,mastery:0}){
    const evidence={
      vocabulary:{clear:data.done?.mastery?.vocabulary===true&&data.latest?.mastery?.vocabulary?.clear===true&&data.latest?.mastery?.vocabulary?.bilingual===true,
        mastery:data.latest?.mastery?.vocabulary?.mastery||0},
      theater:{clear:data.watched?.mastery===true,mastery:data.watched?.mastery===true?100:0},
      reading:{clear:reading.clear===true,mastery:reading.mastery||0},
      comprehension:{clear:data.done?.[course]?.comprehension===true&&data.latest?.[course]?.comprehension?.clear===true&&data.latest?.[course]?.comprehension?.bilingual===true,
        mastery:data.latest?.[course]?.comprehension?.mastery||0},
      review:{clear:data.done?.[course]?.comprehension===true&&(data.pendingWrong?.[course]||[]).length===0,
        mastery:data.done?.[course]?.comprehension===true&&(data.pendingWrong?.[course]||[]).length===0?100:0}
    };
    const stages=COURSES[course]?.steps||[];
    const mastery=stages.length?Math.round(stages.reduce((sum,s)=>sum+evidence[s].mastery,0)/stages.length):0;
    return {steps:evidence,mastery,finished:stages.length>0&&stages.every(s=>evidence[s].clear),
      passed:stages.filter(s=>evidence[s].clear).length,total:stages.length};
  }
  return {PREFIX,COURSES,LABELS,scope,storageKey,initial,read,write,questionPool,shuffle,
    createQuiz,vocabularyPool,createVocabularyQuiz,createBilingualQuiz,result,targetSeconds,updateQuiz,readingStatus,courseStatus};
});
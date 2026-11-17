/* PowerOn Learning Courses — independent navigation, quiz, and course-only progress. */
(function(host){
  "use strict";
  const core=host.PowerOnCourseCore;
  if(!core)return;
  let view="choose",quiz=null,quizIndex=0,quizAnswers=[],latestResult=null;
  let activeKey=null,currentData=null,currentContext=null;
  const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function context(){
    const lesson=typeof currentLesson!=="undefined"?Number(currentLesson):1;
    const key=typeof currentKey!=="undefined"?currentKey:"L01_P1_full";
    const part=Number((key.match(/_P(\d+)_/)||[])[1]||1);
    const level=typeof currentLevel!=="undefined"?String(currentLevel):"standard";
    let learner=null;
    try{learner=JSON.parse(host.localStorage.getItem("poweron_study_learner_v1")||"null");}catch(_){}
    const partScope=core.scope({lesson,part,level});
    return {lesson,part,level,key,partScope,learner,storageKey:core.storageKey(learner,partScope)};
  }
  function refresh(){
    currentContext=context();activeKey=currentContext.storageKey;
    currentData=core.read(host.localStorage,activeKey);
    return currentData;
  }
  function save(){return core.write(host.localStorage,activeKey,currentData);}
  function pool(){
    const c=currentContext;
    return core.questionPool(c.lesson,c.part,host.PowerOnCourseQuestionBank||[],host.PowerOnComprehension||{});
  }
  function overlay(){
    let root=host.document.getElementById("po-course-overlay");
    if(!root){
      root=host.document.createElement("section");
      root.id="po-course-overlay";root.className="po-course-overlay";
      root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");
      root.setAttribute("aria-label","PowerOn 学習コース");
      root.setAttribute("tabindex","-1");
      root.addEventListener("click",click);
      root.addEventListener("change",change);
      root.addEventListener("keydown",e=>{
        if(e.key==="Escape"){e.preventDefault();close();}
        if(e.key==="Tab"){
          const focusable=[...root.querySelectorAll("button:not([disabled]),select:not([disabled])")];
          if(!focusable.length)return;
          if(e.shiftKey&&host.document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1).focus();}
          else if(!e.shiftKey&&host.document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0].focus();}
        }
      });
      host.document.body.appendChild(root);
    }
    host.document.body.classList.add("po-course-open");
    return root;
  }
  function hide(){
    host.document.getElementById("po-course-overlay")?.remove();
    host.document.body.classList.remove("po-course-open");
  }
  function floatButton(show){
    let b=host.document.getElementById("po-course-return");
    if(!show){b?.remove();return;}
    if(!b){
      b=host.document.createElement("button");
      b.id="po-course-return";b.type="button";b.textContent="← コースへ戻る / 次のStep";
      b.setAttribute("aria-label","学習コースへ戻り、次のステップを選ぶ");
      b.addEventListener("click",()=>openDashboard());
      host.document.body.appendChild(b);
    }
  }
  function close(){hide();floatButton(false);}
  function open(){
    refresh();view="choose";quiz=null;quizAnswers=[];floatButton(false);paint();overlay().focus();
  }
  function openDashboard(){
    refresh();view=currentData.course&&currentData.course!=="free"?"dashboard":"choose";
    if(view==="dashboard"&&currentData.lastQuizByCourse?.[currentData.course])latestResult=currentData.lastQuizByCourse[currentData.course];
    paint();floatButton(false);overlay().focus();
  }
  function choose(course){
    if(!core.COURSES[course])return;
    refresh();currentData.course=course;save();
    if(course==="free"){
      close();
      // Return to the original, unmodified four-step menu and Story Match modes.
      if(typeof resetAppMode==="function")resetAppMode();
      return;
    }
    view="dashboard";quiz=null;paint();
  }
  function checkReading(){
    const c=currentContext,all=host.PowerOnPractice?.getProgress?.()?.scopes||{};
    const entry=all[c.partScope]?.sceneReading;
    if(!entry?.total)return {done:false,passed:0,total:0};
    const passed=Object.keys(entry.completed||{}).filter(i=>entry.completed[i]&&Number(i)<entry.total&&Number(i)>=0).length;
    return {done:passed===entry.total,passed,total:entry.total};
  }
  function completed(step){
    if(step==="reading")return checkReading().done;
    return Boolean(currentData.done?.[currentData.course]?.[step]);
  }
  function markStep(step){
    const course=currentData.course;
    if(!core.COURSES[course]?.steps.includes(step))return;
    if(step==="reading"||step==="comprehension")return; // Never award reading or quiz passes manually.
    currentData.done[course][step]=true;save();paint();
  }
  function nextRecommended(){
    const stages=core.COURSES[currentData.course]?.steps||[];
    return stages.find(x=>!completed(x))||stages.at(-1);
  }
  function stage(step){
    if(!core.COURSES[currentData.course]?.steps.includes(step)&&!["theater","vocabulary"].includes(step))return;
    if(step==="comprehension"){quiz=null;quizIndex=0;quizAnswers=[];view="quiz";paint();return;}
    if(step==="review"){view="review";paint();return;}
    hide();floatButton(true);
    try{
      if(step==="vocabulary"){
        // Reuse the installed vocabulary activities; never mutate their results.
        if(currentContext.lesson===8)host.PowerOnPractice.open("contextVocab");
        else if(typeof startVocabQuiz==="function")startVocabQuiz();
        else host.PowerOnPractice.open("knowledgeHub");
      }else if(step==="theater")host.PowerOnPractice.openTheater();
      else if(step==="reading")host.PowerOnPractice.open("sceneReading");
    }catch(_){
      openDashboard();
      notice("この学習画面を開けませんでした。LessonとPartを確認してください。");
    }
  }
  function notice(message){
    const el=host.document.getElementById("po-course-message");
    if(el){el.textContent=message;el.hidden=!message;}
  }
  function newQuiz(count){
    if(currentContext.level!=="standard"){notice("内容理解問題は現在Standard本文のみ対応しています。");return;}
    const available=pool();
    if(!available.length){notice("このLesson・Partの内容理解問題はまだ準備中です。");return;}
    const size=Math.min(available.length,Number(count)||currentData.count||10);
    quiz=core.createQuiz(available,{count:size,course:currentData.course});
    quizIndex=0;quizAnswers=[];
    currentData.count=size;save();view="quiz";paint();
  }
  function setLanguage(lang){
    if(lang!=="en"&&lang!=="ja")return;
    currentData.language=lang;save();paint();
  }
  function answer(index){
    if(!quiz||quizAnswers[quizIndex]!==undefined||!Number.isInteger(index)||index<0||index>3)return;
    quizAnswers[quizIndex]=index;
    if(quizAnswers.length===quiz.length){
      latestResult=core.result(quiz,quizAnswers);
      currentData.lastQuizByCourse[currentData.course]={...latestResult,wrong:latestResult.wrong.map(x=>({id:x.id}))};
      const name=currentData.course,prev=currentData.best[name]||0;
      currentData.best[name]=Math.max(prev,latestResult.percent);
      if(latestResult.percent>=80)currentData.done[name].comprehension=true;
      save();
    }
    paint();
  }
  function nextQuestion(){
    if(!quiz||quizAnswers[quizIndex]===undefined)return;
    if(quizIndex===quiz.length-1){view="result";paint();return;}
    quizIndex++;paint();
  }
  function escapeContent(s){return escape(s).replace(/\n/g," ");}
  function button(action,label,extra="",cls=""){
    return '<button type="button" data-action="'+action+'" '+extra+' class="'+cls+'">'+label+'</button>';
  }
  function header(title,sub){
    return '<header class="po-course-header"><div><span>POWER ON III · LEARNING COURSES</span><h2>'+escape(title)+'</h2><p>'+escape(sub)+'</p></div>'+button("close","✕ 終了",'aria-label="コース画面を閉じる"',"po-course-exit")+'</header>';
  }
  function chooser(){
    const c=currentContext;
    return header("Choose Your Learning Course","Lesson "+c.lesson+" · Part "+c.part+" · "+c.level)+
      '<div class="po-course-intro"><strong>学び方を、自分で選ぶ。</strong><p>どのコースでも途中で変更できます。Story Matchの4モードと成績はそのまま残ります。</p></div>'+
      '<div class="po-course-cards">'+
      ['mastery','speed','free'].map(type=>{
        const conf=core.COURSES[type],n=type==="mastery"?"01":type==="speed"?"02":"03";
        const names=type==="mastery"?"語彙 → Story Theater → 音読 → 内容理解":type==="speed"?"音読 → 内容理解 → 苦手だけ復習":"従来の4ステップとStory Matchを自由に選ぶ";
        return button("choose",'<span class="po-course-num">'+n+'</span><span class="po-course-card-icon">'+(type==="mastery"?"📘":type==="speed"?"⚡":"🧭")+'</span><strong>'+escape(conf.title)+'</strong><em>'+escape(conf.en)+'</em><span>'+escape(names)+'</span><b>このコースを選ぶ →</b>','data-course="'+type+'"','po-course-card po-course-'+type);
      }).join('')+'</div>'+
      (currentData.course&&currentData.course!=="free"?button("dashboard","保存したコースの続きへ →",'',"po-course-continue"):"");
  }
  function dashboard(){
    const c=currentContext,conf=core.COURSES[currentData.course],reading=checkReading(),recommended=nextRecommended();
    const stages=conf.steps.map((step,i)=>{
      const d=core.LABELS[step],isDone=completed(step);
      const detail=step==="reading"&&reading.total?'合格 '+reading.passed+' / '+reading.total+' scenes':step==="comprehension"&&currentData.best[conf===core.COURSES.mastery?"mastery":"speed"]!=null?'Best '+currentData.best[currentData.course]+'%':"";
      return '<article class="po-course-stage'+(isDone?' is-done':'')+(recommended===step?' is-next':'')+'">'+
        '<div class="po-course-stage-no">'+(i+1)+'</div><div class="po-course-stage-copy"><strong>'+d.icon+' '+escape(d.name)+'</strong><span>'+escape(d.ja)+'</span><small>'+escape(detail|| (isDone?"✓ 完了":recommended===step?"次におすすめ":"いつでも開始できます"))+'</small></div>'+
        button("stage",step==="comprehension"?"問題に挑戦 →":step==="review"?"復習する →":"学習する →",'data-step="'+step+'"',"po-course-start")+
        (!isDone&&["vocabulary","theater","review"].includes(step)?button("mark","学習済みにする",'data-step="'+step+'"',"po-course-mark"):"")+'</article>';
    }).join('');
    const finished=conf.steps.filter(completed).length;
    return header(conf.title,"Lesson "+c.lesson+" · Part "+c.part+" · "+c.level)+
      '<div class="po-course-overview"><div><strong>学習の進み方</strong><span>途中のStepからも開始できます</span></div><b>'+finished+' / '+conf.steps.length+' 完了</b></div>'+
      '<div class="po-course-progress"><i style="width:'+(finished/conf.steps.length*100)+'%"></i></div>'+
      '<div class="po-course-stage-list">'+stages+'</div>'+
      '<div class="po-course-tools">'+button("choosePage","コースを変更",'',"po-course-ghost")+
       button("free","自由学習へ戻る",'',"po-course-ghost")+
       button("progress","既存の学習記録を見る",'',"po-course-ghost")+'</div>'+
      '<p class="po-course-note">※「学習済み」は語彙・視聴・復習の自己チェック用です。音読の75%判定、内容理解の80%判定は実際の結果だけで記録されます。</p>';
  }
  function quizScreen(){
    if(!quiz){
      const p=pool(),size=p.length;
      return header("Comprehension Challenge","Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
        '<div class="po-course-quiz-setup"><h3>内容理解の問題に挑戦</h3><p>4択問題をランダム出題。日本語・英語は途中でも切り替えられます。</p>'+
        '<div class="po-course-lang"><span>出題言語</span>'+button("language","English",'data-lang="en" aria-pressed="'+(currentData.language==="en")+'"')+button("language","日本語",'data-lang="ja" aria-pressed="'+(currentData.language==="ja")+'"')+'</div>'+
        '<div class="po-course-count"><span>問題数</span>'+[5,10,20].map(n=>button("newQuiz",n+"問", 'data-count="'+n+'"'+(!size?' disabled':""))).join('')+'</div>'+
        (currentContext.level!=="standard"?'<p class="po-course-warning">現在の問題はStandard本文に対応しています。上部のLevelをStandardにしてから開始してください。</p>':"")+
        (!size?'<p class="po-course-warning">このPartの内容理解問題は準備中です。Story Theaterや音読は利用できます。</p>':"<p>このPartには"+size+"問の候補があります。</p>")+
        button("dashboard","← コースに戻る",'',"po-course-ghost")+'</div><p id="po-course-message" role="status" hidden></p>';
    }
    const q=quiz[quizIndex],lang=currentData.language,locale=q[lang],answered=quizAnswers[quizIndex],done=answered!==undefined;
    return header("Comprehension Challenge","Lesson "+currentContext.lesson+" · Part "+currentContext.part+" · Question "+(quizIndex+1)+"/"+quiz.length)+
      '<div class="po-course-question"><div class="po-course-question-top"><span>QUESTION '+(quizIndex+1)+' / '+quiz.length+'</span><span>'+escape(q.difficulty)+' · Paragraph '+q.paragraph+'</span></div>'+
      '<div class="po-course-lang">'+button("language","English",'data-lang="en" aria-pressed="'+(lang==="en")+'"')+button("language","日本語",'data-lang="ja" aria-pressed="'+(lang==="ja")+'"')+'</div>'+
      '<h3>'+escapeContent(locale[0])+'</h3><div class="po-course-answer-grid">'+locale[1].map((value,i)=>
        button("answer",'<b>'+String.fromCharCode(65+i)+'</b><span>'+escapeContent(value)+'</span>',
          'data-index="'+i+'"'+(done?' disabled':''),'po-course-answer'+(done?(i===q.correct?' correct':i===answered?' incorrect':''):''))
      ).join('')+'</div>'+
      (done?'<section class="po-course-feedback"><strong>'+(answered===q.correct?'✓ Correct! 正解':'✕ Incorrect · 正解 '+String.fromCharCode(65+q.correct))+'</strong><p>'+escape(q.explanation||"")+'</p><small>本文の根拠：'+escape(q.evidence||"")+'</small></section>':"")+
      '<div class="po-course-question-footer">'+(done?button("nextQuestion",quizIndex+1===quiz.length?"結果を見る →":"次の問題 →",'',"po-course-start"):"")+
      button("dashboard","中断してコースへ戻る",'',"po-course-ghost")+'</div></div>';
  }
  function resultScreen(){
    const res=latestResult;
    if(!res)return dashboard();
    return header("Challenge Result","Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
      '<section class="po-course-results"><h3>'+(res.percent>=80?"✓ MISSION CLEAR":"Review & Try Again")+'</h3><strong>'+res.percent+'<small>%</small></strong><p>'+res.score+' / '+res.total+' 正解 · 合格目標 80%</p>'+
      '<div class="po-course-result-actions">'+button("review","間違えた問題を復習する",'',"po-course-start")+
      button("retry","もう一度挑戦",'',"po-course-ghost")+button("dashboard","コースに戻る",'',"po-course-ghost")+'</div></section>';
  }
  function reviewScreen(){
    const wrongIds=currentData.lastQuizByCourse?.[currentData.course]?.wrong?.map(q=>q.id)||[];
    const byId=new Map(pool().map(q=>[q.id,q]));
    const misses=wrongIds.map(id=>byId.get(id)).filter(Boolean);
    return header("Targeted Review","間違えた問題を根拠から復習")+
      '<div class="po-course-review"><h3>苦手問題 '+misses.length+'問</h3>'+
      (misses.length?misses.map((q,i)=>'<article><strong>'+ (i+1)+'. '+escape(q[currentData.language]?.[0]||q.en[0])+'</strong><p>'+escape(q.explanation)+'</p><small>本文：'+escape(q.evidence)+'</small></article>').join(''):'<p>まだ復習対象はありません。内容理解問題に挑戦してください。</p>')+
      '<div class="po-course-result-actions">'+button("stage","Story Theaterでもう一度確認",'data-step="theater"',"po-course-start")+
      button("stage","語彙を復習",'data-step="vocabulary"',"po-course-ghost")+
      button("stage","内容理解問題を解く",'data-step="comprehension"',"po-course-ghost")+
      button("dashboard","コースに戻る",'',"po-course-ghost")+'</div></div>';
  }
  function paint(){
    const root=overlay();
    root.innerHTML='<div class="po-course-inner">'+
      (view==="choose"?chooser():view==="dashboard"?dashboard():view==="quiz"?quizScreen():view==="result"?resultScreen():reviewScreen())+
      '</div>';
    root.scrollTop=0;
  }
  function click(event){
    const btn=event.target.closest?.("button[data-action]");
    if(!btn||btn.disabled)return;
    const action=btn.dataset.action;
    switch(action){
      case "close":close();break;
      case "choose":choose(btn.dataset.course);break;
      case "choosePage":view="choose";paint();break;
      case "dashboard":openDashboard();break;
      case "free":choose("free");break;
      case "stage":stage(btn.dataset.step);break;
      case "mark":markStep(btn.dataset.step);break;
      case "language":setLanguage(btn.dataset.lang);break;
      case "newQuiz":newQuiz(Number(btn.dataset.count));break;
      case "answer":answer(Number(btn.dataset.index));break;
      case "nextQuestion":nextQuestion();break;
      case "retry":newQuiz(currentData.count);break;
      case "review":view="review";paint();break;
      case "progress":hide();floatButton(true);host.PowerOnPractice?.open?.("progress");break;
    }
  }
  function change(){}
  host.PowerOnCourses={open,openDashboard,close,choose,context,launchStep:stage,
    _test:{pool:()=>{refresh();return pool();},reading:checkReading,getData:()=>{refresh();return currentData;}}};
})(window);

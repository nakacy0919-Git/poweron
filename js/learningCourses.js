/* PowerOn Learning Courses — independent navigation, quiz, and course-only progress. */
(function(host){
  "use strict";
  const core=host.PowerOnCourseCore;
  if(!core)return;
  let view="choose",quiz=null,quizIndex=0,quizAnswers=[],quizTimes=[],quizLangs=[],latestResult=null,quizKind="comprehension";
  let questionStartedAt=0,pausedAt=null,activeLearningStep=null,activeScope=null;
  // UI-only timers; the scoring and existing Story Match storage are unchanged.
  let feedbackTimer=null,feedbackPaused=false;
  function cancelFeedbackTimer(){
    if(feedbackTimer!==null){(host.clearTimeout||clearTimeout)(feedbackTimer);feedbackTimer=null;}
    feedbackPaused=false;
  }
  function pauseFeedback(){
    if(!quiz||quizAnswers[quizIndex]===undefined||quizKind!=="vocabulary")return;
    cancelFeedbackTimer();feedbackPaused=true;paint();
  }
  function advanceVocabularyAfterFeedback(){
    if(quizKind!=="vocabulary"||!quiz||quizAnswers[quizIndex]===undefined)return;
    cancelFeedbackTimer();
    const capturedQuiz=quiz,capturedIndex=quizIndex;
    const correct=quizAnswers[quizIndex]===quiz[quizIndex].correct;
    feedbackTimer=(host.setTimeout||setTimeout)(()=>{
      feedbackTimer=null;
      if(view==="quiz"&&quiz===capturedQuiz&&quizIndex===capturedIndex&&!feedbackPaused){
        nextQuestion();
      }
    },correct?1500:2600);
  }
  function answerTone(correct){
    try{
      const Context=host.AudioContext||host.webkitAudioContext;
      if(!Context)return;
      const ctx=new Context(),osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type="sine";osc.frequency.setValueAtTime(correct?760:240,ctx.currentTime);
      if(correct)osc.frequency.exponentialRampToValueAtTime(1020,ctx.currentTime+.13);
      else osc.frequency.exponentialRampToValueAtTime(175,ctx.currentTime+.16);
      gain.gain.setValueAtTime(.0001,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(correct?.055:.04,ctx.currentTime+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+(correct?.24:.33));
      osc.connect(gain);gain.connect(ctx.destination);osc.start();
      osc.stop(ctx.currentTime+(correct?.25:.35));
      osc.onended=()=>ctx.close?.();
    }catch(_){/* Audio is optional and must never block answering. */}
  }
  const clock=()=>host.performance?.now?.()??Date.now();
  host.document.addEventListener?.("visibilitychange",()=>{
    if(host.document.hidden){if(quiz&&view==="quiz"&&quizAnswers[quizIndex]===undefined)pausedAt=clock();}
    else if(pausedAt!==null){questionStartedAt+=Math.max(0,clock()-pausedAt);pausedAt=null;}
  });
  let activeKey=null,currentData=null,currentContext=null,challengeActive=false,challengeRun=null;
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
      // The chooser stays inside the Lesson canvas; sidebar and tabs remain available.
      root.setAttribute("role","region");
      root.setAttribute("aria-label","PowerOn 学習コース");
      root.setAttribute("tabindex","-1");
      root.addEventListener("click",click);
      root.addEventListener("change",change);
      root.addEventListener("keydown",e=>{
        if(e.key==="Escape"){e.preventDefault();close();}
      });
      (host.document.getElementById("mainScreen")||host.document.body).appendChild(root);
    }
    // Use the selected Lesson illustration, not an opaque navy page background.
    root.style.backgroundImage="linear-gradient(rgba(250,253,255,.85),rgba(250,253,255,.89)),url('img/L"+(currentContext?.lesson||1)+".webp')";
    root.className=challengeActive?"po-course-overlay po-challenge-mode":"po-course-overlay";
    host.document.body.classList.add("po-course-open");
    return root;
  }
  function dismissChooser(){if(host.document.getElementById("po-course-overlay"))hide();}
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
  function close(){cancelFeedbackTimer();hide();floatButton(false);activeLearningStep=null;activeScope=null;challengeActive=false;challengeRun=null;}
  function open(){
    challengeActive=false;challengeRun=null;cancelFeedbackTimer();refresh();view="choose";quiz=null;quizAnswers=[];quizTimes=[];quizLangs=[];floatButton(false);
    host.document.body.classList.toggle("po-course-guided",[8,9,10].includes(currentContext.lesson));
    host.document.body.classList.remove("po-course-free-mode");
    paint();overlay().focus();
  }

  function launchChallenge(){
    if(typeof resetAppMode==="function")resetAppMode();
    cancelFeedbackTimer();refresh();
    if(currentContext.level!=="standard"){
      if(typeof currentLevel!=="undefined")currentLevel="standard";
      const level=host.document.getElementById("levelSelect");if(level)level.value="standard";
      if(typeof onScopeChange==="function")onScopeChange();
      refresh();
    }
    challengeActive=true;challengeRun=null;currentData.course="mastery";save();
    quiz=null;view="challengeIntro";floatButton(false);paint();overlay().focus?.();
  }
  function challengeAvailable(){
    const vocabulary=core.createVocabularyQuiz(currentContext.lesson,currentContext.part,
      typeof lessonVocab!=="undefined"?lessonVocab:{},Math.random,host.PowerOnCourseVocabGlosses||{}).length;
    const comprehension=pool().length;
    return {vocabulary,comprehension,ready:vocabulary>0&&comprehension>=10};
  }
  function beginChallenge(){
    if(!challengeActive||!challengeAvailable().ready)return;
    challengeRun={vocabulary:null,comprehension:null};
    currentData.course="mastery";save();newQuiz(10,"vocabulary");
  }
  function challengeIntro(){
    const a=challengeAvailable(),saved=currentData.challenge||{};
    return header("Check Understanding","Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
      '<section class="po-challenge-panel">'+partPicker()+
      '<span class="po-challenge-tag">MISSION · 3 STAGES</span><h3>全問正解でステージクリア！</h3>'+
      '<p>まず語彙に挑戦し、そのあと日本語・英語の順に本文理解を確認します。</p>'+
      '<div class="po-challenge-steps"><article><b>01</b><strong>Vocabulary</strong><small>語彙 '+a.vocabulary+'問 × 2言語</small></article>'+
      '<article><b>02</b><strong>First Stage</strong><small>日本語の内容理解 10問</small></article>'+
      '<article><b>03</b><strong>Second Stage</strong><small>English · 10 questions</small></article></div>'+
      '<p class="po-challenge-rule">合計'+(a.vocabulary*2+20)+'問。1問でも間違えると今回はステージクリアになりません。</p>'+
      (saved.clear?'<p class="po-challenge-saved">✓ このPartの過去のノーミス達成記録があります</p>':'')+
      (a.ready?button("beginChallenge","▶ "+(a.vocabulary*2+20)+"問のチャレンジを始める",'',"po-challenge-start"):
        '<p class="po-course-warning">問題準備中：語彙 '+a.vocabulary+'問、内容理解 '+a.comprehension+'/10</p>')+
      button("close","✕ 閉じる",'',"po-course-ghost")+'</section>';
  }
  function challengeGap(){
    const v=challengeRun?.vocabulary;
    if(!v)return challengeIntro();
    return header("Vocabulary Complete","Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
      '<section class="po-challenge-panel"><span class="po-challenge-tag">VOCABULARY FINISHED</span>'+
      '<h3>語彙 '+v.score+' / '+v.total+' 正解</h3>'+
      '<p>'+(v.clear?'✓ 語彙ステージはノーミス！':'ミスがありました。最後まで練習できますが、今回の全ステージクリアにはなりません。')+'</p>'+
      '<div class="po-challenge-steps"><article><b>02</b><strong>First Stage</strong><small>日本語 10問</small></article>'+
      '<article><b>03</b><strong>Second Stage</strong><small>English 10 questions</small></article></div>'+
      button("nextChallengeStage","▶ First Stage 日本語を開始",'',"po-challenge-start")+
      button("retryChallenge","最初からやり直す",'',"po-course-ghost")+'</section>';
  }
  function finishChallenge(){
    const v=challengeRun?.vocabulary,c=challengeRun?.comprehension;
    if(!v||!c)return;
    const score=v.score+c.score,total=v.total+c.total,percent=Math.round(score*100/Math.max(1,total));
    const perfect=v.clear&&c.clear&&v.total>=2&&c.total===20&&score===total;
    const old=currentData.challenge||{};
    currentData.challenge={...old,attempts:(old.attempts||0)+1,clear:!!(old.clear||perfect),
      lastClear:perfect,lastScore:score,lastTotal:total,lastPercent:percent,
      bestPercent:Math.max(old.bestPercent||0,percent),
      stages:{vocabulary:{score:v.score,total:v.total},japanese:c.sections?.ja||{score:0,total:10},
        english:c.sections?.en||{score:0,total:10}}};
    save();
  }
  function challengeResult(){
    const d=currentData.challenge||{},st=d.stages||{};
    const line=(title,s)=>'<div><span>'+title+'</span><strong>'+(s?.score||0)+' / '+(s?.total||0)+'</strong></div>';
    return header("Check Understanding · Result","Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
      '<section class="po-challenge-panel po-challenge-result"><h3>'+(d.lastClear?'✓ ALL CLEAR!':'↻ もう一度挑戦しよう')+'</h3>'+
      '<p>今回 '+(d.lastScore||0)+' / '+(d.lastTotal||"?")+' 正解。すべて正解した場合だけステージクリアです。</p>'+
      '<div class="po-challenge-score">'+line("Vocabulary",st.vocabulary)+line("First Stage 日本語",st.japanese)+line("Second Stage English",st.english)+'</div>'+
      button("retryChallenge","↻ もう一度挑戦",'',"po-challenge-start")+
      button("progress","◉ My Progress",'',"po-course-ghost")+
      button("close","✕ 終了",'',"po-course-ghost")+'</section>';
  }

  function openDashboard(){
    cancelFeedbackTimer();refresh();view=currentData.course&&currentData.course!=="free"?"dashboard":"choose";
    if(view==="dashboard"&&currentData.lastQuizByCourse?.[currentData.course])latestResult=currentData.lastQuizByCourse[currentData.course];
    paint();floatButton(false);overlay().focus();
  }
  function choose(course){
    if(!core.COURSES[course])return;
    cancelFeedbackTimer();refresh();
    // Course question bank uses Standard text; switch only this lesson selector.
    if(course!=="free"&&currentContext.level!=="standard"){
      if(typeof currentLevel!=="undefined")currentLevel="standard";
      const level=host.document.getElementById("levelSelect");
      if(level)level.value="standard";
      if(typeof onScopeChange==="function")onScopeChange();
      refresh();
    }
    currentData.course=course;save();
    if(course==="free"){
      host.document.body.classList.add("po-course-free-mode");
      close();
      // Return to the original, unmodified four-step menu and Story Match modes.
      if(typeof resetAppMode==="function")resetAppMode();
      return;
    }
    view="dashboard";quiz=null;paint();
  }
  function checkReading(){
    const all=host.PowerOnPractice?.getProgress?.()?.scopes||{};
    return core.readingStatus(all[currentContext.partScope]?.sceneReading);
  }
  function status(){return core.courseStatus(currentData,currentData.course,checkReading());}
  function completed(step){return Boolean(status().steps[step]?.clear);}
  function nextRecommended(){
    const stages=core.COURSES[currentData.course]?.steps||[];
    return stages.find(x=>!completed(x))||stages.at(-1);
  }
  // Only the completion event after actual audio playback counts as watching.
  function theaterCompleted(){
    if(activeLearningStep!=="theater"||activeScope!==context().storageKey)return false;
    refresh();if(currentData.course!=="mastery")return false;
    currentData.watched.mastery=true;currentData.done.mastery.theater=true;save();return true;
  }
  function stage(step){
    if(!core.COURSES[currentData.course]?.steps.includes(step)&&!["theater","vocabulary"].includes(step))return;
    cancelFeedbackTimer();
    activeLearningStep=null;activeScope=null;
    if(step==="comprehension"||step==="vocabulary"){
      quizKind=step;quiz=null;quizIndex=0;quizAnswers=[];quizTimes=[];view="quiz";paint();return;
    }
    if(step==="review"){view="review";paint();return;}
    hide();floatButton(true);
    activeLearningStep=step;activeScope=currentContext.storageKey;
    try{
      if(step==="theater")host.PowerOnPractice.openTheater();
      else if(step==="reading")host.PowerOnPractice.open("sceneReading");
    }catch(_){
      activeLearningStep=null;activeScope=null;
      openDashboard();notice("この学習画面を開けませんでした。LessonとPartを確認してください。");
    }
  }
  function notice(message){
    const el=host.document.getElementById("po-course-message");
    if(el){el.textContent=message;el.hidden=!message;}
  }
  function newQuiz(count,kind=quizKind){
    cancelFeedbackTimer();
    if(currentContext.level!=="standard"){notice("学習コースの問題はStandard本文に対応しています。");return;}
    if(!["vocabulary","comprehension","review"].includes(kind))return;
    let questions=[],available=[];
    if(kind==="vocabulary"){
      const vocab=typeof lessonVocab!=="undefined"?lessonVocab:{};
      questions=core.createVocabularyQuiz(currentContext.lesson,currentContext.part,vocab,Math.random,host.PowerOnCourseVocabGlosses||{});
      if(!questions.length){notice("このPartの語彙問題は準備中です。");return;}
    }else{
      available=pool();
      if(kind==="review"){
        const wrong=new Set(currentData.pendingWrong[currentData.course]||[]);
        available=available.filter(q=>wrong.has(q.id)||wrong.has(q.id+"::ja")||wrong.has(q.id+"::en"));
      }
      if(!available.length){notice(kind==="review"?"復習対象の間違いはありません。":"このPartの内容理解問題は準備中です。");return;}
      const size=Math.min(available.length,kind==="review"?20:(Number(count)||currentData.count||10));
      questions=core.createQuiz(available,{count:size,course:currentData.course,
        priorityIds:(currentData.pendingWrong[currentData.course]||[]).map(id=>id.replace(/::(?:ja|en)$/,""))});
    }
    quiz=core.createBilingualQuiz(questions);quizKind=kind;quizIndex=0;quizAnswers=[];quizTimes=[];quizLangs=[];
    questionStartedAt=clock();pausedAt=null;
    if(kind==="comprehension")currentData.count=Math.min(20,Number(count)||10);
    save();view="quiz";paint();
  }

  function answer(index){
    if(!quiz||quizAnswers[quizIndex]!==undefined||!Number.isInteger(index)||index<0||index>3)return;
    const now=clock(),elapsed=pausedAt===null?now-questionStartedAt:pausedAt-questionStartedAt;
    quizTimes[quizIndex]=Math.max(1,elapsed/1000);quizLangs[quizIndex]=quiz[quizIndex].phase;quizAnswers[quizIndex]=index;
    if(quizAnswers.length===quiz.length){
      latestResult=core.updateQuiz(currentData,currentData.course,quizKind,quiz,quizAnswers,quizTimes,quizLangs);
      if(quizKind!=="vocabulary")currentData.lastQuizByCourse[currentData.course]={
        ...latestResult,wrong:latestResult.wrong.map(x=>({id:x.id}))
      };
      if(challengeActive&&challengeRun){
        if(quizKind==="vocabulary")challengeRun.vocabulary=latestResult;
        if(quizKind==="comprehension"){challengeRun.comprehension=latestResult;finishChallenge();}
      }
      save();
    }
    paint();
    if(quizKind==="vocabulary"){
      answerTone(quizAnswers[quizIndex]===quiz[quizIndex].correct);
      // Show the explanation until the learner taps the single clear Next button.
    }
  }
  function nextQuestion(){
    if(!quiz||quizAnswers[quizIndex]===undefined)return;
    cancelFeedbackTimer();
    if(quizIndex===quiz.length-1){view=challengeActive?(quizKind==="vocabulary"?"challengeGap":"challengeResult"):"result";paint();return;}
    // Never switch language mid-question. Finish the Japanese half first.
    if(quizIndex+1===quiz.length/2){if(!challengeActive||quizKind!=="vocabulary"){view="phaseIntro";paint();return;}}
    quizIndex++;questionStartedAt=clock();pausedAt=null;paint();
  }
  function startEnglish(){
    if(!quiz||view!=="phaseIntro"||quizIndex+1!==quiz.length/2)return;
    quizIndex++;view="quiz";questionStartedAt=clock();pausedAt=null;paint();
  }
  function escapeContent(s){return escape(s).replace(/\n/g," ");}
  function button(action,label,extra="",cls=""){
    return '<button type="button" data-action="'+action+'" '+extra+' class="'+cls+'">'+label+'</button>';
  }
  function header(title,sub){
    return '<header class="po-course-header"><div><span>'+(challengeActive?"POWER ON III · CHECK UNDERSTANDING":"POWER ON III · LEARNING COURSES")+'</span><h2>'+escape(title)+'</h2><p>'+escape(sub)+'</p></div>'+button("close","✕ 終了",'aria-label="コース画面を閉じる"',"po-course-exit")+'</header>';
  }
  function partPicker(){
    if(![8,9,10].includes(currentContext.lesson))return "";
    const parts=Object.keys(typeof lessonStructure!=="undefined"?lessonStructure[currentContext.lesson]||{}:{});
    return '<div class="po-course-part-picker" role="group" aria-label="学習するPart">'+
      '<span class="po-course-part-label">学習するPart</span>'+
      '<div class="po-course-part-buttons">'+parts.map(p=>
        button("selectPart","Part "+escape(p),
          'data-part="'+escape(p)+'" aria-pressed="'+(Number(p)===currentContext.part)+'"',
          "po-course-part-button"+(Number(p)===currentContext.part?" is-active":""))
      ).join("")+'</div></div>';
  }
  function selectPart(part){
    if(!Object.prototype.hasOwnProperty.call(typeof lessonStructure!=="undefined"?lessonStructure[currentContext.lesson]||{}:{},part))return;
    if(String(currentContext.part)===String(part))return;
    cancelFeedbackTimer();
    const input=host.document.getElementById("partSelect"),para=host.document.getElementById("paraSelect");
    if(input)input.value=part;
    if(typeof updateParaSelect==="function")updateParaSelect();
    if(para)para.value="full";
    if(typeof onScopeChange==="function")onScopeChange();
    refresh();quiz=null;quizAnswers=[];quizTimes=[];quizLangs=[];
    view=challengeActive?"challengeIntro":"choose";challengeRun=null;paint();
  }
  function chooser(){
    const c=currentContext;
    return header("Choose Your Learning Course","Lesson "+c.lesson+" · Part "+c.part+" · "+c.level)+
      partPicker()+'<div class="po-course-intro"><strong>学び方を、自分で選ぶ。</strong><p>どのコースでも途中で変更できます。Story Matchの4モードと成績はそのまま残ります。</p></div>'+
      '<div class="po-course-cards">'+
      ['mastery','speed','free'].map(type=>{
        const conf=core.COURSES[type],n=type==="mastery"?"01":type==="speed"?"02":"03";
        const names=type==="mastery"?"語彙 → Story Theater → 音読 → 内容理解":type==="speed"?"音読 → 内容理解 → 苦手だけ復習":"従来の4ステップとStory Matchを自由に選ぶ";
        return button("choose",'<span class="po-course-num">'+n+'</span><span class="po-course-card-icon">'+(type==="mastery"?"📘":type==="speed"?"⚡":"🧭")+'</span><strong>'+escape(conf.title)+'</strong><em>'+escape(conf.en)+'</em><span>'+escape(names)+'</span><b>このコースを選ぶ →</b>','data-course="'+type+'"'+(![8,9,10].includes(c.lesson)&&type!=="free"?' disabled':''),'po-course-card po-course-'+type);
      }).join('')+'</div>'+
      (currentData.course&&currentData.course!=="free"?button("dashboard","保存したコースの続きへ →",'',"po-course-continue"):"");
  }
  function dashboard(){
    const c=currentContext,conf=core.COURSES[currentData.course],progress=status();
    const reading=checkReading(),recommended=nextRecommended();
    const stages=conf.steps.map((step,i)=>{
      const label=core.LABELS[step],state=progress.steps[step],isDone=state.clear;
      const latest=step==="vocabulary"?currentData.latest.mastery.vocabulary:
        step==="comprehension"?currentData.latest[currentData.course].comprehension:null;
      const detail=step==="reading"?"合格 "+reading.passed+" / "+reading.total+" scenes":
        step==="review"?"未克服 "+(currentData.pendingWrong[currentData.course]||[]).length+" 問":
        latest?.bilingual?
          "日本語 "+latest.sections.ja.score+"/"+latest.sections.ja.total+
          " · English "+latest.sections.en.score+"/"+latest.sections.en.total+
          " · 平均"+latest.averageSeconds+"秒":
        latest?latest.score+" / "+latest.total+" 正解 · 平均"+latest.averageSeconds+"秒":isDone?"検証済み":"まだ未達成";
      const recommendedStep=!progress.finished&&recommended===step;
      return '<article class="po-course-stage po-course-step-'+(i+1)+(isDone?' is-done':'')+(recommendedStep?' is-next':'')+'">'+
        '<div class="po-course-stage-top"><span class="po-course-stage-no">'+(isDone?'✓':i+1)+'</span>'+
        '<span class="po-course-stage-kicker">STEP '+String(i+1).padStart(2,"0")+'</span>'+
        '<span class="po-course-stage-badge'+(recommendedStep?' is-next':'')+'">'+
          (isDone?"✓ CLEAR":recommendedStep?"NEXT":"未クリア")+'</span></div>'+
        '<div class="po-course-stage-copy"><strong>'+label.icon+' '+escape(label.name)+'</strong>'+
        '<span>'+escape(label.ja)+'</span><small>'+escape(detail)+'</small>'+
        '<div class="po-stage-meter" role="progressbar" aria-label="'+escape(label.name)+' マスター率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+state.mastery+'"><i style="width:'+state.mastery+'%"></i></div>'+
        '<small>マスター率 '+state.mastery+'%</small></div>'+
        button("stage",isDone?"もう一度学習する →":recommendedStep?"このStepから始める →":"学習する →",
          'data-step="'+step+'"',"po-course-start")+'</article>';
    }).join("");
    return header(conf.title,"Lesson "+c.lesson+" · Part "+c.part+" · "+c.level)+partPicker()+
      '<div class="po-course-overview"><div><strong>マスター率 '+progress.mastery+'%</strong><span>'+(progress.finished?'🏆 コース修了！':''+progress.total+'つのStepを順番にマスターしよう')+'</span></div><b>'+progress.passed+' / '+progress.total+' クリア</b></div>'+
      '<div class="po-course-progress" role="progressbar" aria-label="コース総合マスター率" aria-valuenow="'+progress.mastery+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+progress.mastery+'%"></i></div>'+
      '<div class="po-course-stage-list" aria-label="コースの学習ステップ">'+stages+'</div>'+
      '<div class="po-course-tools">'+button("choosePage","コースを変更",'',"po-course-ghost")+
       button("free","自由学習",'',"po-course-ghost")+
       button("progress","既存の学習記録を見る",'',"po-course-ghost")+'</div>'+
      '<details class="po-course-step-note"><summary>マスター率の計算方法・達成条件を見る</summary>'+
      '<p>マスター率 = 正解率70%＋解答速度20%＋再挑戦の安定性10%。' +
      '内容理解は日本語・英語それぞれ10問以上で両方全問正解するとクリア。速度はマスター率に反映しますが、速さだけで不合格にはなりません。' +
      '最高得点は記録しつつ、直近の理解度も表示します。音読は従来どおり全シーン75%以上が条件です。</p></details>';
  }
  function phaseIntro(){
    const half=quiz.length/2,correct=quiz.slice(0,half).filter((q,i)=>quizAnswers[i]===q.correct).length;
    return header("日本語ステージ完了！","Step 1 → Step 2 · Japanese to English")+
      '<section class="po-course-phase-intro"><span class="po-course-phase-celebration">✓</span>'+
      '<div class="po-course-phase-stages"><span class="is-done">STEP 1 日本語 ✓</span><span>→</span><span class="is-next">STEP 2 English</span></div>'+
      '<h3>日本語での内容確認が終わりました</h3>'+
      '<p class="po-course-phase-count">日本語：'+correct+' / '+half+' 正解</p>'+
      '<p>次は、同じ学習内容を<b>英語の問題・英語の選択肢</b>で確認しましょう。選択肢の並びも変わります。</p>'+
      '<p class="po-course-phase-note">ミッションクリアには両方のステージで全問正解が必要です。</p>'+
      button("startEnglish","English Stage を始める →",'',"po-course-start po-course-phase-start")+
      button("dashboard","コースへ戻る",'',"po-course-ghost")+'</section>';
  }
  function quizScreen(){
    if(!quiz){
      const vocabulary=quizKind==="vocabulary",size=vocabulary?
        Math.min(10,core.vocabularyPool(currentContext.lesson,currentContext.part,typeof lessonVocab!=="undefined"?lessonVocab:{}).length):pool().length;
      const heading=vocabulary?"Vocabulary Check":"Comprehension Challenge";
      const description=vocabulary?
        "日本語で意味を確認したあと、英語の説明を選びます。両方の全問正解でクリア。":
        "日本語で内容を確認したあと、英語で同じ内容に挑戦します。";
      const choice=(n)=>{
        const isPractice=n===5, primary=n===10, canStart=size>=n;
        const title=isPractice?"練習する":primary?"ミッションに挑戦":"発展に挑戦";
        const detail=n+"問 × 日本語・英語 = "+(n*2)+"問";
        return button("newQuiz",'<span class="po-course-choice-icon" aria-hidden="true">'+(isPractice?"✎":primary?"▶":"★")+'</span><strong>'+title+'</strong><small>'+detail+'</small>',
          'data-count="'+n+'"'+(canStart?"":" disabled"),"po-course-choice"+(primary?" is-primary":""));
      };
      return header(heading,"Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
        '<section class="po-course-quiz-setup po-course-setup-guided">'+
        '<div class="po-setup-heading"><span class="po-setup-kicker">STEP 1 · START</span><h3>'+heading+'</h3>'+
        '<p>'+(vocabulary?"単語の意味を確認し、次に英語で挑戦。":"本文の内容を日本語で確認し、次に英語で挑戦。")+'</p></div>'+
        '<div class="po-setup-roadmap" aria-label="学習の流れ"><div><b>①</b><strong>日本語で答える</strong></div><span aria-hidden="true">→</span><div><b>②</b><strong>Englishで答える</strong></div><span aria-hidden="true">→</span><div><b>✓</b><strong>結果を確認</strong></div></div>'+
        '<h4 class="po-setup-prompt">下のボタンを選んでスタート</h4>'+
        '<div class="po-course-choice-grid">'+(vocabulary?choice(size===10?10:size):[5,10,20].map(choice).join(""))+'</div>'+
        (currentContext.level!=="standard"?'<p class="po-course-warning">問題はStandard本文に対応しています。</p>':"")+
        (!size?'<p class="po-course-warning">このPartの問題は準備中です。</p>':
          '<p class="po-setup-footnote">'+(vocabulary?"日英両方の全問正解でクリア":"各言語10問以上の全問正解でクリア。5問は練習用")+' · 出題候補 '+size+'問</p>')+
        button("dashboard","← コースへ戻る",'',"po-course-ghost po-setup-back")+'</section><p id="po-course-message" role="status" hidden></p>';
    }
    const q=quiz[quizIndex],lang=q.phase,locale=q[lang],answered=quizAnswers[quizIndex],done=answered!==undefined;
    const half=quiz.length/2,partIndex=quizIndex%half+1,vocabulary=quizKind==="vocabulary";
    const japanese=lang==="ja",phaseLabel=japanese?"日本語":"English";
    const nextLabel=quizIndex===quiz.length-1?"結果を見る →":
      quizIndex+1===half?"英語ステージへ →":"次の問題 →";
    return header(vocabulary?"Vocabulary Check":quizKind==="review"?"Targeted Review Quiz":"Comprehension Challenge",
      "Lesson "+currentContext.lesson+" · Part "+currentContext.part+" · "+phaseLabel+" "+partIndex+"/"+half)+
      '<div class="po-course-question'+(vocabulary?' is-vocabulary':'')+'">'+
      '<div class="po-course-phase-stages" aria-label="出題ステージ">'+
        '<span class="'+(japanese?'is-next':'is-done')+'">STEP 1 日本語 '+(japanese?partIndex+'/'+half:'✓')+'</span>'+
        '<span>→</span><span class="'+(!japanese?'is-next':'')+'">STEP 2 English'+(!japanese?' '+partIndex+'/'+half:'')+'</span></div>'+
      '<div class="po-course-question-top"><span>QUESTION '+partIndex+' / '+half+' · '+phaseLabel+'</span>'+
      '<span>合計 '+(quizIndex+1)+' / '+quiz.length+' · '+escape(q.difficulty)+' · '+(vocabulary?'Vocabulary':'Paragraph '+q.paragraph)+'</span></div>'+
      '<h3>'+escapeContent(locale[0])+'</h3>'+
      '<div class="po-course-answer-grid">'+locale[1].map((value,i)=>
        button("answer",'<b>'+String.fromCharCode(65+i)+'</b><span>'+escapeContent(value)+'</span>',
          'data-index="'+i+'"'+(done?' disabled':''),'po-course-answer'+(done?(i===q.correct?' correct':i===answered?' incorrect':''):''))
      ).join('')+'</div>'+
      (done&&!vocabulary?'<section class="po-course-feedback"><strong>'+
        (answered===q.correct?'✓ Correct! 正解':'✕ Incorrect · 正解 '+String.fromCharCode(65+q.correct))+'</strong>'+
        '<p>'+escape(q.explanation||"")+'</p><small>根拠：'+escape(q.evidence||"")+'</small>'+
        '<small>解答時間 '+quizTimes[quizIndex].toFixed(1)+'秒 · 目標目安 '+core.targetSeconds(q,lang)+'秒（時間超過は不合格にはなりません）</small></section>':"")+
      '<div class="po-course-question-footer">'+(!vocabulary&&done?button("nextQuestion",nextLabel,'',"po-course-start"):"")+
      button(challengeActive?"backChallenge":"dashboard",challengeActive?"チャレンジを中断":"中断してコースへ戻る",'',"po-course-ghost")+'</div>'+
      (vocabulary&&done?
        '<div class="po-course-feedback-backdrop" role="status" aria-live="polite">'+
          '<section class="po-course-answer-popup '+(answered===q.correct?'is-correct':'is-incorrect')+'" aria-label="回答の説明">'+
          '<span class="po-course-popup-icon" aria-hidden="true">'+(answered===q.correct?'✓':'!')+'</span>'+
          '<strong>'+(answered===q.correct?'Correct! 正解':'Incorrect! 惜しい！')+'</strong>'+
          '<p class="po-course-popup-solution">'+(japanese?'正解：':'Correct answer: ')+'<b>'+String.fromCharCode(65+q.correct)+'. '+escapeContent(locale[1][q.correct])+'</b></p>'+
          '<p class="po-course-popup-explanation">'+escape(q.explanation||'')+'</p>'+
          '<small>'+escape(q.evidence||'')+'</small>'+
          '<div class="po-course-popup-actions">'+
          '<span>解説を確認したら次へ進んでください</span>'+
          button("nextQuestion",nextLabel,'',"po-course-popup-next")+
          '</div></section></div>':"")+'</div>';
  }
  function resultScreen(){
    const res=latestResult;if(!res)return dashboard();
    const ja=res.sections?.ja||{score:0,total:0},en=res.sections?.en||{score:0,total:0};
    const practiceOnly=quizKind==="comprehension"&&ja.total<10;
    return header("Challenge Result","Lesson "+currentContext.lesson+" · Part "+currentContext.part)+
      '<section class="po-course-results"><h3>'+(res.clear?"✓ MISSION CLEAR!":practiceOnly?"練習終了 · 本番は各言語10問以上":"もう一度挑戦しよう")+'</h3>'+
      '<strong>'+res.mastery+'<small>% Mastery</small></strong>'+
      '<div class="po-course-language-results"><div><span>STEP 1 日本語</span><strong>'+ja.score+' / '+ja.total+'</strong></div>'+
      '<div><span>STEP 2 English</span><strong>'+en.score+' / '+en.total+'</strong></div></div>'+
      '<p>合計 '+res.score+' / '+res.total+' 正解 · 正解率 '+res.percent+'% · 平均 '+res.averageSeconds+'秒/問</p>'+
      '<div class="po-course-score-breakdown"><span>正解率 '+res.accuracy+'%</span><span>速度 '+res.speed+'%</span><span>安定性 '+res.retention+'%</span></div>'+
      '<p>'+(res.clear?"日英両方で全問正解！ ミッション達成です。":
        '日本語・英語の両方で全問正解を目指そう。')+'</p>'+
      '<div class="po-course-result-actions">'+
      (quizKind==="comprehension"||quizKind==="review"?button("review","間違えた問題を復習",'',"po-course-start"):"")+
      button("retry","もう一度挑戦",'',"po-course-ghost")+button("dashboard","コースへ戻る",'',"po-course-ghost")+'</div></section>';
  }
  function reviewScreen(){
    const wrongIds=currentData.pendingWrong[currentData.course]||[];
    const byId=new Map(pool().map(q=>[q.id,q]));
    const misses=wrongIds.map(id=>({id,phase:id.endsWith("::ja")?"ja":id.endsWith("::en")?"en":null,
      q:byId.get(id.replace(/::(?:ja|en)$/,""))})).filter(item=>item.q);
    const clear=currentData.done?.[currentData.course]?.comprehension===true&&misses.length===0;
    return header("Targeted Review","間違えた日本語・英語の設問を確認し、再挑戦する")+
      '<div class="po-course-review"><h3>'+(clear?"✓ すべて克服しました！":"未克服 "+misses.length+" 問")+'</h3>'+
      (misses.length?misses.map((item,i)=>'<article><strong>'+(i+1)+'. '+(item.phase==="ja"?"日本語":item.phase==="en"?"English":"復習")+
        ' · '+escape(item.q[item.phase||"ja"]?.[0]||item.q.en[0])+
        '</strong><p>'+escape(item.q.explanation)+'</p><small>本文：'+escape(item.q.evidence)+'</small></article>').join(''):
        '<p>'+(clear?"復習ミッションクリアです。":"間違えた問題はまだありません。まず日英2段階の内容理解に挑戦しましょう。")+'</p>')+
      '<div class="po-course-result-actions">'+
      (misses.length?button("reviewQuiz","間違えた内容を日英で再テスト",'',"po-course-start"):"")+
      button("stage","Story Theaterで復習",'data-step="theater"',"po-course-ghost")+
      button("stage","語彙チェック",'data-step="vocabulary"',"po-course-ghost")+
      button("stage","内容理解に再挑戦",'data-step="comprehension"',"po-course-ghost")+
      button("dashboard","コースへ戻る",'',"po-course-ghost")+'</div></div>';
  }
  function paint(){
    const root=overlay();
    root.innerHTML='<div class="po-course-inner">'+
      (view==="challengeIntro"?challengeIntro():view==="challengeGap"?challengeGap():view==="challengeResult"?challengeResult():
      view==="choose"?chooser():view==="dashboard"?dashboard():view==="quiz"?quizScreen():view==="phaseIntro"?phaseIntro():view==="result"?resultScreen():reviewScreen())+
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
      case "choosePage":cancelFeedbackTimer();view="choose";paint();break;
      case "dashboard":openDashboard();break;
      case "free":choose("free");break;
      case "stage":stage(btn.dataset.step);break;
      case "selectPart":selectPart(String(btn.dataset.part));break;
      case "beginChallenge":beginChallenge();break;
      case "nextChallengeStage":if(challengeActive&&challengeRun?.vocabulary)newQuiz(10,"comprehension");break;
      case "retryChallenge":beginChallenge();break;
      case "backChallenge":cancelFeedbackTimer();quiz=null;challengeRun=null;view="challengeIntro";paint();break;
      case "newQuiz":newQuiz(Number(btn.dataset.count),quizKind);break;
      case "answer":answer(Number(btn.dataset.index));break;
      case "nextQuestion":nextQuestion();break;
      case "startEnglish":startEnglish();break;
      case "pauseFeedback":pauseFeedback();break;
      case "retry":newQuiz(quizKind==="vocabulary"?10:currentData.count,quizKind);break;
      case "review":cancelFeedbackTimer();view="review";paint();break;
      case "reviewQuiz":newQuiz(20,"review");break;
      case "progress":if(challengeActive)close();else{hide();floatButton(true);}host.PowerOnPractice?.open?.("progress");break;
    }
  }
  function change(event){
    if(event.target?.matches?.('[data-course-part]'))selectPart(String(event.target.value));
  }
  function lessonChanged(num){
    // A Lesson tab changes only the background; courses launch from the dedicated button.
    close();
    host.document.body.classList.toggle("po-course-guided",[8,9,10].includes(Number(num)));
    host.document.body.classList.remove("po-course-free-mode");
  }
  function scopeChanged(){
    if(!currentContext)return;
    if(context().storageKey!==currentContext.storageKey){
      cancelFeedbackTimer();quiz=null;quizAnswers=[];quizTimes=[];activeLearningStep=null;activeScope=null;
      refresh();
      if(host.document.getElementById("po-course-overlay")){
        view=challengeActive?"challengeIntro":"choose";challengeRun=null;paint();
      }
    }
  }
  host.PowerOnCourses={open,openDashboard,close,dismissChooser,choose,context,launchStep:stage,launchChallenge,
    lessonChanged,scopeChanged,theaterCompleted,
    _test:{pool:()=>{refresh();return pool();},reading:checkReading,
      getData:()=>{refresh();return currentData;},status:()=>{refresh();return status();},
      getView:()=>view,getQuiz:()=>quiz,getQuizKind:()=>quizKind}};
})(window);

// Lesson 8 Chunk Practice + best-score gate. Loaded after quiz.js.
(function installLesson8Practice(){
    "use strict";
    const POINTS = 10;
    // 10P刻みの得点に合わせて設定した学習到達基準。
    const MIN_MODULE_RATE = 0.6;
    const PART_PASS_POINTS = Object.freeze({L08_P1:310, L08_P2:300, L08_P3:200, L08_P4:160});
    const LESSON_PASS_POINTS = 1000;
    const STORAGE_KEY = "poweron_lesson8_progress_v1";
    const originalMenu = startVocabQuiz;
    const originalSetup = setupQuizData;
    const originalRender = renderQuizQuestion;
    const originalCheck = checkAnswer1;
    const originalTimer = startTimer;
    const originalResult = renderQuizResult;
    let earnedPoints = 0;
    let questionStarted = 0;
    let scoringMode = false;
    const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const partKey = () => (typeof currentKey === "string" ? currentKey.split("_").slice(0,2).join("_") : "");
    const supported = () => /^L08_P[1-4]$/.test(partKey());
    const quizScored = () => supported() && scoringMode && (quizMode === 1 || quizMode === 3 || quizMode === 4 || quizMode === 5);
    const html = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const maxFor = (part,kind) => {
        const items=kind==="vocab" ? (typeof lessonVocab!=="undefined"&&lessonVocab[part]) : (typeof lesson8Chunks!=="undefined"&&lesson8Chunks[part]);
        return Array.isArray(items)?items.length*POINTS:0;
    };
    function readProgress(){
        try {
            if(typeof localStorage==="undefined")return {};
            const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
            return value && typeof value==="object" && !Array.isArray(value) ? value : {};
        }catch(e){return {};}
    }
    function saveBest(part,kind,points){
        try{
            if(typeof localStorage==="undefined")return false;
            const data=readProgress();
            const previous=data[part] && data[part][kind];
            const max=maxFor(part,kind);
            if(!max)return false;
            if(!data[part] || typeof data[part]!=="object")data[part]={};
            if(!previous || previous.max!==max || points>previous.points){
                data[part][kind]={points,max,at:new Date().toISOString()};
                localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
            }
            return true;
        }catch(e){return false;}
    }
    function status(part){
        const record=readProgress()[part]||{};
        const vm=maxFor(part,"vocab"),cm=maxFor(part,"chunk");
        const vp=record.vocab && record.vocab.max===vm ? Math.min(vm,Math.max(0,Number(record.vocab.points)||0)) : 0;
        const cp=record.chunk && record.chunk.max===cm ? Math.min(cm,Math.max(0,Number(record.chunk.points)||0)) : 0;
        const pass=PART_PASS_POINTS[part]||Infinity;
        const minV=Math.ceil(vm*MIN_MODULE_RATE/POINTS)*POINTS;
        const minC=Math.ceil(cm*MIN_MODULE_RATE/POINTS)*POINTS;
        const vocabDone=!!(record.vocab&&record.vocab.max===vm);
        const chunkDone=!!(record.chunk&&record.chunk.max===cm);
        const vRemaining=Math.max(0,minV-vp);
        const cRemaining=Math.max(0,minC-cp);
        const remaining=Math.max(0,pass-vp-cp,vRemaining+cRemaining);
        const ready=vm>0 && cm>0 && vocabDone && chunkDone &&
            vp>=minV && cp>=minC && vp+cp>=pass;
        return {vp,vm,cp,cm,total:vp+cp,max:vm+cm,pass,remaining,vRemaining,cRemaining,
            minV,minC,ready,vocabDone,chunkDone};
    }
    function overview(){
        const keys=Object.keys(PART_PASS_POINTS);
        const parts=keys.map(part=>({part,...status(part)}));
        const total=parts.reduce((sum,p)=>sum+p.total,0);
        const max=parts.reduce((sum,p)=>sum+p.max,0);
        return {parts,total,max,pass:LESSON_PASS_POINTS,
            remaining:Math.max(0,LESSON_PASS_POINTS-total),
            ready:parts.every(p=>p.ready)&&total>=LESSON_PASS_POINTS};
    }
    function summary(part){
        const s=status(part);
        const label=part.replace("L08_P","Part ");
        const completed=s.vocabDone&&s.chunkDone;
        const moduleNeeds=[
            s.vRemaining?`単語あと${s.vRemaining}P`:"",
            s.cRemaining?`チャンクあと${s.cRemaining}P`:""
        ].filter(Boolean).join("・");
        const message=s.ready?"Part合格！ 2つのミッションを達成しました":
            `合格ライン ${s.pass}Pまで、あと${s.remaining}P${moduleNeeds?`（${moduleNeeds}）`:""}`;
        return `<section class="l8-score-summary" aria-label="${label}の現在の獲得ポイント">
            <div class="l8-score-heading">
              <span class="l8-score-label">${label} · 現在の獲得ポイント</span>
              <strong class="l8-score-amount">${s.total}<small> / ${s.max} P</small></strong>
            </div>
            <div class="l8-score-track" role="progressbar" aria-label="${label}の進捗" aria-valuemin="0" aria-valuemax="${s.max}" aria-valuenow="${s.total}">
              <div style="width:${s.max?Math.round(s.total/s.max*100):0}%"></div>
            </div>
            <div class="l8-score-grid">
                <span>Mission 1・単語 <b>${s.vp} / ${s.vm} P${s.vocabDone?"":" · 未挑戦"}</b></span>
                <span>Mission 2・チャンク <b>${s.cp} / ${s.cm} P${s.chunkDone?"":" · 未挑戦"}</b></span>
            </div>
            <p class="l8-score-status">${message}</p>
            ${!completed?'<p class="l8-score-note">単語・チャンク両方の結果が必要です。各モードで60%以上が合格条件です。</p>':""}
        </section>`;
    }
    function dashboard(part){
    const all=overview();
    return `<div class="l8-dashboard">
        ${summary(part)}
        <details class="l8-overview-details">
          <summary><strong>Lesson 8 全体：${all.total} / ${all.max} P</strong><span>${all.ready?"全体合格！":"最終目標 1,000P＋各Part合格"} · Part別の成績を見る</span></summary>
          <div class="l8-part-overview" aria-label="Lesson 8各Partの獲得ポイント">
            ${all.parts.map(p=>`<div class="l8-part-chip ${p.part===part?"is-current":""}">
                <span>${p.part.replace("L08_P","Part ")}</span>
                <strong>${p.total} / ${p.max} P</strong>
                <small>${p.ready?"合格":p.pass+"Pで合格"}</small>
            </div>`).join("")}
          </div>
        </details>
    </div>`;
}
    function renderMissionMenu(part) {
    const score=status(part), num=part.replace("L08_P","");
    const vocabLabel=score.vp>=score.minV && score.vocabDone ? "達成" : score.vocabDone ? "再挑戦" : "未挑戦";
    const chunkLabel=score.cp>=score.minC && score.chunkDone ? "達成" : score.chunkDone ? "再挑戦" : "未挑戦";
    return `<div class="quiz-menu-container l8-scored-menu l8-missions">
        <header class="l8-mission-header">
          <span class="l8-eyebrow">LESSON 8 · PART ${num}</span>
          <h2 class="quiz-menu-title">2つのミッションに挑戦しよう！</h2>
          <p>① 単語の意味 → ② 本文のチャンクの意味。両方をクリアしてPart ${num} 合格を目指そう。</p>
        </header>
        <div class="l8-mission-cards">
          <button class="l8-mission-card l8-mission-vocab" onclick="setupQuizData(5)">
            <span class="l8-mission-top"><span>MISSION 1</span><small>${vocabLabel}</small></span>
            <strong>単語クイズ <span>英語 ⇄ 日本語</span></strong>
            <span class="l8-mission-description">英→日・日→英が混ざった4択問題。1単語1問で挑戦！</span>
            <span class="l8-mission-points">${score.vp} / ${score.vm} P　<span>2秒以内の正解で10P</span></span>
          </button>
          <button class="l8-mission-card l8-mission-chunk" onclick="setupQuizData(4)">
            <span class="l8-mission-top"><span>MISSION 2</span><small>${chunkLabel}</small></span>
            <strong>チャンククイズ <span>英語 → 日本語</span></strong>
            <span class="l8-mission-description">本文の英語のまとまりに合う日本語を4択で選ぼう。</span>
            <span class="l8-mission-points">${score.cp} / ${score.cm} P　<span>5秒以内の正解で10P</span></span>
          </button>
        </div>
        ${dashboard(part)}
        <p class="l8-mission-rule">合格条件：単語・チャンクを各60%以上 ＋ Part ${num} 合計 ${score.pass}P以上。何度でも挑戦でき、ベストスコアを保存します。</p>
        <details class="l8-optional"><summary>おまけ：声で単語を答える（得点対象外）</summary>
          <button class="l8-secondary-btn" onclick="setupQuizData(2)">🎙️ Voice Speakingを開く</button>
        </details>
        <button class="l8-close-button" onclick="closeVocabQuiz()">× クイズを終了</button>
      </div>`;
}

    function setupMixedVocabulary(part) {
    const items=typeof lessonVocab!=="undefined"?lessonVocab[part]:null;
    if(!Array.isArray(items)||items.length<4){alert("このPartの単語が見つかりません。");return;}
    quizSessionId++;
    stopQuizRecognition();
    clearInterval(quizTimer);
    isQuizTransitioning=false;
    quizMode=5;
    isTimerEnabled=true;
    const shuffled=items.slice().sort(()=>Math.random()-0.5);
    const english=[...new Set(items.map(x=>x.word))];
    const japanese=[...new Set(items.map(x=>x.meaning))];
    quizQuestions=shuffled.map((v,i)=>{
        const direction=i%2===0?"en-ja":"ja-en";
        const answer=direction==="en-ja"?v.meaning:v.word;
        const pool=direction==="en-ja"?japanese:english;
        const alternatives=pool.filter(x=>x!==answer).sort(()=>Math.random()-0.5).slice(0,3);
        const choices=[answer,...alternatives].sort(()=>Math.random()-0.5);
        return {word:v.word,meaning:v.meaning,correct:answer,choices,direction};
    });
    currentQuizIndex=0;
    quizScore=0;
    renderQuizQuestion();
}

    function renderMixedQuestion() {
    clearInterval(quizTimer);
    isQuizTransitioning=false;
    if(currentMode!=="quiz")return;
    if(currentQuizIndex>=quizQuestions.length){renderQuizResult();return;}
    const question=quizQuestions[currentQuizIndex],reverse=question.direction==="ja-en";
    const display=document.getElementById("targetTextDisplay");
    display.innerHTML=`<section class="l8-chunk-screen l8-mixed-screen">
       <div class="l8-chunk-kicker">MISSION 1 · 単語クイズ · 英語 ⇄ 日本語</div>
       <div class="l8-chunk-meta"><span>問題 ${currentQuizIndex+1} / ${quizQuestions.length}</span><b>今回 ${earnedPoints} P</b></div>
       <div class="timer-container"><div id="tBar" class="timer-bar"></div></div>
       <p class="l8-chunk-instruction">${reverse?"日本語に合う英単語はどれ？":"英単語の日本語の意味はどれ？"}（2秒以内で10P）</p>
       <div class="l8-chunk-text l8-vocab-question">${html(reverse?question.meaning:question.word)}</div>
       <div class="quiz-choices l8-chunk-choices">
         ${question.choices.map((choice,index)=>`<button class="quiz-choice-btn l8-chunk-choice" onclick="checkLesson8MixedAnswer(this,${index})">${html(choice)}</button>`).join("")}
       </div>
    </section>`;
    startTimer();
}

    function gradeMissionChoice(btn,index,limitMs){
    if(!quizScored() || currentMode!=="quiz" || isQuizTransitioning)return;
    if(now()-questionStarted>limitMs){handleTimeOut();return;}
    const q=quizQuestions[currentQuizIndex];
    if(!q || !Number.isInteger(index) || index<0 || index>=q.choices.length)return;
    isQuizTransitioning=true;
    clearInterval(quizTimer);
    const buttons=btn.parentElement.querySelectorAll("button");
    buttons.forEach(b=>{b.disabled=true;b.style.pointerEvents="none";});
    if(q.choices[index]===q.correct){
        quizScore++;
        earnedPoints+=POINTS;
        btn.style.background="#2f8067";btn.style.color="#fff";
        if(typeof playGentleQuizSound==="function")playGentleQuizSound();
    }else{
        btn.style.background="#b44545";btn.style.color="#fff";
        buttons.forEach((b,i)=>{
            if(q.choices[i]===q.correct){b.style.background="#e7f5ef";b.style.borderColor="#2f8067";b.style.color="#234f40";}
        });
    }
    const session=quizSessionId;
    setTimeout(()=>{
        if(currentMode==="quiz" && quizSessionId===session){currentQuizIndex++;renderQuizQuestion();}
    },800);
}
    window.startVocabQuiz=function(){
        scoringMode=false;
        originalMenu();
        if(!supported())return;
        const el=document.getElementById("targetTextDisplay");
        if(el)el.innerHTML=renderMissionMenu(partKey());
    };
    window.startChunkPractice=function(){
        if(!supported()){alert("Chunk PracticeはLesson 8のPart 1〜4で利用できます。");return;}
        window.startVocabQuiz();
        window.setupQuizData(4);
    };
    window.setupQuizData=function(mode){
        scoringMode=supported()&&(mode===1||mode===3||mode===4||mode===5);
        earnedPoints=0;
        questionStarted=0;
        if(mode===5){
            if(!supported()){alert("Mission 1はLesson 8のPart 1〜4で利用できます。");return;}
            setupMixedVocabulary(partKey());
            return;
        }
        if(mode!==4){
            if(scoringMode)isTimerEnabled=true;
            originalSetup(mode);
            return;
        }
        if(!supported()){alert("Chunk PracticeはLesson 8のみ対応しています。");return;}
        const part=partKey();
        const items=(typeof lesson8Chunks!=="undefined")?lesson8Chunks[part]:null;
        if(!Array.isArray(items)||items.length<4){alert("チャンクの問題データが見つかりません。");return;}
        quizSessionId++;
        stopQuizRecognition();
        clearInterval(quizTimer);
        isQuizTransitioning=false;
        quizMode=4;
        isTimerEnabled=true;
        const pool=[...new Set(items.map(x=>x.ja))];
        quizQuestions=items.map(item=>{
            const fakes=pool.filter(x=>x!==item.ja).sort(()=>Math.random()-0.5).slice(0,3);
            const choices=[item.ja,...fakes].sort(()=>Math.random()-0.5);
            return {word:item.en,meaning:item.ja,correct:item.ja,choices};
        }).sort(()=>Math.random()-0.5);
        currentQuizIndex=0;
        quizScore=0;
        renderQuizQuestion();
    };
    window.renderQuizQuestion=function(){
        if(quizScored()&&quizMode===5){renderMixedQuestion();return;}
        if(!quizScored()||quizMode!==4){
            originalRender();
            return;
        }
        clearInterval(quizTimer);
        isQuizTransitioning=false;
        if(currentMode!=="quiz")return;
        if(currentQuizIndex>=quizQuestions.length){renderQuizResult();return;}
        const q=quizQuestions[currentQuizIndex];
        const display=document.getElementById("targetTextDisplay");
        display.innerHTML=`<section class="l8-chunk-screen">
          <div class="l8-chunk-kicker">Lesson 8 · ${html(partKey().replace("L08_P","Part "))} · CHUNK PRACTICE</div>
          <div class="l8-chunk-meta">Question ${currentQuizIndex+1} / ${quizQuestions.length}　 <b>${earnedPoints} P</b></div>
          <div class="timer-container"><div id="tBar" class="timer-bar"></div></div>
          <p class="l8-chunk-instruction">次の英語チャンクの意味を選んでください（5秒以内で10P）</p>
          <div class="l8-chunk-text">${html(q.word)}</div>
          <div class="quiz-choices l8-chunk-choices">
              ${q.choices.map((choice,i)=>`<button class="quiz-choice-btn l8-chunk-choice" onclick="checkLesson8ChunkAnswer(this,${i})">${html(choice)}</button>`).join("")}
          </div>
        </section>`;
        startTimer();
    };
    window.startTimer=function(){
        if(!quizScored()){originalTimer();return;}
        clearInterval(quizTimer);
        const timeLimit=quizMode===4?5000:2000;
        timeLeft=timeLimit/100;
        questionStarted=now();
        const index=currentQuizIndex,session=quizSessionId;
        const bar=document.getElementById("tBar");
        quizTimer=setInterval(()=>{
            if(currentMode!=="quiz"||session!==quizSessionId||index!==currentQuizIndex){
                clearInterval(quizTimer);return;
            }
            const remaining=Math.max(0,timeLimit-(now()-questionStarted));
            timeLeft=Math.ceil(remaining/100);
            if(bar)bar.style.width=(remaining/timeLimit*100)+"%";
            if(!remaining){clearInterval(quizTimer);handleTimeOut();}
        },50);
    };
    window.checkAnswer1=function(btn,selected,correct){
        if(quizScored()&&(quizMode===1||quizMode===3)
           &&currentMode==="quiz"&&!isQuizTransitioning
           &&selected===correct &&now()-questionStarted<=2000){
            earnedPoints+=POINTS;
        }
        originalCheck(btn,selected,correct);
    };
    window.checkLesson8MixedAnswer=function(btn,index){
        if(quizMode!==5)return;
        gradeMissionChoice(btn,index,2000);
    };
    window.checkLesson8ChunkAnswer=function(btn,index){
        if(quizMode!==4)return;
        gradeMissionChoice(btn,index,5000);
    };
    window.renderQuizResult=function(){
        if(!quizScored()){originalResult();return;}
        isQuizTransitioning=true;
        stopQuizRecognition();
        clearInterval(quizTimer);
        const part=partKey();
        const kind=quizMode===4?"chunk":"vocab";
        const max=quizQuestions.length*POINTS;
        const saved=saveBest(part,kind,earnedPoints);
        const s=status(part);
        const display=document.getElementById("targetTextDisplay");
        const title=quizMode===4?"Mission 2・チャンク":"Mission 1・単語";
        display.innerHTML=`<section class="l8-chunk-screen l8-result">
          <h2>${title} · ${html(part.replace("L08_P","Part "))}</h2>
          <div class="l8-result-points">${earnedPoints} <small>/ ${max} P</small></div>
          <p>${quizScore} / ${quizQuestions.length} 問正解　（制限時間内に正解すると10P）</p>
          <div class="l8-result-overview">${dashboard(part)}</div>
          <p class="l8-score-note">${saved?"この端末にベストスコアを保存しました。":"保存できませんでした。ブラウザの保存設定を確認してください。"}</p>
          ${s.ready?
              `<p class="l8-pass-message">Part合格！ 2つのミッションを達成しました。</p>
               <button class="l8-next-btn" onclick="startVocabQuiz()">Partのミッション一覧へ</button>`:
              quizMode===5 && (!s.chunkDone || s.cRemaining>0)?
              `<button class="l8-next-btn" onclick="setupQuizData(4)">次へ：Mission 2 チャンクに挑戦</button>
               <button class="l8-secondary-btn" onclick="setupQuizData(5)">単語をもう一度</button>`:
              quizMode===4 && (!s.vocabDone || s.vRemaining>0)?
              `<button class="l8-next-btn" onclick="setupQuizData(5)">Mission 1 単語に挑戦</button>
               <button class="l8-secondary-btn" onclick="setupQuizData(4)">チャンクをもう一度</button>`:
              `<button class="l8-next-btn" onclick="setupQuizData(${quizMode})">もう一度挑戦する</button>`}
          <button class="l8-secondary-btn" onclick="startVocabQuiz()">クイズメニューへ</button>
          <button class="l8-secondary-btn" onclick="closeVocabQuiz()">終了</button>
        </section>`;
        if(typeof PowerOnPractice!=="undefined" && quizQuestions.length)
            PowerOnPractice.captureLegacy('vocabulary',Math.round(quizScore/quizQuestions.length*100));
        if(s.ready && typeof fireConfetti==="function")fireConfetti();
    };
    window.getLesson8PracticeStatus=function(part){return status(part||partKey());};
    window.getLesson8Overview=function(){return overview();};
})();

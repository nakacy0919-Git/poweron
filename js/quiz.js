// ==========================================
// quiz.js: 多機能単語テスト（PowerSlide Power On Ⅲ 最終完成版）
// ==========================================

let quizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let quizMode = 1; // 1: 英→日4択, 2: Voice Speaking, 3: 日→英4択
let isTimerEnabled = true;
let quizTimer = null;
let timeLeft = 50; // 5.0秒 (0.1秒単位)

let quizRecognition = null;
let isQuizTransitioning = false;
let quizSessionId = 0;
let quizPoints = 0;
let quizPointsScope = null;
let quizPointsStartedAt = 0;
let quizResultSavedSession = -1;

function quizClockNow() {
    return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
        ? performance.now() : Date.now();
}

function stopQuizRecognition() {
    if (!quizRecognition) return;
    const old = quizRecognition;
    quizRecognition = null;
    old.onend = null;
    old.onresult = null;
    try { old.abort(); } catch(e) {}
}
function closeVocabQuiz() {
    resetAppMode();
    if (window.innerWidth <= 768 && typeof openSpeechOverlay === 'function') openSpeechOverlay('reading');
}


// --- クイズメニューの表示 ---
function startVocabQuiz() {
    resetAppMode();
    currentMode = 'quiz';
    document.body.classList.add('quiz-active');
    stopQuizRecognition();
    clearInterval(quizTimer);
    quizSessionId++;

    const mainOverlay = document.getElementById('mainOverlay');
    const title = document.getElementById('overlayTitle');
    const targetDisplay = document.getElementById('targetTextDisplay');

    if (mainOverlay) mainOverlay.style.display = 'flex';
    if (title) title.innerText = "📝 PowerSlide Quiz Menu";
    
    document.getElementById('fontControls').style.display = 'none';
    document.getElementById('speechResultWindow').style.display = 'none';
    targetDisplay.style.display = 'block';

    const lesson8Part = lesson8QuizProgress.partFromKey(currentKey);
    const partVocab = lesson8Part && typeof lessonVocab !== 'undefined' ? lessonVocab[lesson8Part] : null;
    const partWordCount = partVocab ? partVocab.length : 0;
    const clearTarget = lesson8QuizProgress.targetForCount(partWordCount);
    const stage1 = lesson8Part ? lesson8QuizProgress.get(lesson8Part, 1) : null;
    const stage2 = lesson8Part ? lesson8QuizProgress.get(lesson8Part, 3) : null;
    const stage2Unlocked = lesson8Part ? lesson8QuizProgress.unlockedReverse(lesson8Part, partWordCount) : false;

    targetDisplay.innerHTML = `
        <div class="quiz-menu-container">
            ${lesson8Part ? `
                <div class="quiz-progress-panel">
                    <strong>Lesson 8 / Part ${lesson8Part.slice(-1)}　Pポイントチャレンジ</strong>
                    <div>2秒以内の正解：+10P / それ以外：0P</div>
                    <div>クリア目標：${clearTarget}P（満点 ${lesson8QuizProgress.maxForCount(partWordCount)}P）</div>
                    <div>英→日：自己ベスト ${stage1.bestPoints}P　|　日→英：自己ベスト ${stage2.bestPoints}P</div>
                    <div style="font-size:.8rem;color:#666;">成績はこの端末のブラウザに保存されます。</div>
                </div>
            ` : ''}
            <h2 class="quiz-menu-title">モードを選択してください</h2>
            
            <button class="quiz-mode-btn btn-mode-1" onclick="setupQuizData(1)">
                🔠 4択クイズ (英→日)
                <span class="quiz-mode-subtxt">意味をリストから選択します</span>
            </button>

            ${currentKey.startsWith("L08_") ? `
            <button class="quiz-mode-btn btn-mode-1" onclick="setupQuizData(3)" ${stage2Unlocked ? '' : 'disabled aria-disabled="true"'}>
                🇯🇵 4択クイズ (日→英)
                <span class="quiz-mode-subtxt">${stage2Unlocked ? 'ステージ2：日本語から英単語を選択' : '🔒 ステージ1で' + clearTarget + 'Pを取ると解放'}</span>
            </button>
            ` : ""}

            <button class="quiz-mode-btn btn-mode-2" onclick="setupQuizData(2)">
                🎙️ Voice Speaking (日→英)
                <span class="quiz-mode-subtxt">${lesson8Part ? '発音練習（Pポイント対象外）' : '正しい英単語を発音して回答します'}</span>
            </button>

            <button class="quiz-mode-btn" style="background:#eee;color:#333;" onclick="closeVocabQuiz()">✕ 終了する</button>
            ${lesson8Part ? '<p style="font-size:1rem;color:#444;">Pポイント獲得は2秒以内。2秒後も回答できます。</p>' : `
                <div style="margin-top:30px; font-size:1.6rem; font-weight:900; color:#444; font-family:'Noto Sans JP', sans-serif;">
                    <label style="cursor:pointer; display:flex; align-items:center; gap:12px;">
                        <input type="checkbox" id="timerToggle" ${isTimerEnabled ? 'checked' : ''} onchange="isTimerEnabled=this.checked" style="width:28px; height:28px; cursor:pointer;">
                        ⏱️ 5秒制限を有効にする
                    </label>
                </div>
            `}
        </div>
    `;
}

// --- クイズデータの準備 ---
function setupQuizData(mode) {
    quizSessionId++;
    stopQuizRecognition();
    clearInterval(quizTimer);
    isQuizTransitioning = false;
    quizMode = mode;
    // 新しい日→英の選択クイズは今回Lesson 8だけに公開する。
    if (mode === 3 && !currentKey.startsWith('L08_')) {
        alert('日→英4択は現在Lesson 8に対応しています。');
        return;
    }
    const baseKey = currentKey.split('_').slice(0, 2).join('_'); 
    const currentVocabArray = (typeof lessonVocab !== 'undefined') ? lessonVocab[baseKey] : null;

    if (!currentVocabArray || currentVocabArray.length === 0) {
        alert("このパートに登録された単語データが見つかりません。");
        return;
    }

    // Lesson 8: Partごとに英→日をクリアしてから日→英へ進む。
    if (mode === 3 && lesson8QuizProgress.partFromKey(currentKey) &&
        !lesson8QuizProgress.unlockedReverse(currentKey, currentVocabArray.length)) {
        alert('英→日4択で目標Pをクリアすると、日→英4択が解放されます。');
        return;
    }
    quizPointsScope = lesson8QuizProgress.partFromKey(currentKey);
    quizPoints = 0;
    quizPointsStartedAt = 0;
    quizResultSavedSession = -1;

    // 日→英の場合だけ正答・誤答とも英単語とし、それ以外は日本語の意味とする。
    const isReverseChoice = mode === 3;
    const allChoicesPool = [...new Set(currentVocabArray
        .map(v => isReverseChoice ? v.word : v.meaning).filter(Boolean))];

    quizQuestions = currentVocabArray.map(v => {
        const correct = isReverseChoice ? v.word : v.meaning;
        let choices = [correct];
        let fakes = allChoicesPool.filter(answer => answer !== correct);
        fakes.sort(() => 0.5 - Math.random());
        choices = choices.concat(fakes.slice(0, 3));
        
        let dummyCount = 1;
        while(choices.length < 4) { choices.push("（ダミー選択肢 " + dummyCount++ + "）"); }
        choices.sort(() => 0.5 - Math.random()); 
        
        let hintStr = v.word ? v.word.charAt(0) : "?";
        return { word: v.word, meaning: v.meaning, correct, choices, hint: hintStr };
    });

    quizQuestions.sort(() => 0.5 - Math.random());
    currentQuizIndex = 0;
    quizScore = 0;
    renderQuizQuestion();
}

// --- 問題の描画 ---
function renderQuizQuestion() {
    // 別のモードに切り替わっていたら強制終了（誤作動防止）
    if (currentMode !== 'quiz') {
        clearInterval(quizTimer);
        return; 
    }

    clearInterval(quizTimer);
    isQuizTransitioning = false; 
    const display = document.getElementById('targetTextDisplay');
    
    if (currentQuizIndex >= quizQuestions.length) {
        renderQuizResult();
        return;
    }

    const q = quizQuestions[currentQuizIndex];
    const isLesson8PointRound = lesson8QuizProgress.isPointsMode(quizPointsScope, quizMode);
    let html = `
        <div style="text-align:center; padding: 20px;">
            <div style="font-size: 1.4rem; font-family:'Nunito', sans-serif; color: #888; font-weight:900; margin-bottom: 15px;">Question ${currentQuizIndex + 1} / ${quizQuestions.length}</div>
    `;

    if (isLesson8PointRound) {
        const target = lesson8QuizProgress.targetForCount(quizQuestions.length);
        html += `
            <div class="quiz-points-hud">Pポイント：<strong id="quizPointsValue">${quizPoints}P</strong>　
                クリア目標：${target}P
            </div>
            <div class="timer-container"><div id="tBar" class="timer-bar"></div></div>
            <div id="quizPointsTimerLabel" style="font-size:1rem;color:#555;">2.0秒以内に正解すると +10P</div>
        `;
    } else if (isTimerEnabled && (quizMode === 1 || quizMode === 3)) {
        html += `<div class="timer-container"><div id="tBar" class="timer-bar"></div></div>`;
    }

    const safeCorrect = q.correct ? q.correct.replace(/'/g, "\\'") : "";
    const safeWord = q.word ? q.word.replace(/'/g, "\\'") : "";

    if (quizMode === 1 || quizMode === 3) {
        // モード1: 英→日4択 / モード3: 日→英4択
        const questionLabel = quizMode === 3 ? "日本語の意味に合う英語を選んでください" : "英語の意味を選んでください";
        const questionText = quizMode === 3 ? q.meaning : q.word;
        html += `
            <div style="font-size:1.05rem;color:#666;margin-bottom:12px;">${questionLabel}</div>
            <div class="quiz-word" style="font-size: 4.5rem; font-weight: 900; color: #333; margin-bottom: 40px; font-family: 'Nunito', 'Noto Sans JP', sans-serif;">${questionText}</div>
            <div class="quiz-choices" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 900px; margin: 0 auto;">
                ${q.choices.map(c => {
                    const safeChoice = c ? c.replace(/'/g, "\\'") : "";
                    return `<button class="quiz-choice-btn" onclick="checkAnswer1(this, '${safeChoice}', '${safeCorrect}')" style="padding:25px 20px; border-radius:15px; border:2px solid #ddd; font-weight:900; font-size:1.5rem; font-family:'Noto Sans JP', sans-serif; cursor:pointer; background:#fff; transition:0.2s; box-shadow:0 4px 6px rgba(0,0,0,0.05); color:#333;">${c}</button>`;
                }).join('')}
            </div>
            ${isLesson8PointRound ? '<div id="quizPointsFeedback" aria-live="polite" style="font-size:1.2rem;font-weight:bold;margin-top:14px;min-height:30px;"></div>' : ''}
        `;
        display.innerHTML = html;
        if (isLesson8PointRound) {
            startLesson8PointsClock();
        } else {
            // 2秒チャレンジ中は音声再生による待ち時間を発生させない。
            if (quizMode === 1 && typeof playWordAudio === 'function') playWordAudio(q.word);
            startTimer();
        }
    } else {
        // モード2: Voice Speaking (PicFlash)
        html += `
            <div style="font-size: 1.6rem; color: #ff4b4b; font-weight: 900; font-family:'Noto Sans JP', sans-serif; margin-bottom:10px;">意味に合う英語を発音してください</div>
            <div style="font-size: 4rem; font-weight: 900; color: #333; margin-bottom: 30px; font-family:'Noto Sans JP', sans-serif;">${q.correct}</div>
            
            <!-- 文字起こしフォントを 3.5rem に拡大 -->
            <div id="quizSpeechBox" style="min-height:120px; background:#fff5f8; border:4px dashed #ff9a9e; border-radius:20px; padding:20px; margin-bottom:15px; font-size:3.5rem; font-weight:900; font-family:'Nunito', sans-serif; color:#ff4b4b; display:flex; align-items:center; justify-content:center; text-align:center;">
                🎙️ Listening...
            </div>
            
            <div id="quizHintArea" style="min-height:40px; font-size:1.8rem; font-weight:900; font-family:'Nunito', sans-serif; color:#888;"></div>
            
            <div style="display:flex; justify-content:center; gap:20px; margin-top:10px;">
                <button class="hint-btn" onclick="showQuizHint('${q.hint}')" style="padding:15px 40px; font-size:1.3rem; font-weight:900; border-radius:30px; font-family:'Noto Sans JP', sans-serif; background:#f0f0f0; border:2px solid #ccc; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.05);">💡 ヒントを出す</button>
            </div>
            <button class="hint-btn" onclick="skipQuizSpeaking()" style="margin-top:12px; padding:12px 30px; border:1px solid #bbb; border-radius:20px; background:#fff; font-size:1rem;">次へ（スキップ）</button>
            <div style="margin-top:10px; font-size:1rem; color:#888;">マイクで「Skip」「Next」と言っても進めます</div>
        `;
        display.innerHTML = html;
        
        const sessionId = quizSessionId;
        setTimeout(() => {
            if (currentMode === 'quiz' && quizMode === 2 && quizSessionId === sessionId && !isQuizTransitioning) startQuizSpeech(q.word);
        }, 100);
    }
}

// Lesson 8: 2秒を過ぎても問題は閉じず、以降の正解は0Pにする。
function startLesson8PointsClock() {
    quizPointsStartedAt = quizClockNow();
    const sessionId = quizSessionId;
    const index = currentQuizIndex;
    quizTimer = setInterval(() => {
        if (currentMode !== 'quiz' || quizSessionId !== sessionId ||
            currentQuizIndex !== index || isQuizTransitioning) {
            clearInterval(quizTimer);
            return;
        }
        const remaining = Math.max(0,
            lesson8QuizProgress.POINT_WINDOW_MS - (quizClockNow() - quizPointsStartedAt));
        const bar = document.getElementById('tBar');
        if (bar) bar.style.width = (remaining / lesson8QuizProgress.POINT_WINDOW_MS * 100) + '%';
        const label = document.getElementById('quizPointsTimerLabel');
        if (label) {
            label.innerText = remaining > 0
                ? (remaining / 1000).toFixed(1) + '秒　+10P'
                : '2秒経過：正解しても0P（回答はできます）';
        }
        if (remaining === 0) clearInterval(quizTimer);
    }, 50);
}

// --- タイマー処理（暴走対策済み） ---
function startTimer() {
    if (!isTimerEnabled) return;
    timeLeft = 50;
    const bar = document.getElementById('tBar');
    
    quizTimer = setInterval(() => {
        // モードが変わったら裏のタイマーを即座に殺す
        if (currentMode !== 'quiz') {
            clearInterval(quizTimer);
            return;
        }

        timeLeft--;
        if (bar) bar.style.width = (timeLeft * 2) + "%";
        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            handleTimeOut();
        }
    }, 100);
}

function handleTimeOut() {
    // Lesson 8の2秒はP付与の締切であり、解答の締切ではない。
    if (lesson8QuizProgress.isPointsMode(quizPointsScope, quizMode)) return;
    if (currentMode !== 'quiz' || isQuizTransitioning) return;
    isQuizTransitioning = true;
    clearInterval(quizTimer);
    currentQuizIndex++;
    renderQuizQuestion();
}

// --- モード1(4択)の判定 ---
function checkAnswer1(btn, selected, correct) {
    if (currentMode !== 'quiz' || (quizMode !== 1 && quizMode !== 3) || isQuizTransitioning) return;
    isQuizTransitioning = true;
    const sessionId = quizSessionId;
    const isLesson8PointRound = lesson8QuizProgress.isPointsMode(quizPointsScope, quizMode);
    const elapsedMs = isLesson8PointRound ? quizClockNow() - quizPointsStartedAt : 0;
    const earnedPoints = isLesson8PointRound && selected === correct &&
        elapsedMs >= 0 && elapsedMs <= lesson8QuizProgress.POINT_WINDOW_MS
        ? lesson8QuizProgress.POINTS_PER_FAST_CORRECT : 0;
    quizPoints += earnedPoints;
    clearInterval(quizTimer);
    const feedback = document.getElementById('quizPointsFeedback');
    if (feedback && isLesson8PointRound) {
        feedback.innerText = selected !== correct ? '不正解：0P' :
            earnedPoints > 0 ? '正解！ +10P' : '正解！ 2秒を過ぎたため0P';
        const pointsLabel = document.getElementById('quizPointsValue');
        if (pointsLabel) pointsLabel.innerText = quizPoints + 'P';
    }
    const buttons = btn.parentElement.querySelectorAll('button');
    buttons.forEach(b => b.style.pointerEvents = 'none');

    if (selected === correct) {
        btn.style.background = '#4caf50'; btn.style.color = 'white'; btn.style.borderColor = '#4caf50';
        quizScore++;
        if (typeof successSound !== 'undefined' && successSound) successSound.play().catch(e=>{});
    } else {
        btn.style.background = '#f44336'; btn.style.color = 'white'; btn.style.borderColor = '#f44336';
        buttons.forEach(b => {
            if (b.innerText === correct) {
                b.style.background = '#4caf50'; b.style.color = 'white'; b.style.borderColor = '#4caf50';
            }
        });
    }

    setTimeout(() => { 
        if (currentMode === 'quiz' && quizSessionId === sessionId) {
            currentQuizIndex++;
            renderQuizQuestion();
        }
    }, 1200);
}

// --- モード2(Voice Speaking)の判定（甘め判定＆Skip対応） ---
function startQuizSpeech(targetWord) {
    const box = document.getElementById('quizSpeechBox');
    
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        if(box) box.innerText = "ブラウザが未対応です";
        return;
    }

    if (quizRecognition) {
        quizRecognition.onend = null;
        try { quizRecognition.abort(); } catch(e){}
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    quizRecognition = new SpeechRec();
    quizRecognition.lang = 'en-US';
    quizRecognition.interimResults = true;
    quizRecognition.continuous = true; 

    // 正解単語のクリーニング（記号除去）
    const cleanTarget = targetWord.toLowerCase().replace(/[.,!?'’"“”\-]/g, '').trim();
    
    // 【判定甘め処理】語尾の s, es, d, ed, ing を除去した「語幹」も正解として許容する
    let stemmedTarget = cleanTarget;
    if (cleanTarget.length > 3) { // 短すぎる単語は除外
        stemmedTarget = cleanTarget.replace(/(es|s|ed|d|ing)$/, '');
    }

    quizRecognition.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            const speechBox = document.getElementById('quizSpeechBox');
            if (speechBox) speechBox.innerText = 'マイクを利用できません。スキップボタンを使ってください。';
            if (quizRecognition) quizRecognition.onend = null;
        }
    };

    quizRecognition.onresult = (e) => {
        if (isQuizTransitioning || currentMode !== 'quiz') return;

        let finalTrans = '';
        let interimTrans = '';
        for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalTrans += e.results[i][0].transcript + ' ';
            else interimTrans += e.results[i][0].transcript;
        }
        
        let fullTranscript = (finalTrans + interimTrans).toLowerCase();
        if (box) box.innerText = fullTranscript || "🎙️ Listening...";

        let cleanTranscript = fullTranscript.replace(/[.,!?'’"“”\-]/g, '');

        // ★ Skip処理（skip または next と聞こえたら次へ）
        if (cleanTranscript.includes('skip') || cleanTranscript.includes('next')) {
            isQuizTransitioning = true;
            quizRecognition.stop();
            handleSkip2(targetWord);
            return;
        }

        // ★ 正解処理（完全一致、または語尾を除いた語幹が含まれていればOK）
        if (cleanTarget && (cleanTranscript.includes(cleanTarget) || cleanTranscript.includes(stemmedTarget))) {
            isQuizTransitioning = true;
            quizRecognition.stop();
            handleCorrect2(fullTranscript, targetWord);
        }
    };

    const activeRecognition = quizRecognition;
    const activeSession = quizSessionId;
    quizRecognition.onend = () => {
        if (currentMode === 'quiz' && quizMode === 2 && !isQuizTransitioning && quizSessionId === activeSession) {
            setTimeout(() => {
                if (quizRecognition === activeRecognition && currentMode === 'quiz' && !isQuizTransitioning) {
                    try { activeRecognition.start(); } catch(e) {}
                }
            }, 250);
        }
    };
    
    try { 
        quizRecognition.start(); 
    } catch(err) {}
}

function handleCorrect2(transcript, targetWord) {
    const sessionId = quizSessionId;
    const box = document.getElementById('quizSpeechBox');
    if (box) {
        box.style.background = '#e8f5e9';
        box.style.borderColor = '#4caf50';
        box.style.color = '#4caf50';
        box.innerText = `${transcript} (OK!)`;
    }
    quizScore++;
    if (typeof successSound !== 'undefined' && successSound) successSound.play().catch(e=>{});
    
    setTimeout(() => { 
        if (currentMode === 'quiz' && quizSessionId === sessionId) {
            currentQuizIndex++;
            renderQuizQuestion();
        }
    }, 1200);
}

function handleSkip2(targetWord) {
    const sessionId = quizSessionId;
    const box = document.getElementById('quizSpeechBox');
    if (box) {
        box.style.background = '#ffebee';
        box.style.borderColor = '#f44336';
        box.style.color = '#f44336';
        box.innerHTML = `Skipped...<br><span style="font-size:2rem; color:#333; display:block; margin-top:10px;">正解: <b>${targetWord}</b></span>`;
    }
    
    setTimeout(() => { 
        if (currentMode === 'quiz' && quizSessionId === sessionId) {
            currentQuizIndex++;
            renderQuizQuestion();
        }
    }, 1500);
}

// 音声認識非対応・マイク拒否時も次の問題に進める。
function skipQuizSpeaking() {
    if (currentMode !== 'quiz' || quizMode !== 2 || isQuizTransitioning) return;
    const q = quizQuestions[currentQuizIndex];
    if (!q) return;
    isQuizTransitioning = true;
    stopQuizRecognition();
    handleSkip2(q.word);
}

function showQuizHint(letter) {
    const area = document.getElementById('quizHintArea');
    if (area) area.innerText = `ヒント: 頭文字は "${letter.toUpperCase()}" です`;
}

function advanceLesson8QuizPart() {
    if (!quizPointsScope || quizMode !== 3) return;
    const nextPartNumber = Number(quizPointsScope.slice(-1)) + 1;
    if (nextPartNumber > 4) return;
    const partSelect = document.getElementById('partSelect');
    if (!partSelect) return;
    partSelect.value = String(nextPartNumber);
    if (typeof updateParaSelect === 'function') updateParaSelect();
    if (typeof onScopeChange === 'function') onScopeChange();
    startVocabQuiz();
}

// --- リザルト画面 ---
function renderQuizResult() {
    isQuizTransitioning = true;
    stopQuizRecognition();
    clearInterval(quizTimer);

    const display = document.getElementById('targetTextDisplay');
    let percent = Math.round((quizScore / quizQuestions.length) * 100);
    const isLesson8PointRound = lesson8QuizProgress.isPointsMode(quizPointsScope, quizMode);
    const isLesson8AnyMode = !!quizPointsScope;
    const clearTarget = lesson8QuizProgress.targetForCount(quizQuestions.length);
    const cleared = isLesson8PointRound && quizPoints >= clearTarget;
    let saved = null;
    if (isLesson8AnyMode && quizResultSavedSession !== quizSessionId) {
        saved = lesson8QuizProgress.save(quizPointsScope, quizMode, {
            points: quizPoints, correct: quizScore, questionCount: quizQuestions.length
        });
        quizResultSavedSession = quizSessionId;
    } else if (isLesson8AnyMode) {
        saved = lesson8QuizProgress.get(quizPointsScope, quizMode);
    }
    let progressionHtml = '';
    if (isLesson8PointRound) {
        progressionHtml = `
            <div class="quiz-result-progress">
                <div style="font-size:2rem;font-weight:900;">${quizPoints}P / ${lesson8QuizProgress.maxForCount(quizQuestions.length)}P</div>
                <div>クリア目標：${clearTarget}P　・　自己ベスト：${saved.bestPoints}P</div>
                <div style="font-weight:bold;color:${cleared ? '#25834d' : '#9b5120'};">${cleared ? (quizMode === 3 && quizPointsScope === 'L08_P4' ? 'LESSON 8 ALL CLEAR!' : 'CLEAR! 次のステージに進めます。') : 'もう一度挑戦してポイントをためよう！'}</div>
                <div style="font-size:.82rem;color:#666;">${saved.persisted === false ? '保存できないブラウザ環境のため、今回は一時記録のみです。' : 'この端末に成績を保存しました。'}</div>
            </div>
            ${quizMode === 1 && cleared ? '<button onclick="setupQuizData(3)" class="quiz-next-stage-btn">次へ：日→英4択に挑戦</button>' : ''}
            ${quizMode === 3 && cleared && quizPointsScope !== 'L08_P4' ? '<button onclick="advanceLesson8QuizPart()" class="quiz-next-stage-btn">次のPartのクイズへ</button>' : ''}
        `;
    } else if (isLesson8AnyMode) {
        progressionHtml = `<div class="quiz-result-progress">発音練習の結果：${quizScore}問正解 ／ 自己ベスト：${saved.bestCorrect}問（Pポイント対象外）</div>`;
    }
    display.innerHTML = `
        <div style="text-align:center; padding: 50px; font-family:'Nunito', sans-serif;">
            <div style="font-size: 2.5rem; font-weight:900; color:#333;">Quiz Result</div>
            <div style="font-size: 6rem; font-weight: 900; color: ${isLesson8PointRound ? (cleared ? '#4caf50' : '#764ba2') : (percent >= 80 ? '#4caf50' : '#764ba2')}; margin: 20px 0;">${percent}%</div>
            <p style="font-size: 1.8rem; font-weight:bold; color:#555;">${quizScore} / ${quizQuestions.length} Correct</p>
            ${progressionHtml}
            <button onclick="startVocabQuiz()" style="margin-top:40px; padding: 20px 50px; font-size:1.5rem; font-weight:900; border-radius:40px; border:none; background:#333; color:white; cursor:pointer; font-family:'Noto Sans JP', sans-serif; box-shadow:0 5px 15px rgba(0,0,0,0.2);">メニューに戻る</button>
            <button onclick="closeVocabQuiz()" style="margin:15px; padding:15px 25px; border:1px solid #aaa; border-radius:30px; background:white;">終了</button>
        </div>
    `;
    if ((isLesson8PointRound ? cleared : percent >= 80) && typeof fireConfetti === 'function') fireConfetti();
}
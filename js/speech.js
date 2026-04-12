// ==========================================
// speech.js: 音声認識とスコア計算（変数重複エラー完全解消版）
// ==========================================
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// ★ state.js等とダブってエラーになる変数の宣言を完全に削除しました！
// speech.js専用の変数だけを宣言します。
let mainRecognition;
let isMainRecording = false;
let finalTranscript = ''; 
let currentInterim = ''; // 息継ぎなしフリーズ救出用

// ★先生のGAS URL
const GAS_URL = "https://script.google.com/macros/s/AKfycby6AC39tWELS-GeGn0cuWfMNKunMb-Rp4RBZ-_L2VGjbCm9f-9PK54iG1q5K3lSlhI2BQ/exec"; 

if (window.SpeechRecognition) {
    mainRecognition = new SpeechRecognition();
    mainRecognition.lang = 'en-US';
    mainRecognition.interimResults = true;
    mainRecognition.continuous = true;
    
    mainRecognition.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'denied') {
            isMainRecording = false;
            
            const micBtn = document.getElementById('micBtn');
            if (micBtn) { micBtn.classList.remove('recording'); micBtn.innerHTML = "START"; }
            const bShadow = document.getElementById('bigShadowBtn');
            const sShadow = document.getElementById('stopShadowBtn');
            if(bShadow) bShadow.style.display = 'flex';
            if(sShadow) sShadow.style.display = 'none';
            
            const submitBtn = document.getElementById('floatingSubmitBtn');
            if (submitBtn) submitBtn.style.display = 'none';

            const recDisplay = document.getElementById('recognizedTextDisplay');
            if (recDisplay) {
                recDisplay.innerHTML = `
                <div style="padding: 20px; background: #fff5f8; border-radius: 12px; border-left: 5px solid #d32f2f; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-top: 20px;">
                    <div style="font-size: 1.2rem; color: #d32f2f; font-weight: bold; margin-bottom: 10px;">⚠️ マイクへのアクセスがブロックされています</div>
                    <div style="line-height: 1.6; color: #333; font-size: 1rem; font-weight: 500;">
                        お使いのブラウザでマイクが許可されていません。<br><br>
                        【解決方法】<br>
                        URLバーの「ぁあ（aA）」マークを押してマイクを許可するか、設定アプリからSafariのマイクアクセスを許可してください。
                    </div>
                </div>`;
            }
        }
    };

    mainRecognition.onresult = (e) => { 
        let interimTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
                finalTranscript += e.results[i][0].transcript + ' ';
            } else {
                interimTranscript += e.results[i][0].transcript;
            }
        }
        currentInterim = interimTranscript; 
        lastSpokenText = finalTranscript + interimTranscript;
        processSpeechMatch(lastSpokenText); 
    };

    mainRecognition.onend = () => {
        if (isMainRecording) {
            // ブラウザが強制終了した時、消えかかっている文字を救出
            if (currentInterim.trim() !== '') {
                finalTranscript += currentInterim + ' ';
                currentInterim = ''; 
                lastSpokenText = finalTranscript;
                processSpeechMatch(lastSpokenText);
            }
            
            setTimeout(() => { try { if (isMainRecording) mainRecognition.start(); } catch(err){} }, 250);
        }
    };
}

function openSpeechOverlay(mode) {
    if (typeof resetAppMode === 'function') resetAppMode();
    currentMode = mode;
    
    const mainOverlay = document.getElementById('mainOverlay');
    if(mainOverlay) mainOverlay.style.display = 'flex';
    
    const speechResult = document.getElementById('speechResultWindow');
    if(speechResult) {
        speechResult.style.display = 'flex';
        speechResult.style.paddingTop = '10px'; 
    }
    
    const targetDisplay = document.getElementById('targetTextDisplay');
    if(targetDisplay) targetDisplay.style.display = 'none';
    
    const title = document.getElementById('overlayTitle');
    if(title) title.innerText = mode === 'reading' ? '📖 Reading Check' : '🎙️ Shadowing Training';
    
    const fontControls = document.getElementById('fontControls');
    if(fontControls) fontControls.style.display = 'none';
    
    const submitBtn = document.getElementById('floatingSubmitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
    
    // --- ★ レベル対応：引き出しを切り替える ---
    let safeScripts = (typeof lessonScripts !== 'undefined') ? lessonScripts : {};
    if (typeof currentLevel !== 'undefined') {
        if (currentLevel === 'pre1' && typeof lessonScriptsPre1 !== 'undefined') safeScripts = lessonScriptsPre1;
        if (currentLevel === 'grade1' && typeof lessonScriptsGrade1 !== 'undefined') safeScripts = lessonScriptsGrade1;
    }
    const activeKey = (typeof currentKey !== 'undefined') ? currentKey : "";
    targetText = safeScripts[activeKey] || "※データ未登録";
    // ---------------------------------------------
    
    if (typeof engFontSize !== 'undefined' && engFontSize < 28) engFontSize = 28;
    if (typeof recFontSize !== 'undefined' && recFontSize < 32) recFontSize = 32;
    
    const accEl = document.getElementById('hudAccValue');
    if(accEl) {
        accEl.innerHTML = `0<span style="font-size:1rem;">%</span>`;
        accEl.style.color = '#ffffff'; 
    }
    
    const wpmEl = document.getElementById('hudWpmValue');
    if(wpmEl) wpmEl.innerText = "0";
    
    currentScore = 0; lastSpokenText = ""; finalTranscript = ""; currentInterim = ""; recordStartTime = 0;

    const rMic = document.getElementById('readingMicContainer');
    const sMic = document.getElementById('shadowingMicContainer');
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');

    const micBtn = document.getElementById('micBtn');
    if(micBtn) { micBtn.classList.remove('recording'); micBtn.innerHTML = "START"; }
    if(bShadow) { bShadow.style.display = 'flex'; bShadow.innerHTML = "START"; }
    if(sShadow) sShadow.style.display = 'none';

    processSpeechMatch(""); 

    if (mode === 'shadowing') {
        if(rMic) rMic.style.display = 'none';
        if(sMic) sMic.style.display = 'block';
    } else {
        if(rMic) rMic.style.display = 'block';
        if(sMic) sMic.style.display = 'none';
    }
}

function toggleReadingRecording() {
    if (!mainRecognition) return alert("ブラウザが音声認識に未対応です(Chrome推奨)。");
    const micBtn = document.getElementById('micBtn');
    const submitBtn = document.getElementById('floatingSubmitBtn');
    
    if (isMainRecording) { 
        isMainRecording = false; mainRecognition.stop();
        if (micBtn) { micBtn.classList.remove('recording'); micBtn.innerHTML = "RETRY"; }
        if (submitBtn && currentScore > 0) submitBtn.style.display = 'block';
        
        if (typeof checkCelebration === 'function') checkCelebration(); 
        processSpeechMatch(lastSpokenText); 
    } else {
        recordStartTime = Date.now(); 
        isMainRecording = true; 
        lastSpokenText = ""; finalTranscript = ""; currentInterim = ""; 
        mainRecognition.start(); 
        if (micBtn) { micBtn.classList.add('recording'); micBtn.innerHTML = "STOP"; }
        if (submitBtn) submitBtn.style.display = 'none';
        
        processSpeechMatch(""); 
    }
}

function startShadowing() {
    if (!mainRecognition) return alert("ブラウザが未対応です");
    if (isMainRecording) return;
    
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');
    if(bShadow) bShadow.style.display = 'none';
    if(sShadow) { sShadow.style.display = 'flex'; sShadow.innerHTML = "FINISH"; }
    
    const submitBtn = document.getElementById('floatingSubmitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
    
    recordStartTime = Date.now(); 
    isMainRecording = true; 
    lastSpokenText = ""; finalTranscript = ""; currentInterim = ""; 
    mainRecognition.start();
    
    if (typeof loopState !== 'undefined' && !loopState.active && typeof audioPlayer !== 'undefined' && audioPlayer) {
        audioPlayer.currentTime = 0;
    }
    if (typeof audioPlayer !== 'undefined' && audioPlayer) {
        audioPlayer.play().then(() => {
            if (typeof updateAudioButtonUI === 'function') updateAudioButtonUI(true);
        }).catch(e => console.error(e));
    }

    processSpeechMatch(""); 
}

function stopShadowing() {
    isMainRecording = false; mainRecognition.stop(); 
    if (typeof stopAudio === 'function') stopAudio();
    
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');
    if(bShadow) { bShadow.style.display = 'flex'; bShadow.innerHTML = "RETRY"; }
    if(sShadow) sShadow.style.display = 'none';
    
    const submitBtn = document.getElementById('floatingSubmitBtn');
    if (submitBtn && currentScore > 0) submitBtn.style.display = 'block';
    
    if (typeof checkCelebration === 'function') checkCelebration(); 
    processSpeechMatch(lastSpokenText);
}

function recalculateMatch() {
    processSpeechMatch(lastSpokenText || "");
}

function processSpeechMatch(spokenText) {
    if (!targetText) return;
    
    // ★ 判定モードを固定（false: 順不同の甘め / true: 順通りの厳しめ）
    const isStrict = false;
    
    const cleanString = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, '');
    
    const targetWordsArray = targetText.split(/\s+/).filter(w => w).map(cleanString);
    const spokenOriginalWords = spokenText.split(/\s+/).filter(w => w); 
    
    let matchCount = 0; 
    let htmlOutput = []; 
    let searchIndex = 0; 
    let targetPool = [...targetWordsArray]; 
    
    spokenOriginalWords.forEach((originalWord) => {
        let cleanSpoken = cleanString(originalWord); 
        if (!cleanSpoken) {
            htmlOutput.push(originalWord);
            return;
        }
        
        let isMatched = false;
        if (isStrict) {
            let foundIndex = targetWordsArray.indexOf(cleanSpoken, searchIndex);
            if (foundIndex !== -1) { 
                isMatched = true; searchIndex = foundIndex + 1; 
            }
        } else {
            let foundIndex = targetPool.indexOf(cleanSpoken);
            if (foundIndex !== -1) { 
                isMatched = true; targetPool.splice(foundIndex, 1); 
            }
        }

        if (isMatched) {
            htmlOutput.push(`<span class="matched-word">${originalWord}</span>`);
            matchCount++;
        } else {
            htmlOutput.push(`<span class="unmatched-word" style="color:#555;">${originalWord}</span>`);
        }
    });

    const validTargetWordCount = targetWordsArray.length;
    const percentage = validTargetWordCount === 0 ? 0 : Math.round((matchCount / validTargetWordCount) * 100);
    currentScore = percentage > 100 ? 100 : percentage; 
    
    const recDisplay = document.getElementById('recognizedTextDisplay');
    if (recDisplay) {
        let modeTitle = currentMode === 'reading' ? '📖 Reading Check' : '🎙️ Shadowing Training';
        recDisplay.style.fontSize = ''; 
        
        let innerHtml = `
            <div style="padding-bottom: 120px; margin-top: -15px;">
                <div style="display:flex; align-items:center; margin-bottom: 10px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">
                    <div style="font-size:1.8rem; margin-right:15px; background:#e0f2fe; border-radius:50%; width:50px; height:50px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.1);">${currentMode === 'reading' ? '📖' : '🎧'}</div>
                    <div>
                        <div style="font-weight:900; font-size:1.1rem; color:#333;">${modeTitle}</div>
                        <div style="font-size:0.75rem; color:#888; font-weight:bold;">@Lesson_Text</div>
                    </div>
                </div>`;

        if (currentMode === 'reading') {
            let engFontToUse = typeof engFontSize !== 'undefined' ? engFontSize : 32;
            innerHtml += `
                <div style="margin-bottom: 15px; padding: 15px; background: #fdfbfb; border-radius: 12px; border-left: 5px solid #4facfe; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <div style="font-size: 0.9rem; color: #4facfe; font-weight: bold;">TARGET TEXT（お手本）</div>
                        
                        <div style="display:flex; gap:8px;">
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('eng', -2); recalculateMatch();" style="padding:4px 12px; border:1px solid #81d4fa; border-radius:6px; background:#e1f5fe; color:#0288d1; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A -</button>
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('eng', 2); recalculateMatch();" style="padding:4px 12px; border:1px solid #81d4fa; border-radius:6px; background:#e1f5fe; color:#0288d1; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A +</button>
                        </div>
                    </div>
                    <div id="engContainer" style="line-height: 1.8; color: #333; font-size: ${engFontToUse}px; transition: font-size 0.2s ease;">${targetText}</div>
                </div>`;
        }

        let fontSizeToUse = typeof recFontSize !== 'undefined' ? recFontSize : 32;
        innerHtml += `
                <div style="padding: 15px; background: #fff5f8; border-radius: 12px; border-left: 5px solid #ff4b4b; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <div style="font-size: 0.9rem; color: #ff4b4b; font-weight: bold;">YOUR VOICE（あなたの発音）</div>
                        
                        <div style="display:flex; gap:8px;">
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('rec', -2); recalculateMatch();" style="padding:4px 12px; border:1px solid #ffcdd2; border-radius:6px; background:#ffebee; color:#c62828; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A -</button>
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('rec', 2); recalculateMatch();" style="padding:4px 12px; border:1px solid #ffcdd2; border-radius:6px; background:#ffebee; color:#c62828; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A +</button>
                        </div>
                    </div>
                    <div style="line-height: 1.6; color: ${spokenText ? '#333' : '#aaa'}; font-weight: 500; font-size: ${fontSizeToUse}px; transition: font-size 0.2s ease;">
                        ${spokenText ? htmlOutput.join(' ') : (isMainRecording ? 'Listening... (マイクに向かってお話しください)' : '※右下のSTARTボタンを押して開始してください')}
                    </div>
                </div>
            </div>`;
            
        recDisplay.innerHTML = innerHtml;
    }
    
    const accEl = document.getElementById('hudAccValue');
    if (accEl) {
        accEl.innerHTML = `${currentScore}<span style="font-size:1rem;">%</span>`;
        accEl.style.color = currentScore >= 70 ? '#ffd700' : '#ffffff'; 
    }

    if (recordStartTime > 0 && spokenOriginalWords.length > 0) {
        let elapsedMinutes = (Date.now() - recordStartTime) / 60000;
        if (elapsedMinutes < 0.01) elapsedMinutes = 0.01;
        const wpmEl = document.getElementById('hudWpmValue');
        if (wpmEl) wpmEl.innerText = Math.round(spokenOriginalWords.length / elapsedMinutes);
    }
}

// ==========================================
// ★ 成績提出システム（画面の数字と100%完全一致保証版）
// ==========================================
function openSubmitModal() {
    // 1. 裏の変数は無視！「いま画面(HUD)に表示されている数字」をそのまま取得する
    const hudScore = parseInt(document.getElementById('hudAccValue').innerText) || 0;
    const hudWpm = parseInt(document.getElementById('hudWpmValue').innerText) || 0;

    if (hudScore === 0) return alert("まだスコアがありません。一度練習を行ってから提出してください。");
    
    // 2. 取得した画面の数字をポップアップ画面にコピー
    document.getElementById('submitAcc').innerText = hudScore;
    document.getElementById('submitWpm').innerText = hudWpm;
    
    const lNum = typeof currentLesson !== 'undefined' ? currentLesson : "?";
    const pSelect = document.getElementById('partSelect');
    const pNum = pSelect && pSelect.options.length > 0 ? pSelect.options[pSelect.selectedIndex].text : "?";
    const paraSelect = document.getElementById('paraSelect');
    const paraNum = paraSelect && paraSelect.options.length > 0 ? paraSelect.options[paraSelect.selectedIndex].text : "?";
    
    document.getElementById('submitScopeDisplay').innerText = `Lesson ${lNum} / ${pNum} / ${paraNum}`;
    
    document.getElementById('studentClass').value = localStorage.getItem('savedClass') || "";
    document.getElementById('studentNumber').value = localStorage.getItem('savedNum') || "";
    document.getElementById('studentName').value = localStorage.getItem('savedName') || "";
    
    document.getElementById('submitModal').style.display = 'flex';
}

function sendScoreToGAS() {
    const sClass = document.getElementById('studentClass').value.trim();
    const sNum = document.getElementById('studentNumber').value.trim();
    const sName = document.getElementById('studentName').value.trim();
    
    // 3. 送信する瞬間も、「ポップアップ画面の数字」を直接読み取る（絶対にズレない）
    const finalScore = parseInt(document.getElementById('submitAcc').innerText) || 0;
    const finalWpm = parseInt(document.getElementById('submitWpm').innerText) || 0;
    
    if (!sClass || !sNum || !sName) return alert("クラス、出席番号、氏名をすべて入力してください。");
    if (!GAS_URL || !GAS_URL.startsWith("https://script.google.com/")) return alert("先生の設定エラー：GASのURLが正しく設定されていません。");

    localStorage.setItem('savedClass', sClass);
    localStorage.setItem('savedNum', sNum);
    localStorage.setItem('savedName', sName);

    const btn = document.getElementById('finalSubmitBtn');
    btn.innerText = "送信中...";
    btn.disabled = true;
    btn.style.background = "#999";

    let elapsedSeconds = recordStartTime > 0 ? Math.round((Date.now() - recordStartTime) / 1000) : 0;
    
    // 4. 不正チェック用の暗号も、画面の数字(finalScore)を使って計算
    let cheatCode = (finalScore * 123) + sName.length;

    // 5. 送信するデータパック
    const payload = {
        className: sClass,
        studentNumber: sNum,
        name: sName,
        mode: currentMode === 'reading' ? 'Reading Check' : 'Shadowing',
        score: finalScore, // ★画面の数字をそのまま送る
        wpm: finalWpm,     // ★画面の数字をそのまま送る
        timeTaken: elapsedSeconds,
        checksum: cheatCode
    };

    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.result === "success") {
            alert("✅ スコアの提出が完了しました！先生にデータが送られました。");
            document.getElementById('submitModal').style.display = 'none';
            document.getElementById('floatingSubmitBtn').style.display = 'none'; 
        } else {
            alert("❌ 送信に失敗しました: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("❌ 通信エラーが発生しました。インターネット接続を確認してもう一度お試しください。");
    })
    .finally(() => {
        btn.innerText = "このスコアで送信する";
        btn.disabled = false;
        btn.style.background = "#4caf50";
    });
}
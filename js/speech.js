// ==========================================
// speech.js: 音声認識とスコア計算（最終進化版）
// ==========================================
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let mainRecognition;
let isMainRecording = false;

// ★ マイクの精度向上・履歴保持のための変数
let finalTranscript = ''; 

if (window.SpeechRecognition) {
    mainRecognition = new SpeechRecognition();
    mainRecognition.lang = 'en-US';
    mainRecognition.interimResults = true;
    mainRecognition.continuous = true;
    
    mainRecognition.onresult = (e) => { 
        let interimTranscript = '';
        // 話した言葉を「確定分」と「推測中」に分けてしっかり蓄積・保持する（精度アップ）
        for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
                finalTranscript += e.results[i][0].transcript + ' ';
            } else {
                interimTranscript += e.results[i][0].transcript;
            }
        }
        lastSpokenText = finalTranscript + interimTranscript;
        processSpeechMatch(lastSpokenText); 
    };

    mainRecognition.onend = () => {
        if (isMainRecording) {
            setTimeout(() => { try { if (isMainRecording) mainRecognition.start(); } catch(err){} }, 250);
        }
    };
}

function openSpeechOverlay(mode) {
    resetAppMode();
    currentMode = mode;
    
    const mainOverlay = document.getElementById('mainOverlay');
    if(mainOverlay) mainOverlay.style.display = 'flex';
    
    const speechResult = document.getElementById('speechResultWindow');
    if(speechResult) speechResult.style.display = 'flex';
    
    const targetDisplay = document.getElementById('targetTextDisplay');
    if(targetDisplay) targetDisplay.style.display = 'none';
    
    const title = document.getElementById('overlayTitle');
    if(title) title.innerText = mode === 'reading' ? '📖 Reading Check' : '🎙️ Shadowing Training';
    
    const fontControls = document.getElementById('fontControls');
    if(fontControls) fontControls.style.display = 'flex';
    
    // ★ Reading Checkの時は英文サイズの調整ボタンも表示する
    const engFont = document.getElementById('engFontControl');
    if(engFont) engFont.style.display = mode === 'reading' ? 'flex' : 'none';
    
    const jpnFont = document.getElementById('jpnFontControl');
    if(jpnFont) jpnFont.style.display = 'none';
    
    const recFont = document.getElementById('recFontControl');
    if(recFont) recFont.style.display = 'flex';
    
    const safeScripts = (typeof lessonScripts !== 'undefined') ? lessonScripts : {};
    targetText = safeScripts[currentKey] || "※データ未登録";
    
    // ★ デフォルトのフォントサイズを「大きく・見やすく」設定
    if (engFontSize < 28) engFontSize = 28;
    if (recFontSize < 32) recFontSize = 32;
    
    const accEl = document.getElementById('hudAccValue');
    if(accEl) accEl.innerHTML = `0<span style="font-size:1rem;">%</span>`;
    
    const wpmEl = document.getElementById('hudWpmValue');
    if(wpmEl) wpmEl.innerText = "0";
    
    currentScore = 0; lastSpokenText = ""; finalTranscript = ""; recordStartTime = 0;

    const rMic = document.getElementById('readingMicContainer');
    const sMic = document.getElementById('shadowingMicContainer');
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');

    processSpeechMatch(""); 

    if (mode === 'shadowing') {
        if(rMic) rMic.style.display = 'none';
        if(sMic) sMic.style.display = 'block';
        if(bShadow) bShadow.style.display = 'flex';
        if(sShadow) sShadow.style.display = 'none';
    } else {
        if(rMic) rMic.style.display = 'block';
        if(sMic) sMic.style.display = 'none';
    }
}

function toggleReadingRecording() {
    if (!mainRecognition) return alert("ブラウザが音声認識に未対応です(Chrome推奨)。");
    const micBtn = document.getElementById('micBtn');
    
    if (isMainRecording) { 
        isMainRecording = false; mainRecognition.stop();
        if (micBtn) { micBtn.classList.remove('recording'); micBtn.innerHTML = "START"; }
        checkCelebration(); 
        processSpeechMatch(lastSpokenText); 
    } else {
        recordStartTime = Date.now(); 
        isMainRecording = true; 
        lastSpokenText = ""; finalTranscript = ""; // 録音開始時にテキスト履歴をリセット
        mainRecognition.start(); 
        if (micBtn) { micBtn.classList.add('recording'); micBtn.innerHTML = "STOP"; }
        processSpeechMatch(""); 
    }
}

function startShadowing() {
    if (!mainRecognition) return alert("ブラウザが未対応です");
    if (isMainRecording) return;
    
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');
    if(bShadow) bShadow.style.display = 'none';
    if(sShadow) sShadow.style.display = 'flex';
    
    recordStartTime = Date.now(); 
    isMainRecording = true; 
    lastSpokenText = ""; finalTranscript = ""; // 録音開始時にテキスト履歴をリセット
    mainRecognition.start();
    
    if (!loopState.active && audioPlayer) audioPlayer.currentTime = 0;
    if (audioPlayer) audioPlayer.play().then(() => updateAudioButtonUI(true)).catch(e => console.error(e));

    processSpeechMatch(""); 
}

function stopShadowing() {
    isMainRecording = false; mainRecognition.stop(); stopAudio();
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');
    if(bShadow) bShadow.style.display = 'flex';
    if(sShadow) sShadow.style.display = 'none';
    checkCelebration(); 
    processSpeechMatch(lastSpokenText);
}

function recalculateMatch() {
    processSpeechMatch(lastSpokenText || "");
}

function processSpeechMatch(spokenText) {
    if (!targetText) return;
    const diffSelect = document.getElementById('difficultySelect');
    const isStrict = diffSelect ? diffSelect.value === 'strict' : false;
    
    const cleanString = (str) => str.toLowerCase().replace(/[.,!?'’"“”\-]/g, '');
    
    const targetWordsArray = targetText.split(/\s+/).filter(w => w).map(cleanString);
    const spokenOriginalWords = spokenText.split(/\s+/).filter(w => w); 
    
    let matchCount = 0; 
    let htmlOutput = []; 
    let searchIndex = 0; 
    let targetPool = [...targetWordsArray]; 
    
    // ★ 修正：話した言葉（Your Voice）側をループして、合っていれば青く装飾する！
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
        
        // フォントサイズを即座に反映させるための仕掛け
        recDisplay.style.fontSize = recFontSize + 'px'; 
        
        let innerHtml = `
            <div style="padding-bottom: 120px;">
                <div style="display:flex; align-items:center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;">
                    <div style="font-size:2rem; margin-right:15px; background:#e0f2fe; border-radius:50%; width:60px; height:60px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.1);">${currentMode === 'reading' ? '📖' : '🎧'}</div>
                    <div>
                        <div style="font-weight:900; font-size:1.1rem; color:#333;">${modeTitle}</div>
                        <div style="font-size:0.8rem; color:#888; font-weight:bold;">@Lesson_Text</div>
                    </div>
                </div>`;

        // ★ Reading Check の時のみ「お手本(Target Text)」を表示。青くならない純粋なテキスト。
        if (currentMode === 'reading') {
            innerHtml += `
                <div style="margin-bottom: 20px; padding: 20px; background: #fdfbfb; border-radius: 12px; border-left: 5px solid #4facfe; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.85rem; color: #4facfe; font-weight: bold; margin-bottom: 8px;">TARGET TEXT（お手本）</div>
                    <div id="engContainer" style="line-height: 1.8; color: #333; font-size: ${engFontSize}px;">${targetText}</div>
                </div>`;
        }

        // ★ Your Voice エリア：ここでマッチした単語が青くなる！
        innerHtml += `
                <div style="padding: 20px; background: #fff5f8; border-radius: 12px; border-left: 5px solid #ff4b4b; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.85rem; color: #ff4b4b; font-weight: bold; margin-bottom: 8px;">YOUR VOICE（あなたの発音・文字起こし / 読めた単語は青色に変わります）</div>
                    <div style="line-height: 1.6; color: ${spokenText ? '#333' : '#aaa'}; font-weight: 500;">
                        ${spokenText ? htmlOutput.join(' ') : (isMainRecording ? 'Listening... (マイクに向かってお話しください)' : '※右下のSTARTボタンを押して開始してください')}
                    </div>
                </div>
            </div>`;
            
        recDisplay.innerHTML = innerHtml;
    }
    
    const accEl = document.getElementById('hudAccValue');
    if (accEl) {
        accEl.innerHTML = `${currentScore}<span style="font-size:1rem;">%</span>`;
        accEl.style.color = currentScore >= 80 ? '#4caf50' : (currentScore >= 50 ? '#fff' : '#ffb3b3');
    }

    if (recordStartTime > 0 && spokenWordsArray.length > 0) {
        let elapsedMinutes = (Date.now() - recordStartTime) / 60000;
        if (elapsedMinutes < 0.01) elapsedMinutes = 0.01;
        const wpmEl = document.getElementById('hudWpmValue');
        if (wpmEl) wpmEl.innerText = Math.round(spokenWordsArray.length / elapsedMinutes);
    }
}
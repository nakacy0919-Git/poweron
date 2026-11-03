// PowerOn speech recognition: resilient Reading Check and Shadowing.
// SpeechRecognition needs HTTPS, microphone permission and a supported browser.
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let mainRecognition = null;
let isMainRecording = false;
let speechStopping = false;
let speechSessionId = 0;
let recognitionSegmentFinal = '';
let finalTranscript = '';
let currentInterim = '';
let recognitionRestartTimer = null;
let recognitionStopFallback = null;
let recordEndTime = 0;

// Submission endpoint remains unchanged.
const GAS_URL = "https://script.google.com/macros/s/AKfycby6AC39tWELS-GeGn0cuWfMNKunMb-Rp4RBZ-_L2VGjbCm9f-9PK54iG1q5K3lSlhI2BQ/exec";

function speechMessage(message) {
    const box = document.getElementById('dynamicVoiceText');
    if (box) box.textContent = message;
}

function setRecordingButtons(running, finished) {
    const mic = document.getElementById('micBtn');
    const begin = document.getElementById('bigShadowBtn');
    const end = document.getElementById('stopShadowBtn');
    if (mic) {
        mic.classList.toggle('recording', running && currentMode === 'reading');
        mic.textContent = running ? 'STOP' : (finished ? 'RETRY' : 'START');
    }
    if (begin) {
        begin.style.display = running && currentMode === 'shadowing' ? 'none' : 'flex';
        begin.textContent = finished ? 'RETRY' : 'START';
    }
    if (end) {
        end.style.display = running && currentMode === 'shadowing' ? 'flex' : 'none';
        end.textContent = 'FINISH';
    }
    document.body.classList.toggle('is-recording', !!running);
}

function stopRecognitionTimers() {
    if (recognitionRestartTimer !== null) clearTimeout(recognitionRestartTimer);
    if (recognitionStopFallback !== null) clearTimeout(recognitionStopFallback);
    recognitionRestartTimer = null;
    recognitionStopFallback = null;
}

function appendRecognitionSegment() {
    // Preserve the newest final and interim words without replaying prior resultIndex.
    const segment = [recognitionSegmentFinal, currentInterim].filter(Boolean).join(' ').trim();
    if (segment) finalTranscript = [finalTranscript, segment].filter(Boolean).join(' ').trim();
    recognitionSegmentFinal = '';
    currentInterim = '';
    lastSpokenText = finalTranscript;
}

function finishRecognition() {
    if (!speechStopping) return;
    speechStopping = false;
    stopRecognitionTimers();
    mainRecognition = null;
    processSpeechMatch(lastSpokenText);
    setRecordingButtons(false, true);
    const submit = document.getElementById('floatingSubmitBtn');
    if (submit) submit.style.display = currentScore > 0 ? 'block' : 'none';
    if (typeof checkCelebration === 'function') checkCelebration();
}

function stopSpeechRecording() {
    if (!isMainRecording) return;
    isMainRecording = false;
    speechStopping = true;
    recordEndTime = Date.now();
    stopRecognitionTimers();
    setRecordingButtons(false, true);
    if (currentMode === 'shadowing' && typeof stopAudio === 'function') stopAudio();
    // The final result may arrive after stop(); wait for onend before final scoring.
    processSpeechMatch(lastSpokenText);
    const active = mainRecognition;
    if (!active) { finishRecognition(); return; }
    try { active.stop(); } catch (_) { appendRecognitionSegment(); finishRecognition(); return; }
    const token = speechSessionId;
    recognitionStopFallback = setTimeout(() => {
        if (token !== speechSessionId || !speechStopping) return;
        appendRecognitionSegment();
        finishRecognition();
    }, 1500);
}

function abortSpeechSession() {
    speechSessionId++;
    isMainRecording = false;
    speechStopping = false;
    stopRecognitionTimers();
    const rec = mainRecognition;
    mainRecognition = null;
    if (rec) {
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        try { rec.abort(); } catch (_) {}
    }
    setRecordingButtons(false, false);
    const submit = document.getElementById('floatingSubmitBtn');
    if (submit) submit.style.display = 'none';
}

function failSpeechRecognition(error) {
    // The recognizer is unavailable. Restore buttons so students can retry.
    const reason = error && (error.error || error.message || String(error));
    let guide = '音声認識を開始できません。HTTPSのSafariまたはChromeで開き、マイクの設定とネット接続を確認してください。';
    if (/not-allowed|service-not-allowed|permission|denied/i.test(reason)) {
        guide = 'マイクへのアクセスが許可されていません。ブラウザのサイト設定でマイクを許可してから、RETRYを押してください。';
    } else if (/audio-capture|device/i.test(reason)) {
        guide = 'マイクを利用できません。端末のマイク接続と他のアプリの使用状況を確認してください。';
    } else if (/network|service/i.test(reason)) {
        guide = '音声認識サービスに接続できません。インターネット接続を確認してRETRYしてください。';
    }
    if (currentMode === 'shadowing' && typeof stopAudio === 'function') stopAudio();
    abortSpeechSession();
    recordEndTime = Date.now();
    processSpeechMatch(lastSpokenText);
    setRecordingButtons(false, true);
    speechMessage(guide);
}

function startRecognitionEngine(token) {
    if (token !== speechSessionId || !isMainRecording || !SpeechRecognitionCtor) return;
    let recognizer;
    try {
        recognizer = new SpeechRecognitionCtor();
        recognizer.lang = 'en-US';
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognitionSegmentFinal = '';
        currentInterim = '';
        mainRecognition = recognizer;
        recognizer.onresult = (event) => {
            if (token !== speechSessionId || mainRecognition !== recognizer ||
                (!isMainRecording && !speechStopping)) return;
            const committed = [], pending = [];
            for (let i = 0; i < event.results.length; i++) {
                const item = event.results[i];
                const text = item && item[0] && item[0].transcript ? item[0].transcript.trim() : '';
                if (!text) continue;
                (item.isFinal ? committed : pending).push(text);
            }
            recognitionSegmentFinal = committed.join(' ');
            currentInterim = pending.join(' ');
            lastSpokenText = [finalTranscript, recognitionSegmentFinal, currentInterim].filter(Boolean).join(' ').trim();
            processSpeechMatch(lastSpokenText);
        };
        recognizer.onerror = event => {
            if (token !== speechSessionId || mainRecognition !== recognizer) return;
            if (['no-speech','aborted'].includes(event.error)) return;
            failSpeechRecognition(event);
        };
        recognizer.onend = () => {
            if (token !== speechSessionId || mainRecognition !== recognizer) return;
            appendRecognitionSegment();
            if (speechStopping) {
                finishRecognition();
                return;
            }
            mainRecognition = null;
            if (!isMainRecording) return;
            processSpeechMatch(lastSpokenText);
            recognitionRestartTimer = setTimeout(() => {
                recognitionRestartTimer = null;
                if (token === speechSessionId && isMainRecording && !speechStopping)
                    startRecognitionEngine(token);
            }, 350);
        };
        recognizer.start();
    } catch (error) {
        failSpeechRecognition(error);
    }
}

function beginSpeechRecording() {
    if (!SpeechRecognitionCtor) {
        speechMessage('このブラウザは音声認識に対応していません。SafariまたはChromeの最新版で開いてください。');
        return;
    }
    abortSpeechSession();
    finalTranscript = '';
    recognitionSegmentFinal = '';
    currentInterim = '';
    lastSpokenText = '';
    recordStartTime = Date.now();
    recordEndTime = 0;
    currentScore = 0;
    isMainRecording = true;
    const token = speechSessionId;
    setRecordingButtons(true, false);
    processSpeechMatch('');
    startRecognitionEngine(token);
}

function openSpeechOverlay(mode) {
    if (typeof resetAppMode === 'function') resetAppMode();
    currentMode = mode;
    document.body.classList.add('speech-active');
    
    document.body.classList.remove('is-recording'); 
    
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
    
    let safeScripts = (typeof lessonScripts !== 'undefined') ? lessonScripts : {};
    if (typeof currentLevel !== 'undefined') {
        if (currentLevel === 'pre1' && typeof lessonScriptsPre1 !== 'undefined') safeScripts = lessonScriptsPre1;
        if (currentLevel === 'grade1' && typeof lessonScriptsGrade1 !== 'undefined') safeScripts = lessonScriptsGrade1;
    }
    const activeKey = (typeof currentKey !== 'undefined') ? currentKey : "";
    // Advanced-level texts are available for limited lessons; keep standard text usable.
    targetText = safeScripts[activeKey] || (typeof lessonScripts !== "undefined" && lessonScripts[activeKey]) || "※データ未登録";
    
    if (window.innerWidth <= 768) {
        // 10px was unreadable on portrait iPad / mobile. Maintain at least 18px.
        if (typeof engFontSize !== 'undefined') engFontSize = Math.max(18, Math.min(engFontSize, 24));
        if (typeof recFontSize !== 'undefined') recFontSize = Math.max(18, Math.min(recFontSize, 24));
    } else {
        if (typeof engFontSize !== 'undefined' && engFontSize < 28) engFontSize = 28;
        if (typeof recFontSize !== 'undefined' && recFontSize < 32) recFontSize = 32;
    }
    
    const accEl = document.getElementById('hudAccValue');
    if(accEl) {
        accEl.innerHTML = `0<span style="font-size:1rem;">%</span>`;
        accEl.style.color = '#ffffff'; 
    }
    
    const wpmEl = document.getElementById('hudWpmValue');
    if(wpmEl) wpmEl.innerText = "0";
    
    currentScore = 0; lastSpokenText = ""; finalTranscript = ""; currentInterim = ""; recordStartTime = 0; recordEndTime = 0;

    const recDisplay = document.getElementById('recognizedTextDisplay');
    if (recDisplay) {
        let innerHtml = ``;

        if (mode === 'reading') {
            innerHtml += `
                <div style="flex: 1 1 0%; min-height: 0; height: 50%; display: flex; flex-direction: column; overflow: hidden; margin-bottom: 15px; padding: 15px; background: #fdfbfb; border-radius: 12px; border-left: 5px solid #4facfe; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="font-size: 0.9rem; color: #4facfe; font-weight: bold;">TARGET TEXT（お手本）</div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('eng', -2); recalculateMatch();" style="padding:4px 12px; border:1px solid #81d4fa; border-radius:6px; background:#e1f5fe; color:#0288d1; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A -</button>
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('eng', 2); recalculateMatch();" style="padding:4px 12px; border:1px solid #81d4fa; border-radius:6px; background:#e1f5fe; color:#0288d1; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A +</button>
                        </div>
                    </div>
                    <div id="staticTargetText" style="flex-grow: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; line-height: 1.8; color: #333; font-size: ${engFontSize}px;">${targetText}</div>
                </div>`;
        }

        innerHtml += `
                <div style="flex: 1 1 0%; min-height: 0; height: 50%; display: flex; flex-direction: column; overflow: hidden; padding: 15px; background: #fff5f8; border-radius: 12px; border-left: 5px solid #ff4b4b; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="font-size: 0.9rem; color: #ff4b4b; font-weight: bold;">YOUR VOICE（あなたの発音）</div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('rec', -2); recalculateMatch();" style="padding:4px 12px; border:1px solid #ffcdd2; border-radius:6px; background:#ffebee; color:#c62828; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A -</button>
                            <button onclick="if(typeof changeFontSize==='function') changeFontSize('rec', 2); recalculateMatch();" style="padding:4px 12px; border:1px solid #ffcdd2; border-radius:6px; background:#ffebee; color:#c62828; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A +</button>
                        </div>
                    </div>
                    <div id="dynamicVoiceText" style="flex-grow: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; line-height: 1.6; color: #aaa; font-weight: 500; font-size: ${recFontSize}px;">
                        ※右下のSTARTボタンを押して開始してください
                    </div>
                </div>`;
                
        recDisplay.innerHTML = innerHtml;
    }

    const rMic = document.getElementById('readingMicContainer');
    const sMic = document.getElementById('shadowingMicContainer');
    const bShadow = document.getElementById('bigShadowBtn');
    const sShadow = document.getElementById('stopShadowBtn');

    setRecordingButtons(false, false);

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
    if (currentMode !== 'reading') return;
    if (isMainRecording) stopSpeechRecording();
    else if (!speechStopping) beginSpeechRecording();
}
function startShadowing() {
    if (currentMode !== 'shadowing' || isMainRecording || speechStopping) return;
    beginSpeechRecording();
    if (!isMainRecording) return;
    if (typeof loopState !== 'undefined' && !loopState.active && typeof audioPlayer !== 'undefined' && audioPlayer)
        audioPlayer.currentTime = 0;
    if (typeof audioPlayer !== 'undefined' && audioPlayer) {
        Promise.resolve(audioPlayer.play()).then(() => {
            if (isMainRecording && typeof updateAudioButtonUI === 'function') updateAudioButtonUI(true);
        }).catch(() => {
            speechMessage('音声教材が再生できません。音声ファイルを確認するか、Reading Checkで練習してください。');
        });
    }
}
function stopShadowing() {
    if (currentMode !== 'shadowing') return;
    stopSpeechRecording();
}
function recalculateMatch() { processSpeechMatch(lastSpokenText || ''); }

function processSpeechMatch(spokenText) {
    if (!targetText) return;
    const plainText = String(targetText).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    const tokens = s => (s.match(/[a-z0-9]+(?:['’][a-z0-9]+)*/gi) || []);
    const canonical = word => word.toLowerCase().replace(/[’]/g, "'");
    const targetWords = tokens(plainText).map(canonical);
    const spokenOriginalWords = tokens(String(spokenText||''));
    const spokenWords = spokenOriginalWords.map(canonical);
    // An ordered LCS avoids counting an arbitrary jumble of target words as a fluent reading.
    // 1000 tokens per side is ample for a reading task and bounds work on low-end iPads.
    const target = targetWords.slice(0, 1000);
    const spoken = spokenWords.slice(0, 1000);
    const rows = spoken.length + 1, cols = target.length + 1;
    const table = Array.from({length:rows}, () => new Uint16Array(cols));
    for (let i=spoken.length-1; i>=0; i--) {
        for (let j=target.length-1; j>=0; j--) {
            table[i][j] = spoken[i] === target[j]
                ? 1+table[i+1][j+1]
                : Math.max(table[i+1][j],table[i][j+1]);
        }
    }
    const matched = new Set();
    let i=0, j=0;
    while (i<spoken.length && j<target.length) {
        if (spoken[i] === target[j]) { matched.add(i); i++; j++; }
        else if (table[i+1][j] >= table[i][j+1]) i++;
        else j++;
    }
    const count = matched.size;
    const total = target.length;
    currentScore = total ? Math.min(100,Math.round(count/total*100)) : 0;
    const safe = str => String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const box = document.getElementById('dynamicVoiceText');
    if (box) {
        const size = typeof recFontSize === 'number' ? recFontSize : 32;
        box.style.fontSize = size+'px';
        box.style.color = spokenOriginalWords.length ? '#333' : '#777';
        box.innerHTML = spokenOriginalWords.length
            ? spokenOriginalWords.map((word,index) => '<span class="'+(matched.has(index)?'matched-word':'unmatched-word')+'">'+safe(word)+'</span>').join(' ')
            : (isMainRecording ? 'Listening...（声を出して読んでください）' : 'STARTボタンを押して音読してください');
    }
    const model = document.getElementById('staticTargetText');
    if (model) model.style.fontSize = (typeof engFontSize === 'number' ? engFontSize : 32)+'px';
    const acc = document.getElementById('hudAccValue');
    const wpm = document.getElementById('hudWpmValue');
    if (isMainRecording || speechStopping) {
        if (acc) {acc.textContent = '---';acc.style.color='#aaa';}
        if (wpm) wpm.textContent='---';
        return;
    }
    if (acc) { acc.textContent = currentScore+'%';acc.style.color=currentScore>=80?'#ffd700':'#fff'; }
    const end = recordEndTime || Date.now();
    const minutes = recordStartTime ? Math.max((end-recordStartTime)/60000,1/60) : 0;
    const speed = minutes ? Math.round(spokenOriginalWords.length/minutes) : 0;
    if (wpm) wpm.textContent = String(speed);
}


// ==========================================
// ★ 成績提出システム（送信データに範囲・WPM・時間を追加）
// ==========================================
function openSubmitModal() {
    const hudScore = parseInt(document.getElementById('hudAccValue').innerText) || 0;
    const hudWpm = parseInt(document.getElementById('hudWpmValue').innerText) || 0;

    if (hudScore === 0) return alert("まだスコアがありません。一度練習を行ってから提出してください。");
    
    document.getElementById('submitAcc').innerText = hudScore;
    document.getElementById('submitWpm').innerText = hudWpm;
    
    const lNum = typeof currentLesson !== 'undefined' ? currentLesson : "?";
    const pSelect = document.getElementById('partSelect');
    const pNum = pSelect && pSelect.options.length > 0 ? pSelect.options[pSelect.selectedIndex].text : "?";
    const paraSelect = document.getElementById('paraSelect');
    const paraNum = paraSelect && paraSelect.options.length > 0 ? paraSelect.options[paraSelect.selectedIndex].text : "?";
    
    // モーダルに練習範囲を表示
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
    
    const finalScore = parseInt(document.getElementById('submitAcc').innerText) || 0;
    const finalWpm = parseInt(document.getElementById('submitWpm').innerText) || 0;
    
    // ★追加：画面の表示から「練習範囲」の文字列を取得
    const sScope = document.getElementById('submitScopeDisplay').innerText;
    
    if (!sClass || !sNum || !sName) return alert("クラス、出席番号、氏名をすべて入力してください。");
    if (!GAS_URL || !GAS_URL.startsWith("https://script.google.com/")) return alert("先生の設定エラー：GASのURLが正しく設定されていません。");

    localStorage.setItem('savedClass', sClass);
    localStorage.setItem('savedNum', sNum);
    localStorage.setItem('savedName', sName);

    const btn = document.getElementById('finalSubmitBtn');
    btn.innerText = "送信中...";
    btn.disabled = true;
    btn.style.background = "#999";

    // 音読にかかった時間（秒）
    let elapsedSeconds = recordStartTime > 0 ? Math.round(((recordEndTime || Date.now()) - recordStartTime) / 1000) : 0;
    let cheatCode = (finalScore * 123) + sName.length;

    // ★追加：送るデータ（payload）に scope を追加
    const payload = {
        className: sClass,
        studentNumber: sNum,
        name: sName,
        scope: sScope,         // ★追加：Lesson / Part / Para
        mode: currentMode === 'reading' ? 'Reading Check' : 'Shadowing',
        score: finalScore, 
        wpm: finalWpm,         // (送信済)
        timeTaken: elapsedSeconds, // (送信済：音読時間[秒])
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
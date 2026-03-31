// ==========================================
// ui.js: 画面描画、フォント変更、ポップアップ・単語機能の完全復活版
// ==========================================

// ★ デフォルトのフォントサイズを「見やすく・大きく」強制上書き！
engFontSize = 32;
jpnFontSize = 24;

function changeFontSize(type, step) {
    if (type === 'eng') {
        engFontSize = Math.max(14, Math.min(60, engFontSize + step));
        const container = document.getElementById('engContainer');
        if (container) container.style.fontSize = engFontSize + 'px';
    } else if (type === 'jpn') {
        jpnFontSize = Math.max(14, Math.min(60, jpnFontSize + step));
        const container = document.getElementById('jpnContainer');
        if (container) container.style.fontSize = jpnFontSize + 'px';
    } else if (type === 'rec') {
        recFontSize = Math.max(14, Math.min(80, recFontSize + step));
        const display = document.getElementById('recognizedTextDisplay');
        if (display) display.style.fontSize = recFontSize + 'px';
    }
}

function toggleTextMode(mode) {
    let newScriptState = isScriptOpen;
    let newJpnState = isJapaneseOpen;
    if (mode === 'script') newScriptState = !isScriptOpen;
    if (mode === 'japanese') newJpnState = !isJapaneseOpen;

    resetAppMode();

    isScriptOpen = newScriptState;
    isJapaneseOpen = newJpnState;

    if (!isScriptOpen && !isJapaneseOpen) return;

    currentMode = 'text';
    const mainOverlay = document.getElementById('mainOverlay');
    if(mainOverlay) mainOverlay.style.display = 'flex';
    
    const speechResult = document.getElementById('speechResultWindow');
    if(speechResult) speechResult.style.display = 'none';
    
    const targetDisplay = document.getElementById('targetTextDisplay');
    if(targetDisplay) targetDisplay.style.display = 'block';
    
    const fontControls = document.getElementById('fontControls');
    if(fontControls) fontControls.style.display = 'flex';
    
    const engFont = document.getElementById('engFontControl');
    if(engFont) engFont.style.display = isScriptOpen ? 'flex' : 'none';
    
    const jpnFont = document.getElementById('jpnFontControl');
    if(jpnFont) jpnFont.style.display = isJapaneseOpen ? 'flex' : 'none';
    
    const recFont = document.getElementById('recFontControl');
    if(recFont) recFont.style.display = 'none';
    
    const title = document.getElementById('overlayTitle');
    if(title) title.innerText = "";
    
    renderDualText();
}

// ★ 復活：本文の中に登録された単語（New Words）を赤くハイライトさせる処理
function renderDualText() {
    const display = document.getElementById('targetTextDisplay');
    if (!display) return;

    const safeScripts = (typeof lessonScripts !== 'undefined') ? lessonScripts : {};
    const safeTranslations = (typeof lessonTranslations !== 'undefined') ? lessonTranslations : {};
    const safeVocab = (typeof lessonVocab !== 'undefined') ? lessonVocab : {};

    let rawEng = safeScripts[currentKey] || "※英語データ未登録";
    let rawJpn = safeTranslations[currentKey] || "※和訳データ未登録";
    
    // ★ 修正：Part全体（L01_P1）に紐づく単語データも確実に拾えるように検索キーを拡張！
    const baseKey = currentKey.split('_').slice(0, 2).join('_'); 
    const currentVocab = safeVocab[currentKey] || safeVocab[baseKey]; 

    let html = `<div id="textContainer" style="display:flex; flex-direction:column; gap:20px;">`;

    if (isScriptOpen) {
        let engHtml = rawEng;
        
        // 登録されている単語があれば、赤文字（vocab-highlight）に変換する
        if (currentVocab) {
            let vocabList = [];
            // 単語データが配列でもオブジェクトでもエラーにならないように吸収
            if (Array.isArray(currentVocab)) {
                vocabList = currentVocab;
            } else {
                vocabList = Object.keys(currentVocab).map(k => ({ word: k, ...currentVocab[k] }));
            }

            // 長い単語から順番に処理する（短い単語が長い単語の一部を誤って置換するのを防ぐ）
            vocabList.sort((a, b) => b.word.length - a.word.length);

            vocabList.forEach(v => {
                if(!v.word) return;
                const regex = new RegExp(`\\b${v.word}\\b`, 'gi');
                engHtml = engHtml.replace(regex, `<span class="vocab-highlight" onclick="showVocab(event, '$&', '${v.word}')">$&</span>`);
            });
        }

        const engSentences = engHtml.match(/.*?([.?!]\s*|$)/g)?.filter(s => s.trim().length > 0) || [engHtml];
        html += `<div id="engContainer" style="font-size:${engFontSize}px; line-height:1.6;">`;
        engSentences.forEach((s, i) => { 
            html += `<span class="eng-sentence" id="eng-s-${i}" onclick="highlightSentence(event, ${i})" style="cursor:pointer; border-radius:4px; transition:0.2s;">${s}</span>`; 
        });
        html += `</div>`;
    }

    if (isJapaneseOpen) {
        const jpnSentences = rawJpn.match(/.*?([。？！]\s*|$)/g)?.filter(s => s.replace(/<br>/g, '').trim().length > 0) || [rawJpn];
        html += `<div id="jpnContainer" class="jpn-container-style" style="font-size:${jpnFontSize}px;">`;
        jpnSentences.forEach((s, i) => { 
            html += `<span class="jpn-sentence" id="jpn-s-${i}" onclick="highlightSentence(event, ${i})" style="cursor:pointer; border-radius:4px; transition:0.2s;">${s}</span>`; 
        });
        html += `</div>`;
    }
    html += `</div>`;
    display.innerHTML = html;
}

// 1文のハイライト（単語のタップと競合しないように修正）
function highlightSentence(event, idx) {
    if (event) event.stopPropagation(); // 単語タップ時に文全体のハイライトが反応するのを防ぐ

    if (!isScriptOpen || !isJapaneseOpen) return;
    const eng = document.getElementById(`eng-s-${idx}`);
    const jpn = document.getElementById(`jpn-s-${idx}`);
    const isActive = eng && eng.style.backgroundColor !== '';

    document.querySelectorAll('.eng-sentence, .jpn-sentence').forEach(el => { el.style.backgroundColor = ''; el.style.boxShadow = ''; });
    if (!isActive) {
        if (eng) { eng.style.backgroundColor = '#fff3cd'; eng.style.boxShadow = '0 0 0 4px #fff3cd'; }
        if (jpn) { jpn.style.backgroundColor = '#fff3cd'; jpn.style.boxShadow = '0 0 0 4px #fff3cd'; }
    }
}

// ==========================================
// ★ 復活：ポップアップとマイクによる発音チェック機能
// ==========================================

function showVocab(event, displayWord, dictWord) {
    if (event) event.stopPropagation();
    
    const safeVocab = (typeof lessonVocab !== 'undefined') ? lessonVocab : {};
    const baseKey = currentKey.split('_').slice(0, 2).join('_');
    const currentVocab = safeVocab[currentKey] || safeVocab[baseKey];
    if (!currentVocab) return;
    
    let vocabData = null;
    if (Array.isArray(currentVocab)) {
        vocabData = currentVocab.find(v => v.word.toLowerCase() === dictWord.toLowerCase());
    } else {
        vocabData = currentVocab[dictWord];
    }

    if (!vocabData) return;
    
    document.getElementById('popupWord').innerText = displayWord;
    document.getElementById('popupPron').innerText = vocabData.pron || "";
    document.getElementById('popupMean').innerText = vocabData.mean || "";
    document.getElementById('popupRecognized').style.display = 'none';
    
    const popup = document.getElementById('vocabPopup');
    popup.style.display = 'block';
    
    // タップした位置のすぐ下に表示
    let x = event.pageX;
    let y = event.pageY + 25;
    if (x + popup.offsetWidth > window.innerWidth) x = window.innerWidth - popup.offsetWidth - 10;
    
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    // ★ 開いた瞬間に、ネイティブ音声で自動読み上げ
    playWordAudio(displayWord);
}

function playWordAudio(word) {
    const msg = new SpeechSynthesisUtterance(word);
    msg.lang = 'en-US';
    window.speechSynthesis.speak(msg);
}

function closeVocabPopup() {
    const popup = document.getElementById('vocabPopup');
    if (popup) popup.style.display = 'none';
}

// ポップアップ専用のマイク認識設定
let popupRecognition = null;
let isPopupRecording = false;

if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    popupRecognition = new SpeechRec();
    popupRecognition.lang = 'en-US';
    popupRecognition.interimResults = false;
    
    popupRecognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.trim().toLowerCase();
        const targetWord = document.getElementById('popupWord').innerText.toLowerCase();
        const recDisplay = document.getElementById('popupRecognized');
        
        recDisplay.style.display = 'block';
        
        // 発音した言葉の中に、目標の単語が含まれていればOK！
        if (transcript.includes(targetWord) || targetWord.includes(transcript)) {
            recDisplay.innerHTML = `認識: <span style="color:#4caf50; font-weight:bold;">${transcript}</span> (OK!)`;
            let success = document.getElementById('successSound');
            if(success) success.play().catch(err=>{});
        } else {
            recDisplay.innerHTML = `認識: <span style="color:#d32f2f; font-weight:bold;">${transcript}</span> (Try again)`;
        }
    };
    
    popupRecognition.onend = () => {
        isPopupRecording = false;
        const btn = document.getElementById('popupMicBtn');
        if (btn) btn.classList.remove('recording');
    };
}

function togglePopupMic() {
    if (!popupRecognition) return alert('ブラウザが音声認識に対応していません。');
    const btn = document.getElementById('popupMicBtn');
    
    if (isPopupRecording) {
        popupRecognition.stop();
        isPopupRecording = false;
        btn.classList.remove('recording');
    } else {
        const recDisplay = document.getElementById('popupRecognized');
        recDisplay.style.display = 'block';
        recDisplay.innerText = 'Listening... (発音してください)';
        popupRecognition.start();
        isPopupRecording = true;
        btn.classList.add('recording');
    }
}

// ==========================================
// その他のエフェクト
// ==========================================

function fireConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#FFD700'];
    for (let i = 0; i < 80; i++) {
        let conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.animationDuration = (Math.random() * 2 + 1) + 's';
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 3000);
    }
}

function checkCelebration() {
    if (currentScore >= 80) {
        if (successSound) successSound.play().catch(e => console.log(e));
        fireConfetti();
    }
}
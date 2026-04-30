// ==========================================
// ui.js: 画面描画、フォント変更、ポップアップ・単語機能の完全復活＆美UI版
// ==========================================

// ★ デフォルトのフォントサイズ
engFontSize = 32;
jpnFontSize = 24;

// ★ 追加：レベルを切り替えて画面を即座に更新する関数
function changeLevel(level) {
    currentLevel = level;
    // 画面が開いていれば、新しいレベルの文章で即座に再描画する
    if (typeof currentMode !== 'undefined') {
        if (currentMode === 'text') renderDualText();
        else if (currentMode === 'reading' || currentMode === 'shadowing') openSpeechOverlay(currentMode);
    }
}

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
    if(targetDisplay) {
        targetDisplay.style.display = 'block';
        targetDisplay.style.padding = '0'; 
        targetDisplay.style.background = 'transparent';
        targetDisplay.style.boxShadow = 'none';
        targetDisplay.style.border = 'none';
    }
    
    // ★ 古い上部のフォントコントロールは完全に隠す
    const fontControls = document.getElementById('fontControls');
    if(fontControls) fontControls.style.display = 'none';
    
    const title = document.getElementById('overlayTitle');
    if(title) {
        if (isScriptOpen && isJapaneseOpen) title.innerText = '📜 Script & 🇯🇵 Japanese';
        else if (isScriptOpen) title.innerText = '📜 Script';
        else if (isJapaneseOpen) title.innerText = '🇯🇵 Japanese';
    }
    
    renderDualText();
}

// ★ 本文の中に登録された単語（New Words）を赤くハイライトさせる処理（美UI組み込み済）
// ★ 本文の中に登録された単語（New Words）を赤くハイライトさせる処理（美UI組み込み済）
function renderDualText() {
    const display = document.getElementById('targetTextDisplay');
    if (!display) return;

    // --- 引き出しの切り替え ---
    let safeScripts = (typeof lessonScripts !== 'undefined') ? lessonScripts : {};
    let safeTranslations = (typeof lessonTranslations !== 'undefined') ? lessonTranslations : {};
    let safeVocab = (typeof lessonVocab !== 'undefined') ? lessonVocab : {};

    if (currentLevel === 'pre1') {
        if (typeof lessonScriptsPre1 !== 'undefined') safeScripts = lessonScriptsPre1;
        if (typeof lessonTranslationsPre1 !== 'undefined') safeTranslations = lessonTranslationsPre1; // ★追加：和訳も準1級へ
        if (typeof lessonVocabPre1 !== 'undefined') safeVocab = lessonVocabPre1;
    } else if (currentLevel === 'grade1') {
        if (typeof lessonScriptsGrade1 !== 'undefined') safeScripts = lessonScriptsGrade1;
        if (typeof lessonTranslationsGrade1 !== 'undefined') safeTranslations = lessonTranslationsGrade1; // ★追加：和訳も1級へ
        if (typeof lessonVocabGrade1 !== 'undefined') safeVocab = lessonVocabGrade1;
    }
    // ---------------------------------------------

    let rawEng = safeScripts[currentKey] || "※英語データ未登録";
    let rawJpn = safeTranslations[currentKey] || "※和訳データ未登録";
    
    const baseKey = currentKey.split('_').slice(0, 2).join('_'); 
    const currentVocab = safeVocab[currentKey] || safeVocab[baseKey]; 

    let html = `<div id="textContainer" style="display:flex; flex-direction:column; gap:20px; padding-top:5px;">`;
    // ...（この下の if (isScriptOpen) { ... 等はそのまま残します）

    if (isScriptOpen) {
        let engHtml = rawEng;
        
        if (currentVocab) {
            let vocabList = [];
            if (Array.isArray(currentVocab)) {
                vocabList = currentVocab;
            } else {
                vocabList = Object.keys(currentVocab).map(k => ({ word: k, ...currentVocab[k] }));
            }

            vocabList.sort((a, b) => b.word.length - a.word.length);

            vocabList.forEach(v => {
                if(!v.word) return;
                const regex = new RegExp(`\\b${v.word}\\b`, 'gi');
                engHtml = engHtml.replace(regex, `<span class="vocab-highlight" onclick="showVocab(event, '$&', '${v.word}')">$&</span>`);
            });
        }

        const engSentences = engHtml.match(/.*?([.?!]\s*|$)/g)?.filter(s => s.trim().length > 0) || [engHtml];
        
        // ★ 美しいUI枠（A- A+ ボタン埋め込み）
        html += `
        <div style="padding: 20px; background: #fdfbfb; border-radius: 12px; border-left: 5px solid #4facfe; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <div style="font-size: 1.1rem; color: #4facfe; font-weight: bold;">TARGET TEXT（本文）</div>
                <div style="display:flex; gap:8px;">
                    <button onclick="if(typeof changeFontSize==='function') changeFontSize('eng', -2);" style="padding:6px 14px; border:1px solid #ddd; border-radius:6px; background:#fff; color:#333; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A -</button>
                    <button onclick="if(typeof changeFontSize==='function') changeFontSize('eng', 2);" style="padding:6px 14px; border:1px solid #ddd; border-radius:6px; background:#fff; color:#333; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A +</button>
                </div>
            </div>
            <div id="engContainer" style="font-size:${engFontSize}px; line-height:1.8; color:#333; transition: font-size 0.2s ease;">`;
        
        engSentences.forEach((s, i) => { 
            html += `<span class="eng-sentence" id="eng-s-${i}" onclick="highlightSentence(event, ${i})" style="cursor:pointer; border-radius:4px; transition:0.2s;">${s}</span>`; 
        });
        html += `</div></div>`;
    }

    if (isJapaneseOpen) {
        const jpnSentences = rawJpn.match(/.*?([。？！]\s*|$)/g)?.filter(s => s.replace(/<br>/g, '').trim().length > 0) || [rawJpn];
        
        // ★ 美しいUI枠（A- A+ ボタン埋め込み）
        html += `
        <div style="padding: 20px; background: #fffbf2; border-radius: 12px; border-left: 5px solid #ff9800; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <div style="font-size: 1.1rem; color: #ff9800; font-weight: bold;">JAPANESE（日本語訳）</div>
                <div style="display:flex; gap:8px;">
                    <button onclick="if(typeof changeFontSize==='function') changeFontSize('jpn', -2);" style="padding:6px 14px; border:1px solid #ddd; border-radius:6px; background:#fff; color:#333; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A -</button>
                    <button onclick="if(typeof changeFontSize==='function') changeFontSize('jpn', 2);" style="padding:6px 14px; border:1px solid #ddd; border-radius:6px; background:#fff; color:#333; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">A +</button>
                </div>
            </div>
            <div id="jpnContainer" class="jpn-container-style" style="font-size:${jpnFontSize}px; line-height:1.8; color:#333; transition: font-size 0.2s ease;">`;
        
        jpnSentences.forEach((s, i) => { 
            html += `<span class="jpn-sentence" id="jpn-s-${i}" onclick="highlightSentence(event, ${i})" style="cursor:pointer; border-radius:4px; transition:0.2s;">${s}</span>`; 
        });
        html += `</div></div>`;
    }
    html += `</div>`;
    display.innerHTML = html;
}

// 1文のハイライト（単語のタップと競合しないように修正）
function highlightSentence(event, idx) {
    if (event) event.stopPropagation();

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
// ★ ポップアップとマイクによる発音チェック機能
// ==========================================

function showVocab(event, displayWord, dictWord) {
    if (event) event.stopPropagation();
    
    // --- ★ レベル対応：引き出しを切り替える ---
    let safeVocab = (typeof lessonVocab !== 'undefined') ? lessonVocab : {};
    if (currentLevel === 'pre1' && typeof lessonVocabPre1 !== 'undefined') safeVocab = lessonVocabPre1;
    if (currentLevel === 'grade1' && typeof lessonVocabGrade1 !== 'undefined') safeVocab = lessonVocabGrade1;
    // ---------------------------------------------

    const baseKey = currentKey.split('_').slice(0, 2).join('_');
    const currentVocab = safeVocab[currentKey] || safeVocab[baseKey];
    if (!currentVocab) return;
    // ...（この下はそのまま残します）
    
    let vocabData = null;
    if (Array.isArray(currentVocab)) {
        vocabData = currentVocab.find(v => v.word.toLowerCase() === dictWord.toLowerCase());
    } else {
        vocabData = currentVocab[dictWord];
    }

    if (!vocabData) return;
    
    document.getElementById('popupWord').innerText = displayWord;
    document.getElementById('popupPron').innerText = vocabData.pronunciation || vocabData.pron || "";
    document.getElementById('popupMean').innerText = vocabData.meaning || vocabData.mean || "";
    document.getElementById('popupRecognized').style.display = 'none';
    
    const popup = document.getElementById('vocabPopup');
    popup.style.display = 'block';
    
    let x = event.pageX;
    let y = event.pageY + 25;
    if (x + popup.offsetWidth > window.innerWidth) x = window.innerWidth - popup.offsetWidth - 10;
    
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

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
    
    popupRecognition.onerror = (e) => {
        isPopupRecording = false;
        const btn = document.getElementById('popupMicBtn');
        if (btn) btn.classList.remove('recording');

        const recDisplay = document.getElementById('popupRecognized');
        recDisplay.style.display = 'block';

        if (e.error === 'not-allowed' || e.error === 'denied') {
            recDisplay.innerHTML = `<span style="color:#d32f2f; font-size:14px; line-height:1.4; display:block; margin-top:5px;">マイクがブロックされています。<br>URLバーの「ぁあ」や設定アプリからマイクを許可してください。</span>`;
        } else {
            recDisplay.innerHTML = `<span style="color:#d32f2f; font-size:14px;">エラーが発生しました(${e.error})。もう一度お試しください。</span>`;
        }
    };

    popupRecognition.onresult = (e) => {
        const rawTranscript = e.results[0][0].transcript.trim().toLowerCase();
        const transcript = rawTranscript.replace(/[^a-z0-9\s]/gi, '').trim();
        const targetWord = document.getElementById('popupWord').innerText.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
        
        const recDisplay = document.getElementById('popupRecognized');
        recDisplay.style.display = 'block';
        
        let isMatch = false;
        if (transcript === targetWord) {
            isMatch = true;
        } else if (transcript.includes(targetWord) || (targetWord.includes(transcript) && transcript.length >= 3)) {
            isMatch = true;
        }

        if (isMatch) {
            recDisplay.innerHTML = `認識: <span style="color:#4caf50; font-weight:bold;">${rawTranscript}</span> (OK!)`;
            let success = document.getElementById('successSound');
            if(success) success.play().catch(err=>{});
        } else {
            recDisplay.innerHTML = `認識: <span style="color:#d32f2f; font-weight:bold;">${rawTranscript}</span> (Try again)`;
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
        recDisplay.innerHTML = 'Listening... (発音してください)';
        
        try {
            popupRecognition.start();
            isPopupRecording = true;
            btn.classList.add('recording');
        } catch(err) {
            console.log(err);
        }
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
        if (typeof successSound !== 'undefined' && successSound) successSound.play().catch(e => console.log(e));
        fireConfetti();
    }
}
// ==========================================
// ★ スマホ専用：メニュー連動と自動起動
// ==========================================

// スマホ画面の上部メニュー（Lesson/Part）を変更したときに呼ばれる関数
function changeScopeMobile() {
    const lesson = document.getElementById('mobileLessonSelect').value; // 例: "L01"
    const part = document.getElementById('mobilePartSelect').value; // 例: "p1"

    // 読み込むデータのキーを生成（スマホでは「Part 1」を選んだら、そのPartの全文を出すのが使いやすいです）
    let newKey = "";
    if (part === "full") {
        newKey = lesson + "_P1_full"; 
    } else {
        const partNum = part.replace('p', ''); // p1 を 1 に変換
        newKey = lesson + "_P" + partNum + "_full"; // 例: L01_P1_full
    }

    currentKey = newKey;

    // もし "_full" のデータが存在しない場合は、"_p1" などの分割データを探して自動補正する安全装置
    let safeScripts = (typeof lessonScripts !== 'undefined') ? lessonScripts : {};
    if (typeof currentLevel !== 'undefined') {
        if (currentLevel === 'pre1' && typeof lessonScriptsPre1 !== 'undefined') safeScripts = lessonScriptsPre1;
        if (currentLevel === 'grade1' && typeof lessonScriptsGrade1 !== 'undefined') safeScripts = lessonScriptsGrade1;
    }

    if (!safeScripts[currentKey]) {
        const fallbackKey = lesson + "_P" + (part === 'full' ? '1' : part.replace('p', '')) + "_p1";
        if (safeScripts[fallbackKey]) {
            currentKey = fallbackKey;
        }
    }

    // 画面を更新（すでにシャドーイング中ならシャドーイングのまま、それ以外はReadingモードで開く）
    const modeToOpen = (typeof currentMode !== 'undefined' && currentMode === 'shadowing') ? 'shadowing' : 'reading';
    if (typeof openSpeechOverlay === 'function') {
        openSpeechOverlay(modeToOpen);
    }
}

// スマホでページを開いた瞬間に、自動的に音読画面を起動する魔法
window.addEventListener('DOMContentLoaded', () => {
    // 画面の横幅が768px以下（スマホサイズ）かチェック
    if (window.innerWidth <= 768) {
        // 他のデータが読み込まれるのを0.5秒だけ待ってから、スマホ専用画面をドーンと表示する
        setTimeout(() => {
            changeScopeMobile();
        }, 500);
    }
});
// ==========================================
// ★ スマホ専用：リサイズ機能 ＆ 音声ボタン連動
// ==========================================

// PC版の音声ボタン処理を上書きして、スマホのボタンの表示も連動させる
const originalUpdateAudioButtonUI = window.updateAudioButtonUI;
window.updateAudioButtonUI = function(isPlaying) {
    if (originalUpdateAudioButtonUI) originalUpdateAudioButtonUI(isPlaying);
    const mBtn = document.getElementById('btnMobileMainAudio');
    if (mBtn) mBtn.innerHTML = isPlaying ? "⏸ 一時停止" : "▶ 再生";
};

// リサイズバーを指でスワイプして上下の高さを変える機能
function initMobileResizer() {
    const resizer = document.getElementById('mobileResizer');
    const topPanel = document.getElementById('targetTextDisplay');
    
    if (!resizer || !topPanel) return;

    let isDragging = false;
    let startY = 0;
    let startTopHeight = 0;

    // タッチ開始
    resizer.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        startTopHeight = topPanel.getBoundingClientRect().height;
        document.body.style.overflow = 'hidden'; // 画面全体のスクロールを止める
    }, { passive: false });

    // タッチしながら移動
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); // 誤動作防止
        
        const deltaY = e.touches[0].clientY - startY;
        let newHeight = startTopHeight + deltaY;
        
        // 広げすぎ・縮めすぎをブロック（最低100px、最大は画面端から250pxまで）
        if (newHeight < 100) newHeight = 100;
        if (newHeight > window.innerHeight - 250) newHeight = window.innerHeight - 250;
        
        topPanel.style.height = `${newHeight}px`;
    }, { passive: false });

    // タッチ終了
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.overflow = ''; // スクロール制限を解除
        }
    });
}

// 画面が読み込まれた時にリサイズ機能を有効にする
window.addEventListener('DOMContentLoaded', () => {
    initMobileResizer();
});
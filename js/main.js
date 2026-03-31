// ==========================================
// main.js: レッスン切替、初期化、イベント登録
// ==========================================
function selectLesson(num, btnElement) {
    currentLesson = num;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const gradients = [
        'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    ];
    document.documentElement.style.setProperty('--theme-gradient', gradients[(num - 1) % 5]);

    // ★追加：背景画像と「白い透明シート」の設定
    const mainScreen = document.getElementById('mainScreen');
    if (mainScreen) {
        // rgba(255, 255, 255, 0.85) の "0.85" の数字で白シートの濃さを調整できます（0.0が透明 ～ 1.0が真っ白）
        mainScreen.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('img/L${num}.webp')`;
    }

    const partSelect = document.getElementById('partSelect');
    if (partSelect) {
        partSelect.innerHTML = '';
        const parts = Object.keys(lessonStructure[num] || {1: [1,2,3]});
        parts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = `Part ${p}`; partSelect.appendChild(opt);
        });
    }
    updateParaSelect();
    resetAppMode();
    onScopeChange();
}

function updateParaSelect() {
    const partSelect = document.getElementById('partSelect');
    const paraSelect = document.getElementById('paraSelect');
    if (!partSelect || !paraSelect) return;

    const part = partSelect.value;
    const prevValue = paraSelect.value;
    
    paraSelect.innerHTML = '<option value="full">Full Text</option>';
    const paras = (lessonStructure[currentLesson] && lessonStructure[currentLesson][part]) ? lessonStructure[currentLesson][part] : [1,2,3];
    
    paras.forEach(pNum => {
        const opt = document.createElement('option');
        opt.value = `p${pNum}`; opt.textContent = `Paragraph ${pNum}`; paraSelect.appendChild(opt);
    });

    if (paraSelect.querySelector(`option[value="${prevValue}"]`)) {
        paraSelect.value = prevValue;
    } else {
        paraSelect.value = "full";
    }
}

function onScopeChange() {
    const part = document.getElementById('partSelect')?.value || "1";
    const para = document.getElementById('paraSelect')?.value || "full";
    currentKey = `L${String(currentLesson).padStart(2, '0')}_P${part}_${para}`;
    
    if (audioPlayer) audioPlayer.src = `lessons/lesson${currentLesson}/part${part}/audio/${currentKey}.mp3`;
    
    clearLoop();
    closeVocabPopup();

    if (currentMode === 'shadowing' || currentMode === 'reading') {
        openSpeechOverlay(currentMode);
    } else if (isScriptOpen || isJapaneseOpen) {
        renderDualText();
    }
}

function resetAppMode() {
    const mainOverlay = document.getElementById('mainOverlay');
    if(mainOverlay) mainOverlay.style.display = 'none';
    
    const speechResult = document.getElementById('speechResultWindow');
    if(speechResult) speechResult.style.display = 'none';
    
    const targetDisplay = document.getElementById('targetTextDisplay');
    if(targetDisplay) targetDisplay.style.display = 'none';
    
    const fontControls = document.getElementById('fontControls');
    if(fontControls) fontControls.style.display = 'none';
    
    closeVocabPopup(); stopAudio(); clearLoop();

    if (isMainRecording) {
        if (currentMode === 'shadowing') stopShadowing();
        else stopReadingRecording();
    }

    currentMode = ''; isScriptOpen = false; isJapaneseOpen = false;
}

// UIリサイズバーの処理
const dragHandle = document.getElementById('drag-handle');
const sidebar = document.getElementById('sidebar');
const appContainer = document.getElementById('appContainer');
let isResizingSidebar = false;

if (dragHandle) {
    dragHandle.addEventListener('mousedown', () => { isResizingSidebar = true; });
}
document.addEventListener('mousemove', (e) => {
    if (!isResizingSidebar || !appContainer || !sidebar) return;
    const newWidth = appContainer.getBoundingClientRect().right - e.clientX;
    if (newWidth > 150 && newWidth < appContainer.getBoundingClientRect().width * 0.7) {
        sidebar.style.width = newWidth + 'px';
    }
});
document.addEventListener('mouseup', () => { isResizingSidebar = false; });

// アプリ起動時の処理
document.addEventListener('DOMContentLoaded', () => {
    const defaultBtn = document.querySelector('.nav-btn.active') || document.querySelector('.nav-btn');
    if (defaultBtn) selectLesson(1, defaultBtn);

    // イベントリスナーの登録
    const partSelectEl = document.getElementById('partSelect');
    if (partSelectEl) partSelectEl.addEventListener('change', () => { updateParaSelect(); onScopeChange(); });
    
    const paraSelectEl = document.getElementById('paraSelect');
    if (paraSelectEl) paraSelectEl.addEventListener('change', onScopeChange);
});

// ==========================================
// 最終安定版：リサイズバー ＆ 確定WPM（正確なCWPM） ＆ 正確Accuracy
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 【1. リサイズバー機能】
    const dragHandle = document.getElementById('drag-handle');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    const startResize = (e) => { 
        isResizing = true; 
        document.body.style.cursor = 'col-resize'; 
        document.body.style.userSelect = 'none';
        if(e.preventDefault && e.type !== 'touchstart') e.preventDefault(); 
    };
    
    const doResize = (clientX) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - clientX - 18;
        if (newWidth >= 150 && newWidth <= window.innerWidth * 0.7) {
            sidebar.style.width = newWidth + 'px';
            sidebar.style.minWidth = newWidth + 'px';
        }
    };

    const stopResize = () => { isResizing = false; document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; };

    if (dragHandle) {
        dragHandle.addEventListener('mousedown', startResize);
        dragHandle.addEventListener('touchstart', startResize, {passive: false});
    }
    document.addEventListener('mousemove', (e) => doResize(e.clientX));
    document.addEventListener('touchmove', (e) => doResize(e.touches[0].clientX));
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchend', stopResize);


    // 【2. WPM & Accuracy 確定計測システム（修正版）】
    let sessionStartTime = 0;
    let wpmInterval = null;

    // 数値を計算して画面に表示する関数
    const updateStats = (isFinal = false) => {
        const textDisplay = document.getElementById('recognizedTextDisplay');
        if (!textDisplay || !sessionStartTime) return;

        // ★画面上の「青く光った正解単語」の数を取得
        const matchedWordsCount = textDisplay.querySelectorAll('.matched-word').length;
        
        // --- Accuracyの計算 (青い単語の数 / お手本の全単語数) ---
        // ※お手本の単語はspanタグで包まれている前提
        const allWordsCount = textDisplay.querySelectorAll('span').length;
        if (allWordsCount > 0) {
            const acc = Math.round((matchedWordsCount / allWordsCount) * 100);
            document.getElementById('hudAccValue').innerText = acc + "%";
        }

        // --- WPMの計算 (青い単語の数 ÷ 経過時間) ---
        // ※お手本の残りの文章に騙されず、実際に正解した単語のペースだけを測る
        const currentTime = Date.now();
        const elapsedMs = currentTime - sessionStartTime;
        const elapsedMin = elapsedMs / 60000;

        if (elapsedMin > 0.05) { // 開始直後の3秒間は暴走を防ぐため計算を待つ
            const wpm = Math.round(matchedWordsCount / elapsedMin);
            document.getElementById('hudWpmValue').innerText = wpm;
        }
    };

    // 計測開始
    const startSession = () => {
        sessionStartTime = Date.now();
        document.getElementById('hudAccValue').innerText = "0%";
        document.getElementById('hudWpmValue').innerText = "0";
        clearInterval(wpmInterval);
        wpmInterval = setInterval(() => updateStats(false), 1000); // 1秒ごとに更新
    };

    // 計測終了（数値をロック）
    const stopSession = () => {
        clearInterval(wpmInterval); // タイマーを即座に停止
        updateStats(true); // 最終確定値を計算してロック
        sessionStartTime = 0; // 開始時間をリセット
    };

    // --- 各モードのボタン操作に連動 ---

    // Reading Check用
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        const obs = new MutationObserver(() => {
            if (micBtn.classList.contains('recording')) startSession();
            else stopSession();
        });
        obs.observe(micBtn, { attributes: true, attributeFilter: ['class'] });
    }

    // Shadowing用
    const bigShadowBtn = document.getElementById('bigShadowBtn');
    const stopShadowBtn = document.getElementById('stopShadowBtn');
    if (bigShadowBtn && stopShadowBtn) {
        bigShadowBtn.addEventListener('click', startSession);
        stopShadowBtn.addEventListener('click', stopSession);
    }
});
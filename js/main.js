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
// リサイズバー修復 ＆ WPM自動計算
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 【1. リサイズバー（ドラッグハンドル）の修復】
    const dragHandle = document.getElementById('drag-handle');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    // マウス・タッチ操作の開始
    const startResize = (e) => { 
        isResizing = true; 
        document.body.style.cursor = 'col-resize'; 
        document.body.style.userSelect = 'none'; // ドラッグ中の文字選択を防ぐ
        if(e.preventDefault && e.type !== 'touchstart') e.preventDefault(); 
    };
    
    // ドラッグ中の幅変更処理
    const doResize = (clientX) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - clientX - 18; // ハンドル幅を考慮
        // サイドバーの幅を制限（150px 〜 画面の70%まで）
        if (newWidth >= 150 && newWidth <= window.innerWidth * 0.7) {
            sidebar.style.width = newWidth + 'px';
            sidebar.style.minWidth = newWidth + 'px';
            sidebar.style.maxWidth = newWidth + 'px';
        }
    };

    // 操作の終了
    const stopResize = () => { 
        isResizing = false; 
        document.body.style.cursor = 'default'; 
        document.body.style.userSelect = 'auto'; 
    };

    if (dragHandle) {
        dragHandle.addEventListener('mousedown', startResize);
        dragHandle.addEventListener('touchstart', startResize, {passive: false});
    }
    document.addEventListener('mousemove', (e) => doResize(e.clientX));
    document.addEventListener('touchmove', (e) => doResize(e.touches[0].clientX));
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchend', stopResize);


    // 【2. WPM（話すスピード）の自動計算機能】
    let wpmStartTime = 0;
    let wpmInterval = null;
    
    const startWPM = () => {
        wpmStartTime = Date.now();
        clearInterval(wpmInterval);
        // 1秒ごとにWPMを計算して画面（HUD）に反映
        wpmInterval = setInterval(() => {
            const textEl = document.getElementById('recognizedTextDisplay');
            if (!textEl || !wpmStartTime) return;
            
            // 読み取られた単語の数をカウント
            const wordCount = textEl.innerText.trim().split(/\s+/).filter(w => w.length > 0).length;
            const elapsedMin = (Date.now() - wpmStartTime) / 60000; // 経過時間（分）
            
            if (elapsedMin > 0) {
                const wpmEl = document.getElementById('hudWpmValue');
                if (wpmEl) wpmEl.innerText = Math.round(wordCount / elapsedMin);
            }
        }, 1000);
    };
    
    const stopWPM = () => clearInterval(wpmInterval);

    // Reading Check の STARTボタンに検知を仕込む
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            // ボタンが「START」から「STOP(recording状態)」に切り替わる時
            if (!micBtn.classList.contains('recording')) startWPM(); 
            else stopWPM();
        });
    }

    // Shadowing の START/FINISHボタンに検知を仕込む
    const bigShadowBtn = document.getElementById('bigShadowBtn');
    const stopShadowBtn = document.getElementById('stopShadowBtn');
    if (bigShadowBtn) bigShadowBtn.addEventListener('click', startWPM);
    if (stopShadowBtn) stopShadowBtn.addEventListener('click', stopWPM);
});
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

    const mainScreen = document.getElementById('mainScreen');
    if (mainScreen) {
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
    
    if (typeof audioPlayer !== 'undefined' && audioPlayer) {
        audioPlayer.src = `lessons/lesson${currentLesson}/part${part}/audio/${currentKey}.mp3`;
    }
    
    if (typeof clearLoop === 'function') clearLoop();
    if (typeof closeVocabPopup === 'function') closeVocabPopup();

    if (typeof currentMode !== 'undefined' && (currentMode === 'shadowing' || currentMode === 'reading')) {
        if (typeof openSpeechOverlay === 'function') openSpeechOverlay(currentMode);
    } else if (typeof isScriptOpen !== 'undefined' && (isScriptOpen || isJapaneseOpen)) {
        if (typeof renderDualText === 'function') renderDualText();
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
    
    if (typeof closeVocabPopup === 'function') closeVocabPopup();
    if (typeof stopAudio === 'function') stopAudio();
    if (typeof clearLoop === 'function') clearLoop();

    // ★修正：isMainRecording のエラー回避と、正しい関数名への噛み合わせ
    if (typeof isMainRecording !== 'undefined' && isMainRecording) {
        if (currentMode === 'shadowing') {
            if (typeof stopShadowing === 'function') stopShadowing();
        } else {
            if (typeof toggleReadingRecording === 'function') toggleReadingRecording(); // 修正！
        }
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

    // 【2. WPM & Accuracy 確定計測システム】
    let sessionStartTime = 0;
    let wpmInterval = null;

    const updateStats = (isFinal = false) => {
        const textDisplay = document.getElementById('recognizedTextDisplay');
        if (!textDisplay || !sessionStartTime) return;

        const matchedWordsCount = textDisplay.querySelectorAll('.matched-word').length;
        
        const allWordsCount = textDisplay.querySelectorAll('span').length;
        if (allWordsCount > 0) {
            const acc = Math.round((matchedWordsCount / allWordsCount) * 100);
            document.getElementById('hudAccValue').innerText = acc + "%";
        }

        const currentTime = Date.now();
        const elapsedMs = currentTime - sessionStartTime;
        const elapsedMin = elapsedMs / 60000;

        if (elapsedMin > 0.05) { 
            const wpm = Math.round(matchedWordsCount / elapsedMin);
            document.getElementById('hudWpmValue').innerText = wpm;
        }
    };

    const startSession = () => {
        sessionStartTime = Date.now();
        document.getElementById('hudAccValue').innerText = "0%";
        document.getElementById('hudWpmValue').innerText = "0";
        clearInterval(wpmInterval);
        wpmInterval = setInterval(() => updateStats(false), 1000); 
    };

    const stopSession = () => {
        clearInterval(wpmInterval); 
        updateStats(true); 
        sessionStartTime = 0; 
    };

    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        const obs = new MutationObserver(() => {
            if (micBtn.classList.contains('recording')) startSession();
            else stopSession();
        });
        obs.observe(micBtn, { attributes: true, attributeFilter: ['class'] });
    }

    const bigShadowBtn = document.getElementById('bigShadowBtn');
    const stopShadowBtn = document.getElementById('stopShadowBtn');
    if (bigShadowBtn && stopShadowBtn) {
        bigShadowBtn.addEventListener('click', startSession);
        stopShadowBtn.addEventListener('click', stopSession);
    }
});
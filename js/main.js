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
    if (currentMode === 'quiz' || currentMode === 'practice') resetAppMode();
    const part = document.getElementById('partSelect')?.value || "1";
    const para = document.getElementById('paraSelect')?.value || "full";
    currentKey = `L${String(currentLesson).padStart(2, '0')}_P${part}_${para}`;
    // Chunk Practice applies to Lesson 8 only; hide entries in other lessons.
    document.querySelectorAll('.lesson8-only').forEach(button => {
        button.style.display = currentLesson === 8 ? '' : 'none';
    });
    
    if (typeof audioPlayer !== 'undefined' && audioPlayer) {
        // Lesson 8 Part 4 has audio files at the part root; others use /audio/.
        const audioDir = currentLesson === 8 && String(part) === '4'
            ? `lessons/lesson8/part4`
            : `lessons/lesson${currentLesson}/part${part}/audio`;
        audioPlayer.src = `${audioDir}/${currentKey}.mp3`;
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
    if (typeof PowerOnPractice !== 'undefined') PowerOnPractice.stop();
    if (typeof stopQuizRecognition === 'function') stopQuizRecognition();
    if (typeof quizTimer !== 'undefined') clearInterval(quizTimer);
    document.body.classList.remove('quiz-active');
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

    // Scope/mode changes must cancel the previous microphone session immediately.
    // No previous onend/result callback may update a newly selected text.
    if (typeof abortSpeechSession === 'function') abortSpeechSession();
    document.body.classList.remove('speech-active');
    document.body.classList.remove('text-active');
    document.body.classList.remove('po-practice-active');

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

    // Accuracy and WPM are calculated exactly once in speech.js.
    // The old MutationObserver re-scored only visible spans and overwrote final results.
});

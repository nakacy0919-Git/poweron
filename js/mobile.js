if (window.innerWidth <= 768) {
    // 10pxの初期化
    window.currentMobileFontSize = 10;
    document.documentElement.style.setProperty('--mobile-font-size', '10px');

    window.safeChangeSize = function(type, step) {
        window.currentMobileFontSize = Math.max(8, Math.min(30, window.currentMobileFontSize + step));
        document.documentElement.style.setProperty('--mobile-font-size', window.currentMobileFontSize + 'px');
    };

    // 視覚誘導（※ボタンの表示はspeech.jsに任せ、ここでは操作しない）
    window.checkSelectionGuide = function() {
        const l = document.getElementById('mobileLessonSelect').value;
        const p = document.getElementById('mobilePartSelect').value;
        const pr = document.getElementById('mobileParaSelect').value;

        const lessonSel = document.getElementById('mobileLessonSelect');
        const partSel = document.getElementById('mobilePartSelect');
        const paraSel = document.getElementById('mobileParaSelect');

        if (!lessonSel || !partSel || !paraSel) return;

        lessonSel.classList.remove('guide-focus');
        partSel.classList.remove('guide-focus');
        paraSel.classList.remove('guide-focus');

        if (!l) lessonSel.classList.add('guide-focus');
        else if (!p) partSel.classList.add('guide-focus');
        else if (!pr) paraSel.classList.add('guide-focus');

        if (!l || !p || !pr) {
            document.body.classList.add('hide-text-overlay');
        } else {
            document.body.classList.remove('hide-text-overlay');
        }
    };

    window.addEventListener('DOMContentLoaded', window.checkSelectionGuide);
}

// グローバル関数
window.syncMobileMenu = function() {
    if (window.innerWidth <= 768) window.checkSelectionGuide(); 
    
    let l = document.getElementById('mobileLessonSelect').value;
    let p = document.getElementById('mobilePartSelect').value;
    let pr = document.getElementById('mobileParaSelect').value;
    
    if (l) {
        const navBtns = document.querySelectorAll('.nav-btn');
        if(navBtns[l-1]) window.selectLesson(parseInt(l), navBtns[l-1]);
    }
    if (p) document.getElementById('partSelect').value = p;
    if (pr) document.getElementById('paraSelect').value = pr;
    
    if (typeof window.onScopeChange === 'function') window.onScopeChange();
    setTimeout(() => { if(typeof window.openSpeechOverlay === 'function') window.openSpeechOverlay('reading'); }, 100);
};

window.openCustomSubmitModal = function() {
    if (typeof openSubmitModal === 'function') openSubmitModal();
};
if (window.innerWidth <= 768) {
    // 10pxの初期化
    window.currentMobileFontSize = 10;
    document.documentElement.style.setProperty('--mobile-font-size', '10px');

    window.safeChangeSize = function(type, step) {
        window.currentMobileFontSize = Math.max(8, Math.min(30, window.currentMobileFontSize + step));
        document.documentElement.style.setProperty('--mobile-font-size', window.currentMobileFontSize + 'px');
    };

    // 視覚誘導
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

// ==========================================
// ★ 新規：ブラウザ環境の自動判別と誘導ポップアップ
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // PCの場合は実行しない
    if (window.innerWidth > 768) return;

    const ua = navigator.userAgent.toLowerCase();
    
    // OSとブラウザの判定
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = isIOS && /safari/.test(ua) && !/crios|fxios|opios/.test(ua);
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    
    // アプリ内ブラウザ(WebView)の判定
    const isLine = /line/.test(ua);
    const isFB = /fbav|fban/.test(ua);
    const isInsta = /instagram/.test(ua);
    const isTwitter = /twitter/.test(ua);
    const isAndroidWebView = /wv/.test(ua) && /android/.test(ua);
    const isIOSWebView = isIOS && !/safari/.test(ua); // Safariの文字がないiOSブラウザ（ロイロ等）
    
    const isInAppBrowser = isLine || isFB || isInsta || isTwitter || isAndroidWebView || isIOSWebView;

    if (isInAppBrowser) {
        // ① アプリ内ブラウザの場合（マイクが使えない警告）
        const warningDiv = document.createElement('div');
        warningDiv.id = 'inAppBrowserWarning';
        warningDiv.innerHTML = `
            <div class="popup-box">
                <h3>⚠️ マイクが使えません</h3>
                <p>現在のアプリ（LINEやロイロノート等）では音声認識がブロックされます。</p>
                <p>画面の右上または右下にあるメニューボタン「︙」や「🧭」等から<br><b>「ブラウザで開く（Safari/Chrome）」</b>を選択してください。</p>
                <button onclick="document.getElementById('inAppBrowserWarning').style.display='none'">閉じる</button>
            </div>
        `;
        document.body.appendChild(warningDiv);
    } 
    else if (isIOS && isSafari && !isStandalone) {
        // ② iOS Safariで、まだホーム画面に追加されていない場合
        if (localStorage.getItem('hideA2HSPrompt')) return; // 一度消したら出さない

        const promptDiv = document.createElement('div');
        promptDiv.id = 'iosA2HSPrompt';
        promptDiv.innerHTML = `
            <div class="a2hs-content">
                <div class="a2hs-text">
                    <strong>📱 アプリとして追加</strong>
                    <span>下の [共有マーク 📤] から<br>「ホーム画面に追加」を選ぶと全画面で快適に使えます！</span>
                </div>
                <button onclick="document.getElementById('iosA2HSPrompt').style.display='none'; localStorage.setItem('hideA2HSPrompt', 'true');">✕</button>
            </div>
        `;
        document.body.appendChild(promptDiv);
    }
});
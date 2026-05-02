if (window.innerWidth <= 768) {
    // 1. スマホ初期画面
    const welcome = document.getElementById('mobileWelcomeScreen');
    if (welcome) welcome.classList.add('active');

    // 2. フォントサイズ管理（絶対に10pxスタート）
    window.targetMobileSize = 10;
    window.voiceMobileSize = 10;

    function applyMobileFonts() {
        let styleTag = document.getElementById('mobile-dynamic-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'mobile-dynamic-style';
            document.head.appendChild(styleTag);
        }
        // ★PC版の inline style(26px) に絶対に勝つため、全要素（*）に !important を指定
        styleTag.innerHTML = `
            @media (max-width: 768px) {
                .target-box-area .mobile-text-body, .target-box-area .mobile-text-body * { 
                    font-size: ${window.targetMobileSize}px !important; 
                    line-height: 1.5 !important; 
                }
                .voice-box-area .mobile-text-body, .voice-box-area .mobile-text-body * { 
                    font-size: ${window.voiceMobileSize}px !important; 
                    line-height: 1.5 !important; 
                }
            }
        `;
    }
    applyMobileFonts();

    // A-/A+ボタンでサイズを変える機能
    window.safeChangeSize = function(type, step) {
        if (type === 'target') window.targetMobileSize = Math.max(8, Math.min(40, window.targetMobileSize + step));
        else window.voiceMobileSize = Math.max(8, Math.min(40, window.voiceMobileSize + step));
        applyMobileFonts(); // ここで直ちにスタイルを更新
    };

    // 3. 監視エンジン：PC版の干渉を排除し、ボタンを維持する
    const mobileObserver = new MutationObserver(() => {
        const container = document.getElementById('recognizedTextDisplay');
        if (!container) return;

        const boxes = container.querySelectorAll(':scope > div');
        boxes.forEach(box => {
            const text = box.innerText || "";
            if (text.includes('TARGET') || text.includes('お手本')) box.classList.add('target-box-area');
            if (text.includes('YOUR VOICE') || text.includes('あなたの発音')) box.classList.add('voice-box-area');

            const content = box.querySelector(':scope > div:nth-child(n+2)');
            if (content) {
                content.classList.add('mobile-text-body');
                // PC版が書いたインラインスタイルを物理的に消去（保険）
                const children = content.querySelectorAll('*');
                children.forEach(el => {
                    if (el.style.fontSize) el.style.fontSize = ''; 
                    el.style.borderLeft = 'none';
                });
            }

            // A-/A+ボタンの維持（消えていたら復活）
            const header = box.querySelector(':scope > div:first-child');
            if (header && !header.querySelector('.mobile-font-ctrls')) {
                const type = box.classList.contains('target-box-area') ? 'target' : 'voice';
                header.insertAdjacentHTML('beforeend', `
                    <div class="mobile-font-ctrls" style="margin-left:auto; display:flex; gap:6px;">
                        <button onclick="window.safeChangeSize('${type}', -2)" style="padding:5px 12px; border:1px solid #ccc; background:#fff; border-radius:6px; font-weight:bold; font-size:12px; color:#333; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">A -</button>
                        <button onclick="window.safeChangeSize('${type}', 2)" style="padding:5px 12px; border:1px solid #ccc; background:#fff; border-radius:6px; font-weight:bold; font-size:12px; color:#333; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">A +</button>
                    </div>`);
            }
        });
        
        // ガタつきの原因（PC版の高さ強制指定）を剥ぎ取る
        container.querySelectorAll('*').forEach(el => {
            if (el.style.height) el.style.height = '';
            if (el.style.minHeight) el.style.minHeight = '';
        });
    });

    mobileObserver.observe(document.body, { childList: true, subtree: true });
}

// グローバル関数群
window.startMobileApp = function() {
    const welcome = document.getElementById('mobileWelcomeScreen');
    if(welcome) { welcome.style.opacity = '0'; setTimeout(() => { welcome.style.display = 'none'; }, 500); }
};

window.syncMobileMenu = function() {
    let l = document.getElementById('mobileLessonSelect').value;
    let p = document.getElementById('mobilePartSelect').value || "1";
    let pr = document.getElementById('mobileParaSelect').value || "full";
    if (!l) return;
    const navBtns = document.querySelectorAll('.nav-btn');
    if(navBtns[l-1]) selectLesson(parseInt(l), navBtns[l-1]);
    document.getElementById('partSelect').value = p;
    document.getElementById('paraSelect').value = pr;
    if (typeof onScopeChange === 'function') onScopeChange();
    setTimeout(() => { if(typeof openSpeechOverlay === 'function') openSpeechOverlay('reading'); }, 200);
};

window.openCustomSubmitModal = function() {
    const modal = document.getElementById('submitModal');
    if(modal) {
        modal.style.display = 'flex';
        let lVal = document.getElementById('mobileLessonSelect')?.value || '';
        let pVal = document.getElementById('mobilePartSelect')?.value || '1';
        let prVal = document.getElementById('mobileParaSelect')?.value || 'full';
        let scopeStr = `Lesson ${lVal} - Part ${pVal}`;
        if(prVal !== 'full') scopeStr += ` (${prVal.toUpperCase()})`;
        document.getElementById('submitScopeDisplay').innerText = scopeStr;
        document.getElementById('submitAcc').innerText = document.getElementById('hudAccValue').innerText.replace('%','');
        document.getElementById('submitWpm').innerText = document.getElementById('hudWpmValue').innerText;
    }
};
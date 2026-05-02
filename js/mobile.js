// ★ 透明な壁を確実に消す処理
function startMobileApp() {
    const welcome = document.getElementById('mobileWelcomeScreen');
    if(welcome) {
        welcome.style.opacity = '0';
        welcome.style.pointerEvents = 'none'; // タッチ判定を即座に消す
        setTimeout(() => { 
            welcome.classList.add('hidden-welcome'); // CSSで完全に非表示化
        }, 500);
    }
}

// スマホメニュー連動
function syncMobileMenu() {
    let lessonVal = document.getElementById('mobileLessonSelect').value;
    let partVal = document.getElementById('mobilePartSelect').value;
    let paraVal = document.getElementById('mobileParaSelect').value;

    // Lessonがまだ未選択（空）なら何もしない
    if (!lessonVal) return; 

    // 初めてLessonを選んだとき、Part/段落が「〜を選択」だったら自動で1セット目にする
    if (!partVal) {
        document.getElementById('mobilePartSelect').value = "1";
        partVal = "1";
    }
    if (!paraVal) {
        document.getElementById('mobileParaSelect').value = "full";
        paraVal = "full";
    }

    // PC版のLesson切り替え関数を呼び出す
    const navBtns = document.querySelectorAll('.nav-btn');
    if(navBtns[parseInt(lessonVal) - 1]) {
        selectLesson(parseInt(lessonVal), navBtns[parseInt(lessonVal) - 1]);
    }

    // サイドバーの値を更新して、教材データを読み込ませる
    document.getElementById('partSelect').value = partVal;
    document.getElementById('paraSelect').value = paraVal;
    
    if (typeof onScopeChange === 'function') {
        onScopeChange();
    }

    // 教材が読み込まれるのを待って音読オーバーレイを開く
    setTimeout(() => {
        if(typeof openSpeechOverlay === 'function') openSpeechOverlay('reading');
    }, 200);
}

// 成績提出モーダルを開く専用関数
function openCustomSubmitModal() {
    const modal = document.getElementById('submitModal');
    if(modal) {
        modal.style.display = 'flex';
        let lVal = document.getElementById('mobileLessonSelect') ? document.getElementById('mobileLessonSelect').value : '';
        let pVal = document.getElementById('mobilePartSelect') ? document.getElementById('mobilePartSelect').value : '';
        let prVal = document.getElementById('mobileParaSelect') ? document.getElementById('mobileParaSelect').value : '';
        
        if(window.innerWidth > 768) {
            const activeNav = document.querySelector('.nav-btn.active');
            if(activeNav) lVal = activeNav.innerText.replace(/\D/g, '');
            if(document.getElementById('partSelect')) pVal = document.getElementById('partSelect').value;
            if(document.getElementById('paraSelect')) prVal = document.getElementById('paraSelect').value;
        }

        let scopeStr = `Lesson ${lVal} - Part ${pVal}`;
        if(prVal && prVal !== 'full') scopeStr += ` (${prVal.toUpperCase()})`;
        
        const display = document.getElementById('submitScopeDisplay');
        if(display) display.innerText = scopeStr;

        const accElement = document.getElementById('hudAccValue');
        const wpmElement = document.getElementById('hudWpmValue');
        if(accElement && document.getElementById('submitAcc')) document.getElementById('submitAcc').innerText = accElement.innerText.replace('%', '');
        if(wpmElement && document.getElementById('submitWpm')) document.getElementById('submitWpm').innerText = wpmElement.innerText;
    }
}

// フォントサイズ変更（スマホ専用）
let targetMobileSize = 12;
let voiceMobileSize = 12;
window.changeFontSize = function(type, step) {
    if (window.innerWidth > 768) return;
    if (type === 'eng' || type === 'target') {
        targetMobileSize = Math.max(10, Math.min(30, targetMobileSize + step));
        document.documentElement.style.setProperty('--target-font', targetMobileSize + 'px');
    } else {
        voiceMobileSize = Math.max(10, Math.min(30, voiceMobileSize + step));
        document.documentElement.style.setProperty('--voice-font', voiceMobileSize + 'px');
    }
};

// 監視エンジン：不要な要素を抹殺し、本文を確実に表示
const observer = new MutationObserver(() => {
    if (window.innerWidth > 768) return; 
    const recDisplay = document.getElementById('recognizedTextDisplay');
    if(!recDisplay) return;

    const allDivs = Array.from(recDisplay.querySelectorAll(':scope > div'));
    let targetBox = null, voiceBox = null;

    allDivs.forEach((div) => {
        if (div.id === 'mobileResizerHandle') return;
        const text = div.innerText || "";

        if (text.includes('TARGET TEXT') || text.includes('Target Text') || text.includes('お手本')) {
            div.classList.add('target-box-area');
            div.style.setProperty('display', 'flex', 'important');
            targetBox = div;
            const header = div.querySelector('div:first-child');
            
            // ★ フリーズ（無限ループ）の原因を修正：dataset.customized で一度だけ処理するようストッパーを設置
            if (header && !header.dataset.customized) {
                header.innerHTML = `<span>Target Text</span><div><button class="font-size-btn" onclick="changeFontSize('target', -2)">A-</button><button class="font-size-btn" onclick="changeFontSize('target', 2)">A+</button></div>`;
                header.dataset.customized = "true";
            }
            
        } else if (text.includes('YOUR VOICE') || text.includes('Your Voice') || text.includes('あなたの発音')) {
            div.classList.add('voice-box-area');
            div.style.setProperty('display', 'flex', 'important');
            voiceBox = div;
            const header = div.querySelector('div:first-child');
            
            // ★ こちらもストッパーを設置
            if (header && !header.dataset.customized) {
                header.innerHTML = `<span>Your Voice</span><div><button class="font-size-btn" onclick="changeFontSize('voice', -2)">A-</button><button class="font-size-btn" onclick="changeFontSize('voice', 2)">A+</button></div>`;
                header.dataset.customized = "true";
            }
            if(div.innerHTML.includes('STARTボタンを押して')) {
                div.innerHTML = div.innerHTML.replace(/※.*?STARTボタンを押して.*?<\/span>/g, '<span style="font-size:12px;color:#666;">※Startボタンを押して開始</span>');
            }
        } else {
            div.style.setProperty('display', 'none', 'important');
        }
    });

    // リサイズバー
    if(targetBox && voiceBox && !document.getElementById('mobileResizerHandle')) {
        targetBox.style.cssText += 'height: 45vh !important; flex: 0 0 45vh !important;';
        voiceBox.style.cssText += 'height: calc(100% - 45vh - 24px) !important; flex: 0 0 calc(100% - 45vh - 24px) !important;';
        const resizer = document.createElement('div');
        resizer.id = 'mobileResizerHandle';
        resizer.innerHTML = '<div style="width:50px; height:5px; background:#aaa; border-radius:3px;"></div>';
        resizer.style.cssText = 'display:flex; justify-content:center; align-items:center; height:24px; background:#f0f4f8; cursor:ns-resize; touch-action:none; z-index:50; border-top:1px solid #ddd; border-bottom:1px solid #ddd; flex-shrink: 0;';
        targetBox.parentNode.insertBefore(resizer, voiceBox);
        
        let isDragging = false, startY, startHeight;
        resizer.addEventListener('touchstart', (e) => { isDragging = true; startY = e.touches[0].clientY; startHeight = targetBox.offsetHeight; document.body.style.overflow = 'hidden'; }, {passive: false});
        document.addEventListener('touchmove', (e) => {
            if(!isDragging) return; e.preventDefault();
            let newH = startHeight + (e.touches[0].clientY - startY);
            if(newH > 60 && newH < window.innerHeight - 200) {
                targetBox.style.height = newH + 'px'; targetBox.style.flex = `0 0 ${newH}px`;
                voiceBox.style.height = `calc(100% - ${newH}px - 24px)`; voiceBox.style.flex = `0 0 calc(100% - ${newH}px - 24px)`;
            }
        }, {passive: false});
        document.addEventListener('touchend', () => { isDragging = false; document.body.style.overflow = ''; });
    }
});
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.start-record-btn');
    if(btn) {
        setTimeout(() => {
            const isRecording = btn.innerText.includes('STOP') || btn.innerText.includes('FINISH');
            if(isRecording) {
                document.body.classList.add('is-recording');
            } else {
                document.body.classList.remove('is-recording');
            }
        }, 50);
    }
});
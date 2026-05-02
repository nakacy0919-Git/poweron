// スマホメニューの連動
function syncMobileMenu() {
    const lessonVal = document.getElementById('mobileLessonSelect').value;
    const partVal = document.getElementById('mobilePartSelect').value;
    const paraVal = document.getElementById('mobileParaSelect').value;

    const navBtns = document.querySelectorAll('.nav-btn');
    if(navBtns[lessonVal - 1]) {
        selectLesson(parseInt(lessonVal), navBtns[lessonVal - 1]);
    }

    document.getElementById('partSelect').value = partVal;
    document.getElementById('paraSelect').value = paraVal;
    onScopeChange();

    setTimeout(() => {
        const mode = (typeof currentMode !== 'undefined' && currentMode === 'shadowing') ? 'shadowing' : 'reading';
        if(typeof openSpeechOverlay === 'function') openSpeechOverlay(mode);
    }, 100);
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
        if(prVal && prVal !== 'full') {
            scopeStr += ` (${prVal.toUpperCase()})`;
        }
        
        const display = document.getElementById('submitScopeDisplay');
        if(display) display.innerText = scopeStr;

        const accElement = document.getElementById('hudAccValue');
        const wpmElement = document.getElementById('hudWpmValue');
        if(accElement && document.getElementById('submitAcc')) {
            document.getElementById('submitAcc').innerText = accElement.innerText.replace('%', '');
        }
        if(wpmElement && document.getElementById('submitWpm')) {
            document.getElementById('submitWpm').innerText = wpmElement.innerText;
        }
    }
}

// ★ Target Text と Your Voice を完全に独立してサイズ変更する処理
let targetMobileSize = 12;
let voiceMobileSize = 12;
const originalChangeFontSize = window.changeFontSize;
window.changeFontSize = function(type, step) {
    if (window.innerWidth > 768) {
        if(originalChangeFontSize) try { originalChangeFontSize(type, step); } catch(e){}
        return;
    }
    if (type === 'eng' || type === 'target') {
        targetMobileSize = Math.max(10, Math.min(30, targetMobileSize + step));
        document.documentElement.style.setProperty('--target-font', targetMobileSize + 'px');
    } else if (type === 'rec' || type === 'voice') {
        voiceMobileSize = Math.max(10, Math.min(30, voiceMobileSize + step));
        document.documentElement.style.setProperty('--voice-font', voiceMobileSize + 'px');
    }
};

// DOMの監視：ヘッダーの固定、不要な要素の厳密な抹殺、スクロール領域の再設定
const observer = new MutationObserver(() => {
    if (window.innerWidth > 768) return; 
    
    const recDisplay = document.getElementById('recognizedTextDisplay');
    if(!recDisplay) return;

    const allDivs = Array.from(recDisplay.querySelectorAll(':scope > div'));

    let targetBox = null;
    let voiceBox = null;

    allDivs.forEach((div) => {
        if (div.id === 'mobileResizerHandle') return;

        // 要素内のすべてのテキストを取得
        const text = div.innerText || "";

        // ①「TARGET TEXT（お手本）」が含まれるなら絶対に消さずに保護！
        if (text.includes('TARGET TEXT') || text.includes('Target Text') || text.includes('お手本')) {
            div.classList.add('target-box-area');
            div.style.setProperty('display', 'flex', 'important'); // 確実に表示！
            targetBox = div;
            
            const header = div.querySelector('div:first-child');
            if (header) {
                const btns = header.querySelectorAll('.font-size-btn');
                if (btns.length >= 2) {
                    btns[0].setAttribute('onclick', "changeFontSize('target', -2)");
                    btns[1].setAttribute('onclick', "changeFontSize('target', 2)");
                }
            }
        } 
        // ②「YOUR VOICE（あなたの発音）」が含まれるなら絶対に消さずに保護！
        else if (text.includes('YOUR VOICE') || text.includes('Your Voice') || text.includes('あなたの発音')) {
            div.classList.add('voice-box-area');
            div.style.setProperty('display', 'flex', 'important'); // 確実に表示！
            voiceBox = div;
            
            const header = div.querySelector('div:first-child');
            if (header) {
                const btns = header.querySelectorAll('.font-size-btn');
                if (btns.length >= 2) {
                    btns[0].setAttribute('onclick', "changeFontSize('voice', -2)");
                    btns[1].setAttribute('onclick', "changeFontSize('voice', 2)");
                }
            }
            if(div.innerHTML.includes('STARTボタンを押して')) {
                div.innerHTML = div.innerHTML.replace(/※.*?STARTボタンを押して.*?<\/span>/g, '<span style="font-size:12px;color:#666;">※Startボタンを押して開始</span>');
            }
        } 
        // ③ ターゲットでもボイスでもない、邪魔な要素（Reading Checkなど）だけを問答無用で非表示！
        else {
            div.style.setProperty('display', 'none', 'important');
        }
    });

    // リサイズバーと外枠の絶対固定
    if(targetBox && voiceBox && !document.getElementById('mobileResizerHandle')) {
        // 外枠自体の高さを絶対固定（ガタつき防止）
        targetBox.style.cssText += 'height: 45vh !important; flex: 0 0 45vh !important;';
        voiceBox.style.cssText += 'height: calc(100% - 45vh - 24px) !important; flex: 0 0 calc(100% - 45vh - 24px) !important;';

        const resizer = document.createElement('div');
        resizer.id = 'mobileResizerHandle';
        resizer.innerHTML = '<div style="width:50px; height:5px; background:#aaa; border-radius:3px;"></div>';
        resizer.style.cssText = 'display:flex; justify-content:center; align-items:center; height:24px; margin: 0; background:#f0f4f8; cursor:ns-resize; touch-action:none; z-index:50; border-top:1px solid #ddd; border-bottom:1px solid #ddd; flex-shrink: 0;';
        
        targetBox.parentNode.insertBefore(resizer, voiceBox);

        let isDragging = false, startY, startHeight;
        resizer.addEventListener('touchstart', (e) => {
            isDragging = true; startY = e.touches[0].clientY; startHeight = targetBox.offsetHeight;
            document.body.style.overflow = 'hidden';
        }, {passive: false});
        
        document.addEventListener('touchmove', (e) => {
            if(!isDragging) return; e.preventDefault();
            let newHeight = startHeight + (e.touches[0].clientY - startY);
            if(newHeight > 60 && newHeight < window.innerHeight - 200) { 
                targetBox.style.height = newHeight + 'px'; 
                targetBox.style.flex = `0 0 ${newHeight}px`; // リサイズ中も枠を絶対固定
                
                voiceBox.style.height = `calc(100% - ${newHeight}px - 24px) !important`;
                voiceBox.style.flex = `0 0 calc(100% - ${newHeight}px - 24px) !important`;
            }
        }, {passive: false});
        
        document.addEventListener('touchend', () => { 
            isDragging = false; document.body.style.overflow = ''; 
        });
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// START時にメニューを消して画面を広くする処理
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
// ==========================================
// audio.js: 音声ファイルの再生・制御（レベル自動対応版）
// ==========================================
function updateAudioButtonUI(isPlaying) {
    const btn = document.getElementById('btnMainAudio');
    if (btn) btn.innerHTML = isPlaying ? "⏸ Pause Audio" : "▶ Play Audio";
}

function toggleMainAudio() {
    if (!audioPlayer || !audioPlayer.src || audioPlayer.src.includes("undefined")) {
        return alert("音声ファイルがセットされていません。");
    }

    // --- ★魔法のコード：レベルに合わせてファイル名を自動変換 ---
    let currentSrc = audioPlayer.src;
    
    // 一旦、付加された文字を取り除いて標準の「.mp3」に戻す（連打や切り替えによるバグ防止）
    let baseSrc = currentSrc.replace('_pre1.mp3', '.mp3').replace('_grade1.mp3', '.mp3');
    let newSrc = baseSrc;

    // 選ばれているレベルに合わせて、ファイル名のお尻に文字を付け足す
    if (typeof currentLevel !== 'undefined') {
        if (currentLevel === 'pre1') newSrc = baseSrc.replace('.mp3', '_pre1.mp3');
        else if (currentLevel === 'grade1') newSrc = baseSrc.replace('.mp3', '_grade1.mp3');
    }

    // もしファイル名が変更されていたら、プレイヤーに新しいファイルをセットする
    if (currentSrc !== newSrc) {
        audioPlayer.src = newSrc;
    }
    // --------------------------------------------------------

    if (audioPlayer.paused) {
        audioPlayer.play().then(() => updateAudioButtonUI(true)).catch(e => {
            console.error(e); 
            // 先生がエラー原因を特定しやすいように、探しているファイル名を表示します
            alert("音声ファイルが見つかりません。\nファイル名が「" + newSrc.split('/').pop() + "」になっているか確認してください。");
        });
    } else {
        audioPlayer.pause(); updateAudioButtonUI(false);
    }
}

function stopAudio() {
    if (!audioPlayer) return;
    audioPlayer.pause();
    if (audioPlayer.readyState > 0) audioPlayer.currentTime = 0;
    updateAudioButtonUI(false);
}

function seekAudio(seconds) {
    if (audioPlayer && audioPlayer.readyState > 0) audioPlayer.currentTime += seconds;
}

let loopState = { start: null, end: null, active: false };

function setLoopStart() {
    if (!audioPlayer) return;
    loopState.start = audioPlayer.currentTime; loopState.end = null; loopState.active = false;
    const btnStart = document.getElementById('btn-loop-start');
    const btnEnd = document.getElementById('btn-loop-end');
    if(btnStart) btnStart.classList.add('loop-active');
    if(btnEnd) btnEnd.classList.remove('loop-active');
}

function setLoopEnd() {
    if (!audioPlayer || loopState.start === null) return;
    loopState.end = audioPlayer.currentTime;
    if (loopState.end <= loopState.start) return;
    loopState.active = true;
    const btnEnd = document.getElementById('btn-loop-end');
    if(btnEnd) btnEnd.classList.add('loop-active');
    if (audioPlayer.paused) toggleMainAudio();
}

function clearLoop() {
    loopState = { start: null, end: null, active: false };
    const btnStart = document.getElementById('btn-loop-start');
    const btnEnd = document.getElementById('btn-loop-end');
    if(btnStart) btnStart.classList.remove('loop-active');
    if(btnEnd) btnEnd.classList.remove('loop-active');
}

if (audioPlayer) {
    audioPlayer.addEventListener('timeupdate', () => {
        if (loopState.active && audioPlayer.currentTime >= loopState.end) {
            audioPlayer.currentTime = loopState.start;
            if (audioPlayer.paused) audioPlayer.play();
        }
    });
    audioPlayer.addEventListener('ended', () => updateAudioButtonUI(false));
}
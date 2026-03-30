// ==========================================
// audio.js: 音声ファイルの再生・制御
// ==========================================
function updateAudioButtonUI(isPlaying) {
    const btn = document.getElementById('btnMainAudio');
    if (btn) btn.innerHTML = isPlaying ? "⏸ Pause Audio" : "▶ Play Audio";
}

function toggleMainAudio() {
    if (!audioPlayer || !audioPlayer.src || audioPlayer.src.includes("undefined")) {
        return alert("音声ファイルがセットされていません。");
    }
    if (audioPlayer.paused) {
        audioPlayer.play().then(() => updateAudioButtonUI(true)).catch(e => {
            console.error(e); alert("音声が見つかりません。ファイル名とフォルダの場所を確認してください。");
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
// ==========================================
// state.js: 状態管理・共通変数
// ==========================================
let currentLesson = 1;
let currentKey = "L01_P1_full";
let currentScore = 0;
let currentMode = ''; 
let isScriptOpen = false;
let isJapaneseOpen = false;

// フォントサイズ管理
let engFontSize = 24;
let jpnFontSize = 20;
let recFontSize = 28;

let targetText = "";
let recordStartTime = 0;
let lastSpokenText = "";

// レッスン構造データ
const lessonStructure = {
    1: { 1: [1,2,3], 2: [1,2] }, 2: { 1: [1,2,3], 2: [1,2] }, 3: { 1: [1,2], 2: [1,2,3] },
    4: { 1: [1,2,3], 2: [1,2], 3: [1,2] }, 5: { 1: [1,2,3], 2: [1,2], 3: [1,2,3] },
    6: { 1: [1,2,3], 2: [4,5], 3: [6,7], 4: [8,9] }, 7: { 1: [1,2], 2: [3,4], 3: [5,6], 4: [7,8] },
    8: { 1: [1,2], 2: [3,4,5], 3: [6,7,8], 4: [9,10] }, 9: { 1: [1,2], 2: [3,4], 3: [5,6], 4: [7,8,9] },
    10: { 1: [1,2,3], 2: [4,5,6], 3: [7,8], 4: [9,10] }
};

// オーディオ要素
let audioPlayer = document.getElementById('mainAudioPlayer');
let successSound = document.getElementById('successSound');
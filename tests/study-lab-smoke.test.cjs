const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('Study Lab can enter all modes and stores practice independently', () => {
    const nodes = Object.create(null);
    ['mainOverlay', 'targetTextDisplay', 'speechResultWindow', 'overlayTitle'].forEach(id => {
        nodes[id] = {style:{}, innerHTML:'', textContent:''};
    });
    const storageData = new Map();
    const window = {
        PowerOnPracticeCore:require('../js/practiceCore.js'),
        localStorage:{
            getItem:key=>storageData.get(key)||null,
            setItem:(key,value)=>storageData.set(key,value)
        }
    };
    const sandbox = {
        window,
        document:{
            body:{classList:{add(){},remove(){}}},
            getElementById:id=>nodes[id]||null
        },
        currentLesson:1,
        currentKey:'L01_P1_full',
        currentLevel:'standard',
        currentMode:'',
        lessonStructure:{1:{1:[1,2]}},
        lessonScripts:{L01_P1_full:'We learn English today. Students work together to solve puzzles.'},
        lessonTranslations:{L01_P1_full:'今日は英語を学びます。生徒は一緒に活動します。'}
    };
    sandbox.resetAppMode = function () {
        if (window.PowerOnPractice) window.PowerOnPractice.stop();
        sandbox.currentMode = '';
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8'),sandbox);
    const practice = window.PowerOnPractice;

    practice.open('reading');
    assert.match(nodes.targetTextDisplay.innerHTML,/We learn English today/);
    practice.markRead(true);
    assert.equal(practice.getProgress().scopes['standard:L01_P1_full'].reading.completed[0],true);

    practice.open('deep');
    practice.switchJapanese();
    assert.match(nodes.targetTextDisplay.innerHTML,/今日は英語を学びます/);
    practice.markRead(true);
    assert.equal(practice.getProgress().scopes['standard:L01_P1_full'].deep.completed[0],true);

    practice.open('puzzle');
    assert.match(nodes.targetTextDisplay.innerHTML,/po-puzzle-cards/);
    ['0','1','2','3'].forEach(id=>practice.chooseCard(id));
    practice.checkPuzzle();
    assert.equal(practice.getProgress().scopes['standard:L01_P1_full'].puzzle.completed[0],true);

    practice.captureLegacy('readingcheck',92);
    assert.equal(practice.getProgress().scopes['standard:L01_P1_full'].readingcheck.bestAccuracy,92);
    practice.open('progress');
    assert.match(nodes.targetTextDisplay.innerHTML,/Lesson 10/);
    assert.match(nodes.targetTextDisplay.innerHTML,/Reading Check/);
    practice.close();
    assert.equal(sandbox.currentMode,'');
});

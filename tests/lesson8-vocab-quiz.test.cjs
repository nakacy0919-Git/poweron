// node --test tests/lesson8-vocab-quiz.test.cjs
// Pure Node.js regression tests: no browser, network or deployment required.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function launch(existingStore) {
    const callbacks = [];
    const nodes = {};
    const classes = new Set();
    const store = existingStore || new Map();
    const clock = {now:0};
    const context = {
        currentKey: 'L08_P1_full',
        currentMode: 'quiz',
        window: {
            innerWidth: 1280,
            localStorage: {
                getItem: key => store.has(key) ? store.get(key) : null,
                setItem: (key,value) => store.set(key,String(value))
            }
        },
        performance: {now: () => clock.now},
        document: {
            body: {classList: {add: s => classes.add(s), remove: s => classes.delete(s)}},
            getElementById(id) {
                if (!nodes[id]) nodes[id] = {innerHTML:'', innerText:'', style:{}};
                return nodes[id];
            }
        },
        clearInterval() {},
        setInterval() {return 1;},
        setTimeout(fn) {callbacks.push(fn); return callbacks.length;},
        resetAppMode() {context.currentMode = ''; classes.delete('quiz-active');},
        alert() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root,'lessons/lessonData.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(root,'js/lesson8QuizProgress.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(root,'js/quiz.js'),'utf8'),context);
    const run = source => vm.runInContext(source, context);
    run('isTimerEnabled = false');
    return {context,run,callbacks,nodes,classes,store,clock};
}

test('Lesson 8 has exactly 18 / 11 / 9 / 10 vocabulary items and valid four choices', () => {
    const {run,context} = launch();
    for (const [p,n] of [[1,18],[2,11],[3,9],[4,10]]) {
        context.currentKey = 'L08_P'+p+'_full';
        run('setupQuizData(1)');
        const questions = run('quizQuestions');
        assert.equal(questions.length,n);
        for (const question of questions) {
            assert.equal(question.choices.length,4);
            assert.equal(new Set(question.choices).size,4);
            assert.equal(question.choices.filter(c => c===question.correct).length,1);
            const meanings=run('lessonVocab.L08_P'+p+'.map(x=>x.meaning)');
            assert.ok(question.choices.every(c=>meanings.includes(c)));
        }
    }
});

test('double click and timeout cannot award multiple points', () => {
    const {run,context,callbacks} = launch();
    run('setupQuizData(1)');
    const question=run('quizQuestions[0]');
    const buttons=question.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=question.correct;
    run('checkAnswer1(answerButton, answer, answer)');
    run('checkAnswer1(answerButton, answer, answer)');
    run('handleTimeOut()');
    assert.equal(run('quizScore'),1);
    assert.equal(run('currentQuizIndex'),0);
    callbacks.splice(0).forEach(fn=>fn());
    assert.equal(run('currentQuizIndex'),1);
    assert.equal(run('quizScore'),1);
});

test('stale callbacks from a previous quiz session do not advance the new session', () => {
    const {run,context,callbacks} = launch();
    run('setupQuizData(1)');
    const q=run('quizQuestions[0]');
    const buttons=q.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=q.correct;
    run('checkAnswer1(answerButton, answer, answer)');
    run('setupQuizData(1)');
    callbacks.splice(0).forEach(fn=>fn());
    assert.equal(run('currentQuizIndex'),0);
    assert.equal(run('quizScore'),0);
});

test('voice quiz supports manual skip without SpeechRecognition', () => {
    const {run,callbacks} = launch();
    run('setupQuizData(2)');
    callbacks.splice(0).forEach(fn=>fn());
    assert.match(run("document.getElementById('quizSpeechBox').innerText"), /未対応/);
    run('skipQuizSpeaking()');
    callbacks.splice(0).forEach(fn=>fn());
    assert.equal(run('currentQuizIndex'),1);
});

test('mobile entry and responsive quiz visibility rules exist', () => {
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const css=fs.readFileSync(path.join(root,'css/mobile.css'),'utf8');
    assert.match(html,/id="btnMobileVocabQuiz"/);
    assert.match(css,/body\.quiz-active #targetTextDisplay/);
    assert.match(css,/body\.quiz-active #speechResultWindow/);
    assert.match(css,/body\.quiz-active \.quiz-choices/);
});

test('reverse Japanese-to-English four-choice works for all Lesson 8 parts', () => {
    const {run,context} = launch();
    for (const [part,count] of [[1,18],[2,11],[3,9],[4,10]]) {
        context.currentKey = 'L08_P'+part+'_full';
        run('lesson8QuizProgress.save("L08_P'+part+'", 1, {points: '+(count*10)+', correct: '+count+', questionCount: '+count+'})');
        run('setupQuizData(3)');
        const questions = run('quizQuestions');
        const words = run('lessonVocab.L08_P'+part+'.map(v=>v.word)');
        const original = run('lessonVocab.L08_P'+part);
        assert.equal(questions.length,count);
        for (const question of questions) {
            assert.ok(original.some(v=>v.word===question.correct && v.meaning===question.meaning));
            assert.equal(question.choices.length,4);
            assert.equal(new Set(question.choices).size,4);
            assert.equal(question.choices.filter(x=>x===question.correct).length,1);
            assert.ok(question.choices.every(x=>words.includes(x)));
        }
        assert.match(run("document.getElementById('targetTextDisplay').innerHTML"), /日本語の意味に合う英語/);
    }
});

test('reverse choices score exactly once and cannot double-advance on timeout', () => {
    const {run,context,callbacks} = launch();
    run('lesson8QuizProgress.save("L08_P1", 1, {points:180, correct:18, questionCount:18})');
    run('setupQuizData(3)');
    const question=run('quizQuestions[0]');
    const buttons=question.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=question.correct;
    run('checkAnswer1(answerButton, answer, answer)');
    run('checkAnswer1(answerButton, answer, answer)');
    run('handleTimeOut()');
    assert.equal(run('quizScore'),1);
    assert.equal(run('currentQuizIndex'),0);
    callbacks.splice(0).forEach(fn=>fn());
    assert.equal(run('quizScore'),1);
    assert.equal(run('currentQuizIndex'),1);
});

test('reverse quiz does not auto-play the correct word pronunciation', () => {
    const {run,context} = launch();
    let audioCalls=0;
    context.playWordAudio=()=>{audioCalls++;};
    run('lesson8QuizProgress.save("L08_P1", 1, {points:180, correct:18, questionCount:18})');
    run('setupQuizData(3)');
    assert.equal(audioCalls,0);
});


test('Lesson 8 targets are 60 percent, with 10P for a correct answer within 2 seconds', () => {
    const {run,context,clock} = launch();
    const expected = [[1,18,110],[2,11,70],[3,9,60],[4,10,60]];
    for (const [part,count,target] of expected) {
        context.currentKey = 'L08_P'+part+'_full';
        assert.equal(run('lesson8QuizProgress.targetForCount('+count+')'),target);
    }
    context.currentKey = 'L08_P1_full';
    run('setupQuizData(1)');
    const question=run('quizQuestions[0]');
    const buttons=question.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=question.correct;
    clock.now=2000;
    run('checkAnswer1(answerButton,answer,answer)');
    assert.equal(run('quizScore'),1);
    assert.equal(run('quizPoints'),10);
});

test('Correct answer after 2000ms awards 0P, but still counts as correct', () => {
    const {run,context,clock} = launch();
    run('setupQuizData(1)');
    const question=run('quizQuestions[0]');
    const buttons=question.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=question.correct;
    clock.now=2001;
    run('handleTimeOut()');
    assert.equal(run('currentQuizIndex'),0); // 2 seconds is a P window, not answer timeout
    run('checkAnswer1(answerButton,answer,answer)');
    assert.equal(run('quizScore'),1);
    assert.equal(run('quizPoints'),0);
    assert.match(run("document.getElementById('quizPointsFeedback').innerText"),/0P/);
});

test('Wrong answers award no P points even when fast', () => {
    const {run,context,clock} = launch();
    run('setupQuizData(1)');
    const question=run('quizQuestions[0]');
    const buttons=question.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=question.choices.find(x=>x!==question.correct);
    clock.now=200;
    run('checkAnswer1(answerButton,answer,"'+question.correct+'")');
    assert.equal(run('quizScore'),0);
    assert.equal(run('quizPoints'),0);
});

test('Reverse stage is locked until sufficient stage-one points are saved', () => {
    const {run,context} = launch();
    run('startVocabQuiz()');
    assert.match(run("document.getElementById('targetTextDisplay').innerHTML"),/disabled aria-disabled/);
    run('lesson8QuizProgress.save("L08_P1",1,{points:100,correct:17,questionCount:18})');
    assert.equal(run('lesson8QuizProgress.unlockedReverse("L08_P1",18)'),false);
    run('lesson8QuizProgress.save("L08_P1",1,{points:110,correct:18,questionCount:18})');
    assert.equal(run('lesson8QuizProgress.unlockedReverse("L08_P1",18)'),true);
    run('startVocabQuiz()');
    assert.match(run("document.getElementById('targetTextDisplay').innerHTML"),/ステージ2：日本語から英単語/);
});

test('Lesson 8 result screen saves completed attempts and does not double-save', () => {
    const {run,context,callbacks} = launch();
    run('setupQuizData(1)');
    run('quizQuestions = quizQuestions.slice(0,1)');
    const q=run('quizQuestions[0]');
    const buttons=q.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=q.correct;
    run('checkAnswer1(answerButton,answer,answer)');
    callbacks.splice(0).forEach(cb=>cb());
    assert.equal(run('lesson8QuizProgress.get("L08_P1",1).attempts'),1);
    assert.equal(run('lesson8QuizProgress.get("L08_P1",1).bestPoints'),10);
    run('renderQuizResult()');
    assert.equal(run('lesson8QuizProgress.get("L08_P1",1).attempts'),1);
});

test('Local score and unlocking survive a new page session on the same browser', () => {
    const first=launch();
    first.run('lesson8QuizProgress.save("L08_P2",1,{points:70,correct:11,questionCount:11})');
    const another=launch(first.store);
    assert.equal(another.run('lesson8QuizProgress.get("L08_P2",1).bestPoints'),70);
    assert.equal(another.run('lesson8QuizProgress.get("L08_P2",1).attempts'),1);
    assert.equal(another.run('lesson8QuizProgress.unlockedReverse("L08_P2",11)'),true);
    assert.equal(another.run('lesson8QuizProgress.get("L08_P1",1).bestPoints'),0);
});

test('Progress remains usable when browser storage is denied', () => {
    const {run,context} = launch();
    context.window.localStorage = {getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
    assert.equal(run('lesson8QuizProgress.save("L08_P3",1,{points:60,correct:9,questionCount:9}).persisted'),false);
    assert.equal(run('lesson8QuizProgress.unlockedReverse("L08_P3",9)'),true);
});

test('Legacy lessons keep the existing five-second quiz, without the points challenge', () => {
    const {run,context} = launch();
    context.currentKey='L07_P1_full';
    run('startVocabQuiz()');
    const html=run("document.getElementById('targetTextDisplay').innerHTML");
    assert.match(html,/5秒制限/);
    assert.ok(!html.includes('Pポイントチャレンジ'));
    assert.ok(!html.includes('日→英4択'));
});


test('Full Part 1 clears Stage 1 with 110P, then Stage 2 unlocks and clears', () => {
    const {run,context,clock,callbacks} = launch();
    run('setupQuizData(1)');
    for (let i=0;i<18;i++) {
        const question=run('quizQuestions[currentQuizIndex]');
        const buttons=question.choices.map(innerText=>({innerText,style:{}}));
        context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
        context.answer=question.correct;
        clock.now += i<11 ? 1000 : 2001;
        run('checkAnswer1(answerButton,answer,answer)');
        callbacks.splice(0).forEach(cb=>cb());
    }
    assert.equal(run('quizPoints'),110);
    assert.equal(run('quizScore'),18);
    assert.equal(run('lesson8QuizProgress.get("L08_P1",1).bestPoints'),110);
    assert.equal(run('lesson8QuizProgress.unlockedReverse("L08_P1",18)'),true);
    run('setupQuizData(3)');
    assert.equal(run('quizMode'),3);
    for(let i=0;i<18;i++) {
        const question=run('quizQuestions[currentQuizIndex]');
        const buttons=question.choices.map(innerText=>({innerText,style:{}}));
        context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
        context.answer=question.correct;
        clock.now += 1000;
        run('checkAnswer1(answerButton,answer,answer)');
        callbacks.splice(0).forEach(cb=>cb());
    }
    assert.equal(run('quizPoints'),180);
    assert.equal(run('lesson8QuizProgress.get("L08_P1",3).bestPoints'),180);
    assert.match(run("document.getElementById('targetTextDisplay').innerHTML"),/次のPartのクイズへ/);
});

test('Accuracy alone must not trigger the points clear celebration', () => {
    const {run,context,clock,callbacks} = launch();
    let confetti=0;
    context.fireConfetti=()=>{confetti++;};
    run('setupQuizData(1)');
    run('quizQuestions = quizQuestions.slice(0,1)');
    const q=run('quizQuestions[0]');
    const buttons=q.choices.map(innerText=>({innerText,style:{}}));
    context.answerButton={style:{},parentElement:{querySelectorAll(){return buttons;}}};
    context.answer=q.correct;
    clock.now=2001;
    run('checkAnswer1(answerButton,answer,answer)');
    callbacks.splice(0).forEach(cb=>cb());
    assert.equal(run('quizScore'),1);
    assert.equal(run('quizPoints'),0);
    assert.equal(confetti,0);
});

// node --test tests/lesson8-vocab-quiz.test.cjs
// Pure Node.js regression tests: no browser, network or deployment required.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function launch() {
    const callbacks = [];
    const nodes = {};
    const classes = new Set();
    const context = {
        currentKey: 'L08_P1_full',
        currentMode: 'quiz',
        window: {innerWidth: 1280},
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
    vm.runInContext(fs.readFileSync(path.join(root,'js/quiz.js'),'utf8'),context);
    const run = source => vm.runInContext(source, context);
    run('isTimerEnabled = false');
    return {context,run,callbacks,nodes,classes};
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
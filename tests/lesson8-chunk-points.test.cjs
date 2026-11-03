// Run with: node --test tests/lesson8-chunk-points.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
function createApp(){
    const nodes={},callbacks=[],timers=[],saved=new Map(),alerts=[],opens=[];
    let currentTime=0;
    const ctx={
        currentKey:'L08_P1_full',currentMode:'quiz',
        innerWidth:1280,
        performance:{now:()=>currentTime},
        localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
        document:{
            body:{classList:{add(){},remove(){}}},
            getElementById(id){return nodes[id]||(nodes[id]={innerHTML:'',innerText:'',style:{}});}
        },
        setInterval(fn){timers.push(fn);return timers.length;},clearInterval(){},
        setTimeout(fn){callbacks.push(fn);return callbacks.length;},
        resetAppMode(){ctx.currentMode='';},
        alert(msg){alerts.push(msg);},
        open(url,target,features){opens.push({url,target,features});}
    };
    ctx.window=ctx;
    vm.createContext(ctx);
    for(const file of ['lessons/lessonData.js','lessons/lesson8/chunks.js','js/quiz.js','js/lesson8Practice.js']){
        vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
    }
    const run=src=>vm.runInContext(src,ctx);
    return {ctx,run,nodes,callbacks,timers,saved,alerts,opens,clock(ms){currentTime+=ms;}};
}
function choiceButton(q){
    const buttons=q.choices.map(innerText=>({innerText,style:{},disabled:false}));
    const i=q.choices.indexOf(q.correct);
    const selected=buttons[i];
    selected.parentElement={querySelectorAll(){return buttons;}};
    return {selected,buttons,index:i};
}
test('87 chunks are literal textbook spans with unique Japanese options',()=>{
    const {run}=createApp();
    const expected=[25,31,19,12];
    for(let p=1;p<=4;p++){
        const key='L08_P'+p;
        const chunks=run('lesson8Chunks.'+key);
        const full=run('lessonScripts.'+key+'_full');
        assert.equal(chunks.length,expected[p-1]);
        assert.equal(new Set(chunks.map(c=>c.ja)).size,chunks.length);
        for(const c of chunks){assert.ok(full.includes(c.en),c.en);assert.ok(c.ja.length>0);}
    }
});
test('each part generates four unique choices with one correct answer',()=>{
    const {ctx,run,nodes}=createApp();
    for(const [p,n] of [[1,25],[2,31],[3,19],[4,12]]){
        ctx.currentKey='L08_P'+p+'_full';
        ctx.currentMode='quiz';
        run('setupQuizData(4)');
        const questions=run('quizQuestions');
        assert.equal(questions.length,n);
        for(const q of questions){
            assert.equal(q.choices.length,4);
            assert.equal(new Set(q.choices).size,4);
            assert.equal(q.choices.filter(v=>v===q.correct).length,1);
        }
        assert.match(nodes.targetTextDisplay.innerHTML,/l8-chunk-choices/);
    }
});
test('chunk score is awarded once within five seconds and stored',()=>{
    const app=createApp(),{run,clock,ctx,saved}=app;
    run('setupQuizData(4)');
    const q=run('quizQuestions[0]'),{selected,index}=choiceButton(q);
    ctx.answerButton=selected;ctx.answerIndex=index;
    clock(900);
    run('checkLesson8ChunkAnswer(answerButton,answerIndex)');
    run('checkLesson8ChunkAnswer(answerButton,answerIndex)');
    assert.equal(run('quizScore'),1);
    run('currentQuizIndex=quizQuestions.length;renderQuizResult()');
    assert.equal(run("getLesson8PracticeStatus('L08_P1').cp"),10);
    assert.ok(saved.has('poweron_lesson8_progress_v1'));
});
test('correct vocab answer after two seconds earns no points',()=>{
    const app=createApp(),{run,ctx,clock}=app;
    ctx.currentKey='L08_P2_full';
    run('setupQuizData(1)');
    const q=run('quizQuestions[0]'),{selected}=choiceButton(q);
    ctx.answerButton=selected;ctx.answer=q.correct;
    clock(2200);
    run('checkAnswer1(answerButton,answer,answer)');
    assert.equal(run('quizScore'),1);
    run('currentQuizIndex=quizQuestions.length;renderQuizResult()');
    assert.equal(run("getLesson8PracticeStatus('L08_P2').vp"),0);
});
test('correct vocab answer within two seconds earns 10 P and best score persists',()=>{
    const app=createApp(),{run,ctx,clock}=app;
    run('setupQuizData(3)');
    const q=run('quizQuestions[0]'),{selected}=choiceButton(q);
    ctx.answerButton=selected;ctx.answer=q.correct;
    clock(500);
    run('checkAnswer1(answerButton,answer,answer)');
    run('checkAnswer1(answerButton,answer,answer)');
    assert.equal(run('quizScore'),1);
    run('currentQuizIndex=quizQuestions.length;renderQuizResult()');
    assert.equal(run("getLesson8PracticeStatus('L08_P1').vp"),10);
    ctx.currentMode='quiz';
    run('setupQuizData(1)');
    run('currentQuizIndex=quizQuestions.length;renderQuizResult()');
    assert.equal(run("getLesson8PracticeStatus('L08_P1').vp"),10);
});
test('combined gate needs both module results and opens Copeak only when passing',()=>{
    const app=createApp(),{run,ctx,saved,opens,alerts}=app;
    let p=run("getLesson8PracticeStatus('L08_P1')");
    assert.equal(p.ready,false);
    ctx.currentKey='L08_P1_full';
    run('openCopeakPractice()');
    assert.equal(opens.length,0);
    assert.equal(alerts.length,1);
    saved.set('poweron_lesson8_progress_v1',JSON.stringify({L08_P1:{
        vocab:{points:150,max:180},chunk:{points:200,max:250}
    }}));
    p=run("getLesson8PracticeStatus('L08_P1')");
    assert.equal(p.ready,true);
    assert.equal(p.total,350);
    run('openCopeakPractice()');
    assert.equal(opens.length,1);
    assert.equal(opens[0].url,'https://copeak.pic-speak-story.com/');
    saved.set('poweron_lesson8_progress_v1',JSON.stringify({L08_P1:{
        vocab:{points:150,max:180},chunk:{points:190,max:250}
    }}));
    assert.equal(run("getLesson8PracticeStatus('L08_P1').ready"),false);
});
test('desktop, mobile, and score CSS are wired',()=>{
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const css=fs.readFileSync(path.join(root,'css/lesson8Practice.css'),'utf8');
    assert.match(html,/lessons\/lesson8\/chunks.js/);
    assert.match(html,/js\/lesson8Practice.js/);
    assert.match(html,/lesson8-only/);
    assert.match(css,/l8-chunk-choices/);
    assert.match(css,/@media\(max-width:768px\)/);
});

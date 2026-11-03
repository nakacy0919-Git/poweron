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
        vocab:{points:100,max:180},chunk:{points:210,max:250}
    }}));
    // 310P alone is insufficient when Vocabulary has not reached 60%.
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

test('quiz menu shows saved points first, then mode buttons, and all four parts',()=>{
    const {run,ctx,nodes,saved}=createApp();
    saved.set('poweron_lesson8_progress_v1',JSON.stringify({L08_P2:{
        vocab:{points:70,max:110},chunk:{points:200,max:310}
    }}));
    ctx.currentKey='L08_P2_full';
    run('startVocabQuiz()');
    const view=nodes.targetTextDisplay.innerHTML;
    assert.ok(view.includes('Part 2 · 現在の獲得ポイント'));
    assert.ok(view.includes('270'));
    assert.ok(view.includes('70 / 110 P'));
    assert.ok(view.includes('200 / 310 P'));
    assert.ok(view.includes('あと30P'));
    for(const p of [1,2,3,4])assert.ok(view.includes('Part '+p));
    assert.ok(view.indexOf('現在の獲得ポイント')<view.indexOf('setupQuizData(1)'));
    assert.ok(view.includes('class="quiz-menu-container l8-scored-menu"'));
    assert.equal(run("getLesson8PracticeStatus('L08_P2').ready"),false);
});
test('part-specific pass thresholds and module 60% floor apply',()=>{
    const app=createApp(),{run,saved}=app;
    const cases=[
        {part:'L08_P1',vMax:180,cMax:250,v:110,c:200,pass:310},
        {part:'L08_P2',vMax:110,cMax:310,v:70,c:230,pass:300},
        {part:'L08_P3',vMax:90,cMax:190,v:60,c:140,pass:200},
        {part:'L08_P4',vMax:100,cMax:120,v:60,c:100,pass:160}
    ];
    for(const c of cases){
        const obj={};
        obj[c.part]={vocab:{points:c.v,max:c.vMax},chunk:{points:c.c,max:c.cMax}};
        saved.set('poweron_lesson8_progress_v1',JSON.stringify(obj));
        const result=run("getLesson8PracticeStatus('"+c.part+"')");
        assert.equal(result.pass,c.pass);
        assert.equal(result.ready,true,c.part);
        assert.equal(result.remaining,0);
        obj[c.part].chunk.points=c.c-10;
        saved.set('poweron_lesson8_progress_v1',JSON.stringify(obj));
        const below=run("getLesson8PracticeStatus('"+c.part+"')");
        assert.equal(below.ready,false,c.part);
        assert.equal(below.remaining,10);
    }
});
test('overall 1,000P threshold is separate from individual part passes',()=>{
    const {run,saved}=createApp();
    const scores={
       L08_P1:{vocab:{points:110,max:180},chunk:{points:200,max:250}},
       L08_P2:{vocab:{points:70,max:110},chunk:{points:230,max:310}},
       L08_P3:{vocab:{points:60,max:90},chunk:{points:140,max:190}},
       L08_P4:{vocab:{points:60,max:100},chunk:{points:100,max:120}}
    };
    saved.set('poweron_lesson8_progress_v1',JSON.stringify(scores));
    let summary=run('getLesson8Overview()');
    assert.equal(summary.total,970);
    assert.equal(summary.remaining,30);
    assert.equal(summary.ready,false);
    scores.L08_P1.chunk.points+=30;
    saved.set('poweron_lesson8_progress_v1',JSON.stringify(scores));
    summary=run('getLesson8Overview()');
    assert.equal(summary.total,1000);
    assert.equal(summary.remaining,0);
    assert.equal(summary.ready,true);
});

/* Power On III study modes: sentence reading, deep study, listening puzzle and progress.
   No server calls: anonymous progress is stored only on this browser/device. */
(function () {
    'use strict';
    const core = window.PowerOnPracticeCore;
    if (!core) return;
    let storage = null;
    try { storage = window.localStorage; } catch (_) {}
    const PROFILE_KEY = 'poweron_study_learner_v1';
    function readProfile(){try {const x=JSON.parse(storage.getItem(PROFILE_KEY));return x&&typeof x.name==='string'&&typeof x.class==='string'&&typeof x.number==='string'&&x.name.trim()&&x.class.trim()&&x.number.trim()?x:null;}catch(_){return null;}}
    let learner=readProfile(), editing=false;
    function learnerStore(){return core.createProgressStore(storage,learner?'poweron_study_progress_v1:'+JSON.stringify([learner.class,learner.number,learner.name]):undefined);}
    let store=learnerStore();
    function register(event){event.preventDefault();if(app.mode!=='progress')return;const form=event.currentTarget||event.target;const next={class:form.elements.namedItem('class').value.trim(),number:form.elements.namedItem('number').value.trim(),name:form.elements.namedItem('name').value.trim()};if(!next.class||!next.number||!next.name)return;try{storage.setItem(PROFILE_KEY,JSON.stringify(next));}catch(_){const msg=document.getElementById('po-register-error');if(msg)msg.textContent='この端末では保存できません。';return;} stopSpeech();learner=next;store=learnerStore();editing=false;render();}
    function switchLearner(){if(app.mode!=='progress')return;editing=true;render();}
    function anonymous(){if(app.mode!=='progress')return;try{storage.removeItem(PROFILE_KEY);}catch(_){}stopSpeech();learner=null;store=learnerStore();editing=false;render();}
    const games=window.PowerOnStoryGameCore,readingTools=window.PowerOnReadingScore;
    const READING_PASS=core.READING_PASS||75;
    const GAME_MODES=['storyPuzzle','storyRandom','storyListen'];
    const QUESTION_MODES=['compEn','compJa','contextVocab'];
    const isKnowledgeMode=mode=>mode==='knowledgeHub'||QUESTION_MODES.includes(mode);
    let knowledgeRun=null;
    let game=null,gameTimer=null,answerTimer=null,dragCleanup=[],imageEpoch=0;
    let sceneMic=null,sceneMicKey='',sceneMicRun=null,sceneMicStyle='',feedbackNode=null,feedbackTimer=null;
    const MIC_MODE_KEY='poweron_scene_mic_compat_v1';let micOverride=null;
    function appleTouch(){const n=window.navigator||{};return /iPad|iPhone|iPod/.test(n.userAgent||'')||(/Mac/.test(n.platform||n.userAgent||'')&&(n.maxTouchPoints||0)>1);}
    function naturalMic(){if(micOverride!==null)return micOverride;try{const v=storage?.getItem(MIC_MODE_KEY);if(v==='natural')return true;if(v==='normal')return false;}catch(_){}return appleTouch();}
    function toggleMicStyle(){if(app.mode!=='sceneReading'||app.recognizer)return;const next=!naturalMic();stopSpeech();sceneMic=null;sceneMicKey='';sceneMicStyle='';micOverride=next;try{storage?.setItem(MIC_MODE_KEY,next?'natural':'normal');}catch(_){}app.feedback='音声認識方式を変更しました。音読スタートを押してください。';render();}const failedAudio=new Set();
    const MODES = {knowledgeHub:'Content & Vocabulary', compEn:'英問英答', compJa:'日本語内容理解', contextVocab:'本文語彙', storyHub:'Story Match',progress:'学習進捗', reading:'1文ずつ音読', sceneReading:'じっくり学習', deep:'理解チェック（自己申告）', puzzle:'Listening Puzzle', slides:'Story Slides', listening:'Listening Mission', storyPuzzle:'パズルモード', storyRandom:'ランダムモード', storyListen:'リスニング'};
    const app = {
        mode:null, index:0, sentences:[], candidates:[], scope:'', translation:'',
        slides:[], slideScope:'', sceneAudio:null, showJapanese:false, puzzle:null, selected:[], feedback:'', hearing:'',
        recognizer:null, micToken:0, micStart:0, rate:0.85, paragraphs:[], result:null, recording:false
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }
    function dataOf(kind, key) {
        key = key || currentKey;
        const base = kind === 'script' ? (typeof lessonScripts !== 'undefined' ? lessonScripts : {}) :
            (typeof lessonTranslations !== 'undefined' ? lessonTranslations : {});
        let advanced = null;
        if (kind === 'script') {
            if (currentLevel === 'pre1' && typeof lessonScriptsPre1 !== 'undefined') advanced = lessonScriptsPre1;
            if (currentLevel === 'grade1' && typeof lessonScriptsGrade1 !== 'undefined') advanced = lessonScriptsGrade1;
        } else {
            if (currentLevel === 'pre1' && typeof lessonTranslationsPre1 !== 'undefined') advanced = lessonTranslationsPre1;
            if (currentLevel === 'grade1' && typeof lessonTranslationsGrade1 !== 'undefined') advanced = lessonTranslationsGrade1;
        }
        return String((advanced && advanced[key]) || base[key] || '');
    }
    function modeSentences(mode) {
        if (mode === 'slides' || mode === 'sceneReading') return app.slides.map(function(s){return s.english;});
        if (mode === 'listening') return app.paragraphs.map(function(s){return s.english;});
        return mode === 'puzzle' ? app.candidates.map(function (i) {return app.sentences[i];}) : app.sentences;
    }
    function signature(mode) { return core.fingerprint(modeSentences(mode)); }
    function state(mode) {
        const total = modeSentences(mode).length;
        return store.get(['slides','sceneReading','listening'].includes(mode) ? app.slideScope : app.scope, mode, total, signature(mode));
    }
    function percent(row) {
        return row.total ? Math.round(Object.keys(row.completed).filter(function (key) {
            return row.completed[key] && Number(key) >= 0 && Number(key) < row.total;
        }).length / row.total * 100) : 0;
    }
    function completedCount(row) { return Math.round(percent(row) * row.total / 100); }
    function currentText() {
        if (['slides','sceneReading'].includes(app.mode)) return app.slides[app.index] ? app.slides[app.index].english : '';
        if(app.mode==='listening')return app.paragraphs[app.index]?.english||'';
        return app.mode === 'puzzle' ? (app.sentences[app.candidates[app.index]] || '') :
            (app.sentences[app.index] || '');
    }
    function stopSpeech() {
        app.micToken++; app.recording=false;
        const sceneHandle=sceneMicRun;sceneMicRun=null;
        if(sceneMic){try{sceneMic.cancel();}catch(_){}}
        if(sceneHandle&&app.recognizer===sceneHandle.handle)app.recognizer=null;
        if(app.sceneAudio){const a=app.sceneAudio;app.sceneAudio=null;a.onended=null;a.onerror=null;a.onplaying=null;try{a.pause();}catch(_){}}
        if (app.recognizer) {
            const prev = app.recognizer;
            app.recognizer = null;
            prev.onresult = null; prev.onend = null; prev.onerror = null;
            try { prev.abort(); } catch (_) {}
        }
        try { if(window.speechSynthesis?.speaking||window.speechSynthesis?.pending)window.speechSynthesis.cancel(); } catch (_) {}
    }
    function stop() {
        document.body.classList.remove('po-story-active','po-knowledge-active');
        clearGameTimer();clearDrag();clearAnswerFeedback();imageEpoch++;game=null;knowledgeRun=null;stopSpeech();sceneMic=null;sceneMicKey='';
        app.mode = null;
    }
    function prepare(mode) {
        app.mode = mode;
        app.scope = String(currentLevel) + ':' + String(currentKey);
        app.sentences = core.splitSentences(dataOf('script'));
        app.translation = dataOf('translation');
        const partKey = currentKey.split('_').slice(0,2).join('_');
        const part = Number(partKey.split('_P')[1]);
        const nums = ((typeof lessonStructure !== 'undefined' && lessonStructure[currentLesson]) || {})[part] || [];
        app.slideScope = String(currentLevel) + ':' + partKey + '_full';
        app.paragraphs = nums.map(function(number){
            const key = partKey + '_p' + number;
            return {key:key, number:number, english:dataOf('script',key), japanese:dataOf('translation',key)};
        }).filter(function(item){return item.english.trim();});
        app.slides = core.buildScenes(app.paragraphs, core.splitSentences, currentLevel === 'standard' ? core.LESSON8_SCENE_SIZES : undefined);
        app.result=null; app.recording=false;
        app.candidates = app.sentences.map(function (sentence, i) {
            return {sentence:sentence, i:i};
        }).filter(function (item) {
            const words = core.normalizeWords(item.sentence).length;
            return words >= 4 && words <= 32 && !!core.makePuzzle(item.sentence, function(){return 0.5;});
        }).map(function (item) {return item.i;});
        app.index = 0;
        app.showJapanese = false;
        app.puzzle = null;
        app.selected = [];
        app.feedback = '';
        app.hearing = '';
        if (mode !== 'progress' && !isKnowledgeMode(mode)) {
            const saved = state(mode);
            const count = modeSentences(mode).length;
            for (let i = 0; i < count; i++) {
                if (!saved.completed[i]) {app.index = i; break;}
            }
        }
        if (['slides','sceneReading'].includes(mode) && /_p\d+$/.test(currentKey)) {
            const saved=state(mode);
            const first=app.slides.findIndex(function(s,i){return s.paragraphKey===currentKey && !saved.completed[i];});
            const match=app.slides.findIndex(function(s){return s.paragraphKey===currentKey;});
            if(first>=0 || match>=0) app.index=first>=0?first:match;
        }
        if (mode === 'puzzle') resetPuzzle();
        if(GAME_MODES.includes(mode))game=null;
        if(QUESTION_MODES.includes(mode))startKnowledgeRun(mode);
    }
    function open(mode) {
        if (!Object.prototype.hasOwnProperty.call(MODES, mode)) return;
        if(GAME_MODES.includes(mode)&&!games)return;
        if (typeof resetAppMode === 'function') resetAppMode();
        prepare(mode);
        currentMode = 'practice';
        document.body.classList.add('text-active', 'po-practice-active');
        if(mode==='storyHub'||mode==='sceneReading'||GAME_MODES.includes(mode)||isKnowledgeMode(mode))document.body.classList.add('po-story-active');
        if(isKnowledgeMode(mode))document.body.classList.add('po-knowledge-active');
        const overlay = document.getElementById('mainOverlay');
        const content = document.getElementById('targetTextDisplay');
        const speech = document.getElementById('speechResultWindow');
        const title = document.getElementById('overlayTitle');
        if (overlay) overlay.style.display = 'flex';
        if (content) {
            content.style.display = 'block';
            content.style.border = 'none';
            content.style.background = 'transparent';
            content.style.boxShadow = 'none';
            content.style.padding = '12px';
        }
        if (speech) speech.style.display = 'none';
        if (title) title.textContent = MODES[mode] + ' · Lesson ' + currentLesson;
        render();
    }
    function close() {
        if (typeof resetAppMode === 'function') resetAppMode();
        else stop();
    }
    function resetPuzzle() {
        app.selected = [];
        app.feedback = '';
        app.puzzle = core.makePuzzle(currentText());
    }
    function go(delta) {
        if (!app.mode || app.mode === 'progress') return;
        const count = modeSentences(app.mode).length;
        clearAnswerFeedback();stopSpeech();readingTools?.releaseFeedbackAudio?.();
        if (!count) return;
        app.index = Math.max(0, Math.min(count - 1, app.index + delta));
        app.result=null;
        app.showJapanese = false;
        app.feedback = '';
        app.hearing = '';
        if (app.mode === 'puzzle') resetPuzzle();
        render();
    }
    function switchJapanese() {
        app.showJapanese = !app.showJapanese;
        render();
    }
    function markRead(manual) {
        if (!['reading','deep','slides'].includes(app.mode)) return;
        const mode = app.mode;
        store.record(mode === 'slides' ? app.slideScope : app.scope, mode, app.index, modeSentences(mode).length, signature(mode),
            {complete:true, attempt:!manual});
        app.feedback = manual ? '自己申告で完了を記録しました。' : '音読完了を記録しました。';
        render();
    }
    function play() {
        const words=currentText();if(!words||app.recognizer)return;
        if(app.mode==='listening'){playParagraph();return;}
        const scene=['slides','sceneReading'].includes(app.mode)?app.slides[app.index]:null;
        speakModel(words,sceneMedia(scene).audio,()=>status('再生終了。自分でも声に出してみましょう。'),()=>status('音声を再生できません。もう一度お試しください。'),()=>status('再生中…'));
    }
    function status(message) {
        const el = document.getElementById('po-audio-status');
        if (el) el.textContent = message;
    }
    function rate(value) {
        const number = Number(value);
        if (Number.isFinite(number) && number >= 0.5 && number <= 1.2) {app.rate = number;if(app.sceneAudio)app.sceneAudio.playbackRate=number;}
        status('音声速度を変更しました。再生ボタンを押してください。');
    }
    function sound(kind){try{readingTools?.playSound(kind);}catch(_){}}
    function clearAnswerFeedback(){if(feedbackTimer!==null){clearTimeout(feedbackTimer);feedbackTimer=null;}if(feedbackNode){feedbackNode.remove?.();feedbackNode=null;}}
    function showAnswerFeedback(correct){
        clearAnswerFeedback();if(typeof document.createElement!=='function')return;
        const node=document.createElement('div');node.className='po-answer-burst '+(correct?'is-correct':'is-wrong');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.innerHTML='<div class="po-burst-card"><div class="po-burst-mark">'+(correct?'✓':'×')+'</div><strong>'+(correct?'Correct!':'Try Again')+'</strong><span>'+(correct?'正解！':'不正解')+'</span><i></i><i></i><i></i><i></i></div>';
        const parent=document.getElementById('po-knowledge-explanation')||document.body;if(typeof parent.appendChild!=='function')return;parent.appendChild(node);feedbackNode=node;feedbackTimer=setTimeout(()=>{if(feedbackNode===node)clearAnswerFeedback();},900);
    }
    function answerFeedback(correct){sound(correct?'correct':'wrong');showAnswerFeedback(correct);}
    // Same persistent controller / scene ID lifecycle as Treasure Hunt's useReadingSpeech.
    // Every manual tap calls begin directly; only the underlying recognizer is renewed.
    function sceneMicrophone(){
        if(app.mode!=='sceneReading'||!readingTools?.createReadingSpeechController)return;
        if(sceneMicRun&&app.recognizer){if(sceneMicRun.phase!=='scoring'&&sceneMicRun.ready)sceneMicRun.handle.stop();return;}
        const sentence=currentText(),index=app.index,scope=app.slideScope,key=scope+':'+index;
        if(!sentence)return;
        clearAnswerFeedback();stopSpeech();readingTools?.releaseFeedbackAudio?.();
        const style=naturalMic()&&readingTools.createNaturalReadingController?'natural':'normal';
        if(sceneMicStyle!==style){sceneMic=null;sceneMicKey='';sceneMicStyle=style;}
        if(!sceneMic){
            const create=style==='natural'?readingTools.createNaturalReadingController:readingTools.createReadingSpeechController;
            sceneMic=create({host:window,calculate:readingTools.score,getThreshold:()=>READING_PASS,onChange:view=>{
                const run=sceneMicRun;
                if(!run||run.token!==app.micToken||app.mode!=='sceneReading'||run.index!==app.index||run.scope!==app.slideScope)return;
                // begin() resets internally through idle. Do not drop the active handle mid-start.
                if(run.starting&&view.phase==='idle'){run.pending=view;return;}
                const old=run.phase;run.phase=view.phase;const oldReady=!!run.ready;run.ready=!!view.signals?.ready;if(run.ready&&!run.readyAt)run.readyAt=Date.now();app.recording=view.phase!=='idle';
                app.feedback=view.status||'';app.hearing=view.transcript||'';app.recognizer=app.recording?run.handle:null;
                if(view.phase!==old||oldReady!==run.ready)render();
                const node=document.getElementById('po-live-transcript'),statusNode=document.getElementById('po-mic-status');
                if(node)node.textContent=app.hearing||'音読すると、ここに英文が表示されます。';
                if(statusNode)statusNode.textContent=app.feedback;
            },onScore:(score,spoken,id)=>{
                const run=sceneMicRun;
                if(!run||id!==run.key||run.token!==app.micToken||app.mode!=='sceneReading'||run.index!==app.index||run.scope!==app.slideScope)return;
                app.result=score;app.hearing=spoken;app.recognizer=null;app.recording=false;
                store.record(run.scope,'sceneReading',run.index,modeSentences('sceneReading').length,signature('sceneReading'),{attempt:true,accuracy:score,complete:score>=READING_PASS});
                app.feedback='語句一致率 '+score+'% · 約'+Math.round(core.normalizeWords(spoken).length/Math.max(1,(Date.now()-(run.readyAt||run.started))/1000)*60)+' WPM'+(score>=READING_PASS?' ／ 75%以上でクリア！':' ／ 再挑戦できます');
                sceneMicRun=null;render();if(style==='natural')showAnswerFeedback(score>=READING_PASS);else answerFeedback(score>=READING_PASS);
            }});
        }
        // Reset transcript and callbacks for each item, before beginning on the same user tap.
        if(sceneMicKey!==key){sceneMic.setItem({id:key,sentence});sceneMicKey=key;}
        const controller=sceneMic,run={key,index,scope,token:app.micToken,started:Date.now(),phase:'idle',starting:true,pending:null,ready:false,readyAt:null,handle:{stop:()=>controller.stop(),abort:()=>controller.cancel()}};
        sceneMicRun=run;app.result=null;app.hearing='';app.recognizer=run.handle;
        controller.begin();run.starting=false;
        if(sceneMicRun===run&&run.phase==='idle'){app.recognizer=null;app.recording=false;if(run.pending){app.feedback=run.pending.status||app.feedback;app.hearing=run.pending.transcript||'';}sceneMicRun=null;render();}
    }
    function microphone() {
        if(app.mode==='sceneReading'&&readingTools?.createReadingSpeechController){sceneMicrophone();return;}
        if (!['reading','sceneReading'].includes(app.mode)) return;
        if (app.recognizer) {
            try { app.recognizer.stop(); } catch (_) {}
            status('音声を確認しています…');
            return;
        }
        const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Ctor) {
            status('このブラウザでは音声認識が利用できません。対応ブラウザで再試行してください。');
            return;
        }
        stopSpeech();
        const token = app.micToken;
        const sentence = currentText();
        const index = app.index, mode = app.mode, scope = mode==='sceneReading'?app.slideScope:app.scope;
        let recognized = '';
        let error = '';
        let recognizer;try{recognizer=new Ctor();}catch(_){status('マイクを起動できませんでした。');return;}
        recognizer.lang = 'en-US';
        recognizer.continuous = false;
        recognizer.interimResults = true;
        app.recognizer = recognizer;
        app.micStart = Date.now();
        recognizer.onresult = function (event) {
            if (app.micToken !== token || app.recognizer !== recognizer) return;
            recognized = Array.from(event.results).map(function (r) {
                return r[0] && r[0].transcript || '';
            }).join(' ').trim();
            status('認識中：' + recognized);
        };
        recognizer.onerror = function (event) {
            if (app.micToken !== token) return;
            error = event.error || 'error';
            status('認識エラー（' + error + '）。再試行するか、自己申告で記録してください。');
        };
        recognizer.onend = function () {
            if (app.micToken !== token || app.recognizer !== recognizer) return;
            app.recognizer = null; app.recording=false;
            if (error || !recognized) {
                app.feedback=error?'マイクを確認して再試行してください。':'音声を認識できませんでした。もう一度試してください。';render();
                return;
            }
            const score = core.transcriptAccuracy(sentence, recognized);
            const wpm = Math.round(core.normalizeWords(recognized).length /
                Math.max(1, (Date.now() - app.micStart) / 1000) * 60);
            if (app.mode !== mode || app.index !== index || (mode==='sceneReading'?app.slideScope:app.scope) !== scope) return;
            app.result=score;
            store.record(scope, mode, index, modeSentences(mode).length, signature(mode),
                {attempt:true, accuracy:score, complete:score>=READING_PASS});
            app.hearing = '認識した英語：' + recognized;
            if(mode==='sceneReading'&&score>=READING_PASS&&typeof fireConfetti==='function')try{fireConfetti();}catch(_){}
            app.feedback = '語句一致率 ' + score + '% · 約' + wpm + ' WPM' +
                (score>=READING_PASS ? ' ／ 75%以上でクリア！' : ' ／ 75%以上でクリア（再挑戦できます）');
            render();
        };
        try { recognizer.start(); app.recording=true; render(); status('マイクが起動しました。英文を読んでください。'); }
        catch (_) {
            app.recognizer = null;app.recording=false;render();
            status('マイクを起動できませんでした。端末の権限設定を確認してください。');
        }
    }
    function chooseCard(id) {
        if (app.mode !== 'puzzle' || !app.puzzle || state('puzzle').completed[app.index]) return;
        if (!app.selected.includes(String(id))) app.selected.push(String(id));
        app.feedback = '';
        render();
    }
    function undoCard() {
        if (app.mode !== 'puzzle' || !app.selected.length) return;
        app.selected.pop();
        app.feedback = '';
        render();
    }
    function checkPuzzle() {
        if (app.mode !== 'puzzle' || !app.puzzle || !app.selected.length) return;
        const correct = core.puzzleCorrect(app.puzzle, app.selected);
        store.record(app.scope, 'puzzle', app.index, app.candidates.length, signature('puzzle'),
            {attempt:true, complete:correct});
        app.feedback = correct ? '正解！英文の並びを完成できました。' : 'まだ違います。もう一度聞いて並べ直しましょう。';
        render();answerFeedback(correct);
    }
    function retryPuzzle() {
        if (app.mode !== 'puzzle') return;
        resetPuzzle();
        render();
    }
    function scopeBar(label, mode) {
        const row = state(mode), value = percent(row);
        return '<div class="po-stat"><span>' + esc(label) + '</span><strong>' +
            value + '% <small>(' + completedCount(row) + '/' + row.total + ')</small></strong>' +
            '<div class="po-track" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + value +
            '"><div style="width:' + value + '%"></div></div></div>';
    }
    function nav() {
        return '<div class="po-switcher" role="group" aria-label="学習モード切替">' +
            Object.keys(MODES).map(function (mode) {
                return '<button class="' + (mode === app.mode ? 'is-selected' : '') +
                    '" onclick="PowerOnPractice.open(\'' + mode + '\')">' + esc(MODES[mode]) + '</button>';
            }).join('') + '<button onclick="PowerOnPractice.close()" aria-label="学習を終了">✕ 閉じる</button></div>';
    }
    function captureLegacy(mode, score) {
        if (!['readingcheck', 'shadowing', 'vocabulary','vocabEnJa','vocabJaEn','vocabVoice'].includes(mode) ||
            !Number.isFinite(Number(score))) return false;
        const key=/^vocab(?:EnJa|JaEn|Voice)$/.test(mode)?currentKey.split('_').slice(0,2).join('_')+'_full':currentKey;
        const scope = String(currentLevel) + ':' + key;
        const sig = core.fingerprint([dataOf('script',key), mode]);
        // Completion means "attempted", not "passed"; the existing grading stays authoritative.
        return store.record(scope, mode, 0, 1, sig, {
            attempt:true, complete:true, accuracy:Number(score)
        });
    }
    function legacySummary() {
        const labels = {readingcheck:'Reading Check', shadowing:'Shadowing', vocabulary:'Vocabulary'};
        const sigBase = dataOf('script');
        return '<h3>既存メニューの学習履歴 <small>選択中の範囲</small></h3><div class="po-legacy">' +
            Object.keys(labels).map(function (mode) {
                const row = store.get(app.scope, mode, 1, core.fingerprint([sigBase, mode]));
                const score = row.bestAccuracy == null ? '—' : row.bestAccuracy + '%';
                return '<div><strong>' + esc(labels[mode]) + '</strong><span>実施回数 ' +
                    row.attempts + ' 回</span><span>最高スコア ' + score + '</span></div>';
            }).join('') + '</div>' +
            '<p class="po-note">実施回数と最高スコアを記録します。Lesson 8の合格基準やポイントには影響しません。</p>';
    }

    function ring(value,large){const n=Math.max(0,Math.min(100,Math.round(Number(value)||0)));return '<div class="th-progress-ring'+(large?' large':'')+'" role="img" aria-label="進捗 '+n+'%" style="--value:'+n+'%"><div><strong>'+n+'</strong><span>%</span></div></div>';}
    function legacyRow(mode){const isDirection=/^vocab(?:EnJa|JaEn|Voice)$/.test(mode), key=isDirection?currentKey.split('_').slice(0,2).join('_')+'_full':currentKey;return store.get(String(currentLevel)+':'+key,mode,1,core.fingerprint([dataOf('script',key),mode]));}
    function activityIcon(mode){const shapes={"readingcheck":"<rect x=\"9\" y=\"2\" width=\"6\" height=\"12\" rx=\"3\"/><path d=\"M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8\"/>","reading":"<path d=\"M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1V6zM12 6c3-2 6-2 10-1v14c-4-1-7-1-10 1V6zM12 6v14\"/><path d=\"M6 9h3M15 9h3\"/>","shadowing":"<path d=\"M3 9v6h4l5 4V5L7 9H3zM16 9a5 5 0 0 1 0 6M19 5a10 10 0 0 1 0 14\"/>","listening":"<path d=\"M3 9v6h4l5 4V5L7 9H3zM16 9a5 5 0 0 1 0 6M19 5a10 10 0 0 1 0 14\"/>","vocabEnJa":"<path d=\"M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1V6zM12 6c3-2 6-2 10-1v14c-4-1-7-1-10 1V6zM12 6v14\"/><path d=\"M5 9h4M15 9h4\"/>","vocabJaEn":"<path d=\"M4 7h15l-3-3M19 7l-3 3M20 17H5l3-3M5 17l3 3\"/><path d=\"M10 11h4M12 9v4\"/>","vocabulary":"<path d=\"M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1V6zM12 6c3-2 6-2 10-1v14c-4-1-7-1-10 1V6zM12 6v14\"/><path d=\"M5 9h4M15 9h4\"/>","vocabVoice":"<rect x=\"9\" y=\"2\" width=\"6\" height=\"12\" rx=\"3\"/><path d=\"M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8\"/>","sceneReading":"<path d=\"M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1V6zM12 6c3-2 6-2 10-1v14c-4-1-7-1-10 1V6zM12 6v14\"/><path d=\"M6 9h3M15 9h3\"/>","puzzle":"<path d=\"M8 3H4a1 1 0 0 0-1 1v5h2a2 2 0 0 1 0 4H3v7a1 1 0 0 0 1 1h6v-2a2 2 0 0 1 4 0v2h6a1 1 0 0 0 1-1v-6h-2a2 2 0 0 1 0-4h2V4a1 1 0 0 0-1-1h-5v2a2 2 0 0 1-4 0V3H8z\"/>","slides":"<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 9h10M7 13h10M7 17h6\"/>","deep":"<path d=\"M7 5h13M7 12h13M7 19h13M2 5h1M2 12h1M2 19h1\"/><path d=\"m16 10 2 2-2 2\"/>"};return '<svg class="th-activity-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[mode]||shapes.reading)+'</svg>';}

    function clearGameTimer(){if(gameTimer!==null){clearInterval(gameTimer);gameTimer=null;}if(answerTimer!==null){clearTimeout(answerTimer);answerTimer=null;}}
    function clearDrag(){dragCleanup.forEach(fn=>fn());dragCleanup=[];}
    function gameScenes(){return currentLevel==='standard'&&app.slides.length>=2&&app.slides.every(s=>sceneMedia(s).image)?app.slides:[];}
    function gameSig(){return core.fingerprint(gameScenes().map(s=>s.id+'|'+s.english+'|'+sceneMedia(s).image));}
    function gameRow(mode){const row=store.get(app.slideScope,mode,1,gameSig());if(mode==='storyPuzzle'){const times=[row.bestSeconds,...Object.values(row.bestByLevel||{})].filter(x=>Number.isFinite(x)&&x>=0);row.bestSeconds=times.length?Math.min(...times):null;}return row;}
    function gameMetric(mode){const n=gameScenes().length,r=gameRow(mode),v=mode==='storyPuzzle'?(r.bestSeconds==null?0:Math.min(100,30/Math.max(1,r.bestSeconds)*100)):(r.bestPoints==null?0:Math.min(100,r.bestPoints/Math.max(1,games?games.target(n,mode==='storyListen'):1)*100));return {value:n?v:0,meta:!n?'場面画像の準備中':mode==='storyPuzzle'?'Best '+(r.bestSeconds==null?'—':r.bestSeconds.toFixed(1)+'s')+' · 目標30秒':'Best '+(r.bestPoints==null?'—':r.bestPoints)+' pts · 目標'+(games?games.target(n,mode==='storyListen'):0)+'点'};}
    function gameImage(i){const s=gameScenes()[i];return s?'<img src="'+esc(sceneMedia(s).image)+'" alt="場面の選択肢" draggable="false">':'';}
    function gameStart(level,count){clearAnswerFeedback();
        if(!games||!GAME_MODES.includes(app.mode)||!gameScenes().length)return;
        clearGameTimer();clearDrag();stopSpeech();const n=gameScenes().length,mode=app.mode;
        level=[1,2,3].includes(Number(level))?Number(level):3;count=count==='ALL'||count==null?'ALL':Math.max(1,Math.min(n,Math.floor(Number(count)||n)));
        game={mode,level:Number(level)||3,placed:[],selected:null,page:0,score:0,index:0,queue:games.makeQuestions(n,mode==='storyPuzzle'?'ALL':(count||'ALL')),choices:[],started:null,questionStart:null,ready:false,done:false,message:'',deferred:0,answering:false,penalties:0,mistakes:0,hints:[],detail:null,full:mode==='storyPuzzle'||!count||count==='ALL'||Number(count)>=n,count:count||'ALL',initialCount:mode==='storyPuzzle'?n:(count==='ALL'?n:Number(count)),feedbackId:null,feedbackType:null};
        if(mode==='storyPuzzle'){game.placed=games.hints(n,game.level);game.deck=games.shuffle(Array.from({length:n},(_,i)=>i));game.page=0;gameTimer=setInterval(()=>{const el=document.getElementById('po-game-time');if(el&&game&&!game.done)el.textContent=((game.started===null?0:(Date.now()-game.started)/1000)+game.penalties).toFixed(1)+' 秒';},250);}
        else gameQuestion();
        render();if(mode==='storyListen')gameSpeak();
    }
    function gameQuestion(){if(!game)return;stopSpeech();const id=game.queue[game.index];game.choices=games.makeChoices(gameScenes().length,id);game.ready=game.mode==='storyRandom';game.questionStart=game.ready?Date.now():null;game.message='';game.answering=false;game.feedbackId=null;game.feedbackType=null;}
    function gameFinish(){
        if(!game||game.done)return;
        clearGameTimer();stopSpeech();game.done=true;game.seconds=Math.max(0,game.started===null?0:(Date.now()-game.started)/1000)+game.penalties;
        const puzzle=game.mode==='storyPuzzle',target=games.target(gameScenes().length,game.mode==='storyListen'),passed=puzzle?game.seconds<=30:game.full&&game.score>=target;
        store.record(app.slideScope,game.mode,0,1,gameSig(),{attempt:true,complete:passed,...(puzzle?{seconds:game.seconds,gameLevel:game.level}:{points:game.score,questionCount:game.initialCount,full:game.full})});
        if(passed)sound('fanfare');
        if(passed&&typeof fireConfetti==='function')try{fireConfetti();}catch(_){}
        render();
    }
    function gamePick(id){if(!game||game.done||game.mode!=='storyPuzzle'||!Number.isInteger(id)||!gameScenes()[id]||game.placed.includes(id))return;if(game.started===null)game.started=Date.now();game.selected=id;game.message='英文の枠をタップしてください。';render();}
    function gamePlace(id){
        if(!game||game.done||game.mode!=='storyPuzzle'||!Number.isInteger(id)||!gameScenes()[id]||game.placed.includes(id)||game.selected===null)return;
        if(game.started===null)game.started=Date.now();
        if(id!==game.selected){game.mistakes++;game.message='もう一度、英文と画像を見比べましょう。';render();answerFeedback(false);return;}
        game.placed.push(id);game.selected=null;game.message='✓ 正解！';
        if(game.placed.length===gameScenes().length){gameFinish();showAnswerFeedback(true);return;}
        render();answerFeedback(true);
    }
    function gamePage(delta){if(!game||game.mode!=='storyPuzzle'||game.done)return;game.page=Math.max(0,Math.min(Math.ceil(gameScenes().length/4)-1,game.page+delta));game.selected=null;game.message='';render();}
    function gameAnswer(id){
        if(!game||game.done||!game.ready||game.answering||game.questionStart===null||game.mode==='storyPuzzle'||!game.choices.includes(id))return;
        const run=game;run.answering=true;run.feedbackId=id;
        const correct=id===run.queue[run.index];run.feedbackType=correct?'correct':'wrong';
        if(!correct){run.score=Math.max(0,run.score-20);run.message='もう一度挑戦！ −20 pts';}
        else {run.score+=games.points((Date.now()-run.questionStart)/1000,run.mode==='storyListen');run.message='✓ 正解！';}
        render();answerFeedback(correct);
        answerTimer=setTimeout(()=>{answerTimer=null;if(game!==run||run.done)return;if(!correct){run.answering=false;run.feedbackId=null;run.feedbackType=null;render();return;}if(run.index+1>=run.queue.length){gameFinish();return;}run.index++;gameQuestion();render();if(run.mode==='storyListen')gameSpeak();},correct?650:450);
    }
    function gameSkip(){if(!game||game.done||game.answering||game.mode!=='storyListen'||game.deferred>=gameScenes().length)return;game.deferred++;game.queue=games.deferQuestion(game.queue,game.index);game.index++;gameQuestion();render();gameSpeak();}
    function speakModel(text,url,onEnd,onError,onStart){
        stopSpeech();const token=app.micToken;let finished=false;
        const valid=()=>token===app.micToken&&!finished;
        const finish=()=>{if(!valid())return;finished=true;app.sceneAudio=null;onEnd?.();};
        const fail=()=>{if(!valid())return;finished=true;app.sceneAudio=null;onError?.();};
        const speak=()=>{if(!valid())return;try{const synth=window.speechSynthesis,U=window.SpeechSynthesisUtterance;if(!synth||!U){fail();return;}const u=new U(text);u.lang='en-US';u.rate=app.rate;const voices=synth.getVoices?.()||[];u.voice=voices.find(v=>v.name?.includes('Google US English'))||voices.find(v=>v.name?.includes('Samantha'))||voices.find(v=>v.lang==='en-US')||null;u.onstart=()=>{if(valid())onStart?.();};u.onend=finish;u.onerror=fail;try{synth.resume?.();}catch(_){}synth.speak(u);}catch(_){fail();}};
        if(!url||failedAudio.has(url)){speak();return;}
        try{const player=new Audio(url);app.sceneAudio=player;player.playbackRate=app.rate;let tried=false;const fallback=()=>{if(!valid()||tried||app.sceneAudio!==player)return;tried=true;failedAudio.add(url);player.onended=null;player.onerror=null;try{player.pause();}catch(_){}app.sceneAudio=null;speak();};player.onended=finish;player.onerror=fallback;player.onplaying=()=>{if(valid())onStart?.();};const result=player.play();result?.catch?.(fallback);}catch(_){failedAudio.add(url);speak();}
    }
    function gameSpeak(){
        if(document.hidden){if(game&&!game.done){game.ready=false;game.message='画面に戻り、もう一度音声を聞いてください。';render();}return;}
        if(!game||game.done||game.answering||game.mode!=='storyListen')return;
        const run=game,id=run.queue[run.index],scene=gameScenes()[id];if(!scene)return;
        run.ready=false;run.message='音声を聞いてください…';render();
        const valid=()=>game===run&&!run.done&&run.queue[run.index]===id;
        speakModel(scene.english,sceneMedia(scene).audio,()=>{if(!valid())return;run.ready=true;run.questionStart??=Date.now();run.message='合う画像を選んでください。';render();},()=>{if(!valid())return;run.ready=false;run.message='音声を再生できません。もう一度お試しください。';render();});
    }

    function storyScene(index){open('sceneReading');if(Number.isInteger(index)&&index>=0&&index<app.slides.length){app.index=index;render();}}
    function storyLesson8(){if(typeof selectLesson==='function'&&currentLesson!==8){const b=document.querySelectorAll('.nav-btn')[7];selectLesson(8,b);}currentLevel='standard';const l=document.getElementById('levelSelect');if(l)l.value='standard';const para=document.getElementById('paraSelect');if(para){para.value='full';if(typeof onScopeChange==='function')onScopeChange();}document.body.classList.remove('hide-text-overlay');open('storyHub');}
    function storyHub(){
        const n=app.slides.length, available=gameScenes().length>0, reading=state('sceneReading'), passed=completedCount(reading), puzzle=gameRow('storyPuzzle'), random=gameRow('storyRandom'), listening=gameRow('storyListen');
        const tm=available?games.target(n,false):0,tl=available?games.target(n,true):0;
        const cards=[['sceneReading','reading','📖','じっくり学習','絵本のように','ストーリーを読む',passed+'<small> / '+n+' Scenes</small>','Accuracy 75%以上でクリア',n>0&&passed===n,n>0],['storyPuzzle','puzzle','🧩','パズルモード','空欄に画像を当てはめ','物語を完成させる',(puzzle.bestSeconds==null?'—':puzzle.bestSeconds.toFixed(1))+' 秒','ベストタイム / 30秒以内（全Level）',available&&puzzle.bestSeconds!=null&&puzzle.bestSeconds<=30,available],['storyRandom','random','⚡','ランダムモード','英文からイラストを','素早く見極める',(random.bestPoints==null?'—':random.bestPoints)+' pts','全'+n+'問 · '+tm+'点以上',available&&random.bestPoints!=null&&random.bestPoints>=tm,available],['storyListen','listening','🎧','リスニング','流れる音声を聞いて','正しい画像を選ぶ',(listening.bestPoints==null?'—':listening.bestPoints)+' pts','全'+n+'問 · '+tl+'点以上',available&&listening.bestPoints!=null&&listening.bestPoints>=tl,available]];
        return '<section class="po-story-dashboard"><div class="dashboard-heading"><div><span class="po-story-eyebrow">LESSON '+currentLesson+' · '+esc(currentKey.split('_')[1])+' · 学習進捗</span><h2>Select Game Mode</h2></div><div class="mission-count"><b>'+cards.filter(x=>x[8]).length+' / 4</b><span>MISSIONS CLEAR</span></div></div>'+(!available?'<div class="po-story-notice">画像ゲームは場面画像が揃っている Lesson 8 / Standard に対応しています。<button onclick="PowerOnPractice.storyLesson8()">Lesson 8へ →</button></div>':'')+'<div class="mission-cards">'+cards.map(x=>'<button class="mission-card '+x[1]+'" onclick="PowerOnPractice.open(\''+x[0]+'\')" '+(!x[9]?'disabled':'')+'><div class="card-top"><span class="mode-icon">'+x[2]+'</span><span class="badge '+(x[8]?'complete':'')+'">'+(x[8]?'✓ CLEAR':x[9]?'CHALLENGE':'準備中')+'</span></div><h3>'+x[3]+'</h3><p>'+x[4]+'<br>'+x[5]+'</p><div class="mode-metric"><strong>'+x[6]+'</strong><span>'+x[7]+'</span></div><div class="card-footer"><span>'+(x[0]==='sceneReading'&&passed>0&&passed<n?'続きから学習':'学習をはじめる')+'</span><b>→</b></div></button>').join('')+'</div><div class="scene-strip"><span>📖 Scene</span>'+app.slides.map((_,i)=>'<button class="'+(reading.completed[i]?'passed':'')+'" onclick="PowerOnPractice.storyScene('+i+')" title="Scene '+(i+1)+'">'+(i+1)+(reading.completed[i]?' ✓':'')+'</button>').join('')+'</div><footer class="dashboard-footer"><p>4つのミッションをクリアしたら、この画面をスクリーンショットで先生に提出しましょう。<small>記録はこの端末・このブラウザに保存されます。</small></p><button onclick="PowerOnPractice.open(\'knowledgeHub\')">📘 内容理解・語彙</button><button onclick="PowerOnPractice.open(\'progress\')">📊 学習の記録</button></footer></section>';
    }
    function launchStory(){document.body.classList.remove('hide-text-overlay');open('storyHub');if(!gameScenes().length)storyLesson8();}
    function storyToolbar(){return '<div class="po-story-toolbar"><button onclick="PowerOnPractice.open(\'storyHub\')">← 学習進捗へ</button><strong>Lesson '+currentLesson+' · '+esc(currentKey.split('_')[1])+' · '+esc(MODES[app.mode])+'</strong><button onclick="PowerOnPractice.close()">✕ 終了</button></div>';}

    function gameHint(i){if(!game||game.mode!=='storyPuzzle'||game.done||!gameScenes()[i])return;if(!game.placed.includes(i)&&!game.hints.includes(i)){if(game.started===null)game.started=Date.now();game.hints.push(i);game.penalties+=10;}game.detail=i;render();}
    function closeHint(){if(game){game.detail=null;render();}}
    function gameBody(){
        const ss=gameScenes(),n=ss.length,title=MODES[app.mode];
        if(!n)return '<section class="po-match-intro"><h2>'+esc(title)+'</h2><p>場面画像は準備中です。Lesson 8 / Standardで遊べます。</p><button onclick="PowerOnPractice.storyLesson8()">Lesson 8へ</button></section>';
        if(!game){const puzzle=app.mode==='storyPuzzle',t=games.target(n,app.mode==='storyListen');return '<section class="po-match-intro po-story-settings"><span class="mode-icon">'+(puzzle?'🧩':app.mode==='storyRandom'?'⚡':'🎧')+'</span><h2>'+(puzzle?'Select Puzzle Level':'Select Questions')+'</h2><p>'+(puzzle?'英文と画像をマッチさせよう。':'全'+n+'問を終え、'+t+'点以上でクリア。短いコースも選べます。')+'</p><div class="po-settings-options">'+(puzzle?[1,2,3].map(l=>'<button onclick="PowerOnPractice.gameStart('+l+')">Level '+l+'<small>'+(['約半分ヒント','少数ヒント','すべて空欄'][l-1])+'</small></button>').join(''):[...new Set([3,6].filter(q=>q<n)),'ALL'].map(q=>'<button onclick="PowerOnPractice.gameStart(3,\''+q+'\')">'+(q==='ALL'?'全'+n:q)+'問<small>START!</small></button>').join(''))+'</div></section>';}
        if(game.done){const clear=game.mode==='storyPuzzle'?game.seconds<=30:game.full&&game.score>=games.target(n,game.mode==='storyListen');return '<section class="po-match-intro po-story-result"><span class="po-story-eyebrow">MISSION RESULT</span><h2>'+(clear?'✓ MISSION CLEAR!':'練習完了！')+'</h2><strong class="po-game-result">'+(game.mode==='storyPuzzle'?game.seconds.toFixed(1)+' 秒':game.score+' pts')+'</strong><p>'+(game.mode==='storyPuzzle'?'Level '+game.level+' · ヒント '+game.hints.length+' 回 · ミス '+game.mistakes+' 回':game.full?'全問コース':'短い練習コース')+'</p><button class="po-primary" onclick="PowerOnPractice.gameStart('+game.level+',\''+game.count+'\')">もう一度</button><button onclick="PowerOnPractice.open(\'storyHub\')">学習進捗へ</button></section>';}
        if(game.mode==='storyPuzzle'){
            const ids=Array.from({length:n},(_,i)=>i),deck=game.deck.filter(i=>!game.placed.includes(i)),cols=n<=4?2:n<=6?3:4,rows=Math.ceil(n/cols),deckRows=Math.max(1,Math.ceil(n/2));
            const dialog=game.detail===null?'':'<div class="po-hint-overlay" role="dialog" aria-modal="true"><div><button onclick="PowerOnPractice.closeHint()">✕ 閉じる</button><h3>Scene '+(game.detail+1)+'</h3><p>'+esc(ss[game.detail].english)+'</p><p class="po-note">段落全体の和訳</p><p>'+esc(String(ss[game.detail].japanese||'和訳未登録').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,''))+'</p></div></div>';
            return '<div class="po-match-board po-full-puzzle"><div class="po-puzzle-meta"><span>Level '+game.level+' · '+game.placed.length+' / '+n+' Scenes</span><strong id="po-game-time">⏱ '+((game.started===null?0:(Date.now()-game.started)/1000)+game.penalties).toFixed(1)+' 秒</strong><span>ヒント +10秒 · ミス '+game.mistakes+'回</span></div><div class="po-puzzle-instruction" role="status">'+esc(game.message||'画像をドラッグ、または画像→空欄をタップ')+'</div><div class="po-match-columns"><div class="po-match-slots" style="--slot-cols:'+cols+';--slot-rows:'+rows+'">'+ids.map(i=>'<div class="po-puzzle-cell '+(game.placed.includes(i)?'matched':'')+'"><p>'+(i+1)+'. '+esc(ss[i].english)+'</p><button class="po-hint-button" onclick="PowerOnPractice.gameHint('+i+')">'+(game.placed.includes(i)||game.hints.includes(i)?'英文・訳を確認':'💡 ヒント +10秒')+'</button><button class="po-drop-target" data-slot="'+i+'" onclick="PowerOnPractice.gamePlace('+i+')" '+(game.placed.includes(i)?'disabled':'')+'>'+(game.placed.includes(i)?gameImage(i):'<span>'+(game.selected===null?i+1:'ここに置く')+'</span>')+'</button></div>').join('')+'</div><div class="po-match-deck" style="--deck-rows:'+deckRows+'">'+deck.map(i=>'<button class="po-match-picture '+(game.selected===i?'is-selected':'')+'" data-picture="'+i+'" aria-label="画像を選択" onclick="PowerOnPractice.gamePick('+i+')">'+gameImage(i)+'</button>').join('')+'</div></div>'+dialog+'</div>';
        }
        const listening=game.mode==='storyListen';
        return '<div class="po-match-board po-quiz-full '+(listening?'po-listening-full':'po-random-full')+'"><div class="po-game-hud"><strong>'+(listening?'Progress: ':'Q ')+(game.index+1)+' / '+game.queue.length+'</strong><strong>SCORE: '+game.score+'</strong></div><div class="po-game-prompt">'+(listening?'<div class="po-listening-inner"><h2>⚡ 早押しリスニング ⚡</h2><p>'+esc(game.message||'お手本を再生してください。聞き終わると回答できます。')+'</p><div class="po-sound-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="po-listen-actions"><label>再生速度 <select onchange="PowerOnPractice.rate(this.value)">'+[0.65,0.85,1].map(x=>'<option value="'+x+'" '+(app.rate===x?'selected':'')+'>'+x+'×</option>').join('')+'</select></label><button onclick="PowerOnPractice.gameSkip()" '+(game.deferred>=n||game.answering?'disabled':'')+'>⚠ 音声が聞こえない</button><button onclick="PowerOnPractice.gameSpeak()" '+(game.answering?'disabled':'')+'>🔊 '+(game.ready?'もう一度聞く':'お手本を聞く')+'</button></div></div>':esc(ss[game.queue[game.index]].english))+'</div><div class="po-game-choices">'+game.choices.map(i=>'<button aria-label="画像を回答" class="'+(game.feedbackId===i?'po-answer-'+game.feedbackType:'')+'" onclick="PowerOnPractice.gameAnswer('+i+')" '+(!game.ready||game.answering?'disabled':'')+'>'+gameImage(i)+'</button>').join('')+'</div><div class="po-game-footer" role="status">'+esc(listening?'':game.message||'英文に合う画像を選んでください。')+'</div></div>';
    }
    function attachPuzzleDrag(display){
        if(app.mode!=='storyPuzzle'||!game||game.done||!display.querySelectorAll)return;
        display.querySelectorAll('[data-picture]').forEach(button=>{
            let drag=null,ghost=null;const cleanup=()=>{ghost?.remove();ghost=null;drag=null;};dragCleanup.push(cleanup);const run=game;
            button.onpointerdown=ev=>{if(ev.button!==0||game!==run||drag)return;if(game.started===null)game.started=Date.now();drag={id:Number(button.dataset.picture),x:ev.clientX,y:ev.clientY,pointer:ev.pointerId,moved:false};try{button.setPointerCapture(ev.pointerId);}catch(_){}};
            button.onpointermove=ev=>{if(!drag||drag.pointer!==ev.pointerId)return;if(!drag.moved&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)>7){drag.moved=true;ghost=button.querySelector('img')?.cloneNode();if(ghost){ghost.className='po-drag-ghost';document.body.appendChild(ghost);}}if(ghost){ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px';}};
            button.onpointerup=ev=>{if(!drag||drag.pointer!==ev.pointerId)return;const d=drag;cleanup();if(game!==run)return;if(d.moved){ev.preventDefault();const slot=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-slot]');if(slot&&display.contains(slot)){game.selected=d.id;gamePlace(Number(slot.dataset.slot));}else gamePick(d.id);}};
            button.onpointercancel=cleanup;button.onlostpointercapture=cleanup;
        });
    }

    function scopeControl(kind,value){
        const part=document.getElementById('partSelect'),para=document.getElementById('paraSelect'),level=document.getElementById('levelSelect'),mode=app.mode;
        if(kind==='part'&&part){part.value=value;if(typeof updateParaSelect==='function')updateParaSelect();if(para)para.value='full';if(typeof onScopeChange==='function')onScopeChange();}
        if(kind==='para'&&para){para.value=value;if(typeof onScopeChange==='function')onScopeChange();}
        if(kind==='level'&&level){level.value=value;currentLevel=value;}
        if(mode)open(mode);
    }
    function storyPartNav(){
        const part=Number(currentKey.split('_')[1]?.slice(1)),parts=Object.keys(lessonStructure[currentLesson]||{});
        return '<nav class="po-story-part-nav" aria-label="Story Match Part"><strong>Lesson '+currentLesson+'</strong><div class="po-story-part-buttons">'+parts.map(x=>'<button type="button" class="'+(Number(x)===part?'active':'')+'" aria-pressed="'+(Number(x)===part)+'" onclick="PowerOnPractice.storyPart('+Number(x)+')">Part '+Number(x)+'</button>').join('')+'</div><button type="button" class="po-story-exit" onclick="PowerOnPractice.close()">✕ メニュー</button></nav>';
    }
    function storyPart(value){
        const part=String(value);if(app.mode!=='storyHub'||!Object.prototype.hasOwnProperty.call(lessonStructure[currentLesson]||{},part))return;
        const select=document.getElementById('partSelect'),para=document.getElementById('paraSelect'),level=document.getElementById('levelSelect');
        currentLevel='standard';if(level)level.value='standard';
        if(select){select.value=part;if(typeof updateParaSelect==='function')updateParaSelect();}
        if(para)para.value='full';
        if(select&&typeof onScopeChange==='function')onScopeChange();
        else currentKey='L'+String(currentLesson).padStart(2,'0')+'_P'+part+'_full';
        open('storyHub');
    }
    function compactNav(){
        const parts=Object.keys(lessonStructure[currentLesson]||{}),part=currentKey.split('_')[1]?.slice(1),para=currentKey.split('_')[2],nums=(lessonStructure[currentLesson]||{})[part]||[];
        return '<div class="po-compact-nav"><button onclick="PowerOnPractice.open(\'progress\')">▦ Progress</button><select aria-label="Part" onchange="PowerOnPractice.scopeControl(\'part\',this.value)">'+parts.map(x=>'<option value="'+x+'" '+(x===part?'selected':'')+'>Part '+x+'</option>').join('')+'</select><select aria-label="段落" onchange="PowerOnPractice.scopeControl(\'para\',this.value)">'+['full',...nums.map(n=>'p'+n)].map(x=>'<option value="'+x+'" '+(x===para?'selected':'')+'>'+(x==='full'?'Full Text':x.toUpperCase())+'</option>').join('')+'</select><select aria-label="Level" onchange="PowerOnPractice.scopeControl(\'level\',this.value)">'+['standard','pre1','grade1'].map(x=>'<option '+(x===currentLevel?'selected':'')+'>'+x+'</option>').join('')+'</select><select aria-label="活動を変更" onchange="PowerOnPractice.open(this.value)">'+Object.keys(MODES).map(x=>'<option value="'+x+'" '+(x===app.mode?'selected':'')+'>'+esc(MODES[x])+'</option>').join('')+'</select><button onclick="PowerOnPractice.close()">✕ メニュー</button></div>';
    }


    function questionBank(mode){
        const key=String(currentKey||'').split('_').slice(0,2).join('_');
        if(currentLevel!=='standard')return [];
        const part=window.PowerOnComprehension?.[key];
        const source=mode==='contextVocab'?part?.vocabulary:part?.comprehension;
        if(!Array.isArray(source))return [];
        const lang=mode==='compJa'?1:0;
        return source.map(q=>({id:q.id,paragraph:q.paragraph,prompt:mode==='contextVocab'?'本文中の「'+q.word+'」の意味は？':lang?q.ja:q.en,choices:mode==='contextVocab'?q.choices.slice():q.choices.map(pair=>pair[lang]),evidence:q.evidence,word:q.word||'',explanation:q.explanation||'',tip:q.tip||'',promptJa:mode==='contextVocab'?'':q.ja,answerJa:mode==='contextVocab'?q.choices[0]:q.choices[0][1]}));
    }
    function knowledgeSig(mode){return core.fingerprint(questionBank(mode).map(({id,paragraph,prompt,choices,evidence,word})=>JSON.stringify({id,paragraph,prompt,choices,evidence,word})));}
    function knowledgeRow(mode){const questions=questionBank(mode);return questions.length?store.get(app.slideScope,mode,1,knowledgeSig(mode)):{attempts:0,bestAccuracy:null,completed:{}};}
    function knowledgeMetric(mode){const q=questionBank(mode),row=knowledgeRow(mode);return {value:row.bestAccuracy||0,meta:q.length?'Best '+(row.bestAccuracy==null?'—':row.bestAccuracy+'%')+' · '+q.length+'問':'準備中'};}
    function shuffleChoices(){
        if(games?.shuffle)return games.shuffle([0,1,2,3]);
        const arr=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;
    }
    function startKnowledgeRun(mode){
        const questions=questionBank(mode);
        knowledgeRun=questions.length?{mode,scope:app.slideScope,sig:knowledgeSig(mode),questions,orders:questions.map(()=>shuffleChoices()),index:0,answers:[],score:0,finished:false,review:false,reviewIndex:0,expPaged:false,expPage:0,saved:false}:null;
    }
    function launchKnowledge(){open('knowledgeHub');}
    function knowledgeLesson8(){storyLesson8();open('knowledgeHub');}
    function knowledgeStandard(){currentLevel='standard';const el=document.getElementById('levelSelect');if(el)el.value='standard';open(app.mode||'knowledgeHub');}
    function knowledgeAnswer(qIndex,option){
        const run=knowledgeRun;if(!run||!QUESTION_MODES.includes(app.mode)||run.mode!==app.mode||run.scope!==app.slideScope||run.finished||run.index!==qIndex||run.answers[qIndex]!==undefined||!Number.isInteger(option)||option<0||option>3)return;
        run.answers[qIndex]=option;run.expPage=0;run.expPaged=false;if(option===0)run.score++;
        if(qIndex===run.questions.length-1&&!run.saved){
            run.saved=true;const result=Math.round(run.score*100/run.questions.length);
            store.record(run.scope,run.mode,0,1,run.sig,{attempt:true,accuracy:result,complete:result>=80});
        }
        render();answerFeedback(option===0);
    }
    function knowledgeNext(qIndex){
        const run=knowledgeRun;if(!run||run.finished||run.index!==qIndex||run.answers[qIndex]===undefined||(run.expPaged&&run.expPage!==1))return;
        clearAnswerFeedback();run.expPaged=false;run.expPage=0;
        if(run.index===run.questions.length-1)run.finished=true;else run.index++;
        render();
    }
    function knowledgeRetry(){if(!QUESTION_MODES.includes(app.mode))return;startKnowledgeRun(app.mode);render();}
    function knowledgeReview(){if(knowledgeRun?.finished){knowledgeRun.review=!knowledgeRun.review;knowledgeRun.reviewIndex=0;render();}}
    function knowledgeReviewPage(delta){const run=knowledgeRun;if(!run?.finished||!run.review||![-1,1].includes(delta))return;const n=run.answers.filter(x=>x!==0).length;run.reviewIndex=Math.max(0,Math.min(n-1,run.reviewIndex+delta));render();}
    function knowledgeExplanationPage(delta){const run=knowledgeRun;if(!run||run.finished||run.answers[run.index]===undefined||!run.expPaged||![-1,1].includes(delta))return;clearAnswerFeedback();run.expPage=Math.max(0,Math.min(1,run.expPage+delta));render();}
    function knowledgeLesson(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>10||typeof selectLesson!=='function')return;selectLesson(n,document.querySelectorAll('.nav-btn')[n-1]);}
    function knowledgeHubNav(){const parts=Object.keys(lessonStructure[currentLesson]||{}),part=currentKey.split('_')[1]?.slice(1);return '<div class="po-compact-nav po-knowledge-nav"><select aria-label="Lesson" onchange="PowerOnPractice.knowledgeLesson(this.value)">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'" '+(currentLesson===i+1?'selected':'')+'>Lesson '+(i+1)+'</option>').join('')+'</select><select aria-label="Part" onchange="PowerOnPractice.scopeControl(\'part\',this.value)">'+parts.map(x=>'<option value="'+x+'" '+(x===part?'selected':'')+'>Part '+x+'</option>').join('')+'</select><select aria-label="Level" onchange="PowerOnPractice.scopeControl(\'level\',this.value)">'+['standard','pre1','grade1'].map(x=>'<option '+(x===currentLevel?'selected':'')+'>'+x+'</option>').join('')+'</select><button onclick="PowerOnPractice.open(\'progress\')">▦ Progress</button><button onclick="PowerOnPractice.close()">✕ メニュー</button></div>';}
    function knowledgeToolbar(){return '<div class="po-story-toolbar"><button onclick="PowerOnPractice.open(\'knowledgeHub\')">← 内容理解へ</button><strong>Lesson '+currentLesson+' · '+esc(currentKey.split('_')[1])+' · '+esc(MODES[app.mode])+'</strong><button onclick="PowerOnPractice.open(\'progress\')">学習の記録</button></div>';}
    function knowledgeMissing(){return '<div class="po-match-intro"><h2>Content & Vocabulary</h2><p>'+(currentLevel!=='standard'?'Standard の本文に対応した問題です。':'現在、Lesson 8 の Part 1〜4 でご利用いただけます。')+'</p><button class="po-primary" onclick="PowerOnPractice.'+(currentLevel!=='standard'?'knowledgeStandard':'knowledgeLesson8')+'()">'+(currentLevel!=='standard'?'Standard に切り替える':'Lesson 8 へ')+'</button></div>';}
    function knowledgeCards(){
        const labels=[['compEn','📘','English Q&A','英語の質問に英語で答える'],['compJa','📖','日本語内容理解','日本語の質問で本文の内容を確認'],['contextVocab','🔤','Vocabulary in Context','本文中の語句の意味を選ぶ']];
        return '<div class="po-knowledge-cards">'+labels.map(([mode,icon,title,desc])=>{
            const q=questionBank(mode),row=knowledgeRow(mode),best=row.bestAccuracy==null?'—':row.bestAccuracy+'%',clear=row.bestAccuracy>=80;
            return '<button class="po-knowledge-card '+mode+'" onclick="PowerOnPractice.open(\''+mode+'\')" '+(!q.length?'disabled':'')+'><div class="po-knowledge-card-top"><span>'+icon+'</span><small>'+(!q.length?'準備中':clear?'✓ CLEAR':'CHALLENGE')+'</small></div><h3>'+title+'</h3><p>'+desc+'</p><div class="po-knowledge-best"><b>'+best+'</b><span>BEST SCORE · '+q.length+' QUESTIONS</span></div><div class="po-knowledge-link">学習をはじめる <b>→</b></div></button>';
        }).join('')+'</div>';
    }
    function knowledgeHub(){
        const available=questionBank('compEn').length>0,cleared=QUESTION_MODES.filter(m=>knowledgeRow(m).bestAccuracy>=80).length;
        return '<section class="po-knowledge-hub"><div class="po-knowledge-heading"><div><span class="po-story-eyebrow">POWER ON III · LESSON '+currentLesson+' · '+esc(currentKey.split('_')[1])+'</span><h2>Content &amp; Vocabulary</h2><p>本文全体の内容理解と語彙を確認しよう。</p></div><div class="po-knowledge-clear"><strong>'+cleared+' / 3</strong><span>MISSIONS CLEAR</span></div></div>'+(available?knowledgeCards():knowledgeMissing())+'<footer class="po-knowledge-hub-footer"><span>各10問 · 4択 · 80%以上でクリア · Part全体（Standard）</span><button onclick="PowerOnPractice.open(\'storyHub\')">Story Matchへ</button><button onclick="PowerOnPractice.open(\'progress\')">Learning Progressへ</button></footer></section>';
    }
    function knowledgeExplanation(run){
        const i=run.index,q=run.questions[i],answer=run.answers[i],correct=answer===0,letter=String.fromCharCode(65+run.orders[i].indexOf(0)),chosen=String.fromCharCode(65+run.orders[i].indexOf(answer)),paged=run.expPaged,page=run.expPage;
        return '<dialog open id="po-knowledge-explanation" class="po-explanation '+(correct?'is-correct':'is-wrong')+(paged?' is-paged':'')+'" aria-modal="true" aria-labelledby="po-explanation-title"><div class="po-explanation-panel"><header class="po-explanation-header"><span>QUESTION '+(i+1)+' / '+run.questions.length+' · ANSWER REVIEW'+(paged?' · '+(page+1)+' / 2':'')+'</span><h2 id="po-explanation-title">'+(correct?'✓ 正解！ Correct!':'✕ 不正解 · 解説を確認しよう')+'</h2></header><div class="po-explanation-content"><div class="po-exp-group po-exp-first" '+(paged&&page!==0?'hidden':'')+'><div class="po-exp-answer">'+(!correct?'<div class="po-exp-your"><small>あなたの解答 · '+chosen+'</small><strong>'+esc(q.choices[answer])+'</strong></div>':'')+'<div class="po-exp-correct"><small>正解 · '+letter+'</small><strong>'+esc(q.choices[0])+'</strong>'+(run.mode==='compEn'?'<span>'+esc(q.answerJa)+'</span>':'')+'</div></div>'+(run.mode==='compEn'?'<p class="po-exp-question-ja"><small>質問の意味：</small>'+esc(q.promptJa)+'</p>':'')+'<section class="po-exp-reason"><h3>なぜこの答えになるの？</h3><p id="po-explanation-reason">'+esc(q.explanation||'本文の根拠と正解を照らし合わせましょう。')+'</p></section></div><div class="po-exp-group po-exp-second" '+(paged&&page!==1?'hidden':'')+'><section class="po-exp-evidence"><h3>本文の根拠 <small>Paragraph '+q.paragraph+'</small></h3><p lang="en">'+esc(q.evidence)+'</p></section>'+(q.tip?'<section class="po-exp-tip"><h3>覚えておきたいポイント</h3><p>'+esc(q.tip)+'</p></section>':'')+'</div></div><footer class="po-explanation-footer">'+(paged&&page===1?'<button type="button" class="po-exp-back" onclick="PowerOnPractice.knowledgeExplanationPage(-1)">← 正解・理由</button>':'<span>'+(paged?'1 / 2 · 解説を読もう':'解説を読んでから次に進もう。')+'</span>')+'<button type="button" id="po-explanation-next" class="po-primary" onclick="PowerOnPractice.'+(paged&&page===0?'knowledgeExplanationPage(1)':'knowledgeNext('+i+')')+'">'+(paged&&page===0?'本文の根拠・ポイントへ →':i+1===run.questions.length?'解説を確認した・結果を見る →':'解説を確認した・次の問題へ →')+'</button></footer></div></dialog>';
    }
    function fitKnowledgeExplanation(){
        const run=knowledgeRun,modal=document.getElementById('po-knowledge-explanation');
        if(!run||run.finished||!modal||run.expPaged)return;
        const body=modal.querySelector?.('.po-explanation-content');
        if(body&&body.clientHeight>0&&body.scrollHeight>body.clientHeight+2){run.expPaged=true;run.expPage=0;render();}
    }
    function activateKnowledgeExplanation(display){
        const modal=document.getElementById('po-knowledge-explanation');if(!modal)return;
        modal.addEventListener?.('cancel',ev=>ev.preventDefault());
        if(typeof modal.showModal==='function'){try{modal.removeAttribute('open');modal.showModal();}catch(_){modal.setAttribute('open','');}}
        const next=document.getElementById('po-explanation-next');
        modal.addEventListener?.('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();return;}if(ev.key==='Tab'&&next){const controls=Array.from(modal.querySelectorAll?.('button:not(:disabled)')||[next]);if(controls.length){ev.preventDefault();const index=controls.indexOf(document.activeElement);controls[(index+(ev.shiftKey?-1:1)+controls.length)%controls.length]?.focus();}}});
        try{next?.focus({preventScroll:true});}catch(_){}
        fitKnowledgeExplanation();
        if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(()=>{if(document.getElementById('po-knowledge-explanation')===modal)fitKnowledgeExplanation();});
    }
    function knowledgeReviewCard(run,wrong){
        if(!wrong.length)return '<div class="po-knowledge-review-page"><div class="po-review-heading"><h3>全問正解！</h3><button onclick="PowerOnPractice.knowledgeReview()">結果へ戻る</button></div></div>';
        const {q,i}=wrong[Math.max(0,Math.min(wrong.length-1,run.reviewIndex))];
        return '<div class="po-knowledge-review-page"><div class="po-review-heading"><strong>復習 '+(run.reviewIndex+1)+' / '+wrong.length+' · Q'+(i+1)+'</strong><button onclick="PowerOnPractice.knowledgeReview()">結果へ戻る</button></div><div class="po-review-question">'+esc(q.prompt)+'</div><div class="po-review-columns"><div class="po-review-group"><p>あなたの解答：'+esc(q.choices[run.answers[i]])+'</p><p class="po-correct-text">正解：'+esc(q.choices[0])+'</p><p>'+esc(q.explanation)+'</p></div><div class="po-review-group"><small>本文の根拠 · Paragraph '+q.paragraph+'</small><p>'+esc(q.evidence)+'</p><p class="po-exp-review-tip">'+esc(q.tip)+'</p></div></div><div class="po-review-nav"><button onclick="PowerOnPractice.knowledgeReviewPage(-1)" '+(run.reviewIndex===0?'disabled':'')+'>← 前へ</button><span>'+(run.reviewIndex+1)+' / '+wrong.length+'</span><button onclick="PowerOnPractice.knowledgeReviewPage(1)" '+(run.reviewIndex===wrong.length-1?'disabled':'')+'>次へ →</button></div></div>';
    }
    function knowledgeBody(){
        const run=knowledgeRun;if(!run)return knowledgeMissing();
        const n=run.questions.length;
        if(run.finished){
            const result=Math.round(run.score*100/n),wrong=run.questions.map((q,i)=>({q,i})).filter(x=>run.answers[x.i]!==0);
            if(run.review)return knowledgeReviewCard(run,wrong);
            return '<section class="po-knowledge-result"><span class="po-story-eyebrow">'+esc(MODES[run.mode])+' · RESULT</span><h2>'+(result>=80?'✓ MISSION CLEAR!':'もう一度挑戦しよう！')+'</h2><strong class="po-knowledge-score">'+result+'<small>%</small></strong><p>'+run.score+' / '+n+' 正解 · Best '+(knowledgeRow(run.mode).bestAccuracy??0)+'%</p><div class="po-knowledge-result-actions"><button class="po-primary" onclick="PowerOnPractice.knowledgeRetry()">もう一度</button><button onclick="PowerOnPractice.knowledgeReview()">'+(run.review?'復習を閉じる':'間違えた問題を復習（'+wrong.length+'）')+'</button><button onclick="PowerOnPractice.open(\'knowledgeHub\')">学習メニューへ</button></div>'+'</section>';
        }
        const q=run.questions[run.index],answer=run.answers[run.index],locked=answer!==undefined;
        return '<section class="po-knowledge-question '+run.mode+'"><div class="po-knowledge-question-meta"><strong>QUESTION '+(run.index+1)+' / '+n+'</strong><span>Paragraph '+q.paragraph+'</span><b>SCORE: '+run.score+' / '+n+'</b></div><div class="po-track"><div style="width:'+((run.index+(locked?1:0))*100/n)+'%"></div></div><div class="po-knowledge-prompt"><span>'+esc(MODES[run.mode])+'</span><h2>'+esc(q.prompt)+'</h2>'+(run.mode==='contextVocab'?'<p class="po-vocab-context">'+esc(q.evidence)+'</p>':'')+'</div><div class="po-knowledge-options">'+run.orders[run.index].map((option,position)=>'<button type="button" class="po-knowledge-option '+(locked?(option===0?'right':option===answer?'wrong':'locked'):'')+'" onclick="PowerOnPractice.knowledgeAnswer('+run.index+','+option+')" '+(locked?'disabled':'')+'><span>'+String.fromCharCode(65+position)+'</span><b>'+esc(q.choices[option])+'</b></button>').join('')+'</div><div class="po-knowledge-bottom">'+(locked?'<p class="po-note">解説を確認してから次へ進みましょう。</p>':'<p class="po-note">正しい選択肢を1つタップしてください。</p>')+'</div></section>'+(locked?knowledgeExplanation(run):'');
    }

    function dashboardCards(){
        const row=(mode)=>state(mode), best=(mode)=>legacyRow(mode);
        const per=(mode)=>({value:percent(row(mode)),meta:completedCount(row(mode))+' / '+row(mode).total+' 完了'});
        const mark=(mode)=>({value:best(mode).bestAccuracy||0,meta:'Best '+(best(mode).bestAccuracy||0)+'% · '+best(mode).attempts+'回'});
        const listening=row('listening'), listenTotal=listening.total, listenCount=Array.from({length:listenTotal},(_,i)=>Math.min(3,Number((listening.counts||{})[i])||0)).reduce((a,b)=>a+b,0);
        const groups=[
            ...(questionBank('compEn').length?[{name:'CONTENT & VOCABULARY',tone:'teal',items:[['compEn','英問英答','📘',knowledgeMetric('compEn')],['compJa','日本語内容理解','📖',knowledgeMetric('compJa')],['contextVocab','本文語彙','🔤',knowledgeMetric('contextVocab')]]}]:[]),
            {name:'READING & COMPREHENSION',tone:'sky',items:[['readingcheck','本文音読 / Reading Check','🎙',mark('readingcheck')],['reading','1文ずつ音読','📖',per('reading')],['shadowing','Shadowing','🎧',mark('shadowing')]]},
            {name:'VOCABULARY & SKILLS',tone:'teal',items:[['listening','段落リスニング','🔊',{value:listenTotal?listenCount*100/(listenTotal*3):0,meta:completedCount(listening)+' / '+listenTotal+' 段落で3回達成'}],['vocabEnJa','英語 → 日本語','📘',mark('vocabEnJa')],(currentLesson===8?['vocabJaEn','日本語 → 英語','⇄',mark('vocabJaEn')]:['vocabulary','Vocabulary 総合','⇄',mark('vocabulary')]),['vocabVoice','Voice Speaking','🎤',mark('vocabVoice')]]},
            {name:'STORY MATCH',tone:'violet',items:[['sceneReading','じっくり学習','▣',per('sceneReading')],['storyPuzzle','画像パズル','🧩',gameMetric('storyPuzzle')],['storyRandom','ランダム','⚡',gameMetric('storyRandom')],['storyListen','ゲームリスニング','🔊',gameMetric('storyListen')]]},{name:'MORE PRACTICE',tone:'sky',items:[['puzzle','Listening Puzzle','🧩',per('puzzle')],['slides','Story Slides','▧',per('slides')],['deep','理解チェック','✓',per('deep')]]}
        ];
        const items=groups.flatMap(g=>g.items).filter(i=>!GAME_MODES.includes(i[0])||gameScenes().length), total=items.length, overall=Math.round(items.reduce((n,i)=>n+Math.round(i[3].value),0)/total), complete=items.filter(i=>Math.round(i[3].value)===100).length;
        const profile=learner?'<span class="th-learner-name">● '+esc(learner.name)+' <span>'+esc(learner.class)+' · '+esc(learner.number)+'番</span><button type="button" class="th-switch-learner" onclick="PowerOnPractice.switchLearner()">変更</button></span>':'<span class="th-learner-name">匿名記録 · 学習者を登録すると個人別で保存</span>';
        const form=(!learner||editing)?'<form class="th-analytics-register" onsubmit="PowerOnPractice.register(event)" aria-label="学習者を登録"><strong>学習記録を開始</strong><input name="class" aria-label="クラス" placeholder="クラス" maxlength="40" required><input name="number" aria-label="番号" placeholder="番号" maxlength="12" required><input name="name" aria-label="氏名" placeholder="氏名" maxlength="50" required><button type="submit">記録を開始</button>'+(learner?'<button type="button" onclick="PowerOnPractice.anonymous()">匿名に戻る</button>':'')+'<small id="po-register-error" role="alert"></small></form>':'';
        return '<div class="th-analytics"><section class="th-analytics-hero"><a class="th-share-qr" id="po-share-link" aria-label="PowerOnを共有" target="_blank" rel="noopener noreferrer"><span class="th-share-qr-image" id="po-share-qr"></span><span class="th-share-qr-caption">SCAN &amp; SHARE</span></a><div class="th-analytics-intro"><span class="th-analytics-kicker">LEARNING ANALYTICS · LESSON '+currentLesson+' · '+esc(currentKey.split('_')[1])+'</span><h2>Learning Progress</h2><p>学習スキルを分析。カードから練習へ進めます。</p>'+profile+'</div>'+ring(overall,true)+'<div class="th-analytics-summary"><span>COMPLETED</span><strong>'+complete+'<small> / '+total+'</small></strong><p>各項目の達成度を均等集計</p><button onclick="PowerOnPractice.openActivity(\'script\')">本文から学ぶ →</button></div></section>'+form+'<div class="th-analytics-sections">'+groups.map(g=>'<section class="th-analytics-group" data-tone="'+g.tone+'"><h3>'+g.name+'</h3><div class="th-analytics-cards">'+g.items.map(i=>'<button type="button" class="th-analytics-card" onclick="PowerOnPractice.openActivity(\''+i[0]+'\')"><span class="th-activity-icon" aria-hidden="true">'+activityIcon(i[0])+'</span><span class="th-analytics-card-info"><strong>'+i[1]+'</strong><small>'+esc(i[3].meta)+'</small></span>'+ring(i[3].value)+'</button>').join('')+'</div></section>').join('')+'</div><p class="th-analytics-footnote">選択中のLesson・Part・レベルの記録。段落指定時もじっくり学習・Story Slides・段落リスニングはPart全体。匿名の旧記録は匿名モードで保持し、登録者の記録には混ぜません。</p></div>';
    }
    function openActivity(mode){
        if(mode==='vocabulary'){if(typeof startVocabQuiz==='function')startVocabQuiz();return;}
        if(mode==='script'){if(typeof toggleTextMode==='function')toggleTextMode('script');return;}
        if(mode==='readingcheck'||mode==='shadowing'){if(typeof openSpeechOverlay==='function')openSpeechOverlay(mode==='readingcheck'?'reading':'shadowing');return;}
        if(['vocabEnJa','vocabJaEn','vocabVoice'].includes(mode)){
            if(typeof startVocabQuiz==='function'){startVocabQuiz();if(mode==='vocabEnJa')setupQuizData(1);else if(mode==='vocabVoice')setupQuizData(2);else if(currentLesson!==8){/* existing menu defines available modes */}else {const part=lesson8QuizProgress.partFromKey(currentKey),words=(typeof lessonVocab!=='undefined'&&lessonVocab[part])||[];if(lesson8QuizProgress.unlockedReverse(part,words.length))setupQuizData(3);}}
            return;
        }
        open(mode);
    }
    function playParagraph(){
        const item=app.paragraphs[app.index];if(!item)return;
        stopSpeech();const token=app.micToken, index=app.index, scope=app.slideScope, sig=signature('listening');
        const part=Number(item.key.split('_P')[1].split('_')[0]);
        const dir='lessons/lesson'+currentLesson+'/part'+part+(currentLesson===8&&part===4?'':'/audio');
        const suffix=currentLevel!=='standard'&&currentLesson!==8?'_'+currentLevel:'';
        if(currentLesson===8&&currentLevel!=='standard'){status('このレベルの段落音声は未登録です。Standardを選択してください。');return;}
        const player=new Audio(dir+'/'+item.key+suffix+'.mp3');app.sceneAudio=player;player.playbackRate=app.rate;
        player.onended=function(){if(token!==app.micToken||app.sceneAudio!==player||app.mode!=='listening'||app.index!==index)return;app.sceneAudio=null;store.record(scope,'listening',index,app.paragraphs.length,sig,{listen:true,attempt:true});render();status('最後まで再生しました。1回加算しました。');};
        player.onerror=function(){if(app.sceneAudio===player){app.sceneAudio=null;status('段落音声を読み込めません。回数は加算しません。');}};
        player.play().then(function(){if(app.sceneAudio===player)status('再生中… 最後まで聞くと1回加算されます。');}).catch(function(){if(app.sceneAudio===player){app.sceneAudio=null;status('音声を再生できません。');}});
    }
    function cancelPracticeAudio(){stopSpeech();render();status('停止しました。途中停止は加算されません。');}
    function listeningBody(){const r=state('listening');return '<h2>Listening Mission</h2><p class="po-note">各段落を最後まで3回聞いてクリア。途中停止・再生のやり直しは加算されません。</p><div class="th-listening-mission-grid">'+app.paragraphs.map((x,i)=>{const n=Number((r.counts||{})[i])||0;return '<button class="th-listening-part '+(i===app.index?'active':'')+'" onclick="PowerOnPractice.go('+(i-app.index)+')"><span>Paragraph '+x.number+'</span>'+ring(Math.min(100,n*100/3))+'<strong>'+n+' / 3 回</strong><small>'+(n>=3?'✓ CLEAR':'この段落を選ぶ')+'</small></button>';}).join('')+'</div><div class="po-action-row"><button onclick="PowerOnPractice.cancelPracticeAudio()">■ 停止</button></div>';}
    function sceneNext(skip){if(app.mode!=='sceneReading'||app.recognizer)return;clearAnswerFeedback();const passed=!!state('sceneReading').completed[app.index];if(!passed&&!skip)return;if(app.index>=app.slides.length-1)open('storyHub');else go(1);}
    function reconnect(){stopSpeech();sceneMic=null;sceneMicKey='';sceneMicStyle='';app.result=null;app.feedback='マイクを再接続します。';render();if(app.mode==='sceneReading'&&readingTools?.createReadingSpeechController)sceneMicrophone();}
    function sceneReadingBody(){
       const s=app.slides[app.index],total=app.slides.length;if(!s)return '<p class="po-note">このPartのシーンはありません。</p>';
       const r=state('sceneReading'),passed=!!r.completed[app.index],best=(r.scores||{})[app.index]||0,media=currentLevel==='standard'?sceneMedia(s):{},cover='img/L'+Number(currentLesson)+'.webp';
       const micPhase=sceneMicRun?.phase||'idle',micReady=!!sceneMicRun?.ready;
       const jp=String(s.japanese||'和訳未登録').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'');
       return '<section class="reading-studio"><div class="reading-top"><span>Scene '+(app.index+1)+' / '+total+'</span>'+(app.recognizer?'<span class="po-mic-ready '+(micReady&&micPhase!=='scoring'?'is-ready':'')+'" role="status">'+(micPhase==='scoring'?'判定中…':micReady?'● Speak now! 音読開始':'◌ マイク準備中・まだ読まないで')+'</span>':'')+'<span class="badge '+(passed?'complete':'')+'">'+(passed?'✓ CLEAR':'Accuracy 75%以上で合格')+'</span></div><div class="po-track"><div style="width:'+percent(r)+'%"></div></div><div class="reading-main"><figure class="reading-image"><img id="po-scene-image" src="'+esc(media.image||cover)+'" alt="Scene '+(app.index+1)+'"><figcaption id="po-scene-caption">'+(media.image?'Scene '+(app.index+1):'Lessonカバー · 場面画像は未登録')+'</figcaption></figure><div class="reading-text"><div class="po-reading-model"><button onclick="PowerOnPractice.play()" '+(app.recognizer?'disabled':'')+'>🔊 お手本を聞く</button><label>再生速度 <select aria-label="再生速度" onchange="PowerOnPractice.rate(this.value)">'+[0.65,0.85,1].map(v=>'<option value="'+v+'" '+(app.rate===v?'selected':'')+'>'+v+'×</option>').join('')+'</select></label></div><p class="po-audio-status" id="po-audio-status" role="status"></p><p class="reading-english">'+esc(s.english)+'</p><p class="reading-japanese"><small>Paragraph '+s.paragraph+' の和訳（段落全体）</small><br>'+esc(jp)+'</p></div></div><div class="reading-evaluation"><div class="accuracy '+(passed?'pass':'')+'"><span>Accuracy</span><strong>'+(app.result===null?'—':app.result)+'<small>%</small></strong><span>Best '+best+'%</span></div><div class="transcript"><span>認識した英文</span><p id="po-live-transcript">'+esc(app.hearing||'音読すると、ここに英文が表示されます。')+'</p><small id="po-mic-status" role="status">'+esc(app.feedback||'音読スタートを押してください。')+'</small></div><div class="po-mic-tools"><button onclick="PowerOnPractice.reconnect()">マイクを再接続</button><button onclick="PowerOnPractice.toggleMicStyle()" '+(app.recognizer?'disabled':'')+'>'+(naturalMic()?'自動判定モード':'通常モード')+' ⇄</button></div></div><div class="reading-controls"><button onclick="PowerOnPractice.go(-1)" '+(app.index===0||app.recognizer?'disabled':'')+'>◀ 前へ</button><button class="po-primary" onclick="PowerOnPractice.microphone()" '+(app.recognizer&&(!micReady||micPhase==='scoring')?'disabled':'')+'>'+(app.recognizer?(micPhase==='scoring'?'判定中…':!micReady?'マイク準備中…':naturalMic()?'音読中・自動判定':'■ 終了・判定'):'🎙 音読スタート')+'</button><button onclick="PowerOnPractice.sceneNext(true)" '+(passed||app.recognizer?'disabled':'')+'>スキップ（未クリア）</button><button class="po-primary po-reading-next" onclick="PowerOnPractice.sceneNext(false)" '+(!passed||app.recognizer?'disabled':'')+'>'+(app.index===total-1?'✓ 学習進捗へ':'次のシーンへ ▶')+'</button></div><p class="po-note">'+(naturalMic()?'緑の Speak now! で音読開始。読み終えたら静かにして自動判定。固有名詞は対象外。':'緑の Speak now! で音読開始。固有名詞は採点対象外。')+'</p></section>';
    }

    function progressDashboard() {
        const all = store.snapshot().scopes;
        const lessonItems = [];
        const activeLevel = String(currentLevel) + ':';
        for (let num = 1; num <= 10; num++) {
            const parts = Object.keys((typeof lessonStructure !== 'undefined' && lessonStructure[num]) || {});
            let score = 0, cells = 0;
            const partLabels = parts.map(function (part) {
                const prefix = activeLevel + 'L' + String(num).padStart(2,'0') + '_P' + part + '_';
                const matching = Object.keys(all).filter(function (key) {return key.indexOf(prefix) === 0;});
                const values = ['reading','deep','puzzle'].map(function (mode) {
                    return matching.reduce(function (best, key) {
                        const row = all[key] && all[key][mode];
                        if (!row || !row.total) return best;
                        const valid = Object.keys(row.completed || {}).filter(function (k) {
                            return row.completed[k] && Number(k) >= 0 && Number(k) < row.total;
                        }).length;
                        return Math.max(best, Math.round(valid / row.total * 100));
                    }, 0);
                });
                const average = Math.round(values.reduce(function (a,b) {return a+b;},0) / 3);
                score += average; cells++;
                return '<span>Part ' + esc(part) + ' <b>' + average + '%</b></span>';
            });
            const overall = cells ? Math.round(score/cells) : 0;
            lessonItems.push('<article class="po-lesson-card' + (num === Number(currentLesson) ? ' is-current' : '') +
                '"><div><strong>Lesson ' + num + '</strong><strong>' + overall + '%</strong></div>' +
                '<div class="po-track"><div style="width:' + overall + '%"></div></div>' +
                '<div class="po-parts">' + partLabels.join('') + '</div></article>');
        }
        return dashboardCards() + '<details class="po-history"><summary>Lesson 1–10・従来の学習履歴・CSV</summary><p class="po-note">選択中：Lesson ' + currentLesson + ' · ' +
            esc(currentKey.split('_')[1] || '') + ' · ' + esc(currentLevel) +
            '。各モードの進捗は端末内に保存します。</p>' +
            '<div class="po-stats">' + scopeBar('1文ずつ音読','reading') +
            scopeBar('じっくり','deep') + scopeBar('リスニングパズル','puzzle') + scopeBar('Story Slides（Part全体）','slides') + '</div>' +
            '<h3>Lesson 1–10 の進捗 <small>各Partの最高進捗を集計</small></h3>' +
            '<div class="po-lessons">' + lessonItems.join('') + '</div>' + legacySummary() +
            '<div class="po-action-row"><button onclick="PowerOnPractice.exportCSV()">📥 進捗CSVを保存</button></div>' +
            '<p class="po-note">' + (store.isPersistent() ?
                '保存先：この端末のブラウザ（別端末や教師画面との自動同期はまだありません）。' :
                '注意：ブラウザの保存が利用できないため、記録はこの画面を開いている間だけ保持されます。') +
            ' Lesson 8 の既存ポイント制度は変更しません。進捗は学習操作の記録で、成績や発音の厳密な評価ではありません。</p></details>';
    }
    function sceneMedia(scene) {
        // Only registered media is loaded; missing images never masquerade as scene-specific art.
        if (!scene || currentLevel !== 'standard') return {};
        return (window.PowerOnSceneMedia || {})[scene.id] || {};
    }
    function sceneJump(index) {
        const n=Number(index);
        if(app.mode==='slides' && Number.isInteger(n) && n>=0 && n<app.slides.length) go(n-app.index);
    }
    function slideBody() {
        const scene=app.slides[app.index], count=app.slides.length;
        if(!scene) return '<p class="po-note">このPartにスライド用の本文がありません。</p>';
        const row=state('slides'), media=sceneMedia(scene), done=!!row.completed[app.index];
        const cover='img/L'+Number(currentLesson)+'.webp';
        let html='<div class="po-study-meta"><strong>Scene '+(app.index+1)+' / '+count+'</strong><span>Paragraph '+scene.paragraph+' · Sentence '+scene.firstSentence+(scene.lastSentence!==scene.firstSentence?'–'+scene.lastSentence:'')+'</span><span>'+completedCount(row)+' / '+count+' 完了</span></div>'+
            '<div class="po-track" role="progressbar" aria-label="スライド進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent(row)+'"><div style="width:'+percent(row)+'%"></div></div>'+
            '<div class="po-scene-grid"><figure class="po-scene-picture"><img id="po-scene-image" src="'+esc(media.image||cover)+'" alt="'+(media.image?'英文の場面画像':'Lessonの既存カバー画像')+'"><figcaption id="po-scene-caption">'+(media.image?'Scene '+(app.index+1):'Lessonカバー · 場面画像は未登録')+'</figcaption></figure>'+
            '<div class="po-scene-text"><div class="po-sentence">'+esc(scene.english)+'</div>'+
            '<div class="po-action-row"><button onclick="PowerOnPractice.switchJapanese()">'+(app.showJapanese?'和訳を隠す':'日本語訳')+'</button><button class="po-primary" onclick="PowerOnPractice.markRead(true)">'+(done?'✓ 学習済み':'✓ 理解した')+'</button></div>';
        if(app.showJapanese) html+='<div class="po-translation"><strong>Paragraph '+scene.paragraph+' の和訳（段落全体）</strong><p>'+esc(String(scene.japanese||'和訳未登録').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,''))+'</p></div>';
        html+='</div></div><p class="po-note">'+(media.audio?'登録済みモデル音声':'このSceneの専用MP3は未登録：端末読み上げを使用')+'</p>'+
            '<div class="po-navigation"><button onclick="PowerOnPractice.go(-1)" '+(app.index===0?'disabled':'')+'>← 前へ</button><div class="po-scene-jumps" aria-label="Sceneを選択">';
        for(let i=0;i<count;i++) html+='<button aria-label="Scene '+(i+1)+(row.completed[i]?' 学習済み':'')+'" aria-current="'+(i===app.index?'true':'false')+'" class="'+(i===app.index?'po-primary ':'')+(row.completed[i]?'po-scene-complete':'')+'" onclick="PowerOnPractice.sceneJump('+i+')">'+(i+1)+'</button>';
        return html+'</div><button onclick="PowerOnPractice.go(1)" '+(app.index===count-1?'disabled':'')+'>次へ →</button></div>';
    }
    function studyBody() {
        if(app.mode==='knowledgeHub')return knowledgeHub();
        if(QUESTION_MODES.includes(app.mode))return knowledgeBody();
        if(app.mode==='slides')return slideBody();
        if(app.mode==='sceneReading')return sceneReadingBody();
        if(app.mode==='listening')return listeningBody();
        if(GAME_MODES.includes(app.mode))return gameBody();
        const count = modeSentences(app.mode).length;
        if (!count) return '<p class="po-note">この範囲には利用可能な英文がありません。Lesson・Part・段落を変更してください。</p>';
        const row = state(app.mode);
        const done = !!row.completed[app.index];
        const isPuzzle = app.mode === 'puzzle';
        let html = '<div class="po-study-meta"><span>Sentence ' + (app.index+1) + ' / ' + count +
            '</span><span>' + completedCount(row) + '/' + count + ' 完了</span>' +
            (done ? '<span class="po-done">✓ クリア済み</span>' : '') + '</div>' +
            '<div class="po-track"><div style="width:' + percent(row) + '%"></div></div>';
        if (isPuzzle) {
            const selected = app.puzzle ? app.selected.map(function (id) {
                return app.puzzle.ordered.find(function (c) {return c.id === id;});
            }).filter(Boolean) : [];
            html += '<p class="po-note">英文を聞き、チャンクを正しい順番にタップして組み立てます。答えは再生前に表示しません。</p>' +
                '<div class="po-puzzle-answer" aria-live="polite">' +
                (selected.length ? selected.map(function (c) {return '<span>' + esc(c.text) + '</span>';}).join(' ') :
                    '<span class="po-placeholder">ここに選んだ順番で並びます</span>') + '</div>' +
                '<div class="po-puzzle-cards">' + (app.puzzle ? app.puzzle.cards.filter(function (c) {
                    return !app.selected.includes(c.id);
                }).map(function (c) {
                    return '<button ' + (done ? 'disabled' : '') + ' onclick="PowerOnPractice.chooseCard(\'' +
                        esc(c.id) + '\')">' + esc(c.text) + '</button>';
                }).join('') : '') + '</div>' +
                '<div class="po-action-row"><button onclick="PowerOnPractice.undoCard()" ' +
                (done || !app.selected.length ? 'disabled' : '') + '>↶ 1つ戻す</button>' +
                '<button onclick="PowerOnPractice.retryPuzzle()" ' + (done ? 'disabled' : '') +
                '>🔁 並べ直す</button><button class="po-primary" onclick="PowerOnPractice.checkPuzzle()" ' +
                (done || !app.puzzle || app.selected.length !== app.puzzle.ordered.length ? 'disabled' : '') +
                '>答え合わせ</button></div>' +
                (done ? '<p class="po-solution">正解：' + esc(currentText()) + '</p>' : '');
        } else {
            html += '<div class="po-sentence">' + esc(currentText()) + '</div>';
            if (app.mode === 'deep') {
                html += '<p class="po-note">意味を考える → 音声を聞く → 自分で読む → 理解できたら「理解した」を押します。</p>';
                if (app.showJapanese) {
                    const jp = String(app.translation || '').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'');
                    html += '<div class="po-translation"><strong>選択範囲全体の日本語訳（英文と1文ずつ対応しているとは限りません）</strong><p>' +
                        esc(jp || 'この範囲の和訳は未登録です。') + '</p></div>';
                }
                html += '<div class="po-action-row"><button onclick="PowerOnPractice.switchJapanese()">' +
                    (app.showJapanese ? '日本語訳を隠す' : '🇯🇵 和訳を確認') + '</button>' +
                    '<button class="po-primary" onclick="PowerOnPractice.markRead(true)">✓ 理解した（自己申告）</button></div>';
            } else {
                html += '<p class="po-note">お手本を聞いてから音読しましょう。マイクを使うと語句一致率の目安を確認できます。</p>' +
                    '<div class="po-action-row"><button onclick="PowerOnPractice.microphone()">' +
                    (app.recognizer ? '■ 認識を終了' : '🎤 1文を音読して確認') + '</button>' +
                    '<button class="po-primary" onclick="PowerOnPractice.markRead(true)">✓ 読んだ（自己申告）</button></div>';
            }
        }
        if (app.feedback) html += '<p class="po-feedback" role="status">' + esc(app.feedback) + '</p>';
        if (app.hearing) html += '<p class="po-note">' + esc(app.hearing) + '</p>';
        html += '<div class="po-navigation"><button onclick="PowerOnPractice.go(-1)" ' +
            (app.index === 0 ? 'disabled' : '') + '>← 前の文</button>' +
            '<button onclick="PowerOnPractice.go(1)" ' +
            (app.index >= count-1 ? 'disabled' : '') + '>次の文 →</button></div>';
        return html;
    }
    function render() {
        if (!app.mode || currentMode !== 'practice') return;
        const display = document.getElementById('targetTextDisplay');
        if (!display) return;
        clearDrag();const epoch=++imageEpoch;
        let body = app.mode === 'storyHub' ? storyHub() : app.mode === 'progress' ? progressDashboard() : studyBody();
        if (app.mode !== 'progress' && app.mode!=='storyHub' && app.mode!=='sceneReading' && !GAME_MODES.includes(app.mode) && !isKnowledgeMode(app.mode)) {
            body = '<div class="po-speech-controls"><button class="po-primary" onclick="PowerOnPractice.play()" '+(app.recognizer?'disabled':'')+'>▶ '+(app.mode==='listening'?'段落を聞く':['slides','sceneReading'].includes(app.mode)?'お手本を聞く':'この1文を聞く')+'</button>' +
                '<label>速度 <select aria-label="音声速度" onchange="PowerOnPractice.rate(this.value)">' +
                [0.65,0.85,1].map(function (v) {
                    return '<option value="' + v + '"' + (app.rate === v ? ' selected' : '') + '>' +
                        v + '×</option>';
                }).join('') + '</select></label></div>' +
                '<p class="po-audio-status" id="po-audio-status" role="status"></p>' + body;
        }
        display.innerHTML = '<section class="po-practice'+(['slides','sceneReading'].includes(app.mode)?' po-slides':'')+(app.mode==='progress'?' po-analytics':'')+(GAME_MODES.includes(app.mode)?' po-game':'')+(isKnowledgeMode(app.mode)?' po-knowledge':'')+' po-mode-'+app.mode+'"><header class="po-heading"><div><span>POWER ON Ⅲ · STUDY LAB</span><h2>' +
            esc(MODES[app.mode]) + '</h2><p>Lesson ' + currentLesson + ' / ' +
            esc(currentKey.split('_')[1] || '') + ' / ' +
            esc(currentKey.split('_')[2] || '') + ' / ' + esc(currentLevel) + '</p></div>' +
            '</header>' + (app.mode==='knowledgeHub'?knowledgeHubNav():app.mode==='storyHub'?storyPartNav():QUESTION_MODES.includes(app.mode)?knowledgeToolbar():app.mode==='sceneReading'||GAME_MODES.includes(app.mode)?storyToolbar():compactNav()) + '<div class="po-content">' + body + '</div></section>';
        if(QUESTION_MODES.includes(app.mode))activateKnowledgeExplanation(display);
        attachPuzzleDrag(display);
        if(GAME_MODES.includes(app.mode)&&display.querySelectorAll){display.querySelectorAll('.po-match-board img').forEach(img=>{const fail=()=>{if(epoch!==imageEpoch||!game||game.done)return;clearGameTimer();clearDrag();stopSpeech();game=null;const board=display.querySelector('.po-match-board');if(board)board.innerHTML='<div class="po-match-intro"><h2>画像を読み込めません</h2><p>通信環境を確認して、もう一度お試しください。</p><button onclick="PowerOnPractice.open(\''+app.mode+'\')">戻る</button></div>';};img.addEventListener('error',fail,{once:true});if(img.complete&&!img.naturalWidth)fail();});}
        if(app.mode==='progress'){const link=document.getElementById('po-share-link'),qr=document.getElementById('po-share-qr');if(link&&qr){try{const url=window.location.origin+window.location.pathname;link.href=url;if(typeof QRCode==='function')new QRCode(qr,{text:url,width:90,height:90,colorDark:'#123958',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});else qr.textContent='PowerOn';}catch(_){qr.textContent='PowerOn';}}}
        if(['slides','sceneReading'].includes(app.mode)){
            const image=document.getElementById('po-scene-image');
            const caption=document.getElementById('po-scene-caption');
            if(image){const fallback='img/L'+Number(currentLesson)+'.webp';const fail=function(){if(epoch!==imageEpoch)return;if(image.getAttribute('src')!==fallback){image.src=fallback;caption.textContent='Lessonカバー · 場面画像を読み込めません';}else {image.hidden=true;caption.textContent='画像準備中';}};image.addEventListener('error',fail);if(image.complete && !image.naturalWidth) fail();}
        }
    }
    function exportCSV() {
        const rows = [['Level','Scope','Mode','Completed','Total','Percent','Attempts','BestWordMatchPercent','LastStudied','BestPoints','BestSeconds','BestByCount','BestByLevel']];
        const all = store.snapshot().scopes;
        Object.keys(all).sort().forEach(function (key) {
            ['reading','deep','puzzle','readingcheck','shadowing','vocabulary','slides','sceneReading','listening','vocabEnJa','vocabJaEn','vocabVoice','storyPuzzle','storyRandom','storyListen','compEn','compJa','contextVocab'].forEach(function (mode) {
                const row = all[key]?.[mode];
                if (!row || !row.total) return;
                const count = Object.keys(row.completed || {}).filter(function (index) {
                    return row.completed[index] && Number(index) >= 0 && Number(index) < row.total;
                }).length;
                rows.push([key.split(':')[0],key.split(':')[1],mode,count,row.total,
                    Math.round(count/row.total*100),row.attempts||0,row.bestAccuracy == null ? '' : row.bestAccuracy,
                    row.lastAt||'',row.bestPoints??'',row.bestSeconds??'',JSON.stringify(row.bestByCount||{}),JSON.stringify(row.bestByLevel||{})]);
            });
        });
        const csv = '\uFEFF' + rows.map(function (row) {
            return row.map(function (value) {return '"' + String(value).replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""') + '"';}).join(',');
        }).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'poweron-learning-progress.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () {URL.revokeObjectURL(url);}, 1000);
    }
    if(typeof window.addEventListener==='function'){window.addEventListener('DOMContentLoaded',()=>{if(window.location&&window.location.hash==='#story-match')launchStory();});window.addEventListener('pagehide',()=>{stopSpeech();clearGameTimer();clearDrag();clearAnswerFeedback();});window.addEventListener('pageshow',event=>{if(event.persisted&&app.mode)open(GAME_MODES.includes(app.mode)?'storyHub':app.mode);});}
    if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(!document.hidden||!app.mode)return;const wasMic=!!app.recognizer;stopSpeech();clearDrag();if(wasMic){app.feedback='画面を離れたため音読を停止しました。再試行してください。';render();}else if(game&&game.mode==='storyListen'&&!game.done&&!game.answering){game.ready=false;game.message='画面に戻り、もう一度音声を聞いてください。';render();}});
    if(typeof window.addEventListener==='function'){window.addEventListener('resize',fitKnowledgeExplanation);window.visualViewport?.addEventListener?.('resize',fitKnowledgeExplanation);}
    window.PowerOnPractice = {
        open:open, close:close, stop:stop, answerFeedback:answerFeedback, mode:function(){return app.mode;},
        go:go, sceneJump:sceneJump, play:play, rate:rate, microphone:microphone, markRead:markRead,
        switchJapanese:switchJapanese, chooseCard:chooseCard, undoCard:undoCard,
        checkPuzzle:checkPuzzle, retryPuzzle:retryPuzzle, exportCSV:exportCSV,
        gameHint:gameHint,closeHint:closeHint,launchKnowledge:launchKnowledge,knowledgeLesson8:knowledgeLesson8,knowledgeStandard:knowledgeStandard,knowledgeAnswer:knowledgeAnswer,knowledgeNext:knowledgeNext,knowledgeRetry:knowledgeRetry,knowledgeReview:knowledgeReview,knowledgeReviewPage:knowledgeReviewPage,knowledgeExplanationPage:knowledgeExplanationPage,knowledgeLesson:knowledgeLesson,storyPart:storyPart,launchStory:launchStory,storyScene:storyScene,storyLesson8:storyLesson8,gameStart:gameStart,gamePick:gamePick,gamePlace:gamePlace,gamePage:gamePage,gameAnswer:gameAnswer,gameSkip:gameSkip,gameSpeak:gameSpeak,scopeControl:scopeControl,captureLegacy:captureLegacy, register:register,switchLearner:switchLearner,anonymous:anonymous,openActivity:openActivity,cancelPracticeAudio:cancelPracticeAudio,sceneNext:sceneNext,reconnect:reconnect,toggleMicStyle:toggleMicStyle, getProgress:function () {return store.snapshot();}
    };
})();

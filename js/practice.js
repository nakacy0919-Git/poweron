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
    function register(event){event.preventDefault();const form=event.currentTarget||event.target;const next={class:form.elements.namedItem('class').value.trim(),number:form.elements.namedItem('number').value.trim(),name:form.elements.namedItem('name').value.trim()};if(!next.class||!next.number||!next.name)return;try{storage.setItem(PROFILE_KEY,JSON.stringify(next));}catch(_){const msg=document.getElementById('po-register-error');if(msg)msg.textContent='この端末では保存できません。';return;} learner=next;store=learnerStore();editing=false;render();}
    function switchLearner(){editing=true;render();}
    function anonymous(){try{storage.removeItem(PROFILE_KEY);}catch(_){}learner=null;store=learnerStore();editing=false;render();}
    const MODES = {progress:'学習進捗', reading:'1文ずつ音読', sceneReading:'じっくり学習', deep:'理解チェック（自己申告）', puzzle:'Listening Puzzle', slides:'Story Slides', listening:'Listening Mission'};
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
        if(app.sceneAudio){app.sceneAudio.pause(); app.sceneAudio = null;}
        if (app.recognizer) {
            const prev = app.recognizer;
            app.recognizer = null;
            prev.onresult = null; prev.onend = null; prev.onerror = null;
            try { prev.abort(); } catch (_) {}
        }
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
    }
    function stop() {
        stopSpeech();
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
        if (mode !== 'progress') {
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
    }
    function open(mode) {
        if (!Object.prototype.hasOwnProperty.call(MODES, mode)) return;
        if (typeof resetAppMode === 'function') resetAppMode();
        prepare(mode);
        currentMode = 'practice';
        document.body.classList.add('text-active', 'po-practice-active');
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
        stopSpeech();
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
        if (!currentText()) return;
        if(app.recognizer)return;
        if(app.mode==='listening'){playParagraph();return;}
        if (['slides','sceneReading'].includes(app.mode)) {
            const scene=app.slides[app.index]; const media=currentLevel==='standard'?sceneMedia(scene):{};
            if(media.audio){
                stopSpeech(); const player=new Audio(media.audio); app.sceneAudio=player; player.playbackRate=app.rate;
                player.onended=function(){if(app.sceneAudio===player)status('再生終了。');};
                player.play().then(function(){if(app.sceneAudio===player)status('モデル音声を再生中…');}).catch(function(){if(app.sceneAudio===player){app.sceneAudio=null;status('モデル音声を再生できません。');}});
                return;
            }
        }
        if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
            status('このブラウザでは音声読み上げを利用できません。');
            return;
        }
        try {
            stopSpeech();
            const token=app.micToken;
            const phrase = new SpeechSynthesisUtterance(currentText());
            phrase.lang = 'en-US';
            phrase.rate = app.rate;
            phrase.onstart = function () {if(token!==app.micToken)return;status('再生中…');};
            phrase.onend = function () {if(token!==app.micToken)return;status('再生終了。自分でも声に出してみましょう。');};
            phrase.onerror = function () {if(token!==app.micToken)return;status('音声再生に失敗しました。端末の音声設定を確認してください。');};
            window.speechSynthesis.speak(phrase);
        } catch (_) { status('音声再生に失敗しました。'); }
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
    function microphone() {
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
                {attempt:true, accuracy:score, complete:score >= 80});
            app.hearing = '認識した英語：' + recognized;
            if(mode==='sceneReading'&&score>=80&&typeof fireConfetti==='function')try{fireConfetti();}catch(_){}
            app.feedback = '語句一致率 ' + score + '% · 約' + wpm + ' WPM' +
                (score >= 80 ? ' ／ 80%以上でクリア！' : ' ／ 80%以上でクリア（再挑戦できます）');
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
        render();
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
    function dashboardCards(){
        const row=(mode)=>state(mode), best=(mode)=>legacyRow(mode);
        const per=(mode)=>({value:percent(row(mode)),meta:completedCount(row(mode))+' / '+row(mode).total+' 完了'});
        const mark=(mode)=>({value:best(mode).bestAccuracy||0,meta:'Best '+(best(mode).bestAccuracy||0)+'% · '+best(mode).attempts+'回'});
        const listening=row('listening'), listenTotal=listening.total, listenCount=Array.from({length:listenTotal},(_,i)=>Math.min(3,Number((listening.counts||{})[i])||0)).reduce((a,b)=>a+b,0);
        const groups=[
            {name:'READING & COMPREHENSION',tone:'sky',items:[['readingcheck','本文音読 / Reading Check','🎙',mark('readingcheck')],['reading','1文ずつ音読','📖',per('reading')],['shadowing','Shadowing','🎧',mark('shadowing')]]},
            {name:'VOCABULARY & SKILLS',tone:'teal',items:[['listening','段落リスニング','🔊',{value:listenTotal?listenCount*100/(listenTotal*3):0,meta:completedCount(listening)+' / '+listenTotal+' 段落で3回達成'}],['vocabEnJa','英語 → 日本語','📘',mark('vocabEnJa')],(currentLesson===8?['vocabJaEn','日本語 → 英語','⇄',mark('vocabJaEn')]:['vocabulary','Vocabulary 総合','⇄',mark('vocabulary')]),['vocabVoice','Voice Speaking','🎤',mark('vocabVoice')]]},
            {name:'STORY MATCH',tone:'violet',items:[['sceneReading','じっくり学習','▣',per('sceneReading')],['puzzle','Listening Puzzle','🧩',per('puzzle')],['slides','Story Slides','▧',per('slides')],['deep','理解チェック','✓',per('deep')]]}
        ];
        const items=groups.flatMap(g=>g.items), total=items.length, overall=Math.round(items.reduce((n,i)=>n+Math.round(i[3].value),0)/total), complete=items.filter(i=>Math.round(i[3].value)===100).length;
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
    function sceneNext(skip){if(app.mode!=='sceneReading'||app.recognizer)return;const passed=!!state('sceneReading').completed[app.index];if(!passed&&!skip)return;if(app.index>=app.slides.length-1)open('progress');else go(1);}
    function reconnect(){stopSpeech();app.result=null;app.feedback='マイクを再接続できます。音読スタートを押してください。';render();}
    function sceneReadingBody(){
       const s=app.slides[app.index],total=app.slides.length;if(!s)return '<p class="po-note">このPartのシーンはありません。</p>';
       const r=state('sceneReading'),passed=!!r.completed[app.index],best=(r.scores||{})[app.index]||0,media=currentLevel==='standard'?sceneMedia(s):{},cover='img/L'+Number(currentLesson)+'.webp';
       const jp=String(s.japanese||'和訳未登録').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'');
       return '<section class="reading-studio"><div class="reading-top"><span>Scene '+(app.index+1)+' / '+total+'</span><span class="badge '+(passed?'complete':'')+'">'+(passed?'✓ CLEAR':'Accuracy 80%以上で合格')+'</span></div><div class="po-track"><div style="width:'+percent(r)+'%"></div></div><div class="reading-main"><figure class="reading-image"><img id="po-scene-image" src="'+esc(media.image||cover)+'" alt="Scene '+(app.index+1)+'"><figcaption id="po-scene-caption">'+(media.image?'Scene '+(app.index+1):'Lessonカバー · 場面画像は未登録')+'</figcaption></figure><div class="reading-text"><p class="reading-english">'+esc(s.english)+'</p><p class="reading-japanese"><small>Paragraph '+s.paragraph+' の和訳（段落全体）</small><br>'+esc(jp)+'</p></div></div><div class="reading-evaluation"><div class="accuracy '+(passed?'pass':'')+'"><span>Accuracy</span><strong>'+(app.result===null?'—':app.result)+'<small>%</small></strong><span>Best '+best+'%</span></div><div class="transcript"><span>認識した英文</span><p>'+esc(app.hearing||'音読すると、ここに英文が表示されます。')+'</p><small role="status">'+esc(app.feedback||'音読スタートを押してください。')+'</small></div><button onclick="PowerOnPractice.reconnect()">マイクを再接続</button></div><div class="reading-controls"><button onclick="PowerOnPractice.go(-1)" '+(app.index===0||app.recognizer?'disabled':'')+'>◀ 前へ</button><button class="po-primary" onclick="PowerOnPractice.microphone()">'+(app.recognizer?'■ 終了・判定':'🎙 音読スタート')+'</button><button onclick="PowerOnPractice.sceneNext(true)" '+(passed||app.recognizer?'disabled':'')+'>スキップ（未クリア）</button><button class="po-primary" onclick="PowerOnPractice.sceneNext(false)" '+(!passed||app.recognizer?'disabled':'')+'>'+(app.index===total-1?'✓ 学習進捗へ':'次のシーンへ ▶')+'</button></div><p class="po-note">シーン単位音読は語句一致率の目安です。未クリアは再挑戦できます。</p></section>';
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
        return dashboardCards() + '<p class="po-note">選択中：Lesson ' + currentLesson + ' · ' +
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
            ' Lesson 8 の既存ポイント制度は変更しません。進捗は学習操作の記録で、成績や発音の厳密な評価ではありません。</p>';
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
        if(app.mode==='slides')return slideBody();
        if(app.mode==='sceneReading')return sceneReadingBody();
        if(app.mode==='listening')return listeningBody();
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
        let body = app.mode === 'progress' ? progressDashboard() : studyBody();
        if (app.mode !== 'progress') {
            body = '<div class="po-speech-controls"><button class="po-primary" onclick="PowerOnPractice.play()" '+(app.recognizer?'disabled':'')+'>▶ '+(app.mode==='listening'?'段落を聞く':['slides','sceneReading'].includes(app.mode)?'お手本を聞く':'この1文を聞く')+'</button>' +
                '<label>速度 <select aria-label="音声速度" onchange="PowerOnPractice.rate(this.value)">' +
                [0.65,0.85,1].map(function (v) {
                    return '<option value="' + v + '"' + (app.rate === v ? ' selected' : '') + '>' +
                        v + '×</option>';
                }).join('') + '</select></label></div>' +
                '<p class="po-audio-status" id="po-audio-status" role="status"></p>' + body;
        }
        display.innerHTML = '<section class="po-practice'+(['slides','sceneReading'].includes(app.mode)?' po-slides':'')+(app.mode==='progress'?' po-analytics':'')+'"><header class="po-heading"><div><span>POWER ON Ⅲ · STUDY LAB</span><h2>' +
            esc(MODES[app.mode]) + '</h2><p>Lesson ' + currentLesson + ' / ' +
            esc(currentKey.split('_')[1] || '') + ' / ' +
            esc(currentKey.split('_')[2] || '') + ' / ' + esc(currentLevel) + '</p></div>' +
            '</header>' + nav() + '<div class="po-content">' + body + '</div></section>';
        if(app.mode==='progress'){const link=document.getElementById('po-share-link'),qr=document.getElementById('po-share-qr');if(link&&qr){try{const url=window.location.origin+window.location.pathname;link.href=url;if(typeof QRCode==='function')new QRCode(qr,{text:url,width:90,height:90,colorDark:'#123958',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});else qr.textContent='PowerOn';}catch(_){qr.textContent='PowerOn';}}}
        if(['slides','sceneReading'].includes(app.mode)){
            const image=document.getElementById('po-scene-image');
            const caption=document.getElementById('po-scene-caption');
            if(image){const fallback='img/L'+Number(currentLesson)+'.webp';const fail=function(){if(image.getAttribute('src')!==fallback){image.src=fallback;caption.textContent='Lessonカバー · 場面画像を読み込めません';}else {image.hidden=true;caption.textContent='画像準備中';}};image.addEventListener('error',fail);if(image.complete && !image.naturalWidth) fail();}
        }
    }
    function exportCSV() {
        const rows = [['Level','Scope','Mode','Completed','Total','Percent','Attempts','BestWordMatchPercent','LastStudied']];
        const all = store.snapshot().scopes;
        Object.keys(all).sort().forEach(function (key) {
            ['reading','deep','puzzle','readingcheck','shadowing','vocabulary','slides','sceneReading','listening','vocabEnJa','vocabJaEn','vocabVoice'].forEach(function (mode) {
                const row = all[key][mode];
                if (!row || !row.total) return;
                const count = Object.keys(row.completed || {}).filter(function (index) {
                    return row.completed[index] && Number(index) >= 0 && Number(index) < row.total;
                }).length;
                rows.push([key.split(':')[0],key.split(':')[1],mode,count,row.total,
                    Math.round(count/row.total*100),row.attempts||0,row.bestAccuracy == null ? '' : row.bestAccuracy,
                    row.lastAt||'']);
            });
        });
        const csv = '\uFEFF' + rows.map(function (row) {
            return row.map(function (value) {return '"' + String(value).replace(/"/g,'""') + '"';}).join(',');
        }).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'poweron-learning-progress.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () {URL.revokeObjectURL(url);}, 1000);
    }
    window.PowerOnPractice = {
        open:open, close:close, stop:stop, mode:function(){return app.mode;},
        go:go, sceneJump:sceneJump, play:play, rate:rate, microphone:microphone, markRead:markRead,
        switchJapanese:switchJapanese, chooseCard:chooseCard, undoCard:undoCard,
        checkPuzzle:checkPuzzle, retryPuzzle:retryPuzzle, exportCSV:exportCSV,
        captureLegacy:captureLegacy, register:register,switchLearner:switchLearner,anonymous:anonymous,openActivity:openActivity,cancelPracticeAudio:cancelPracticeAudio,sceneNext:sceneNext,reconnect:reconnect, getProgress:function () {return store.snapshot();}
    };
})();

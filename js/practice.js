/* Power On III study modes: sentence reading, deep study, listening puzzle and progress.
   No server calls: anonymous progress is stored only on this browser/device. */
(function () {
    'use strict';
    const core = window.PowerOnPracticeCore;
    if (!core) return;
    let storage = null;
    try { storage = window.localStorage; } catch (_) {}
    const store = core.createProgressStore(storage);
    const MODES = {progress:'学習進捗', reading:'1文ずつ音読', deep:'じっくりモード', puzzle:'Listening Puzzle'};
    const app = {
        mode:null, index:0, sentences:[], candidates:[], scope:'', translation:'',
        showJapanese:false, puzzle:null, selected:[], feedback:'', hearing:'',
        recognizer:null, micToken:0, micStart:0, rate:0.85
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }
    function dataOf(kind) {
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
        return String((advanced && advanced[currentKey]) || base[currentKey] || '');
    }
    function modeSentences(mode) {
        return mode === 'puzzle' ? app.candidates.map(function (i) {return app.sentences[i];}) : app.sentences;
    }
    function signature(mode) { return core.fingerprint(modeSentences(mode)); }
    function state(mode) {
        const total = modeSentences(mode).length;
        return store.get(app.scope, mode, total, signature(mode));
    }
    function percent(row) {
        return row.total ? Math.round(Object.keys(row.completed).filter(function (key) {
            return row.completed[key] && Number(key) >= 0 && Number(key) < row.total;
        }).length / row.total * 100) : 0;
    }
    function completedCount(row) { return Math.round(percent(row) * row.total / 100); }
    function currentText() {
        return app.mode === 'puzzle' ? (app.sentences[app.candidates[app.index]] || '') :
            (app.sentences[app.index] || '');
    }
    function stopSpeech() {
        app.micToken++;
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
        if (app.mode !== 'reading' && app.mode !== 'deep') return;
        const mode = app.mode;
        store.record(app.scope, mode, app.index, app.sentences.length, signature(mode),
            {complete:true, attempt:!manual});
        app.feedback = manual ? '自己申告で完了を記録しました。' : '音読完了を記録しました。';
        render();
    }
    function play() {
        if (!currentText()) return;
        if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
            status('このブラウザでは音声読み上げを利用できません。');
            return;
        }
        try {
            window.speechSynthesis.cancel();
            const phrase = new SpeechSynthesisUtterance(currentText());
            phrase.lang = 'en-US';
            phrase.rate = app.rate;
            phrase.onstart = function () {status('再生中…');};
            phrase.onend = function () {status('再生終了。自分でも声に出してみましょう。');};
            phrase.onerror = function () {status('音声再生に失敗しました。端末の音声設定を確認してください。');};
            window.speechSynthesis.speak(phrase);
        } catch (_) { status('音声再生に失敗しました。'); }
    }
    function status(message) {
        const el = document.getElementById('po-audio-status');
        if (el) el.textContent = message;
    }
    function rate(value) {
        const number = Number(value);
        if (Number.isFinite(number) && number >= 0.5 && number <= 1.2) app.rate = number;
        status('音声速度を変更しました。再生ボタンを押してください。');
    }
    function microphone() {
        if (app.mode !== 'reading') return;
        if (app.recognizer) {
            try { app.recognizer.stop(); } catch (_) {}
            status('音声を確認しています…');
            return;
        }
        const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Ctor) {
            status('このブラウザでは音声認識が利用できません。自己申告ボタンでも学習を記録できます。');
            return;
        }
        stopSpeech();
        const token = app.micToken;
        const sentence = currentText();
        const index = app.index, scope = app.scope;
        let recognized = '';
        let error = '';
        const recognizer = new Ctor();
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
            app.recognizer = null;
            if (error || !recognized) {
                status(error ? 'マイクを確認して再試行してください。' : '音声を認識できませんでした。もう一度試してください。');
                return;
            }
            const score = core.transcriptAccuracy(sentence, recognized);
            const wpm = Math.round(core.normalizeWords(recognized).length /
                Math.max(1, (Date.now() - app.micStart) / 1000) * 60);
            if (app.mode !== 'reading' || app.index !== index || app.scope !== scope) return;
            store.record(scope, 'reading', index, app.sentences.length, signature('reading'),
                {attempt:true, accuracy:score, complete:score >= 80});
            app.hearing = '認識した英語：' + recognized;
            app.feedback = '語句一致率 ' + score + '% · 約' + wpm + ' WPM' +
                (score >= 80 ? ' ／ 80%以上でクリア！' : ' ／ 80%以上でクリア（再挑戦できます）');
            render();
        };
        try { recognizer.start(); status('マイクが起動しました。英文を読んでください。'); }
        catch (_) {
            app.recognizer = null;
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
        if (!['readingcheck', 'shadowing', 'vocabulary'].includes(mode) ||
            !Number.isFinite(Number(score))) return false;
        const scope = String(currentLevel) + ':' + String(currentKey);
        const sig = core.fingerprint([dataOf('script'), mode]);
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
        return '<h2>📊 Learning Progress</h2><p class="po-note">選択中：Lesson ' + currentLesson + ' · ' +
            esc(currentKey.split('_')[1] || '') + ' · ' + esc(currentLevel) +
            '。各モードの進捗は端末内に保存します。</p>' +
            '<div class="po-stats">' + scopeBar('1文ずつ音読','reading') +
            scopeBar('じっくり','deep') + scopeBar('リスニングパズル','puzzle') + '</div>' +
            '<h3>Lesson 1–10 の進捗 <small>各Partの最高進捗を集計</small></h3>' +
            '<div class="po-lessons">' + lessonItems.join('') + '</div>' + legacySummary() +
            '<div class="po-action-row"><button onclick="PowerOnPractice.exportCSV()">📥 進捗CSVを保存</button></div>' +
            '<p class="po-note">' + (store.isPersistent() ?
                '保存先：この端末のブラウザ（別端末や教師画面との自動同期はまだありません）。' :
                '注意：ブラウザの保存が利用できないため、記録はこの画面を開いている間だけ保持されます。') +
            ' Lesson 8 の既存ポイント制度は変更しません。進捗は学習操作の記録で、成績や発音の厳密な評価ではありません。</p>';
    }
    function studyBody() {
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
            body = '<div class="po-speech-controls"><button class="po-primary" onclick="PowerOnPractice.play()">▶ この1文を聞く</button>' +
                '<label>速度 <select aria-label="音声速度" onchange="PowerOnPractice.rate(this.value)">' +
                [0.65,0.85,1].map(function (v) {
                    return '<option value="' + v + '"' + (app.rate === v ? ' selected' : '') + '>' +
                        v + '×</option>';
                }).join('') + '</select></label></div>' +
                '<p class="po-audio-status" id="po-audio-status" role="status"></p>' + body;
        }
        display.innerHTML = '<section class="po-practice"><header class="po-heading"><div><span>POWER ON Ⅲ · STUDY LAB</span><h2>' +
            esc(MODES[app.mode]) + '</h2><p>Lesson ' + currentLesson + ' / ' +
            esc(currentKey.split('_')[1] || '') + ' / ' +
            esc(currentKey.split('_')[2] || '') + ' / ' + esc(currentLevel) + '</p></div>' +
            '</header>' + nav() + '<div class="po-content">' + body + '</div></section>';
    }
    function exportCSV() {
        const rows = [['Level','Scope','Mode','Completed','Total','Percent','Attempts','BestWordMatchPercent','LastStudied']];
        const all = store.snapshot().scopes;
        Object.keys(all).sort().forEach(function (key) {
            ['reading','deep','puzzle','readingcheck','shadowing','vocabulary'].forEach(function (mode) {
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
        go:go, play:play, rate:rate, microphone:microphone, markRead:markRead,
        switchJapanese:switchJapanese, chooseCard:chooseCard, undoCard:undoCard,
        checkPuzzle:checkPuzzle, retryPuzzle:retryPuzzle, exportCSV:exportCSV,
        captureLegacy:captureLegacy, getProgress:function () {return store.snapshot();}
    };
})();

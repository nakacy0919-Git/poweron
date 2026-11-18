/* Pure practice helpers. Shared by browser features and Node regression tests. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PowerOnPracticeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const KEY = 'poweron_study_progress_v1';
    const READING_PASS = 75;
    const readingMode=mode=>mode==='reading'||mode==='sceneReading';
    function promoteReadingScores(entry){if(!entry||!Number.isInteger(entry.total)||entry.total<1||entry.total>250)return false;let changed=false;for(const [k,score] of Object.entries(entry.scores||{})){const index=Number(k);if(Number.isInteger(index)&&String(index)===k&&index>=0&&index<entry.total&&Number.isFinite(score)&&score>=READING_PASS&&score<=100&&!entry.completed?.[k]){if(!entry.completed||typeof entry.completed!=='object')entry.completed={};entry.completed[k]=true;changed=true;}}return changed;}
    const MODES = ['reading', 'deep', 'puzzle', 'readingcheck', 'shadowing', 'vocabulary', 'slides', 'sceneReading', 'listening', 'vocabEnJa', 'vocabJaEn', 'vocabVoice', 'storyPuzzle', 'storyRandom', 'storyListen', 'compEn', 'compJa', 'contextVocab'];

    function splitSentences(value) {
        const source = String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ').trim();
        if (!source) return [];
        const items = [];
        let start = 0;
        for (let i = 0; i < source.length; i++) {
            if (!/[.!?]/.test(source[i])) continue;
            const prev = source.slice(start, i + 1).trim();
            // In Lesson 8 paragraph 7, U.S. ends a sentence rather than merely abbreviating a country.
            if (/\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|U\.S|U\.K)\.$/i.test(prev) && !(/\bU\.S\.$/i.test(prev) && /^\s+So Harriet led her followers to Canada\b/.test(source.slice(i + 1)))) continue;
            if (source[i] === '.' && /^\d{1,2}\.$/.test(prev)) continue; // numbered questions
            if (source[i] === '.' && /\d/.test(source[i-1] || '') && /\d/.test(source[i+1] || '')) continue;
            let end = i + 1;
            while (end < source.length && /["'”’)\]]/.test(source[end])) end++;
            if (end < source.length && !/\s/.test(source[end])) continue;
            items.push(source.slice(start, end).trim());
            start = end;
            i = end - 1;
        }
        if (source.slice(start).trim()) items.push(source.slice(start).trim());
        return items.filter(Boolean);
    }

    const LESSON8_SCENE_SIZES = Object.freeze({
        L08_P1_p1: Object.freeze([2, 2]),
        L08_P1_p2: Object.freeze([1, 2, 2, 1, 2, 1]),
        L08_P2_p3: Object.freeze([2, 2, 2]),
        L08_P2_p4: Object.freeze([1, 2]),
        L08_P2_p5: Object.freeze([1, 3, 1, 2, 2, 2, 1]),
        L08_P3_p6: Object.freeze([2, 2, 2, 1]),
        L08_P3_p7: Object.freeze([1, 1]),
        L08_P3_p8: Object.freeze([2, 1]),
        L08_P4_p9: Object.freeze([2]),
        L08_P4_p10: Object.freeze([2, 1, 1])
    });

    // Lesson 9 Part 1: seven illustrated scenes (2 in paragraph 1, 5 in paragraph 2).
    const LESSON9_SCENE_SIZES = Object.freeze({
        L09_P1_p1: Object.freeze([2, 1]),
        L09_P1_p2: Object.freeze([1, 1, 2, 1, 2])
    });
    const CURATED_SCENE_SIZES = Object.freeze({...LESSON8_SCENE_SIZES, ...LESSON9_SCENE_SIZES});

    function buildScenes(paragraphs, split, sceneSizes) {
        const result = [];
        for (const paragraph of paragraphs) {
            const sentences = split(paragraph.english);
            const requested = sceneSizes && sceneSizes[paragraph.key];
            const fixed = Array.isArray(requested) && requested.every(n => Number.isInteger(n) && n >= 1 && n <= 3) &&
                requested.reduce((sum,n) => sum+n,0) === sentences.length ? requested : null;
            let offset = 0, group = 0;
            while (offset < sentences.length) {
                const first = sentences[offset], second = sentences[offset + 1];
                // Keep long sentences by themselves, and never span paragraph boundaries.
                const size = fixed ? fixed[group++] : (second && (first + ' ' + second).trim().split(/\s+/).length <= 32 ? 2 : 1);
                const selected = sentences.slice(offset, offset + size);
                const index = offset + 1;
                result.push({
                    id: paragraph.key + '_s' + String(index).padStart(2, '0'),
                    paragraphKey: paragraph.key, paragraph: paragraph.number,
                    firstSentence: index, lastSentence: index + size - 1,
                    sentences: selected, english: selected.join(' '),
                    japanese: paragraph.japanese || ''
                });
                offset += size;
            }
        }
        return result;
    }

    function fingerprint(sentences) {
        let hash = 2166136261;
        const data = sentences.join('\u241e');
        for (let i = 0; i < data.length; i++) {
            hash ^= data.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function normalizeWords(text) {
        return String(text || '').toLowerCase().replace(/[’‘]/g, "'")
            .replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    }

    function transcriptAccuracy(expected, heard) {
        const a = normalizeWords(expected), b = normalizeWords(heard);
        if (!a.length) return 0;
        const last = new Uint16Array(a.length + 1);
        for (let i = b.length - 1; i >= 0; i--) {
            let diagonal = 0;
            for (let j = a.length - 1; j >= 0; j--) {
                const next = last[j];
                last[j] = b[i] === a[j] ? diagonal + 1 : Math.max(last[j], last[j + 1]);
                diagonal = next;
            }
        }
        return Math.round(100 * last[0] / a.length);
    }

    function makePuzzle(sentence, random) {
        const words = String(sentence || '').trim().split(/\s+/).filter(Boolean);
        if (words.length < 4) return null;
        const groupSize = Math.max(1, Math.ceil(words.length / 7));
        const ordered = [];
        for (let i = 0; i < words.length; i += groupSize) {
            ordered.push({id: String(ordered.length), text: words.slice(i, i + groupSize).join(' ')});
        }
        if (ordered.length < 3) return null;
        const cards = ordered.map(c => ({id:c.id, text:c.text}));
        const rng = typeof random === 'function' ? random : Math.random;
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.max(0, Math.min(i, Math.floor(Number(rng()) * (i + 1)) || 0));
            const tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
        }
        if (cards.every((c,i) => c.id === ordered[i].id))
            cards.push(cards.shift());
        return {ordered:ordered, cards:cards};
    }

    function puzzleCorrect(puzzle, selectedIds) {
        return !!puzzle && Array.isArray(selectedIds) &&
            puzzle.ordered.length === selectedIds.length &&
            puzzle.ordered.every((card, i) => card.id === selectedIds[i]);
    }

    // Historical personal bests for Story Match must survive material revisions.
    // Do not reassign a previous scene's completion to different text/images:
    // preserve the original fingerprinted record, and aggregate only best scores.
    const PROTECTED_MODES=new Set(['sceneReading','storyPuzzle','storyRandom','storyListen']);
    const safeMetric=(value)=>Number.isFinite(value)&&value>=0?value:null;
    function createProgressStore(storage, storageKey) {
        const keyName=storageKey||KEY;
        let state={version:1,scopes:{},archives:{}},persisted=false;
        try{
            const raw=storage&&storage.getItem(keyName);
            if(raw){
                const parsed=JSON.parse(raw);
                if(parsed&&parsed.version===1&&parsed.scopes&&typeof parsed.scopes==='object'&&!Array.isArray(parsed.scopes)){
                    state=parsed;
                    if(!state.archives||typeof state.archives!=='object'||Array.isArray(state.archives))state.archives={};
                }
            }
            persisted=!!storage;
            let changed=false;
            for(const scope of Object.values(state.scopes)){
                if(scope&&typeof scope==='object')for(const mode of ['reading','sceneReading'])
                    if(promoteReadingScores(scope[mode]))changed=true;
            }
            for(const scoped of Object.values(state.archives)){
                if(!scoped||typeof scoped!=='object')continue;
                for(const mode of ['sceneReading']){
                    for(const version of Object.values(scoped[mode]||{}))
                        if(promoteReadingScores(version))changed=true;
                }
            }
            if(changed&&storage)storage.setItem(keyName,JSON.stringify(state));
        }catch(_){persisted=false;}
        function recordKey(total,fingerprint){
            return 'v'+total+':'+String(fingerprint);
        }
        function modeArchives(scope,mode,create){
            const scoped=state.archives?.[scope];
            if(!create)return scoped?.[mode]||{};
            if(!state.archives||typeof state.archives!=='object')state.archives={};
            if(!state.archives[scope]||typeof state.archives[scope]!=='object')state.archives[scope]={};
            if(!state.archives[scope][mode]||typeof state.archives[scope][mode]!=='object')state.archives[scope][mode]={};
            return state.archives[scope][mode];
        }
        function activeRecord(scope,mode){
            return state.scopes[scope]&&typeof state.scopes[scope]==='object'&&state.scopes[scope][mode];
        }
        function matching(row,count,sig){
            return !!row&&row.fingerprint===sig&&row.total===count;
        }
        function archivedVersions(scope,mode){
            const archived=Object.values(modeArchives(scope,mode,false));
            const current=activeRecord(scope,mode);
            return current?[current,...archived]:archived;
        }
        function personalBest(scope,mode){
            if(!PROTECTED_MODES.has(mode))return null;
            let bestAccuracy=null,bestPoints=null,bestSeconds=null;
            const bestByLevel={},bestByCount={};
            for(const entry of archivedVersions(scope,mode)){
                if(!entry||typeof entry!=='object')continue;
                const accuracy=safeMetric(entry.bestAccuracy),points=safeMetric(entry.bestPoints),
                    seconds=safeMetric(entry.bestSeconds);
                if(accuracy!==null)bestAccuracy=Math.max(bestAccuracy??0,accuracy);
                if(points!==null)bestPoints=Math.max(bestPoints??0,points);
                if(seconds!==null)bestSeconds=Math.min(bestSeconds??Infinity,seconds);
                for(const [level,value] of Object.entries(entry.bestByLevel||{})){
                    const n=safeMetric(value);
                    if(n!==null)bestByLevel[level]=Math.min(bestByLevel[level]??Infinity,n);
                }
                for(const [count,value] of Object.entries(entry.bestByCount||{})){
                    const n=safeMetric(value);
                    if(n!==null)bestByCount[count]=Math.max(bestByCount[count]??0,n);
                }
            }
            return {bestAccuracy,bestPoints,bestSeconds,bestByLevel,bestByCount};
        }
        function read(scope,mode,count,sig){
            const current=activeRecord(scope,mode);
            const previous=matching(current,count,sig)?current:
                PROTECTED_MODES.has(mode)?modeArchives(scope,mode,false)[recordKey(count,sig)]:null;
            const matches=matching(previous,count,sig);
            const result={
                total:count,
                completed:matches&&previous.completed&&typeof previous.completed==='object'?{...previous.completed}:{},
                attempts:matches?(Number(previous.attempts)||0):0,
                bestAccuracy:matches&&safeMetric(previous.bestAccuracy)!==null?previous.bestAccuracy:null,
                lastAt:matches?previous.lastAt||null:null,
                bestPoints:matches&&safeMetric(previous.bestPoints)!==null?previous.bestPoints:null,
                bestSeconds:matches&&safeMetric(previous.bestSeconds)!==null?previous.bestSeconds:null,
                bestByLevel:matches?Object.assign({},previous.bestByLevel||{}):{},
                bestByCount:matches?Object.assign({},previous.bestByCount||{}):{},
                scores:matches?Object.assign({},previous.scores||{}):{},
                counts:matches?Object.assign({},previous.counts||{}):{}
            };
            // Historic bests remain visible across fingerprint changes, but
            // current-scene completion and indexed reading scores do NOT migrate.
            const best=personalBest(scope,mode);
            if(best)Object.assign(result,best);
            return result;
        }
        function record(scope,mode,index,count,sig,options){
            if(!MODES.includes(mode)||!/^(?:standard|pre1|grade1):L\d{2}_P\d+_(?:full|p\d+)$/.test(scope)||
                !Number.isInteger(index)||index<0||index>=count||count>250)return false;
            options=options||{};
            const current=activeRecord(scope,mode);
            const protectedMode=PROTECTED_MODES.has(mode);
            // Archive FIRST, then replace the active version. Never discard
            // previously completed scenes or best scores on source revisions.
            if(protectedMode&&current&&!matching(current,count,sig)&&
                Number.isInteger(current.total)&&current.total>0&&current.fingerprint!=null){
                modeArchives(scope,mode,true)[recordKey(current.total,current.fingerprint)]=current;
            }
            const entry=read(scope,mode,count,sig);
            if(options.complete||(readingMode(mode)&&Number.isFinite(options.accuracy)&&options.accuracy>=READING_PASS))
                entry.completed[index]=true;
            if(options.attempt)entry.attempts+=1;
            if(Number.isFinite(options.points)&&options.points>=0){
                if(Number.isInteger(options.questionCount)&&options.questionCount>0&&options.questionCount<=250){
                    entry.bestByCount[options.questionCount]=
                        Math.max(entry.bestByCount[options.questionCount]||0,options.points);
                }
                if(options.full!==false)entry.bestPoints=Math.max(entry.bestPoints||0,options.points);
            }
            if(Number.isFinite(options.seconds)&&options.seconds>=0){
                if([1,2,3].includes(options.gameLevel))
                    entry.bestByLevel[options.gameLevel]=Math.min(entry.bestByLevel[options.gameLevel]??Infinity,options.seconds);
                if(!options.gameLevel||options.gameLevel===3)
                    entry.bestSeconds=Math.min(entry.bestSeconds??Infinity,options.seconds);
            }
            if(!entry.scores||typeof entry.scores!=='object')entry.scores={};
            if(!entry.counts||typeof entry.counts!=='object')entry.counts={};
            if(Number.isFinite(options.accuracy)){
                const accuracy=Math.min(100,Math.max(0,Math.round(options.accuracy)));
                entry.scores[index]=Math.max(entry.scores[index]||0,accuracy);
                entry.bestAccuracy=Math.max(entry.bestAccuracy??0,accuracy);
            }
            if(options.listen){
                entry.counts[index]=(Number(entry.counts[index])||0)+1;
                if(entry.counts[index]>=3)entry.completed[index]=true;
            }
            entry.fingerprint=sig;
            entry.lastAt=new Date().toISOString();
            if(!state.scopes[scope]||typeof state.scopes[scope]!=='object'||Array.isArray(state.scopes[scope]))
                state.scopes[scope]={};
            state.scopes[scope][mode]=entry;
            try{
                if(storage){
                    storage.setItem(keyName,JSON.stringify(state));
                    persisted=true;
                }else persisted=false;
            }catch(_){persisted=false;}
            return true;
        }
        return {
            get:read,record:record,
            snapshot:function(){return JSON.parse(JSON.stringify(state));},
            personalBest:personalBest,
            history:function(scope,mode){
                if(!PROTECTED_MODES.has(mode))return [];
                return archivedVersions(scope,mode).filter(Boolean).map(x=>JSON.parse(JSON.stringify(x)));
            },
            isPersistent:function(){return persisted;},key:keyName
        };
    }
    return {READING_PASS,splitSentences:splitSentences, buildScenes:buildScenes, LESSON8_SCENE_SIZES:LESSON8_SCENE_SIZES, LESSON9_SCENE_SIZES:LESSON9_SCENE_SIZES, CURATED_SCENE_SIZES:CURATED_SCENE_SIZES, fingerprint:fingerprint, normalizeWords:normalizeWords,
        transcriptAccuracy:transcriptAccuracy, makePuzzle:makePuzzle, puzzleCorrect:puzzleCorrect,
        createProgressStore:createProgressStore};
});

/* Pure practice helpers. Shared by browser features and Node regression tests. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PowerOnPracticeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const KEY = 'poweron_study_progress_v1';
    const MODES = ['reading', 'deep', 'puzzle', 'readingcheck', 'shadowing', 'vocabulary', 'slides', 'sceneReading', 'listening', 'vocabEnJa', 'vocabJaEn', 'vocabVoice', 'storyPuzzle', 'storyRandom', 'storyListen'];

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

    function createProgressStore(storage, storageKey) {
        const keyName = storageKey || KEY;
        let state = {version:1, scopes:{}};
        let persisted = false;
        try {
            const raw = storage && storage.getItem(keyName);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 1 && parsed.scopes && typeof parsed.scopes === 'object' &&
                    !Array.isArray(parsed.scopes)) state = parsed;
            }
            persisted = !!storage;
        } catch (_) { persisted = false; }
        function read(scope, mode, count, sig) {
            const previous = state.scopes[scope] && typeof state.scopes[scope]==='object' && state.scopes[scope][mode];
            if (!MODES.includes(mode) || !previous || previous.fingerprint !== sig ||
                previous.total !== count) return {total:count, completed:{}, attempts:0, bestAccuracy:null};
            return {
                total:count,
                completed:previous.completed && typeof previous.completed === 'object' ? previous.completed : {},
                attempts:Number(previous.attempts) || 0,
                bestAccuracy:Number.isFinite(previous.bestAccuracy) ? previous.bestAccuracy : null,
                lastAt:previous.lastAt || null,
                bestPoints:Number.isFinite(previous.bestPoints)?previous.bestPoints:null,bestSeconds:Number.isFinite(previous.bestSeconds)?previous.bestSeconds:null,bestByLevel:Object.assign({},previous.bestByLevel||{}),bestByCount:Object.assign({},previous.bestByCount||{}),
                scores:Object.assign({}, previous.scores || {}), counts:Object.assign({}, previous.counts || {})
            };
        }
        function record(scope, mode, index, count, sig, options) {
            if (!MODES.includes(mode) || !/^(?:standard|pre1|grade1):L\d{2}_P\d+_(?:full|p\d+)$/.test(scope) ||
                !Number.isInteger(index) || index < 0 || index >= count || count > 250) return false;
            const entry = read(scope, mode, count, sig);
            options = options || {};
            if (options.complete) entry.completed[index] = true;
            if (options.attempt) entry.attempts += 1;
            if(Number.isFinite(options.points)&&options.points>=0){if(Number.isInteger(options.questionCount)&&options.questionCount>0&&options.questionCount<=250){entry.bestByCount=entry.bestByCount||{};entry.bestByCount[options.questionCount]=Math.max(entry.bestByCount[options.questionCount]||0,options.points);}if(options.full!==false)entry.bestPoints=Math.max(entry.bestPoints||0,options.points);}
            if(Number.isFinite(options.seconds)&&options.seconds>=0){if([1,2,3].includes(options.gameLevel)){entry.bestByLevel=entry.bestByLevel||{};entry.bestByLevel[options.gameLevel]=Math.min(entry.bestByLevel[options.gameLevel]??Infinity,options.seconds);}if(!options.gameLevel||options.gameLevel===3)entry.bestSeconds=Math.min(entry.bestSeconds==null?Infinity:entry.bestSeconds,options.seconds);}
            entry.scores = entry.scores || {}; entry.counts = entry.counts || {};
            if (Number.isFinite(options.accuracy)) entry.scores[index] = Math.max(entry.scores[index] || 0, Math.min(100, Math.max(0, Math.round(options.accuracy))));
            if (options.listen) {entry.counts[index] = (Number(entry.counts[index]) || 0) + 1; if (entry.counts[index] >= 3) entry.completed[index] = true;}
            if (Number.isFinite(options.accuracy))
                entry.bestAccuracy = Math.max(entry.bestAccuracy === null ? 0 : entry.bestAccuracy,
                    Math.min(100, Math.max(0, Math.round(options.accuracy))));
            entry.fingerprint = sig;
            entry.lastAt = new Date().toISOString();
            if (!state.scopes[scope]||typeof state.scopes[scope]!=='object'||Array.isArray(state.scopes[scope])) state.scopes[scope] = {};
            state.scopes[scope][mode] = entry;
            try {
                if (storage) {
                    storage.setItem(keyName, JSON.stringify(state));
                    persisted = true;
                } else persisted = false;
            } catch (_) { persisted = false; }
            return true;
        }
        return {
            get:read, record:record, snapshot:function(){return JSON.parse(JSON.stringify(state));},
            isPersistent:function(){return persisted;}, key:keyName
        };
    }
    return {splitSentences:splitSentences, buildScenes:buildScenes, LESSON8_SCENE_SIZES:LESSON8_SCENE_SIZES, fingerprint:fingerprint, normalizeWords:normalizeWords,
        transcriptAccuracy:transcriptAccuracy, makePuzzle:makePuzzle, puzzleCorrect:puzzleCorrect,
        createProgressStore:createProgressStore};
});

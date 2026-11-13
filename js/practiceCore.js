/* Pure practice helpers. Shared by browser features and Node regression tests. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PowerOnPracticeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const KEY = 'poweron_study_progress_v1';
    const MODES = ['reading', 'deep', 'puzzle', 'readingcheck', 'shadowing', 'vocabulary'];

    function splitSentences(value) {
        const source = String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ').trim();
        if (!source) return [];
        const items = [];
        let start = 0;
        for (let i = 0; i < source.length; i++) {
            if (!/[.!?]/.test(source[i])) continue;
            const prev = source.slice(start, i + 1).trim();
            if (/\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|U\.S|U\.K)\.$/i.test(prev)) continue;
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

    function createProgressStore(storage) {
        let state = {version:1, scopes:{}};
        let persisted = false;
        try {
            const raw = storage && storage.getItem(KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 1 && parsed.scopes && typeof parsed.scopes === 'object' &&
                    !Array.isArray(parsed.scopes)) state = parsed;
            }
            persisted = !!storage;
        } catch (_) { persisted = false; }
        function read(scope, mode, count, sig) {
            const previous = state.scopes[scope] && state.scopes[scope][mode];
            if (!MODES.includes(mode) || !previous || previous.fingerprint !== sig ||
                previous.total !== count) return {total:count, completed:{}, attempts:0, bestAccuracy:null};
            return {
                total:count,
                completed:previous.completed && typeof previous.completed === 'object' ? previous.completed : {},
                attempts:Number(previous.attempts) || 0,
                bestAccuracy:Number.isFinite(previous.bestAccuracy) ? previous.bestAccuracy : null,
                lastAt:previous.lastAt || null
            };
        }
        function record(scope, mode, index, count, sig, options) {
            if (!MODES.includes(mode) || !/^(?:standard|pre1|grade1):L\d{2}_P\d+_(?:full|p\d+)$/.test(scope) ||
                !Number.isInteger(index) || index < 0 || index >= count || count > 250) return false;
            const entry = read(scope, mode, count, sig);
            options = options || {};
            if (options.complete) entry.completed[index] = true;
            if (options.attempt) entry.attempts += 1;
            if (Number.isFinite(options.accuracy))
                entry.bestAccuracy = Math.max(entry.bestAccuracy === null ? 0 : entry.bestAccuracy,
                    Math.min(100, Math.max(0, Math.round(options.accuracy))));
            entry.fingerprint = sig;
            entry.lastAt = new Date().toISOString();
            if (!state.scopes[scope]) state.scopes[scope] = {};
            state.scopes[scope][mode] = entry;
            try {
                if (storage) {
                    storage.setItem(KEY, JSON.stringify(state));
                    persisted = true;
                } else persisted = false;
            } catch (_) { persisted = false; }
            return true;
        }
        return {
            get:read, record:record, snapshot:function(){return JSON.parse(JSON.stringify(state));},
            isPersistent:function(){return persisted;}, key:KEY
        };
    }
    return {splitSentences:splitSentences, fingerprint:fingerprint, normalizeWords:normalizeWords,
        transcriptAccuracy:transcriptAccuracy, makePuzzle:makePuzzle, puzzleCorrect:puzzleCorrect,
        createProgressStore:createProgressStore};
});

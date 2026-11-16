// Lesson 8 P-point progress: browser-local only (no names, no server transmission).
// All limits are intentionally centralized for future classroom adjustments.
const lesson8QuizProgress = (() => {
    const STORAGE_KEY = 'poweron.lesson8.quizProgress.v1';
    const POINTS_PER_FAST_CORRECT = 10;
    const POINT_WINDOW_MS = 2000;
    const CLEAR_RATE = 0.60;
    let memoryBackup = null;

    function partFromKey(key) {
        const match = /^L08_P([1-4])(?:_|$)/.exec(String(key || ''));
        return match ? 'L08_P' + match[1] : null;
    }

    function isPointsMode(key, mode) {
        return Boolean(partFromKey(key)) && (mode === 1 || mode === 3);
    }

    function targetForCount(count) {
        return Math.ceil(Math.max(0, count) * CLEAR_RATE) * POINTS_PER_FAST_CORRECT;
    }

    function maxForCount(count) {
        return Math.max(0, count) * POINTS_PER_FAST_CORRECT;
    }

    function numberOrZero(value) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }

    function emptyState() {
        return { version: 1, records: {} };
    }

    function read() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 1 && parsed.records &&
                    typeof parsed.records === 'object' && !Array.isArray(parsed.records)) {
                    return parsed;
                }
            }
        } catch (_) {
            // Private browsing, disabled storage, corrupted JSON: use session memory.
        }
        return memoryBackup || emptyState();
    }

    function write(value) {
        memoryBackup = value;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function get(partKey, mode) {
        const key = partFromKey(partKey);
        if (!key) return { attempts: 0, bestPoints: 0, lastPoints: 0, bestCorrect: 0, lastCorrect: 0, history: [] };
        const raw = read().records[key + ':' + mode] || {};
        return {
            attempts: numberOrZero(raw.attempts),
            bestPoints: numberOrZero(raw.bestPoints),
            lastPoints: numberOrZero(raw.lastPoints),
            bestCorrect: numberOrZero(raw.bestCorrect),
            lastCorrect: numberOrZero(raw.lastCorrect),
            history: Array.isArray(raw.history) ? raw.history.slice(-10) : []
        };
    }

    function unlockedReverse(partKey, questionCount) {
        const key = partFromKey(partKey);
        return !!key && get(key, 1).bestPoints >= targetForCount(questionCount);
    }

    function save(partKey, mode, result) {
        const key = partFromKey(partKey);
        if (!key || ![1, 2, 3].includes(mode)) return null;
        const count = numberOrZero(result.questionCount);
        const points = isPointsMode(key, mode)
            ? Math.min(maxForCount(count), numberOrZero(result.points))
            : 0;
        const correct = Math.min(count, numberOrZero(result.correct));
        const state = read();
        const id = key + ':' + mode;
        const previous = get(key, mode);
        const entry = {
            at: new Date().toISOString(),
            points,
            correct,
            questions: count
        };
        const next = {
            attempts: previous.attempts + 1,
            bestPoints: Math.max(previous.bestPoints, points),
            lastPoints: points,
            bestCorrect: Math.max(previous.bestCorrect, correct),
            lastCorrect: correct,
            history: previous.history.concat(entry).slice(-10)
        };
        state.records[id] = next;
        const persisted = write(state);
        return { ...next, persisted };
    }

    return {
        STORAGE_KEY,
        POINTS_PER_FAST_CORRECT,
        POINT_WINDOW_MS,
        CLEAR_RATE,
        partFromKey,
        isPointsMode,
        targetForCount,
        maxForCount,
        get,
        unlockedReverse,
        save
    };
})();
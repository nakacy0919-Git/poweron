/* Adapted from Story Match readingNumbers, readingNames, readingScore, readingSpeechController and sound. */
(function(root){'use strict';
// Numeric comparison units from Copeak grammar-practice-engine.js.
const SMALL = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
});
const TENS = Object.freeze({
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
});
const ORD = Object.freeze({
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  fortieth: 40,
  fiftieth: 50,
  sixtieth: 60,
  seventieth: 70,
  eightieth: 80,
  ninetieth: 90,
});
const SCALE = Object.freeze({
  thousand: 1000,
  million: 1000000,
  billion: 1000000000,
});
const YEAR_PREFIX = Object.freeze({
  seventeen: 1700,
  eighteen: 1800,
  nineteen: 1900,
  twenty: 2000,
});
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function rawWords(text) {
  return (
    String(text || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (match) => match.replace(/,/g, ""))
      .replace(/(\d(?:\.\d+)?)\s*%/g, "$1 percent")
      .match(/\d+(?:\.\d+)?(?:st|nd|rd|th|s)?|[a-z]+/g) || []
  );
}
function numericKey(value, ordinal = false) {
  const numeric = Number(value);
  return (
    "@number:" +
    ((Number.isFinite(numeric) && Number.isSafeInteger(numeric)) ||
    (Number.isFinite(numeric) && String(value).includes("."))
      ? String(numeric)
      : String(value)) +
    (ordinal ? ":ordinal" : "")
  );
}
function literalNumber(token) {
  // Numeric plurals such as 8s are read aloud as "eights".
  const plural = /^(\d+)s$/.exec(token);
  if (plural) return numericKey(plural[1]) + ":plural";
  const match = /^(\d+(?:\.\d+)?)(st|nd|rd|th)?$/.exec(token);
  return match ? numericKey(match[1], !!match[2]) : null;
}
function cardinalValue(token) {
  return own(SMALL, token)
    ? SMALL[token]
    : own(TENS, token)
      ? TENS[token]
      : null;
}
function numberPhrase(tokens, start) {
  const plurals = { zeros: 0, ones: 1, twos: 2, threes: 3, fours: 4,
    fives: 5, sixes: 6, sevens: 7, eights: 8, nines: 9, tens: 10 };
  if (own(plurals, tokens[start])) {
    return { end: start + 1, key: numericKey(plurals[tokens[start]]) + ":plural" };
  }
  // "twenty twenty-six" and "nineteen ninety-nine" are common year readings.
  const prefix = YEAR_PREFIX[tokens[start]];
  const next = cardinalValue(tokens[start + 1]);
  if (prefix !== undefined && next !== null && next >= 10) {
    let value = next,
      end = start + 2;
    if (
      next >= 20 &&
      next % 10 === 0 &&
      end < tokens.length &&
      own(SMALL, tokens[end]) &&
      SMALL[tokens[end]] > 0 &&
      SMALL[tokens[end]] < 10
    ) {
      value += SMALL[tokens[end]];
      end++;
    }
    return { end, key: numericKey(prefix + value) };
  }
  let total = 0,
    group = 0,
    seen = false,
    ordinal = false,
    previous = "start",
    i = start;
  if (
    tokens[i] === "a" &&
    (tokens[i + 1] === "hundred" || own(SCALE, tokens[i + 1]))
  ) {
    group = 1;
    seen = true;
    previous = "unit";
    i++;
  }
  for (; i < tokens.length; i++) {
    const word = tokens[i],
      small = cardinalValue(word),
      ord = own(ORD, word) ? ORD[word] : null;
    if (word === "point") {
      if (!seen) break;
      let j = i + 1,
        decimals = "";
      while (j < tokens.length) {
        const digit = own(SMALL, tokens[j]) ? SMALL[tokens[j]] : null;
        if (digit === null || digit > 9) break;
        decimals += String(digit);
        j++;
      }
      if (!decimals) break;
      return {
        end: j,
        key: numericKey(String(total + group) + "." + decimals),
      };
    }
    if (word === "and") {
      if (
        !["hundred", "scale"].includes(previous) ||
        (cardinalValue(tokens[i + 1]) === null && !own(ORD, tokens[i + 1]))
      )
        break;
      previous = "and";
      continue;
    }
    if (word === "hundred" || word === "hundredth") {
      if (!seen || !["unit", "tens"].includes(previous)) break;
      group *= 100;
      previous = "hundred";
      if (word === "hundredth") {
        ordinal = true;
        i++;
        break;
      }
      continue;
    }
    const scale = own(SCALE, word)
      ? SCALE[word]
      : word === "thousandth"
        ? 1000
        : null;
    if (scale !== null) {
      if (!seen || !["unit", "tens", "hundred"].includes(previous)) break;
      total += group * scale;
      group = 0;
      previous = "scale";
      if (word.endsWith("th")) {
        ordinal = true;
        i++;
        break;
      }
      continue;
    }
    if (small === null && ord === null) break;
    const number = ord === null ? small : ord;
    if (previous === "unit" || previous === "ordinal") break;
    if (previous === "tens" && !(number > 0 && number < 10)) break;
    if (previous === "tens") group += number;
    else group += number;
    seen = true;
    previous =
      ord !== null
        ? "ordinal"
        : number >= 20 && number % 10 === 0
          ? "tens"
          : "unit";
    if (ord !== null) {
      ordinal = true;
      i++;
      break;
    }
  }
  return seen ? { end: i, key: numericKey(total + group, ordinal) } : null;
}
function units(text) {
  const tokens = rawWords(text),
    result = [];
  for (let i = 0; i < tokens.length; ) {
    const raw = tokens[i],
      literal = literalNumber(raw);
    if (literal) {
      result.push({ key: literal, display: [raw] });
      i++;
      continue;
    }
    const phrase = numberPhrase(tokens, i);
    if (phrase && phrase.end > i) {
      result.push({ key: phrase.key, display: tokens.slice(i, phrase.end) });
      i = phrase.end;
      continue;
    }
    result.push({ key: raw, display: [raw] });
    i++;
  }
  return result;
}


// Reviewed people, places, institutions and named works in the 15 story units.
// Keep ordinary sentence-initial words (and ordinary uses of "mark") scored.
const readingNames = [
  "Internet",
  "Colin",
  "Ann",
  "Takashi",
  "America",
  "Japan",
  "James Lind",
  "Dr. Lind",
  "Lind",
  "British",
  "Mark",
  "Tom",
  "Terry Fox",
  "Terry",
  "Canada",
  "The Terry Fox Run",
  "Marathon of Hope",
  "April",
  "England",
  "China",
  "Europe",
  "U.S.",
  "U. S.",
  "Western",
  "Major League Baseball",
  "Take Me Out to the Ball Game",
  "Bible",
  "God",
  "Seven Seas",
  "Seven Continents",
  "Chinese",
  "Ethiopia",
  "Angola",
  "Celina",
  "UNICEF",
  "New Year’s",
  "New Year's",
  "Harriet Tubman", "Harriet", "Tubman", "Philadelphia", "Maryland", "St. Catharines", "Underground Railroad", "Queen Victoria", "Victoria", "Auburn", "New York", "United States", "Civil War",
];
/* Story Match word accuracy: Copeak numeric normalization and reviewed name exclusions. */



const numericDigitKey = digit => "@number:" + Number(digit);
function normalized(text) {
  let value = String(text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'");
  const contractions = {
    "can't": "cannot",
    "won't": "will not",
    "I'm": "I am",
    "i'm": "i am",
    "you're": "you are",
    "it's": "it is",
    "that's": "that is",
    "I've": "I have",
    "i've": "i have",
  };
  for (const [from, to] of Object.entries(contractions))
    value = value.split(from).join(to);
  return value.replace(
    /\b(does|do|did|is|are|was|were|could|would|should|have|has|had|must)n't\b/gi,
    "$1 not",
  );
}
function words(text) {
  return units(normalized(text)).map((x) => x.key);
}
// Foreign phrases written in Latin letters cannot be reliably detected from
// spelling alone. Only reviewed phrases are excluded; ordinary English stays scored.
const foreignPhrases = [
  "bonjour", "merci", "hola", "gracias", "adios", "adiós",
  "buenos días", "buenos dias", "guten tag", "namaste",
  "konnichiwa", "arigatou", "arigato", "sayonara", "ni hao",
  "xin chào", "xin chao", "annyeong", "sawasdee",
];
const IGNORE_KEY = "qzxomittedwordqzx";
const unicodeWord = /[\p{L}\p{M}\p{N}]/u;

function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
function addIgnoredSpan(spans, start, end) {
  if (start >= end || spans.some((s) => start < s.end && end > s.start))
    return;
  spans.push({ start, end });
}
function hasNonAsciiLetter(text) {
  return Array.from(text).some((char) => char.codePointAt(0) > 127);
}
function protectedSpans(sentence) {
  const source = String(sentence || "");
  const spans = [];

  // Prefer complete, manually reviewed names and titles. Match case and word
  // boundaries so ordinary "mark" is never mistaken for the name "Mark".
  for (const phrase of [...readingNames, ...foreignPhrases].sort(
    (x, y) => y.length - x.length,
  )) {
    const pattern = new RegExp(
      escapeRegex(phrase).replace(/['’]/g, "['’]"),
      readingNames.includes(phrase) ? "gu" : "giu",
    );
    for (const found of source.matchAll(pattern)) {
      const start = found.index;
      let end = start + found[0].length;
      // Proper-name possessives (Celina’s, Terry's) form one optional span.
      if (readingNames.includes(phrase) && /^['’]s\b/u.test(source.slice(end)))
        end += 2;
      if (
        !unicodeWord.test(source[start - 1] || "") &&
        !unicodeWord.test(source[end] || "")
      )
        addIgnoredSpan(spans, start, end);
    }
  }

  // Kanji/kana/Hangul/etc. followed by a phonetic hint in parentheses:
  // 八 (bā), 漢字 (kanji), 日本語 (nihongo). Ignore the hint too.
  const romanization = /\(\s*[\p{L}\p{M}]+(?:[\s'-][\p{L}\p{M}]+)*\s*\)/gu;
  for (const match of source.matchAll(romanization)) {
    const preceding = source.slice(0, match.index).trimEnd();
    const previousWord = preceding.match(/[\p{L}\p{M}]+$/u)?.[0] || "";
    if (hasNonAsciiLetter(previousWord))
      addIgnoredSpan(spans, match.index, match.index + match[0].length);
  }

  const tokens = [...source.matchAll(
    /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu,
  )];
  const isTitle = (word) => /^[A-Z][a-z]+$/.test(word);
  const sentenceStart = (start) => {
    const preceding = source.slice(0, start)
      .replace(/[\s"'“”‘’()[\]{}]+$/gu, "");
    return !preceding || /[.!?:]$/.test(preceding);
  };
  const ordinaryCapitalizedWords = new Set(["English"]);
  const starterWords = new Set([
    "a", "an", "the", "i", "we", "you", "he", "she", "it",
    "they", "in", "on", "at", "to", "from", "for", "of",
    "with", "as", "by", "and", "but", "or", "so", "if",
    "when", "while", "after", "before", "because", "however",
    "today", "yesterday", "tomorrow", "then", "now", "once",
    "this", "that", "these", "those", "there", "here",
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], word = token[0], start = token.index;
    const end = start + word.length;
    const letters = word.replace(/['’-]/g, "");
    // All non-ASCII words/characters are not English-only score targets.
    // This includes Han characters and accented foreign-language words.
    if (hasNonAsciiLetter(letters)) {
      addIgnoredSpan(spans, start, end);
      continue;
    }
    if (word === "I" || ordinaryCapitalizedWords.has(word)) continue;
    const titled = isTitle(word);
    const acronym = /^[A-Z]{2,}$/.test(word);
    const internalCaps = /^[a-z]+[A-Z][A-Za-z]*$/.test(word);
    const atStart = sentenceStart(start);

    // Unknown single capitalized words in the middle of a sentence are
    // usually names; sentence-initial regular English remains assessable.
    if ((titled && !atStart) || acronym || internalCaps)
      addIgnoredSpan(spans, start, end);

    // Unknown two-word names at the beginning, e.g. "Ada Lovelace".
    if (
      titled && atStart && !starterWords.has(word.toLowerCase()) &&
      isTitle(tokens[i + 1]?.[0] || "") &&
      /^\s+$/.test(source.slice(end, tokens[i + 1].index))
    ) {
      addIgnoredSpan(spans, start, end);
      addIgnoredSpan(
        spans,
        tokens[i + 1].index,
        tokens[i + 1].index + tokens[i + 1][0].length,
      );
    }
  }
  return spans.sort((x, y) => x.start - y.start);
}

function comparison(sentence) {
  const source = String(sentence || "");
  const spans = protectedSpans(source);
  let masked = "", cursor = 0;
  const ignoredWidths = [];
  for (const span of spans) {
    masked += source.slice(cursor, span.start) + " " + IGNORE_KEY + " ";
    ignoredWidths.push(
      Math.min(10, Math.max(2, words(source.slice(span.start, span.end)).length + 2)),
    );
    cursor = span.end;
  }
  masked += source.slice(cursor);
  let ignored = 0;
  return words(masked).map((token) =>
    token === IGNORE_KEY
      ? { max: ignoredWidths[ignored++] || 2 }
      : token,
  );
}
function score(sentence, spoken) {
  const expected = comparison(sentence),
    heard = words(spoken),
    n = expected.length,
    m = heard.length;
  const targetCount = expected.filter((x) => typeof x === "string").length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const value = dp[i][j];
      if (!Number.isFinite(value)) continue;
      if (i < n && typeof expected[i] !== "string") {
        // An excluded proper name may be omitted or transcribed as a few words.
        // Ordinary words following it still require their own alignment.
        for (let k = 0; k <= Math.min(expected[i].max, m - j); k++)
          dp[i + 1][j + k] = Math.min(dp[i + 1][j + k], value);
      } else {
        if (i < n) dp[i + 1][j] = Math.min(dp[i + 1][j], value + 1);
        if (j < m) dp[i][j + 1] = Math.min(dp[i][j + 1], value + 1);
        // License plates/phone numbers like 8888 may be spoken as
        // "eight eight eight eight", while the printed text uses one token.
        // Match only an exact run of digits so ordinary errors still count.
        if (i < n && typeof expected[i] === "string") {
          const run = /^@number:(\d{2,8})$/.exec(expected[i]);
          if (run && j + run[1].length <= m &&
              [...run[1]].every((digit, k) => heard[j + k] === numericDigitKey(digit)))
            dp[i + 1][j + run[1].length] = Math.min(
              dp[i + 1][j + run[1].length], value
            );
        }
        if (i < n && j < m)
          dp[i + 1][j + 1] = Math.min(
            dp[i + 1][j + 1],
            value + (expected[i] === heard[j] ? 0 : 1),
          );
      }
    }
  const errorCount = dp[n][m];
  return {
    percent:
      targetCount && m
        ? Math.max(
            0,
            Math.min(100, Math.round(100 * (1 - errorCount / targetCount))),
          )
        : 0,
    targetCount,
    errorCount,
    excludedCount: expected.filter((x) => typeof x !== "string").length,
  };
}
function createFeedback(win) {
  let context = null,
    enabled = true;
  try {
    enabled = win.localStorage?.getItem("copeak-grammar-sounds") !== "off";
  } catch (_) {}
  function tone(kind = "tap") {
    if (!enabled) return;
    try {
      const Audio = win.AudioContext || win.webkitAudioContext;
      if (!Audio) return;
      if (!context || context.state === "closed") context = new Audio();
      if (context.state === "suspended") context.resume().catch(() => {});
      const notes =
        kind === "100"
          ? [523, 659, 784, 1046]
          : kind === "90"
            ? [493, 659, 880]
            : kind === "80"
              ? [392, 494, 587, 784]
              : kind === "retry"
                ? [392, 440]
                : kind === "next"
                  ? [587, 784]
                  : kind === "rise"
                    ? [330, 392, 440, 523]
                    : [523, 659];
      notes.forEach((hz, i) => {
        const t = context.currentTime + i * (kind === "tap" ? 0.055 : 0.09),
          osc = context.createOscillator(),
          gain = context.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(
          kind === "tap" ? 0.018 : 0.025,
          t + 0.017,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    } catch (_) {
      /* Optional feedback must never block the microphone. */
    }
  }
  return {
    tone,
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      try {
        win.localStorage?.setItem(
          "copeak-grammar-sounds",
          enabled ? "on" : "off",
        );
      } catch (_) {}
      return enabled;
    },
  };
}


// Microphone lifecycle ported from nakacy0919-Git/copeak grammar-training.js
// (beginSpeech, endSpeech, cancelRecognition, finalizeSpeechSession).
// GCC PracticePageV170 supplies the same new-recognizer / 250ms restart flow.
// Keep manual start synchronous with the tap: no cached recognizer or cooldown.
function createReadingSpeechController({
  host = window,
  onChange,
  onScore,
  calculate,
  getThreshold = () => 80,
}) {
  const state = {
    item: null,
    recognition: null,
    token: 0,
    recording: false,
    stopRequested: false,
    transcript: "",
    interimTranscript: "",
    recoveries: 0,
    emptyRestarts: 0,
    signals: { audio: false, voice: false, text: false },
    healthTimer: null,
    stopTimer: null,
    restartTimer: null,
  };
  let view = {
    phase: "idle",
    transcript: "",
    status: "音読スタートを押して、英文を最後まで読みましょう。",
    signals: { ...state.signals },
  };
  const paint = (patch) => {
    view = { ...view, ...patch, signals: { ...state.signals } };
    onChange(view);
  };
  const clearTimers = () => {
    for (const key of ["healthTimer", "stopTimer", "restartTimer"]) {
      host.clearTimeout(state[key]);
      state[key] = null;
    }
  };
  const detach = (r) => {
    if (r)
      r.onstart =
        r.onaudiostart =
        r.onspeechstart =
        r.onresult =
        r.onerror =
        r.onend =
          null;
  };
  function cancel() {
    state.token++;
    clearTimers();
    const r = state.recognition;
    state.recognition = null;
    state.recording = false;
    state.stopRequested = false;
    state.interimTranscript = "";
    detach(r);
    if (r)
      try {
        r.abort();
      } catch (_) {}
    paint({ phase: "idle" });
  }
  function setItem(item) {
    cancel();
    state.item = item;
    state.transcript = "";
    state.interimTranscript = "";
    state.signals = { audio: false, voice: false, text: false };
    paint({
      phase: "idle",
      transcript: "",
      status: "音読スタートを押して、英文を最後まで読みましょう。",
    });
  }
  function finalize(token, item, timeout = false) {
    if (
      token !== state.token ||
      !state.stopRequested ||
      state.item?.id !== item.id
    )
      return;
    const recognizer = state.recognition;
    clearTimers();
    const spoken = [state.transcript, state.interimTranscript]
      .filter(Boolean)
      .join(" ")
      .trim();
    state.token++;
    state.recognition = null;
    state.recording = false;
    state.stopRequested = false;
    detach(recognizer);
    if (timeout && recognizer)
      try {
        recognizer.abort();
      } catch (_) {}
    if (!spoken) {
      paint({
        phase: "idle",
        transcript: "",
        status:
          "文字起こしを受信できませんでした。「音読スタート」で再挑戦してください。",
      });
      return;
    }
    const result = calculate(item.sentence, spoken).percent;
    paint({
      phase: "idle",
      transcript: spoken,
      status:
        result >= getThreshold()
          ? "✓ 合格！次のシーンに進めます。"
          : `${getThreshold()}%以上で合格です。もう一度挑戦しましょう。`,
    });
    onScore(result, spoken, item.id);
  }
  function begin() {
    const Speech = host.SpeechRecognition || host.webkitSpeechRecognition,
      item = state.item;
    if (!item || state.recording) return;
    if (!Speech) {
      paint({
        status:
          "音声認識を利用できません。ブラウザーのマイク設定を確認してください。",
      });
      return;
    }
    try { host.speechSynthesis?.cancel(); } catch (_) {}
    cancel();
    state.recording = true;
    state.stopRequested = false;
    state.recoveries = 0;
    state.emptyRestarts = 0;
    state.transcript = "";
    state.interimTranscript = "";
    state.signals = { audio: false, voice: false, text: false };
    const token = state.token;
    paint({
      phase: "listening",
      transcript: "",
      status: "🔴 音読中です。読み終えたら「終了・判定」を押してください。",
    });
    const listen = () => {
      if (
        !state.recording ||
        state.stopRequested ||
        token !== state.token ||
        state.item?.id !== item.id
      )
        return;
      state.restartTimer = null;
      let r;
      try {
        r = new Speech();
        state.recognition = r;
        r.lang = "en-US";
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;
      } catch (e) {
        cancel();
        paint({ status: "マイクを準備できませんでした：" + e.message });
        return;
      }
      const current = () =>
        token === state.token &&
        state.recognition === r &&
        state.item?.id === item.id;
      const previousTranscript = state.transcript;
      let sessionHasText = false;
      state.healthTimer = host.setTimeout(() => {
        state.healthTimer = null;
        if (!current() || state.stopRequested || sessionHasText) return;
        if (state.recoveries >= 1) {
          cancel();
          paint({
            status:
              "文字起こしが応答していません。「マイクを再接続」を押してください。",
          });
          return;
        }
        state.recoveries++;
        state.recognition = null;
        detach(r);
        try {
          r.abort();
        } catch (_) {}
        paint({
          status:
            "文字起こしを再接続しています。接続後にもう一度読んでください。",
        });
        state.restartTimer = host.setTimeout(listen, 500);
      }, 8000);
      r.onstart = () => {
        if (current() && state.recording)
          paint({
            status:
              "音声認識サービスが開始しました。マイク入力・文字起こしを確認中です。",
          });
      };
      r.onaudiostart = () => {
        if (current() && state.recording) {
          state.signals.audio = true;
          paint({});
        }
      };
      r.onspeechstart = () => {
        if (current() && state.recording) {
          state.signals.voice = true;
          paint({});
        }
      };
      r.onresult = (event) => {
        if (!current() || !state.recording) return;
        const finals = [],
          interims = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i],
            text = String(result?.[0]?.transcript || "").trim();
          if (text) (result.isFinal !== false ? finals : interims).push(text);
        }
        if (!finals.length && !interims.length) return;
        sessionHasText = true;
        host.clearTimeout(state.healthTimer);
        state.healthTimer = null;
        state.transcript = [previousTranscript, ...finals]
          .filter(Boolean)
          .join(" ")
          .trim();
        state.interimTranscript = interims.join(" ");
        state.signals = { audio: true, voice: true, text: true };
        state.emptyRestarts = 0;
        paint({
          transcript: [state.transcript, state.interimTranscript]
            .filter(Boolean)
            .join(" "),
        });
      };
      r.onerror = (event) => {
        if (!current()) return;
        const error = event.error || "unknown";
        if (
          [
            "not-allowed",
            "service-not-allowed",
            "audio-capture",
            "language-not-supported",
          ].includes(error)
        ) {
          cancel();
          paint({
            status:
              "マイクを利用できません（" +
              error +
              "）。ブラウザーの権限と入力設定を確認してください。",
          });
        } else if (error !== "no-speech" && error !== "aborted")
          paint({
            status:
              "音声認識が中断されました（" + error + "）。自動で再接続します。",
          });
      };
      r.onend = () => {
        if (!current()) return;
        host.clearTimeout(state.healthTimer);
        state.healthTimer = null;
        state.recognition = null;
        detach(r);
        if (state.recording && !state.stopRequested) {
          if(!sessionHasText&&++state.emptyRestarts>=3){cancel();paint({status:'音声認識が繰り返し中断されました。マイクを再接続してください。'});return;}
          if (state.interimTranscript) {
            state.transcript = [state.transcript, state.interimTranscript]
              .filter(Boolean)
              .join(" ");
            state.interimTranscript = "";
          }
          state.restartTimer = host.setTimeout(listen, 250);
        } else if (state.stopRequested) finalize(token, item);
      };
      try {
        r.start();
      } catch (e) {
        cancel();
        paint({ status: "マイクを開始できませんでした：" + e.message });
      }
    };
    // Deliberately synchronous: this preserves the user activation on iPad.
    listen();
  }
  function stop() {
    if (!state.recording || state.stopRequested) return;
    const item = state.item,
      token = state.token,
      r = state.recognition;
    state.stopRequested = true;
    paint({
      phase: "scoring",
      status: "文字起こしの最終結果を取得して判定しています…",
    });
    host.clearTimeout(state.restartTimer);
    state.restartTimer = null;
    if (r) {
      state.stopTimer = host.setTimeout(
        () => finalize(token, item, true),
        1600,
      );
      try {
        r.stop();
      } catch (_) {
        finalize(token, item, true);
      }
    } else finalize(token, item);
  }
  function reconnect() {
    cancel();
    begin();
  }
  return { begin, stop, cancel, setItem, reconnect };
}

// A single context avoids Safari/iPad's limit on simultaneous AudioContexts.
// Chimes are synthesized on-device: no downloads, external audio, or latency.
let audioContext;
const notesByType = {
  // Gentle, rising major chord: pleasant success with a soft high-note tail.
  correct: [[523.25,0,.28,.065],[659.25,.075,.30,.058],[783.99,.15,.33,.06],[1046.5,.24,.53,.055]],
  "puzzle-correct": [[440,0,.23,.042],[554.37,.095,.27,.044],[659.25,.19,.40,.046]],
  // Low, descending two-note bass motif, still audible on small iPad speakers.
  wrong: [[246.94,0,.20,.066],[196,.12,.30,.062]],
  fanfare: [[392,0,.24,.046],[523.25,.11,.28,.048],[659.25,.22,.31,.048],[783.99,.33,.48,.051]],
};
function playSound(type, enabled=true) {
  if(!enabled || !notesByType[type]) return;
  try {
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context) return;
    if(!audioContext || audioContext.state==="closed") audioContext=new Context();
    if(audioContext.state==="suspended") Promise.resolve(audioContext.resume()).catch(()=>{});
    const startAt=audioContext.currentTime+.012;
    notesByType[type].forEach(([frequency,offset,duration,peak])=>{
      const start=startAt+offset,end=start+duration;
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
      oscillator.type="sine";
      oscillator.frequency.setValueAtTime(frequency,start);
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(peak,start+.024);
      gain.gain.exponentialRampToValueAtTime(peak*.45,start+duration*.42);
      gain.gain.exponentialRampToValueAtTime(.0001,end);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);oscillator.stop(end+.01);
    });
  } catch (_) {
    // Silence is preferable to interrupting an activity if sound is blocked.
  }
}

const api={score:(expected,heard)=>score(String(expected||'').slice(0,4000),String(heard||'').slice(0,4000)),words,createReadingSpeechController,playSound,createFeedback};if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PowerOnReadingScore=api;
})(typeof globalThis==='object'?globalThis:this);
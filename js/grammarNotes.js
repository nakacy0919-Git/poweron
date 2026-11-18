/* Teacher-reviewed grammar commentary anchored to exact Power On III Lesson 8/9 wording.
   A missing note is shown honestly; never guess a grammar role from a regex. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PowerOnGrammarNotes=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const entries=[
  {
    "lesson": 8,
    "tag": "関係代名詞 which",
    "match": "The city is close to the world-famous Niagara Falls",
    "focus": "which stretches along the border between the U.S. and Canada",
    "target": "Niagara Falls",
    "explain": "which 以下が Niagara Falls を後ろから説明。「国境に沿って広がるナイアガラの滝」というまとまりです。"
  },
  {
    "lesson": 8,
    "tag": "時を表す before 節",
    "match": "Long before the American Civil War started",
    "focus": "before the American Civil War started",
    "target": "many slaves in the South tried to escape",
    "explain": "before 以下は出来事の時を示す従属節。後ろの tried to escape が主節の中心です。"
  },
  {
    "lesson": 8,
    "tag": "不定詞 try to do",
    "match": "many slaves in the South tried to escape",
    "focus": "to escape",
    "target": "tried",
    "explain": "try to do は「〜しようとする」。to escape は試みた行動の中身を表します。"
  },
  {
    "lesson": 8,
    "tag": "現在分詞の後置修飾",
    "match": "Quakers living in Philadelphia helped them",
    "focus": "living in Philadelphia",
    "target": "Quakers",
    "explain": "living in Philadelphia が Quakers を後ろから説明。who lived in Philadelphia と言い換えられます。"
  },
  {
    "lesson": 8,
    "tag": "become known as",
    "match": "The routes to freedom became known as",
    "focus": "became known as",
    "target": "The routes to freedom",
    "explain": "become known as は「〜として知られるようになる」。known は過去分詞です。"
  },
  {
    "lesson": 8,
    "tag": "受動態",
    "match": "were set up on the way",
    "focus": "were set up",
    "target": "stations",
    "explain": "set up（設置する）の受動態。秘密の「駅」が設置された、という意味です。"
  },
  {
    "lesson": 8,
    "tag": "目的の so that",
    "match": "so that escaping slaves could find them",
    "focus": "so that escaping slaves could find them",
    "target": "put a lamp in the window",
    "explain": "so that + 主語 + could は「〜できるように」。ランプを置いた目的です。"
  },
  {
    "lesson": 8,
    "tag": "現在分詞の前置修飾",
    "match": "escaping slaves could find them",
    "focus": "escaping",
    "target": "slaves",
    "explain": "escaping は名詞 slaves を修飾する現在分詞で、「逃亡中の奴隷」を示します。"
  },
  {
    "lesson": 8,
    "tag": "受動態＋不定詞",
    "match": "Most slaves were not allowed to learn",
    "focus": "were not allowed to learn",
    "target": "Most slaves",
    "explain": "allow A to do の受動態。「読む・書くことを学ぶのを許されなかった」という意味です。"
  },
  {
    "lesson": 8,
    "tag": "疑問詞＋不定詞",
    "match": "how to read or write",
    "focus": "how to read or write",
    "target": "learn",
    "explain": "how to do は「どのように〜するか」。ここでは learn の内容です。"
  },
  {
    "lesson": 8,
    "tag": "形式主語の構文",
    "match": "It is said that songs known as",
    "focus": "It is said that",
    "target": "songs known as Negro spirituals contained secret messages",
    "explain": "It is said that は「〜と言われている」。内容は that 以下の節にあります。"
  },
  {
    "lesson": 8,
    "tag": "過去分詞の後置修飾",
    "match": "songs known as Negro spirituals",
    "focus": "known as Negro spirituals",
    "target": "songs",
    "explain": "known as ... は songs を後ろから修飾し、「〜として知られる歌」となります。"
  },
  {
    "lesson": 8,
    "tag": "関係代名詞 who",
    "match": "who saved more than 300 slaves",
    "focus": "who saved more than 300 slaves",
    "target": "conductor",
    "explain": "who 以下が人を表す conductor を説明します。"
  },
  {
    "lesson": 8,
    "tag": "be born",
    "match": "She was born into slavery",
    "focus": "was born",
    "target": "She",
    "explain": "be born は「生まれる」。過去の出来事なので was born です。"
  },
  {
    "lesson": 8,
    "tag": "時を表す when 節",
    "match": "When she was in her early twenties",
    "focus": "When she was in her early twenties",
    "target": "Harriet married",
    "explain": "when 節は「20代前半だったとき」という時を示します。"
  },
  {
    "lesson": 8,
    "tag": "過去分詞の後置修飾",
    "match": "a cheerful man named Tubman",
    "focus": "named Tubman",
    "target": "a cheerful man",
    "explain": "named Tubman が man を後ろから説明。「タブマンという名の男性」です。"
  },
  {
    "lesson": 8,
    "tag": "that 名詞節＋受動態",
    "match": "She heard that she and two of her brothers would be sold",
    "focus": "that she and two of her brothers would be sold",
    "target": "heard",
    "explain": "heard の内容が that 節。would be sold は過去から見た未来の受動態です。"
  },
  {
    "lesson": 8,
    "tag": "目的の so that",
    "match": "so that the dogs could not follow them",
    "focus": "so that the dogs could not follow them",
    "target": "crossed a river",
    "explain": "「犬に追跡されないように」川を渡った、という目的の関係です。"
  },
  {
    "lesson": 8,
    "tag": "so ... that",
    "match": "became so frightened that they went back",
    "focus": "so frightened that they went back to the slave huts",
    "target": "her brothers",
    "explain": "so + 形容詞 + that は「とても〜なので…」。恐怖の程度と結果をつなぎます。"
  },
  {
    "lesson": 8,
    "tag": "動名詞 keep -ing",
    "match": "She kept traveling for freedom",
    "focus": "traveling",
    "target": "kept",
    "explain": "keep -ing は「〜し続ける」。traveling が keep に続く動名詞です。"
  },
  {
    "lesson": 8,
    "tag": "目的の不定詞",
    "match": "She used the North Star to guide her",
    "focus": "to guide her",
    "target": "used the North Star",
    "explain": "to guide her は「彼女を導くために」。北極星を使った目的です。"
  },
  {
    "lesson": 8,
    "tag": "that 名詞節",
    "match": "She hoped that her husband would come north",
    "focus": "that her husband would come north with her",
    "target": "hoped",
    "explain": "hoped の希望の中身を that 節が表します。"
  },
  {
    "lesson": 8,
    "tag": "関係代名詞 which（補足）",
    "match": "which prohibited anyone from helping escaping slaves",
    "focus": "which prohibited anyone from helping escaping slaves",
    "target": "The Fugitive Slave Law of 1850",
    "explain": "カンマで区切られた which 節が法律について補足説明しています。"
  },
  {
    "lesson": 8,
    "tag": "prohibit A from -ing",
    "match": "prohibited anyone from helping escaping slaves",
    "focus": "from helping escaping slaves",
    "target": "prohibited anyone",
    "explain": "「Aが〜するのを禁じる」。from の後は動名詞 helping です。"
  },
  {
    "lesson": 8,
    "tag": "make it＋形容詞＋不定詞",
    "match": "made it dangerous for runaways to stop anywhere",
    "focus": "to stop anywhere in the U.S.",
    "target": "made it dangerous",
    "explain": "it は形式目的語。本当の内容は「逃亡者が米国内で立ち止まること」です。"
  },
  {
    "lesson": 8,
    "tag": "関係副詞 where",
    "match": "where they would be safe and free",
    "focus": "where they would be safe and free",
    "target": "Canada",
    "explain": "where 以下が Canada を説明し、「そこで安全かつ自由になれる」を表します。"
  },
  {
    "lesson": 8,
    "tag": "受動態＋by",
    "match": "Large rewards were offered by slaveholders",
    "focus": "were offered by slaveholders",
    "target": "Large rewards",
    "explain": "賞金は「提供される」側なので受動態。by は行為者を表します。"
  },
  {
    "lesson": 8,
    "tag": "前置詞＋動名詞",
    "match": "for catching her",
    "focus": "catching her",
    "target": "for",
    "explain": "前置詞 for の後には動名詞 catching が続きます。"
  },
  {
    "lesson": 8,
    "tag": "関係代名詞の省略",
    "match": "the freedom she had desperately worked for",
    "focus": "she had desperately worked for",
    "target": "the freedom",
    "explain": "the freedom と she の間に目的格の関係代名詞 that／which を補えます。"
  },
  {
    "lesson": 8,
    "tag": "過去完了",
    "match": "she had desperately worked for",
    "focus": "had desperately worked",
    "target": "she",
    "explain": "had + 過去分詞で過去完了。別の過去より前からの取り組みです。"
  },
  {
    "lesson": 8,
    "tag": "受動態",
    "match": "was awarded a silver medal",
    "focus": "was awarded",
    "target": "She",
    "explain": "award A B（AにBを授与する）の受動態。彼女が授与された側です。"
  },
  {
    "lesson": 8,
    "tag": "受動態＋目的の不定詞",
    "match": "a plaque was unveiled in the chapel",
    "focus": "was unveiled",
    "target": "a plaque",
    "explain": "銘板が「披露された」ので受動態。to honor 以下は披露した目的です。"
  },
  {
    "lesson": 9,
    "tag": "SVO の文型",
    "match": "English has a huge vocabulary",
    "focus": "has",
    "target": "English",
    "explain": "English（S）＋has（V）＋a huge vocabulary（O）の第3文型です。"
  },
  {
    "lesson": 9,
    "tag": "現在進行形＋並列",
    "match": "English is still growing and adding more words",
    "focus": "is still growing and adding",
    "target": "English",
    "explain": "be + -ing の進行形。growing と adding が and で並んでいます。"
  },
  {
    "lesson": 9,
    "tag": "現在完了の受動態",
    "match": "English has been influenced by many languages",
    "focus": "has been influenced",
    "target": "English",
    "explain": "has + been + 過去分詞は現在完了の受動態。長い期間受けてきた影響を表します。"
  },
  {
    "lesson": 9,
    "tag": "SVC の文型",
    "match": "English and German were similar languages",
    "focus": "were",
    "target": "English and German",
    "explain": "English and German（S）＋were（V）＋similar languages（C）の第2文型です。"
  },
  {
    "lesson": 9,
    "tag": "begin -ing",
    "match": "lots of French words began coming into English",
    "focus": "coming into English",
    "target": "began",
    "explain": "begin -ing は「〜し始める」。英語へ語が入ってき始めたことを表します。"
  },
  {
    "lesson": 9,
    "tag": "because による理由",
    "match": "This was because French-speaking people",
    "focus": "because French-speaking people, the Normans, had come to control England",
    "target": "This was",
    "explain": "This was because ～ は「それは〜だったから」。理由の節が続きます。"
  },
  {
    "lesson": 9,
    "tag": "過去完了＋不定詞",
    "match": "had come to control England",
    "focus": "had come",
    "target": "to control England",
    "explain": "had come が過去完了。come to do は「〜するようになる」を表します。"
  },
  {
    "lesson": 9,
    "tag": "関係代名詞 that",
    "match": "French words that came into English increased greatly",
    "focus": "that came into English",
    "target": "French words",
    "explain": "that 以下は French words を後ろから説明します。"
  },
  {
    "lesson": 9,
    "tag": "SV＋修飾語",
    "match": "many more words came into English",
    "focus": "came",
    "target": "many more words",
    "explain": "many more words（S）＋came（V）。into English は移動先を表す前置詞句です。"
  },
  {
    "lesson": 9,
    "tag": "過去分詞の後置修飾",
    "match": "words concerned with science and technology",
    "focus": "concerned with science and technology",
    "target": "words",
    "explain": "concerned with ... は words を後ろから修飾します。"
  },
  {
    "lesson": 9,
    "tag": "so did ... の倒置",
    "match": "As art and education developed, so did the English vocabulary",
    "focus": "so did the English vocabulary",
    "target": "As art and education developed",
    "explain": "前半の変化と呼応する so + 助動詞 + 主語 の倒置です。"
  },
  {
    "lesson": 9,
    "tag": "there 構文＋関係代名詞",
    "match": "There are many ways that new words are created",
    "focus": "that new words are created in English today",
    "target": "many ways",
    "explain": "There are ～ で存在を示し、that 以下が ways を説明します。"
  },
  {
    "lesson": 9,
    "tag": "受動態 be called",
    "match": "One way is called clipping",
    "focus": "is called",
    "target": "One way",
    "explain": "call A B（AをBと呼ぶ）の受動態です。"
  },
  {
    "lesson": 9,
    "tag": "動名詞主語＋不定詞",
    "match": "Clipping means to shorten a word",
    "focus": "to shorten a word that already exists",
    "target": "Clipping means",
    "explain": "Clipping は動名詞由来の名詞、to shorten ... は means の説明内容です。"
  },
  {
    "lesson": 9,
    "tag": "関係代名詞 that",
    "match": "a word that already exists",
    "focus": "that already exists",
    "target": "a word",
    "explain": "that 以下が a word を説明。「すでに存在する語」です。"
  },
  {
    "lesson": 9,
    "tag": "関係代名詞の省略",
    "match": "a sentence we might hear on a street",
    "focus": "we might hear on a street in New York City",
    "target": "a sentence",
    "explain": "a sentence の後に目的格 that／which が省略されています。"
  },
  {
    "lesson": 9,
    "tag": "受動態 be clipped",
    "match": "This popular word deli is clipped from",
    "focus": "is clipped from",
    "target": "This popular word deli",
    "explain": "clip（短く切る）の受動態。「元の単語から短縮される」です。"
  },
  {
    "lesson": 9,
    "tag": "when 節＋might",
    "match": "When you give a speech, you might use",
    "focus": "When you give a speech",
    "target": "you might use a mike",
    "explain": "when 節は行為の時・場面。might は可能性を表します。"
  },
  {
    "lesson": 9,
    "tag": "関係代名詞 which（補足）",
    "match": "an exam next week, which is short for examination",
    "focus": "which is short for examination",
    "target": "an exam",
    "explain": "カンマ＋which は exam への補足説明。「examination の短縮形」です。"
  },
  {
    "lesson": 9,
    "tag": "受動態",
    "match": "New words are also introduced into English",
    "focus": "are also introduced",
    "target": "New words",
    "explain": "新語が「導入される」側なので受動態です。"
  },
  {
    "lesson": 9,
    "tag": "be made from",
    "match": "An acronym is made from a set of existing words",
    "focus": "is made from",
    "target": "An acronym",
    "explain": "be made from ～ で「〜から作られる」。素材を示します。"
  },
  {
    "lesson": 9,
    "tag": "受動態＋等位接続",
    "match": "the first letter is taken from each word",
    "focus": "is taken",
    "target": "the first letter",
    "explain": "is taken は受動態。and が後続の別の節とつないでいます。"
  },
  {
    "lesson": 9,
    "tag": "that 名詞節",
    "match": "Few remember that scuba comes from",
    "focus": "that scuba comes from a much longer set of words",
    "target": "remember",
    "explain": "remember の目的語は that 以下の内容です。"
  },
  {
    "lesson": 9,
    "tag": "現在分詞の後置修飾",
    "match": "laser is an acronym meaning Light Amplification",
    "focus": "meaning Light Amplification by Stimulated Emission of Radiation",
    "target": "an acronym",
    "explain": "meaning ～ は an acronym を後ろから説明します。"
  },
  {
    "lesson": 9,
    "tag": "when 節＋受動態",
    "match": "new words are added to English when existing words",
    "focus": "when existing words are put together, or blended",
    "target": "new words are added to English",
    "explain": "主節の are added と従属節の are put はどちらも受動態です。"
  },
  {
    "lesson": 9,
    "tag": "受動態＋目的の不定詞",
    "match": "Breakfast and lunch are put together to form brunch",
    "focus": "to form brunch",
    "target": "are put together",
    "explain": "to form brunch は「brunch を作るために」という目的です。"
  },
  {
    "lesson": 9,
    "tag": "受動態＋目的の不定詞",
    "match": "Cellular and telephone are combined to make",
    "focus": "to make the word cellphone",
    "target": "are combined",
    "explain": "to make ... は副詞的用法の不定詞で、目的を表します。"
  },
  {
    "lesson": 9,
    "tag": "過去分詞の後置修飾",
    "match": "a coinage based on the modern technology",
    "focus": "based on the modern technology of the Internet",
    "target": "a coinage",
    "explain": "based on ～ は a coinage を後ろから説明します。"
  },
  {
    "lesson": 9,
    "tag": "when 節＋受動態",
    "match": "The name was created when the material was invented",
    "focus": "when the material was invented by an American scientist",
    "target": "The name was created",
    "explain": "was created と was invented はどちらも過去の受動態です。"
  },
  {
    "lesson": 9,
    "tag": "関係代名詞 that＋目的",
    "match": "a device that we use with computers to move the cursor",
    "focus": "that we use with computers to move the cursor",
    "target": "a device",
    "explain": "that 節は a device を修飾し、to move は「動かすために」という目的です。"
  },
  {
    "lesson": 9,
    "tag": "関係代名詞 that",
    "match": "new words that came into English recently",
    "focus": "that came into English recently thanks to Japanese",
    "target": "new words",
    "explain": "that 以下が new words を後ろから説明します。"
  },
  {
    "lesson": 9,
    "tag": "as（〜につれて）",
    "match": "A language grows and changes as people and the world change",
    "focus": "as people and the world change",
    "target": "grows and changes",
    "explain": "この as は「〜するにつれて」。世界と言語の変化を結びます。"
  },
  {
    "lesson": 9,
    "tag": "because 節＋might be -ing",
    "match": "Because English is the most commonly used global language",
    "focus": "Because English is the most commonly used global language",
    "target": "it might be growing and changing faster than other languages",
    "explain": "because 節は理由。might be -ing は推量を含む進行形、faster than は比較です。"
  },
  {
    "lesson": 8,
    "tag": "SVC",
    "match": "St. Catharines is a small city",
    "focus": "is",
    "target": "St. Catharines",
    "explain": "St. Catharines が主語、is が動詞、a small city が補語。沿岸を示す語句は修飾語です。"
  },
  {
    "lesson": 8,
    "tag": "choose A as B",
    "match": "the Canadian government formally chose a small chapel",
    "focus": "chose a small chapel in St. Catharines as a National Historic Site of Canada",
    "target": "the Canadian government",
    "explain": "choose A as B は「AをBとして選ぶ」。A と B は同一の対象です。"
  },
  {
    "lesson": 8,
    "tag": "SVC",
    "match": "The chapel was the",
    "focus": "was",
    "target": "The chapel",
    "explain": "S＋V＋C。礼拝堂が「終着駅」であったことを説明します。"
  },
  {
    "lesson": 8,
    "tag": "because 節",
    "match": "These white people helped the slaves because",
    "focus": "because they did not support slavery",
    "target": "helped the slaves",
    "explain": "because 以下が白人たちが助けた理由です。"
  },
  {
    "lesson": 8,
    "tag": "SVC",
    "match": "Philadelphia was the symbol of freedom",
    "focus": "was",
    "target": "Philadelphia",
    "explain": "Philadelphia が主語、was が動詞、the symbol of freedom が補語です。"
  },
  {
    "lesson": 8,
    "tag": "head for",
    "match": "Many slaves in the South headed for Philadelphia",
    "focus": "headed for Philadelphia",
    "target": "Many slaves in the South",
    "explain": "head for は「〜へ向かう」。for 以下は行き先を表します。"
  },
  {
    "lesson": 8,
    "tag": "受動態の並列",
    "match": "escaping slaves were hidden, warmed, and fed",
    "focus": "were hidden, warmed, and fed",
    "target": "escaping slaves",
    "explain": "were に続く3つの過去分詞が並列になっています。"
  },
  {
    "lesson": 8,
    "tag": "疑問文と不定詞",
    "match": "Then how did they manage to find the routes",
    "focus": "manage to find the routes",
    "target": "they",
    "explain": "manage to do は「なんとか〜する」。how は方法を尋ねる疑問詞です。"
  },
  {
    "lesson": 8,
    "tag": "and による並列",
    "match": "angels\" meant \"conductors",
    "focus": "and \"Jordan\" meant \"the Ohio River",
    "target": "angels",
    "explain": "and が「angels は〜を意味する」と「Jordan は〜を意味する」を結びます。"
  },
  {
    "lesson": 8,
    "tag": "but による対比",
    "match": "Slaves sang the spirituals within their families",
    "focus": "but not in the presence of white people",
    "target": "within their families",
    "explain": "but は「家族の中では」と「白人の前では」を対比し、後半の sang は省略されています。"
  },
  {
    "lesson": 8,
    "tag": "SVO",
    "match": "the slaves learned the routes to freedom",
    "focus": "learned",
    "target": "the slaves",
    "explain": "the slaves（S）＋learned（V）＋the routes（O）。In this way は方法です。"
  },
  {
    "lesson": 8,
    "tag": "SVO",
    "match": "She had ten brothers and sisters",
    "focus": "had",
    "target": "She",
    "explain": "She（S）＋had（V）＋ten brothers and sisters（O）の基本構造です。"
  },
  {
    "lesson": 8,
    "tag": "SV",
    "match": "her owner died",
    "focus": "died",
    "target": "her owner",
    "explain": "her owner（S）＋died（V）。A few years later は時の修飾語です。"
  },
  {
    "lesson": 8,
    "tag": "decide to do",
    "match": "They decided to run away together",
    "focus": "to run away together",
    "target": "decided",
    "explain": "decide to do は「〜すると決める」。不定詞が決断した行動を表します。"
  },
  {
    "lesson": 8,
    "tag": "go on",
    "match": "She went on alone through the woods by night",
    "focus": "went on",
    "target": "She",
    "explain": "go on は「進み続ける」。alone は様子、through the woods は通った場所です。"
  },
  {
    "lesson": 8,
    "tag": "SV",
    "match": "She hid by day",
    "focus": "hid",
    "target": "She",
    "explain": "She（S）＋hid（V）。by day は「昼間は」という修飾語です。"
  },
  {
    "lesson": 8,
    "tag": "but で節を接続",
    "match": "She had no map, but she trusted God",
    "focus": "but she trusted God",
    "target": "She had no map",
    "explain": "but は地図がないことと神を信じたことを対比します。"
  },
  {
    "lesson": 8,
    "tag": "get to",
    "match": "At last, she got to Philadelphia",
    "focus": "got to Philadelphia",
    "target": "she",
    "explain": "get to ～ は「〜へ到着する」。At last は「ついに」です。"
  },
  {
    "lesson": 8,
    "tag": "but による対比",
    "match": "Harriet was no longer a slave, but",
    "focus": "but she could not feel happy",
    "target": "Harriet was no longer a slave",
    "explain": "but は「奴隷ではなくなったのに幸せを感じない」という対比を示します。"
  },
  {
    "lesson": 8,
    "tag": "SVC",
    "match": "All her family members were still slaves",
    "focus": "were",
    "target": "All her family members",
    "explain": "all her family members（S）＋were（V）＋slaves（C）です。"
  },
  {
    "lesson": 8,
    "tag": "keep -ing",
    "match": "She kept thinking about them",
    "focus": "thinking about them",
    "target": "kept",
    "explain": "keep -ing は「〜し続ける」。thinking が続けた行動です。"
  },
  {
    "lesson": 8,
    "tag": "動詞の並列",
    "match": "she went back to Maryland and met her family again",
    "focus": "went back to Maryland and met her family again",
    "target": "she",
    "explain": "went と met が and で並び、どちらも she の行動です。"
  },
  {
    "lesson": 8,
    "tag": "wish to do",
    "match": "he did not wish to go",
    "focus": "to go",
    "target": "wish",
    "explain": "wish to do は「〜したいと望む」。did not で過去の否定です。"
  },
  {
    "lesson": 8,
    "tag": "SVO",
    "match": "she led two brothers, a sister, her children",
    "focus": "led",
    "target": "she",
    "explain": "led は「導いた」。目的語には複数の人物が列挙されています。"
  },
  {
    "lesson": 8,
    "tag": "SV",
    "match": "reputation as a fearless leader spread fast",
    "focus": "spread fast",
    "target": "Harriet's reputation as a fearless leader",
    "explain": "reputation が主語、spread が動詞。fast は広まり方を表します。"
  },
  {
    "lesson": 8,
    "tag": "受動態",
    "match": "she was never captured by slave catchers",
    "focus": "was never captured by slave catchers",
    "target": "she",
    "explain": "was captured は受動態。never は「決して〜されなかった」です。"
  },
  {
    "lesson": 8,
    "tag": "when 節",
    "match": "when Abraham Lincoln signed the Emancipation Proclamation",
    "focus": "when Abraham Lincoln signed the Emancipation Proclamation in 1863",
    "target": "Harriet was over forty years old",
    "explain": "when 以下はリンカーンが宣言に署名した時を示します。"
  },
  {
    "lesson": 8,
    "tag": "受動態",
    "match": "Harriet was honored by many people",
    "focus": "was honored by many people",
    "target": "Harriet",
    "explain": "honor の受動態。by many people は称えた人を示します。"
  },
  {
    "lesson": 8,
    "tag": "修飾語と主節",
    "match": "She died on March 10, 1913",
    "focus": "on March 10, 1913",
    "target": "She died",
    "explain": "主節は She died。on 以下は日付、in her early nineties は年齢を示します。"
  },
  {
    "lesson": 9,
    "tag": "SVO",
    "match": "the 20-volume Oxford English Dictionary contains",
    "focus": "contains",
    "target": "the 20-volume Oxford English Dictionary",
    "explain": "辞典が主語、contains が動詞、about 600,000 entries が目的語です。"
  },
  {
    "lesson": 9,
    "tag": "否定と動詞の並列",
    "match": "we do not sit down at a restaurant and say",
    "focus": "do not sit down at a restaurant and say",
    "target": "we",
    "explain": "do not が sit down と say の両方にかかっています。"
  },
  {
    "lesson": 9,
    "tag": "SVO",
    "match": "Instead, we order beef and pork",
    "focus": "order",
    "target": "we",
    "explain": "we（S）＋order（V）＋beef and pork（O）。Instead は「代わりに」です。"
  },
  {
    "lesson": 9,
    "tag": "SVC の補語",
    "match": "Most of these were from Latin and Greek",
    "focus": "were from Latin and Greek",
    "target": "Most of these",
    "explain": "主語 Most of these の出所を were from ... が説明します。"
  },
  {
    "lesson": 9,
    "tag": "現在進行形 go to",
    "match": "I'm going to a deli",
    "focus": "going to a deli",
    "target": "I'm",
    "explain": "go to + 場所 の進行形。「デリに行くところ」で、未来表現の be going to＋動詞原形ではありません。"
  },
  {
    "lesson": 9,
    "tag": "現在完了の疑問文",
    "match": "Have you seen the ad for the new smartphone",
    "focus": "Have you seen",
    "target": "you",
    "explain": "Have＋主語＋過去分詞で現在完了の疑問文です。"
  },
  {
    "lesson": 9,
    "tag": "助動詞 would",
    "match": "native speakers would probably not use",
    "focus": "would probably not use",
    "target": "native speakers",
    "explain": "would not use はこのような場合の予測・傾向を表します。"
  },
  {
    "lesson": 9,
    "tag": "SVC",
    "match": "One popular example is scuba",
    "focus": "is",
    "target": "One popular example",
    "explain": "例の1つ＝scuba の関係。第2文型です。"
  },
  {
    "lesson": 9,
    "tag": "SVC",
    "match": "Radar is another example",
    "focus": "is",
    "target": "Radar",
    "explain": "Radar（S）＋is（V）＋another example（C）です。"
  },
  {
    "lesson": 9,
    "tag": "stand for",
    "match": "What does it stand for",
    "focus": "stand for",
    "target": "it",
    "explain": "stand for は「〜を表す」。What が表す内容を尋ねています。"
  },
  {
    "lesson": 9,
    "tag": "SVO",
    "match": "It means RAdio Detection And Ranging",
    "focus": "means",
    "target": "It",
    "explain": "It（S）＋means（V）＋RAdio Detection And Ranging（O）です。"
  },
  {
    "lesson": 9,
    "tag": "SVO",
    "match": "Technology often offers new words",
    "focus": "offers",
    "target": "Technology",
    "explain": "Technology（S）＋offers（V）＋new words（O）です。"
  },
  {
    "lesson": 9,
    "tag": "動詞の転用",
    "match": "I googled you",
    "focus": "googled",
    "target": "I",
    "explain": "google が動詞として使われ、過去形 googled になっています。"
  },
  {
    "lesson": 9,
    "tag": "引用と助動詞",
    "match": "would be a good example",
    "focus": "would be",
    "target": "a good example",
    "explain": "この部分は直前の引用を受ける述語部分。引用された発話が「良い例だろう」と説明しています。"
  },
  {
    "lesson": 9,
    "tag": "SVC",
    "match": "Another example of coinage is nylon",
    "focus": "is",
    "target": "Another example of coinage",
    "explain": "Another example が主語、is が動詞、nylon が補語です。"
  },
  {
    "lesson": 9,
    "tag": "SVO",
    "match": "Technology also brings new meanings",
    "focus": "brings",
    "target": "Technology",
    "explain": "Technology（S）＋brings（V）＋new meanings（O）です。"
  },
  {
    "lesson": 9,
    "tag": "Let's + 動詞原形",
    "match": "let's look at borrowing",
    "focus": "look at borrowing",
    "target": "let's",
    "explain": "Let's do は「〜しましょう」。borrowing は look at の目的語となる名詞的な語です。"
  },
  {
    "lesson": 9,
    "tag": "SVO",
    "match": "Many new words entered English this way",
    "focus": "entered",
    "target": "Many new words",
    "explain": "Many new words（S）＋entered（V）＋English（O）。this way は方法です。"
  },
  {
    "lesson": 9,
    "tag": "as did ... 倒置",
    "match": "as did many words for music",
    "focus": "as did many words for music",
    "target": "piano",
    "explain": "as did ... は「音楽用語も同様に」。前にある came into English from Italian を受けます。"
  },
  {
    "lesson": 9,
    "tag": "SV と修飾語",
    "match": "Today, words still come into English from other languages",
    "focus": "come",
    "target": "words",
    "explain": "words（S）＋come（V）。into English と from other languages は移動先・出所です。"
  },
  {
    "lesson": 9,
    "tag": "指示語 these",
    "match": "Clipping, acronyms, blending, coinage, borrowing―these happen",
    "focus": "these happen",
    "target": "Clipping, acronyms, blending, coinage, borrowing",
    "explain": "ダッシュ前の列挙を these が受けます。主節は these happen です。"
  }
];
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  function forSentence(lesson,sentence){
    const text=norm(sentence);
    return entries.filter(e=>e.lesson===Number(lesson) && text.includes(norm(e.match)) && text.includes(norm(e.focus)) && text.includes(norm(e.target)));
  }
  return {forSentence,entries};
});

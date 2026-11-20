# Lesson 8 音読採点基準（2026-11-20）

## 対象画面
- **じっくり学習（Read & Practice / Scene Reading）**：通常モード・iPad/Safari自動判定モードとも、`PowerOnReadingScore.score` により評価する。
- **Reading Check（通常の音読判定）**：Lesson 8 のみ、同じ `PowerOnReadingScore.score` を使う。
- **Story Matchの音読関連処理**：既存の同じ判定エンジンを使用。
- **他のLessonのReading Check**：従来の判定方式を保持する。

## 採点から除外するもの
Lesson 8 本文で確認した固有名詞は、聞き取り結果に存在しなくても減点しない。複数語から成る名前は一つの除外範囲として扱う。

- 人名：`Harriet Tubman`、`Abraham Lincoln`、`Queen Victoria` など
- 地名：`St. Catharines`、`Lake Ontario`、`Niagara Falls`、`Maryland` など
- 歴史的名称・組織名：`Underground Railroad`、`Fugitive Slave Law`、`Emancipation Proclamation`、`National Historic Site of Canada` など
- 上記固有名詞の所有格：`Harriet's`、`Harriet’s`、`Harriet Tubman’s` など。アポストロフィの表記差は同等に扱う。

実装は `js/storyReading.js` の確認済み `readingNames` 一覧を使用し、単なる文頭の大文字を固有名詞と誤認して除外することはない。

## 採点するもの
普通名詞、動詞、形容詞、副詞、冠詞、前置詞、助動詞、所有代名詞・所有限定詞（`his`、`her`、`their` 等）など、除外対象でない語は通常通り採点する。

採点は語順を尊重した語句比較（単語単位の挿入・欠落・置換による誤り）で行う。固有名詞を読み飛ばした場合の欠落や、固有名詞を音声認識が別の複数語で表記した場合は、周辺の一般語まで誤って減点しないように扱う。

**Accuracy（%） = max(0, 100 × (1 − 対象語の編集誤り数 / 採点対象語数))（四捨五入、上限100%）**。

- 75%以上：クリア（じっくり学習）
- 75%未満：再挑戦
- 採点対象語が存在しない、または認識された発話が空の場合：現行実装では0%（自動的な100%扱いにはしない）
- 大文字・小文字や基本的な句読点の差は採点を妨げない。
- WPM（読んだ速さ）は別指標であり、固有名詞の採点除外とは独立して音声認識された語数と時間から算出する。

## 例
| お手本 | 音声認識の結果 | 採点 |
| --- | --- | --- |
| `Harriet's reputation spread fast.` | `reputation spread fast` | 100% |
| `Harriet's reputation spread fast.` | `reputation` | 33%（`spread`、`fast` は採点対象） |
| `Queen Victoria helped Harriet Tubman today.` | `helped today` | 100% |
| `St. Catharines is a small city.` | `is a small city` | 100% |

## 実装・回帰確認
- `js/storyReading.js`：共通の登録済み固有名詞除外・所有格除外・スコア計算。
- `js/practice.js`：じっくり学習は共通エンジンを使用。判定基準を画面下部に表示。
- `js/speech.js`：Lesson 8 Reading Checkの得点を共通エンジンで算出し、お手本欄に判定基準を表示。
- `tests/reading-check-stability.test.cjs` と `tests/story-match-integration.test.cjs` に検証ケースを追加。

**公開方針**：この変更は開発ブランチ上の修正。本番へのマージ・デプロイは別途実施する。

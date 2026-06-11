---
name: jp-trade-stats
description: >-
  Search, download, and analyze Japan's Ministry of Finance Trade Statistics
  (財務省貿易統計 / 普通貿易統計) via the e-Stat API. Use this skill whenever the user wants
  Japanese import/export data — trade values or quantities by HS commodity code,
  by country/region, or over time — including year-over-year trends, country
  rankings, or tracking specific commodities (e.g. coffee, cocoa, crude oil).
  Trigger on mentions of 貿易統計, 財務省貿易統計, 輸出入統計, customs.go.jp/toukei, e-Stat
  trade data, 品別国別表, 概況品, HS品目別輸出入, or any request to pull or chart Japanese
  trade figures. The customs.go.jp site blocks scraping, so always go through the
  e-Stat API as described here rather than fetching customs pages directly.
argument-hint: "[取得・分析したい貿易統計の内容]"
allowed-tools: Bash Read Write
user-invocable: true
---

# 日本の財務省貿易統計（e-Stat API）

財務省貿易統計（普通貿易統計）を **e-Stat API** から検索・取得し、国別比較・時系列/前年比・品目追跡を行うためのスキル。実装は Node.js + TypeScript（`tsx` で実行）。

> 税関サイト本体（customs.go.jp/toukei）は robots.txt で自動取得を拒否している。**スクレイピングせず、必ず e-Stat API を使う。**

## 前提: アプリケーションID

e-Stat API は無料の `appId` が必須。未登録なら https://www.e-stat.go.jp/api/ で登録するよう案内し、取得後に設定してもらう:

```bash
export ESTAT_APP_ID=<your-application-id>
```

`ESTAT_APP_ID` が無いとスクリプトは明確なエラーで停止する。ユーザーがまだ持っていない場合は、登録手順を先に案内すること。

## 標準ワークフロー

貿易統計の取得・分析は基本的に次の4ステップ。**ステップ2のメタ確認を飛ばさない**（表ごとに次元の割り当てが違うため）。

### 1. 統計表を探す（statsDataId を特定）

```bash
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts list --word "品別国別表 AND 輸出 AND 確報" --limit 30
```

- `statsCode=00350300`（普通貿易統計）配下を検索。`--word` 省略で一覧。
- タイトルの「輸出/輸入」「速報/確報/確定」「対象年」を見て目的の表を選ぶ。
- 分析用途には **確報以降**（確報/確々報/確定）を選ぶ。速報は暫定値。
- 表タイプの違いは `.agent/skills/jp-trade-stats/references/trade-tables.md` を参照（品別国別表 / 国別概況品別表 / 概況品別統計品目表 / 貿易指数表）。

### 2. 次元とコードを確認する（必須）

```bash
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts meta --id <statsDataId>          # 各次元の概要+先頭サンプル
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts meta --id <statsDataId> --full   # 全コードをダンプ
```

- 出力の `paramId`（`tab`/`cat01`/`cat02`/`area`/`time`）が、そのまま API フィルタキー（`cdTab`, `cdCat01`, `cdArea`, `cdTime` …）になる。
- 目的の品目（9桁HS）・国のコードを確定する。**金額/数量の別と月の別は、表によっては `tab` ではなく
  `cat02` に入る**（品別国別表 輸入で確認済み: `cat02` の `140`=合計_金額、`170`=1月_金額 …）。
  `meta` 出力でどの次元が計測（金額/数量）を担うかを必ず見極める。
- コードを推測で書かないこと。

### 3. データを取得する

```bash
# 例: ある表から品目=<HSコード>, 期間=範囲 で取得し JSON 保存
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <statsDataId> \
  --cdCat01 <品目コード> --cdTimeFrom <from> --cdTimeTo <to> --pretty > data.json

# CSV が欲しい場合
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <statsDataId> --cdCat01 <品目コード> --csv > data.csv
```

- フィルタは `--cdTab/--cdCat01../--cdArea/--cdTime`（単一）と `--cd...From/--cd...To`（範囲）。
- 10万件超は自動でページング（`NEXT_KEY`）。出力は `{code, code_name, value}` に正規化済み。
- 単位（金額=千円が標準、数量は品目依存）に注意。**比較・時系列は計測（金額）を fetch 時に固定すること。**
  品別国別表では計測は `cat02` にあるので `--cdCat02 140`（年計金額）等で固定する（`tab` 次元は無い）。
  固定しないと数量・金額・各月が混ざって合計が壊れる。

### 4. 分析する

`fetch` の JSON を `analyze.ts` に渡す（stdin か `--in`）。

**計測（金額）は fetch 時に固定する。** 品別国別表では金額は `cat02`（年計金額=`140`、1月金額=`170` …）。

```bash
# 国・地域別ランキング（年計金額に固定して）
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <id> --cdCat01 <品目> --cdCat02 140 --cdTime <年> \
  | npx tsx .agent/skills/jp-trade-stats/scripts/analyze.ts --mode country --top 15

# 時系列推移（特定の国・品目, 年計金額）— 複数年を含む表を使う
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <id> --cdCat01 <品目> --cdArea <国> --cdCat02 140 \
  | npx tsx .agent/skills/jp-trade-stats/scripts/analyze.ts --mode timeseries

# 前年比（YoY）— 年計金額(140) で年次同士、または月の金額(例 170=1月)で前年同月比
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <id> --cdCat01 <品目> --cdArea <国> --cdCat02 140 \
  | npx tsx .agent/skills/jp-trade-stats/scripts/analyze.ts --mode yoy
```

- `analyze.ts` 側の絞り込み `--area/--cat/--tab` は **コードでも名称の部分一致でもマッチ**する
  （`--cat` は cat01/cat02 両対応）。ただし計測の固定は **fetch 時の `--cdCat02`** で行うのが確実
  （`--tab` 名は tab 次元を持つ表でしか効かない）。計測を固定し忘れると `analyze` が stderr に警告する。
- `yoy` は同じ `cat02`（同じ計測・同じ月 or 年計）を固定したうえで、複数年を含む年次表の年次同士を比較する。
  前年同月比は `--cdCat02` をその月の金額コード（例 `170`=1月）に固定して実行する。

## 可視化を求められたら

ユーザーが「グラフ」「チャート」「地図」「可視化」を求めた場合は、分析結果（JSON）を素材に:
- 時系列・ランキングなどデータ形状の提示 → Visualizer のチャートで描く。
- 国別の地理的分布 → 地図表現を検討。
ユーザーは D3.js / deck.gl などに精通しているため、本格的な制作物が必要なら成果物（HTML/React アーティファクト）として書き出すことも提案する。

## よくある依頼パターン

**「日本のコーヒー輸入をブラジル・コロンビア等の国別で比較したい」**
→ list で品別国別表(輸入,確報) を特定 → meta でコーヒー(09類/0901)の9桁コードと国コード、計測コード(`cat02` の
`140`=合計_金額)を確認 → fetch（品目固定＋`--cdCat02 140`＋対象年）→ analyze --mode country。

**「ココア輸入額の前年比トレンド」**
→ 品別国別表(輸入) → meta でココア(18類)コードと `cat02` の年計金額(140)を確認 → fetch（品目固定＋`--cdCat02 140`、
複数年を含む年次表）→ analyze --mode yoy。

**「原油輸入の金額・数量の時系列」**
→ 品別国別表(輸入) → meta で原油(2709)と `cat02` の金額・数量コードを確認 → 金額(`--cdCat02 140`)と
数量(`--cdCat02 120` 等)をそれぞれ fetch → analyze --mode timeseries を計測ごとに実行。

## 注意事項

- 出力物・レポートには出典（**財務省貿易統計 / e-Stat**）を明記する（クレジット表示）。
- 速報値は後日改定されるため、確報以降と混在させない。
- 年計は年次表、または月次表の12月分の累計欄を使う。
- 大量・連続リクエストは控えめに。複数表は `getStatsDatas`（一括）も検討。

## 参照ファイル

- `.agent/skills/jp-trade-stats/references/estat-api.md` — e-Stat API のエンドポイント・パラメータ・レスポンス構造。
- `.agent/skills/jp-trade-stats/references/trade-tables.md` — 貿易統計の統計表タイプ、statsCode、次元構造、速報/確報の違い。
- `.agent/skills/jp-trade-stats/references/codes.md` — 9桁HS品目番号と国名符号の構造、コーヒー/ココア等の章・項。

## ビルド／レポート生成スクリプトの保管（重要）

集計・レポート生成のために一度書いたスクリプトは**使い捨てにせず、`.agent/skills/jp-trade-stats/scripts/builders/` に保存して再利用する**。
同種の依頼が来たら、ゼロから書き直さず既存ビルダーを使う／引数や対象を差し替えて流用する。

- 保管先: `.agent/skills/jp-trade-stats/scripts/builders/`。
- 命名: **用途が分かる英語ケバブケース**（例: `chapter-aggregate-annual-report.ts`）。`build-xxx` のような汎称は避ける。
- 入出力: 出力先は**引数で受け取り、既定は作業ディレクトリ直下の `out/`**
  （`const OUT = path.resolve(process.argv[2] ?? "out")`）。生成物（.md/.csv）と取得データ（`out/data/*.json`）は `out/` に置く。
- 先頭のドキュコメントに用途・入力・実行例を必ず書く。

### 既存ビルダー

- `.agent/skills/jp-trade-stats/scripts/builders/chapter-aggregate-annual-report.ts` — 章合算の**年次**輸入額推計レポート（Markdown＋CSV）。
  入力 `out/data/chapter-<NN>.json`（cat02=140 の年計金額）。実行: `npx tsx .agent/skills/jp-trade-stats/scripts/builders/chapter-aggregate-annual-report.ts [outDir]`。
- `.agent/skills/jp-trade-stats/scripts/builders/chapter-aggregate-monthly-series.ts` — 章合算の**月次**輸入額系列（CSV）。
  入力 `out/data/monthly-<NN>-<year>.json`（cat02 の月別金額）。実行: `npx tsx .agent/skills/jp-trade-stats/scripts/builders/chapter-aggregate-monthly-series.ts [outDir]`。

## スクリプト

- `.agent/skills/jp-trade-stats/scripts/estat.ts` — e-Stat API クライアント兼CLI（`list` / `meta` / `fetch`）。
- `.agent/skills/jp-trade-stats/scripts/analyze.ts` — 正規化レコードの分析（`timeseries` / `yoy` / `country`）。
- `.agent/skills/jp-trade-stats/scripts/builders/` — 再利用する集計・レポート生成スクリプト（上記「ビルド／レポート生成スクリプトの保管」参照）。

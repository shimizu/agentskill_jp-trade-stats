# アーキテクチャ概要

## ディレクトリ構成

```text
.
├── src/cli.ts                         # npm パッケージとして公開する CLI
├── template/                          # init/update でコピーされるスキル一式
│   ├── .agent/skills/jp-trade-stats/  # スキル本体
│   ├── .claude/skills/...             # Claude Code 用プロキシ
│   ├── .codex/skills/...              # Codex 用プロキシ
│   └── .gemini/skills/...             # Gemini CLI 用プロキシ
├── dist/                              # tsup のビルド出力
└── docs/                              # 引き継ぎ資料
```

## npm CLI 層

`src/cli.ts` は `template/` を対象ディレクトリへコピーするだけの薄いインストーラです。

主な関数:

- `parseOptions`: `--dir`, `--force`, `--help` を解釈します。
- `walk`: `template/` 配下の全ファイルを再帰的に列挙します。
- `copyTemplate`: コピー処理本体。既存ファイルは `init` ではスキップし、`--force` または `update` で上書きします。
- `cmdInit`: 初回インストール。`ESTAT_APP_ID` 未設定なら警告します。
- `cmdUpdate`: 既存スキルをテンプレート最新版で上書きします。
- `cmdDoctor`: 対象ディレクトリに期待ファイルが揃っているか確認します。

ビルド設定は `tsup.config.ts` です。`src/cli.ts` を Node 18 向け ESM として `dist/cli.js` に出力し、shebang を付与します。

## スキル実体層

スキル本体は `template/.agent/skills/jp-trade-stats/` にあります。

- `SKILL.md`: エージェント向けの操作手順。ユーザー依頼から `list -> meta -> fetch -> analyze` へ誘導します。
- `scripts/estat.ts`: e-Stat API クライアント兼 CLI。統計表検索、メタ取得、データ取得を担当します。
- `scripts/analyze.ts`: `estat.ts fetch` の正規化 JSON を集計します。
- `scripts/builders/`: レポートや CSV 生成の再利用スクリプト置き場です。
- `references/`: API、統計表、コード体系の説明資料です。

各エージェント用の `.claude`, `.codex`, `.gemini` 配下にはプロキシ `SKILL.md` だけを置き、実体は `.agent/skills/jp-trade-stats/` に集約します。

## データフロー

標準的な利用フローは次の通りです。

```text
自然言語の依頼
  -> SKILL.md の手順
  -> estat.ts list で statsDataId を探索
  -> estat.ts meta で次元とコードを確認
  -> estat.ts fetch で VALUE と CLASS_INF を結合して正規化
  -> analyze.ts または builders/ で集計
  -> JSON / CSV / Markdown レポート
```

`fetch` は初回ページだけ `metaGetFlg=Y` とし、`CLASS_INF` から `code -> name` の対応表を作ります。以降のページは `NEXT_KEY` を使って継続取得し、各 `VALUE` を `{dim, dim_name, value}` 形式へ正規化します。

## 分析ロジック

`analyze.ts` は以下のモードを持ちます。

- `timeseries`: `time` 単位で合算します。
- `yoy`: 時系列を作り、隣接年の前年比を計算します。
- `country`: `area` があれば国別、なければ `cat02` 別にランキングします。

品別国別表では金額・数量・月の区別が `cat02` に入ることがあります。集計前に `--cdCat02 140` などで計測を固定しないと、金額と数量や月別値が混ざるため、`sanityWarn` で警告します。

# jp-trade-stats

財務省貿易統計（普通貿易統計）を **e-Stat API** から検索・取得・分析するスキルを、Claude Code / Codex / Gemini CLI に導入する CLI インストーラ。

HS品目別・国別の輸出入額/数量、時系列・前年比（YoY）・国別ランキング、章合算の輸入額推計レポートなどを、エージェントへの自然言語の依頼から実行できる。

## 前提条件

- Node.js 18 以上
- e-Stat API のアプリケーションID（環境変数 `ESTAT_APP_ID`）— 無料登録: https://www.e-stat.go.jp/api/
- スキルを利用するエージェント CLI のいずれか
  - [Claude Code](https://docs.claude.com/claude-code)
  - OpenAI Codex CLI
  - Gemini CLI

## インストール

プロジェクトのルートディレクトリで以下を実行する。

```bash
npx <path>/jp-trade-stats init
```

実行すると、カレントディレクトリに以下の構造でスキルファイルが配置される。

```
<project>/
├── .agent/skills/jp-trade-stats/        # スキル本体
│   ├── SKILL.md                          # 仕様・標準ワークフロー
│   ├── scripts/estat.ts                  # e-Stat API クライアント（list/meta/fetch）
│   ├── scripts/analyze.ts                # 分析（timeseries/yoy/country）
│   ├── scripts/builders/                 # 再利用する集計・レポート生成スクリプト
│   └── references/                       # API・統計表・コードの参照資料
├── .claude/skills/jp-trade-stats/SKILL.md    # Claude Code 用プロキシ
├── .codex/skills/jp-trade-stats/SKILL.md     # Codex 用プロキシ
└── .gemini/skills/jp-trade-stats/SKILL.md    # Gemini 用プロキシ
```

実体は `.agent/skills/jp-trade-stats/` に置かれ、各エージェント用ディレクトリにはそれを参照するプロキシ `SKILL.md` が配置される。

### 続けて必要な準備

```bash
npm install --save-dev tsx
export ESTAT_APP_ID=your-application-id
```

## 使い方

Claude Code から以下のように呼び出す。

```
/jp-trade-stats 日本のコーヒー輸入をブラジル・コロンビア等の国別で比較したい
```

エージェントが SKILL.md の手順に従い、`list` → `meta` → `fetch` → `analyze` を実行する。直接スクリプトを叩くこともできる。

```bash
# 統計表を探す
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts list --word "品別国別表 AND 輸入 AND 確報" --limit 30

# 次元・コードを確認 → データ取得 → 国別ランキング
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <id> --cdCat01 <品目> --cdCat02 140 --cdTime <年> \
  | npx tsx .agent/skills/jp-trade-stats/scripts/analyze.ts --mode country --top 15
```

> 税関サイト本体（customs.go.jp/toukei）は robots.txt で自動取得を拒否しているため、必ず e-Stat API を使う。

## コマンド

```bash
npx jp-trade-stats <command> [options]
```

| コマンド | 説明 |
|---------|------|
| `init` | スキルファイルをターゲットディレクトリに配置する |
| `update` | 既存のスキルファイルを最新版で上書きする |
| `doctor` | インストール状態を確認する |

### オプション

| オプション | 説明 |
|-----------|------|
| `--dir <path>` | ターゲットディレクトリ（デフォルト: カレントディレクトリ） |
| `--force`, `-f` | 既存ファイルを上書きする（`init` のみ） |
| `--help`, `-h` | ヘルプを表示 |

## アンインストール

以下のディレクトリを削除する。

```bash
rm -rf .agent/skills/jp-trade-stats \
       .claude/skills/jp-trade-stats \
       .codex/skills/jp-trade-stats \
       .gemini/skills/jp-trade-stats
```

## ライセンス

MIT

出典表示: 本スキルが生成する成果物には出典（**財務省貿易統計 / e-Stat**）を明記すること。

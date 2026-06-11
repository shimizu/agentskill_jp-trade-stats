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

## e-Stat API キーの設定

本スキルは e-Stat API を利用するため、**アプリケーションID** を取得し、環境変数 `ESTAT_APP_ID` に設定する必要がある。

### 1. アプリケーションID（APIキー）の取得

1. [e-Stat API](https://www.e-stat.go.jp/api/) にアクセスし、ユーザー登録する（無料）。
2. ログイン後、「マイページ → API機能（アプリケーションID発行）」を開く。
3. 利用するアプリケーションのURL（例: `http://localhost/`）を入力してアプリケーションIDを発行する。
4. 発行された英数字の文字列がアプリケーションID（APIキー）となる。

### 2. 環境変数 `ESTAT_APP_ID` の設定

取得したアプリケーションIDを環境変数 `ESTAT_APP_ID` に設定する。スクリプトはこの環境変数から自動的にキーを読み込む。

**macOS / Linux（bash・zsh）**

```bash
# 一時的に設定（現在のシェルのみ有効）
export ESTAT_APP_ID=your-application-id

# 永続化（zsh の場合）
echo 'export ESTAT_APP_ID=your-application-id' >> ~/.zshrc
source ~/.zshrc

# 永続化（bash の場合）
echo 'export ESTAT_APP_ID=your-application-id' >> ~/.bashrc
source ~/.bashrc
```

**Windows（PowerShell）**

```powershell
# 一時的に設定（現在のセッションのみ有効）
$env:ESTAT_APP_ID = "your-application-id"

# 永続化（ユーザー環境変数として登録）
setx ESTAT_APP_ID "your-application-id"
```

### 3. 設定の確認

```bash
echo $ESTAT_APP_ID    # macOS / Linux
echo $env:ESTAT_APP_ID  # Windows PowerShell
```

設定したアプリケーションIDが表示されれば準備完了。`ESTAT_APP_ID` が未設定のままスクリプトを実行すると、認証エラーでデータ取得に失敗する。

## インストール

プロジェクトのルートディレクトリで以下を実行する。

```bash
npx <path>/agentskill_jp-trade-stats init
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

# 保守・改修手順

## 開発環境

前提:

- Node.js 18 以上
- npm
- e-Stat API のアプリケーションID（スキル実行時のみ）

セットアップ:

```bash
npm install
npm run build
```

`package.json` に `test` スクリプトはまだありません。現状の検証はビルドと CLI のスモークテストで行います。

## CLI の動作確認

```bash
npm run build
node dist/cli.js --help
node dist/cli.js init --dir /tmp/jp-trade-stats-check --force
node dist/cli.js doctor --dir /tmp/jp-trade-stats-check
```

確認ポイント:

- `init` で `template/` 配下のファイルが対象ディレクトリへコピーされること。
- 既存ファイルがある場合、`init` はスキップし、`init --force` と `update` は上書きすること。
- `doctor` が不足ファイルを検出すること。

## e-Stat スキルの動作確認

API実行には `ESTAT_APP_ID` が必要です。

```bash
export ESTAT_APP_ID=<your-application-id>
```

一時ディレクトリへインストールしてから、そこを作業ディレクトリにして確認します。

```bash
node dist/cli.js init --dir /tmp/jp-trade-stats-check --force
cd /tmp/jp-trade-stats-check
npm install --save-dev tsx
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts list --word "品別国別表 AND 輸入" --limit 3
```

`meta` と `fetch` は `list` で得た `statsDataId` を使います。

```bash
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts meta --id <statsDataId>
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts fetch --id <statsDataId> --limit 10 --pretty
```

外部APIのため、CI化する場合はネットワーク、APIキー、レート制限、統計表IDの変動を考慮してください。

## 変更時の見る場所

### インストール仕様を変える場合

`src/cli.ts` を変更します。コピー対象、上書きルール、警告文、ヘルプ表示が影響範囲です。変更後は `npm run build` と `/tmp` への `init/doctor` を必ず実行してください。

### スキルの使い方を変える場合

`template/.agent/skills/jp-trade-stats/SKILL.md` を変更します。Claude / Codex / Gemini 用のプロキシは基本的に実体参照だけにし、説明の重複を増やさないでください。

### API取得処理を変える場合

`template/.agent/skills/jp-trade-stats/scripts/estat.ts` を変更します。特に次を壊さないよう確認してください。

- `ESTAT_APP_ID` 未設定時の明確なエラー。
- `RESULT.STATUS` のエラー検出。
- `NEXT_KEY` によるページング。
- `CLASS_INF` と `VALUE` の結合。
- `--csv`, `--pretty`, `--limit` の挙動。

### 分析処理を変える場合

`template/.agent/skills/jp-trade-stats/scripts/analyze.ts` を変更します。品別国別表では `tab` が存在せず、計測が `cat02` に入る場合があるため、警告ロジックを維持してください。

### レポート生成を追加する場合

`template/.agent/skills/jp-trade-stats/scripts/builders/` に用途別のビルダーを追加します。

命名例:

```text
chapter-aggregate-annual-report.ts
country-ranking-report.ts
monthly-yoy-series.ts
```

入力は `out/data/*.json`、出力は既定で `out/` に置く設計に揃えると再利用しやすくなります。

## 既知の注意点

- `statsDataId` は公表更新で変わる可能性があります。READMEやサンプルに固定IDを書く場合は「参考値」と明記してください。
- `sample/generate-web-assets/` は別スキルのサンプルで、このパッケージ本体の配布物ではありません。通常は触らないでください。
- `dist/cli.js` は生成物です。ソース変更後に必要なら `npm run build` で再生成します。
- `node_modules/`, `out/`, APIキー、取得済みの大容量データはコミットしないでください。

## リリース前チェックリスト

- `npm run build` が成功する。
- `node dist/cli.js --help` の内容が期待通り。
- `/tmp` などの空ディレクトリに `init --force` できる。
- `doctor` が成功する。
- `template/` 変更時は、インストール後パスで `npx tsx .../estat.ts` のUsage表示、または実APIの最小確認を行う。
- README、`template/.agent/.../SKILL.md`、`docs/` の説明が矛盾していない。

# 引き継ぎドキュメント

このディレクトリは `jp-trade-stats` の保守・改修を引き継ぐための資料です。まず本ファイルを読み、必要に応じて詳細ドキュメントへ進んでください。

## このリポジトリの目的

`jp-trade-stats` は、財務省貿易統計（普通貿易統計）を e-Stat API から検索・取得・分析するエージェントスキルを、Claude Code / Codex / Gemini CLI 向けに配置する npm CLI インストーラです。

大きく分けて二層あります。

- npm CLI 層: `src/cli.ts`。`jp-trade-stats init/update/doctor` で `template/` を対象プロジェクトへコピーします。
- スキル実体層: `template/.agent/skills/jp-trade-stats/`。e-Stat API クライアント、分析ヘルパー、参照資料、再利用ビルダーを含みます。

## 読む順番

1. [architecture.md](./architecture.md)  
   全体構造、主要ファイル、CLI とスキルのデータフロー。
2. [estat-api-notes.md](./estat-api-notes.md)  
   e-Stat API の前提、実装で使うエンドポイント、注意点。
3. [maintenance.md](./maintenance.md)  
   ビルド、動作確認、変更時の手順、既知の注意点。

## 最低限の確認コマンド

```bash
npm install
npm run build
node dist/cli.js --help
node dist/cli.js init --dir /tmp/jp-trade-stats-check --force
node dist/cli.js doctor --dir /tmp/jp-trade-stats-check
```

スキル内の e-Stat API 実行には `ESTAT_APP_ID` が必要です。

```bash
export ESTAT_APP_ID=<your-application-id>
```

## 保守時の基本方針

- `template/` 配下のファイルが、ユーザー環境へ実際に配布される成果物です。
- `dist/` は `npm run build` の生成物です。ソース変更は `src/` または `template/` に対して行います。
- e-Stat の `statsDataId` は更新され得ます。固定値に依存せず、`estat.ts list` と `estat.ts meta` で都度確認する設計を維持してください。

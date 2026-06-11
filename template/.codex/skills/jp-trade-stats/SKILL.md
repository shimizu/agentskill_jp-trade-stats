---
name: jp-trade-stats
description: >-
  財務省貿易統計（普通貿易統計）を e-Stat API から検索・取得・分析する。HS品目別・国別の輸出入額/数量、
  時系列・前年比・国別ランキングなど。貿易統計 / 財務省貿易統計 / 輸出入統計 / 品別国別表 / 概況品 /
  e-Stat / customs.go.jp/toukei などの言及で起動する。
argument-hint: "[取得・分析したい貿易統計の内容]"
allowed-tools: Bash Read Write
user-invocable: true
---

# jp-trade-stats（プロキシ）

このスキルの本体は `.agent/skills/jp-trade-stats/` に配置されている。

スキル起動時は、以下を読み、その指示に従って動作すること:

- 仕様・標準ワークフロー: `.agent/skills/jp-trade-stats/SKILL.md`
- 実行スクリプト: `.agent/skills/jp-trade-stats/scripts/`（`estat.ts` / `analyze.ts` / `builders/`）
- 参照資料: `.agent/skills/jp-trade-stats/references/`（estat-api / trade-tables / codes）

## 前提

- e-Stat API の無料 `appId` を環境変数 `ESTAT_APP_ID` に設定しておく（未登録なら https://www.e-stat.go.jp/api/ ）。
- スクリプト実行に `tsx` が必要（`npm install --save-dev tsx`）。

## 呼び出し例

```bash
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts list --word "品別国別表 AND 輸入 AND 確報" --limit 30
```

パラメータの判断基準・次元（tab/cat01/cat02/area/time）の扱い・分析手順は
本体 `.agent/skills/jp-trade-stats/SKILL.md` を必ず参照すること。

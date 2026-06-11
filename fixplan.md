# e-Stat API 仕様レビュー Fix Plan

## レビュー範囲

対象は `template/.agent/skills/jp-trade-stats/scripts/estat.ts` を中心に、e-Stat API v3.0 の基本仕様と照合した。確認観点は、アプリケーションID、v3.0 JSON URL、URLエンコード、`RESULT.STATUS`、`RESULT_INF.NEXT_KEY`、公開時のクレジット表示。

## 修正候補

### 1. `RESULT.STATUS` の型ゆれに備える

- 対象: `template/.agent/skills/jp-trade-stats/scripts/estat.ts:44-49`
- 現状: `status !== 0` で成功判定している。
- 懸念: 公式サンプルではステータスを文字列として扱う例があり、JSONでも実レスポンスや変換経路によって `"0"` が返ると、成功レスポンスをエラー扱いする。
- 修正案: `status !== 0 && status !== "0"` のように、数値と文字列の成功値を許容する。
- 優先度: 高

### 2. `getStatsList` の継続取得キーを出力する

- 対象: `template/.agent/skills/jp-trade-stats/scripts/estat.ts:61-82`
- 現状: `--start` は受け付けるが、レスポンス側の `RESULT_INF.NEXT_KEY` を出力していない。
- 懸念: API仕様では一覧取得にも継続取得情報があり、検索結果が `--limit` を超える場合に次ページの開始位置が分かりにくい。
- 修正案: `list` の JSON 出力に `resultInfo` または `nextKey` を追加する。自動で全ページを取りに行く必要はない。
- 優先度: 中

### 3. 公開成果物向けのクレジット文を明確にする

- 対象: `template/.agent/skills/jp-trade-stats/scripts/builders/*.ts`, `template/.agent/skills/jp-trade-stats/SKILL.md`
- 現状: 出典表記はあるが、公式クレジット表示の免責文までは生成レポートに入っていない。
- 懸念: 公開サービス・公開レポートで使う場合、公式が求める「サービス内容は国によって保証されたものではない」旨の表示が抜ける。
- 修正案: `SKILL.md` の注意事項に公式クレジット文を追記し、既存ビルダーのMarkdown出力にも短い免責文を追加する。
- 優先度: 中

## 今回は見送るもの

- `getStatsDatas` 対応: 複数表一括取得は便利だが、現状の用途では必須ではない。
- gzip明示指定: Node.js の `fetch` 実装に任せればよく、手動解凍処理を増やすほどの必要はない。
- CSV APIへの切り替え: 現行のJSON取得は `CLASS_INF` と `VALUE` を結合しやすく、分析用途に合っている。
- `getStatsList` の全ページ自動取得: API負荷が増えやすい。まずは `nextKey` 表示だけで十分。

## 推奨実施順

1. `RESULT.STATUS` の成功判定を数値・文字列両対応にする。
2. `list` 出力に `NEXT_KEY` を含むページ情報を追加する。
3. 公式クレジット文を `SKILL.md` と既存Markdownビルダーに追記する。

## 確認方法

```bash
npm run build
node dist/cli.js init --dir /tmp/jp-trade-stats-check --force
node dist/cli.js doctor --dir /tmp/jp-trade-stats-check
```

API確認は `ESTAT_APP_ID` 設定後に行う。

```bash
cd /tmp/jp-trade-stats-check
npm install --save-dev tsx
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts list --word "品別国別表 AND 輸入" --limit 3
```

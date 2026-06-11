# e-Stat API 実装メモ

## 公式情報

確認した公式ページ:

- 利用ガイド: https://www.e-stat.go.jp/api/api-info/api-guide
- API仕様: https://www.e-stat.go.jp/api/api-info/api-spec
- APIの使い方: https://www.e-stat.go.jp/api/api-dev/how_to_use
- 提供データ: https://www.e-stat.go.jp/api/api-info/api-data
- クレジット表示: https://www.e-stat.go.jp/api/api-info/credit

## 認証と基本URL

e-Stat API はユーザ登録後に発行するアプリケーションIDが必要です。本プロジェクトでは環境変数 `ESTAT_APP_ID` から読みます。

```bash
export ESTAT_APP_ID=<your-application-id>
```

実装は v3.0 JSON API を使います。

```text
https://api.e-stat.go.jp/rest/3.0/app/json
```

公式仕様では XML / JSON / CSV が提供されていますが、このスキルではメタ情報と数値を結合しやすい JSON を標準にしています。

## 使用エンドポイント

`template/.agent/skills/jp-trade-stats/scripts/estat.ts` で使う主なエンドポイントは次の3つです。

| サブコマンド | e-Stat API | 用途 |
| --- | --- | --- |
| `list` | `getStatsList` | 普通貿易統計 `statsCode=00350300` 配下から統計表を検索する |
| `meta` | `getMetaInfo` | `statsDataId` の次元、分類、国、時間、単位コードを確認する |
| `fetch` | `getStatsData` | 実データを取得し、コード名付きのレコードへ正規化する |

将来、大量の複数表取得が必要になった場合は `getStatsDatas` の利用を検討してください。

## パラメータ設計

`call()` はすべてのリクエストに `appId` と `lang=J` を付与します。追加パラメータは `URLSearchParams` でエンコードされます。

`fetch` では次のような e-Stat フィルタを CLI オプションとして透過します。

```text
--cdCat01 <code>
--cdCat01From <code> --cdCat01To <code>
--cdCat02 <code>
--cdArea <code>
--cdTime <code>
--cdTimeFrom <code> --cdTimeTo <code>
--lvCat01 <level>
```

現在の透過判定は `/^(cd|lv)(Tab|Cat\d\d|Area|Time)/` です。`cat03` 以降や `lvArea` もこの形式なら通ります。

## レスポンス処理

e-Stat のレスポンスは先頭オブジェクト配下に `RESULT` を持ちます。`RESULT.STATUS === 0` を成功とし、それ以外は `ERROR_MSG` を含めて例外にします。

`getStatsData` の主な構造:

```text
STATISTICAL_DATA
├── TABLE_INF
├── CLASS_INF.CLASS_OBJ[]
├── DATA_INF.VALUE[]
└── RESULT_INF.NEXT_KEY
```

`VALUE` の `@cat01`, `@area`, `@time` などを `CLASS_INF` の同じ `@id` と照合し、`cat01_name`, `area_name`, `time_name` を付与します。`$` は数値化して `value` に入れます。空文字は `null` です。

## 貿易統計固有の注意点

普通貿易統計の `statsCode` は `00350300` です。

表ごとに次元構造が違うため、コードを推測しないでください。必ず次の順に確認します。

```bash
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts list --word "品別国別表 AND 輸入 AND 確報"
npx tsx .agent/skills/jp-trade-stats/scripts/estat.ts meta --id <statsDataId> --full
```

品別国別表では、金額・数量・月の区別が `cat02` に入るケースがあります。年計金額は `cat02=140`、月別金額は `170`, `200`, `230` のようなコードで表現されることがあります。集計時は fetch 時点で `--cdCat02` を固定してください。

## クレジットと公開時の表示

公開サービスや公開レポートでは、e-Stat API を利用している旨と、内容が国に保証されたものではない旨を利用者が参照できる場所へ表示する必要があります。レポート生成時は少なくとも次を明記してください。

```text
出典: 財務省貿易統計（普通貿易統計）/ e-Stat API
```

APIキーや実データ取得用のローカル環境変数はコミットしないでください。

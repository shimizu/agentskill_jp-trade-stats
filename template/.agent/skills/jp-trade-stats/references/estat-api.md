# e-Stat API リファレンス（貿易統計利用に必要な部分）

公式仕様: https://www.e-stat.go.jp/api/api-info/e-stat-manual3-0 （バージョン 3.0）

## 認証

全リクエストに `appId`（アプリケーションID）が必須。無料登録: https://www.e-stat.go.jp/api/
本スキルのスクリプトは環境変数 `ESTAT_APP_ID` から読む。

```bash
export ESTAT_APP_ID=<your-application-id>
```

## エンドポイント（バージョン3.0, JSON）

ベース: `https://api.e-stat.go.jp/rest/3.0/app/json/`

| 機能 | パス | 用途 |
|---|---|---|
| 統計表情報取得 | `getStatsList` | 統計表（statsDataId）を検索・列挙 |
| メタ情報取得 | `getMetaInfo` | 表の次元（表章/分類/地域/時間）とコード一覧 |
| 統計データ取得 | `getStatsData` | 実データ（数値）を取得 |
| 統計データ一括取得 | `getStatsDatas` | 複数IDをまとめて取得（POST） |

CSV版は `app/getSimpleStatsData` 等（`json/` を外し `getSimple...`）。
本スキルは JSON を取得し正規化する方式を採用（コード→名称の結合がしやすい）。

## getStatsList の主なパラメータ

| パラメータ | 意味 | 例 |
|---|---|---|
| `statsCode` | 政府統計コード | `00350300`（普通貿易統計） |
| `searchWord` | キーワード（AND/OR/NOT可） | `品別国別表 AND 輸出` |
| `surveyYears` | 調査年月 | `2024` / `202412` / `202401-202412` |
| `limit` | 取得件数（既定10万） | `50` |
| `startPosition` | 継続取得の開始行 | `NEXT_KEY` の値 |

## getStatsData の主なパラメータ

| パラメータ | 意味 |
|---|---|
| `statsDataId` | 統計表ID（必須） |
| `cdTab` | 表章項目の単一コード（カンマ区切りで最大100） |
| `cdCat01` / `cdCat01From` / `cdCat01To` | 分類事項01（品目）の単一/範囲 |
| `cdCat02` … `cdCat15` | 分類事項02〜15 |
| `cdArea` / `cdAreaFrom` / `cdAreaTo` | 地域（国）の単一/範囲 |
| `cdTime` / `cdTimeFrom` / `cdTimeTo` | 時間軸の単一/範囲 |
| `lvTab` / `lvCat01` / `lvArea` / `lvTime` | 階層レベルでの絞り込み（`X` / `X-Y` / `-Y` / `X-`） |
| `metaGetFlg` | メタ情報同梱（既定Y） |
| `limit` / `startPosition` | ページング（継続は `RESULT_INF.NEXT_KEY`） |

`From`/`To` の値には `min` / `max` の特殊キーワードも使える。

## レスポンス構造（getStatsData JSON）

```
GET_STATS_DATA
└ STATISTICAL_DATA
   ├ RESULT_INF.NEXT_KEY      ← 継続データがある場合の次開始行
   ├ TABLE_INF                ← 表のメタ（タイトル, 単位 等）
   ├ CLASS_INF.CLASS_OBJ[]    ← 各次元の定義
   │    @id (tab/cat01/area/time...), @name, CLASS[]{@code,@name,@level,@unit}
   └ DATA_INF.VALUE[]         ← 実データ
        {"@tab":"..","@cat01":"..","@area":"..","@time":"..","@unit":"..","$":"12345"}
```

正規化のコツ: `VALUE` の各 `@xxx` を `CLASS_INF` の同名次元の code→name で引き当て、`$` を数値に。
`estat.ts fetch` がこれを自動で行い、`{code, code_name, value}` 形式のレコード配列にする。

## エラーと制約

- レスポンス先頭の `RESULT.STATUS` が 0 以外はエラー（`ERROR_MSG` 参照）。
- 1リクエストの取得上限は10万件。超過時は `NEXT_KEY` でページング（`estat.ts fetch` は自動対応）。
- 過度な連続リクエストは避ける。一括は `getStatsDatas` を検討。
- クレジット表示: 出力物には出典（e-Stat / 財務省貿易統計）を明記する。

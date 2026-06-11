#!/usr/bin/env -S npx tsx
/**
 * estat.ts — 財務省貿易統計（普通貿易統計）を扱う e-Stat API クライアント兼 CLI
 *
 * 普通貿易統計の政府統計コード（statsCode） = 00350300
 *
 * e-Stat のアプリケーションIDが必須。環境変数で設定する:
 *   export ESTAT_APP_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * 取得（無料）: https://www.e-stat.go.jp/api/
 *
 * サブコマンド:
 *   list   — 統計表を検索（getStatsList）。statsDataId の一覧を返す
 *   meta   — 表の次元を取得・要約（getMetaInfo）
 *   fetch  — 統計データを取得（getStatsData）。レコード形式に正規化する
 *
 * 実行:  npx tsx estat.ts <サブコマンド> [オプション]
 */

const BASE = "https://api.e-stat.go.jp/rest/3.0/app/json";
const TRADE_STATS_CODE = "00350300"; // 普通貿易統計

function appId(): string {
  const id = process.env.ESTAT_APP_ID;
  if (!id) {
    console.error(
      "ERROR: ESTAT_APP_ID is not set.\n" +
        "Register at https://www.e-stat.go.jp/api/ and run:\n" +
        "  export ESTAT_APP_ID=<your-application-id>",
    );
    process.exit(1);
  }
  return id;
}

async function call(path: string, params: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams({ appId: appId(), lang: "J" });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, String(v));
  }
  const url = `${BASE}/${path}?${usp.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const json: any = await res.json();
  // e-Stat のレスポンスは必ず RESULT ブロックを持ち、STATUS が 0 で成功。
  // 実レスポンスや変換経路によって数値 0 ではなく文字列 "0" が返ることがあるため両方を許容する。
  const root = json[Object.keys(json)[0]];
  const status = root?.RESULT?.STATUS;
  if (status !== 0 && status !== "0") {
    throw new Error(`e-Stat error ${status}: ${root?.RESULT?.ERROR_MSG ?? "unknown"}`);
  }
  return root;
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// ---------------------------------------------------------------------------
// list: 統計表を検索する
// ---------------------------------------------------------------------------
async function cmdList(opts: Record<string, string>) {
  const root = await call("getStatsList", {
    statsCode: opts.statsCode ?? TRADE_STATS_CODE,
    searchWord: opts.word,
    surveyYears: opts.years, // yyyy | yyyymm | yyyymm-yyyymm（調査年月）
    limit: opts.limit ?? "50",
    startPosition: opts.start,
    explanationGetFlg: "N",
  });
  const tables = asArray(root.DATALIST_INF?.TABLE_INF);
  const out = tables.map((t: any) => ({
    statsDataId: t["@id"],
    title:
      [t.STAT_NAME?.["$"], t.TITLE?.["$"] ?? t.TITLE, t.TITLE_SPEC?.TABLE_NAME]
        .filter(Boolean)
        .join(" / "),
    cycle: t.CYCLE,
    surveyDate: t.SURVEY_DATE,
    updated: t.UPDATED_DATE,
    rows: t.OVERALL_TOTAL_NUMBER,
  }));
  // 検索結果が limit を超える場合の継続取得情報。NEXT_KEY があれば
  // 次回 --start <nextKey> で続きを取得できる（自動全ページ取得はしない）。
  const ri = root.DATALIST_INF?.RESULT_INF;
  const resultInfo = ri
    ? {
        total: ri.TOTAL_NUMBER,
        from: ri.FROM_NUMBER,
        to: ri.TO_NUMBER,
        nextKey: ri.NEXT_KEY, // 続きがある場合のみ存在
      }
    : undefined;
  console.log(JSON.stringify({ count: out.length, resultInfo, tables: out }, null, 2));
}

// ---------------------------------------------------------------------------
// meta: 表の次元を要約する（利用可能なフィルタを把握する）
// ---------------------------------------------------------------------------
async function cmdMeta(opts: Record<string, string>) {
  if (!opts.id) throw new Error("meta requires --id <statsDataId>");
  const root = await call("getMetaInfo", { statsDataId: opts.id });
  const classObjs = asArray(root.METADATA_INF?.CLASS_INF?.CLASS_OBJ);
  const summary = classObjs.map((c: any) => {
    const items = asArray(c.CLASS);
    return {
      paramId: c["@id"], // tab | cat01 | cat02 | area | time …（API フィルタキーになる）
      name: c["@name"], // 表章項目 | 統計品目 | 国 | 時間軸 …
      itemCount: items.length,
      sample: items.slice(0, opts.full ? items.length : 8).map((i: any) => ({
        code: i["@code"],
        name: i["@name"],
        level: i["@level"],
        unit: i["@unit"],
      })),
    };
  });
  console.log(
    JSON.stringify(
      {
        statsDataId: opts.id,
        hint: "Use paramId as the API filter key: cd<ParamId> for single codes, cd<ParamId>From/To for ranges, lv<ParamId> for hierarchy levels.",
        dimensions: summary,
      },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------------------
// fetch: データを取得しレコードに正規化する（meta からコード＋名称を結合）
// ---------------------------------------------------------------------------
async function cmdFetch(opts: Record<string, string>) {
  if (!opts.id) throw new Error("fetch requires --id <statsDataId>");

  // フィルタ系パラメータをそのまま透過する。例: --cdCat01 270900 --cdAreaFrom 103 …
  const passthrough: Record<string, string> = {};
  for (const key of Object.keys(opts)) {
    if (/^(cd|lv)(Tab|Cat\d\d|Area|Time)/.test(key)) passthrough[key] = opts[key];
  }

  let start: string | undefined = opts.start;
  const records: any[] = [];
  let classMap: Record<string, Record<string, any>> = {};
  let tableInfo: any = null;
  const maxRows = opts.limit ? parseInt(opts.limit, 10) : Infinity;

  for (let page = 0; page < 200; page++) {
    const root = await call("getStatsData", {
      statsDataId: opts.id,
      ...passthrough,
      startPosition: start,
      limit: "100000",
      metaGetFlg: page === 0 ? "Y" : "N",
      cntGetFlg: "N",
      annotationGetFlg: "N",
      explanationGetFlg: "N",
      sectionHeaderFlg: "1",
    });
    const sd = root.STATISTICAL_DATA;
    if (page === 0) {
      tableInfo = sd.TABLE_INF;
      // 次元ごとに code→name の対応表を作る。
      for (const c of asArray(sd.CLASS_INF?.CLASS_OBJ)) {
        const m: Record<string, any> = {};
        for (const i of asArray(c.CLASS)) m[i["@code"]] = i;
        classMap[c["@id"]] = m;
      }
    }
    for (const v of asArray(sd.DATA_INF?.VALUE)) {
      const rec: any = {};
      for (const [k, val] of Object.entries(v)) {
        if (k === "$") {
          rec.value = val === "" ? null : Number(val);
        } else if (k.startsWith("@")) {
          const dim = k.slice(1); // tab, cat01, area, time, unit …
          rec[dim] = val;
          const named = classMap[dim]?.[val as string]?.["@name"];
          if (named) rec[`${dim}_name`] = named;
        }
      }
      records.push(rec);
      if (records.length >= maxRows) break;
    }
    const nextKey = root.STATISTICAL_DATA?.RESULT_INF?.NEXT_KEY;
    if (!nextKey || records.length >= maxRows) break;
    start = String(nextKey);
  }

  const payload = {
    statsDataId: opts.id,
    title: tableInfo?.TITLE_SPEC?.TABLE_NAME ?? tableInfo?.TITLE?.["$"],
    recordCount: records.length,
    records,
  };

  if (opts.csv) {
    const cols = Array.from(
      records.reduce<Set<string>>((s, r) => {
        Object.keys(r).forEach((k) => s.add(k));
        return s;
      }, new Set<string>()),
    );
    const esc = (x: any) =>
      x === null || x === undefined ? "" : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x);
    const lines = [cols.join(",")];
    for (const r of records) lines.push(cols.map((c) => esc(r[c])).join(","));
    process.stdout.write(lines.join("\n") + "\n");
  } else {
    process.stdout.write(JSON.stringify(payload, null, opts.pretty ? 2 : 0) + "\n");
  }
}

// ---------------------------------------------------------------------------
// 引数パース
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) o[key] = "true";
      else {
        o[key] = next;
        i++;
      }
    }
  }
  return o;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = parseArgs(rest);
  try {
    switch (cmd) {
      case "list":
        await cmdList(opts);
        break;
      case "meta":
        await cmdMeta(opts);
        break;
      case "fetch":
        await cmdFetch(opts);
        break;
      default:
        console.error(
          "Usage:\n" +
            "  estat.ts list  [--word <kw>] [--years yyyy|yyyymm-yyyymm] [--limit N]\n" +
            "  estat.ts meta  --id <statsDataId> [--full]\n" +
            "  estat.ts fetch --id <statsDataId> [--cdCat01 <code>] [--cdArea <code>]\n" +
            "                 [--cdTimeFrom <code> --cdTimeTo <code>] [--csv] [--pretty] [--limit N]",
        );
        process.exit(1);
    }
  } catch (e: any) {
    console.error("FAILED:", e.message);
    process.exit(1);
  }
}

main();

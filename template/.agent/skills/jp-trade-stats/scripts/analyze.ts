#!/usr/bin/env -S npx tsx
/**
 * analyze.ts — 正規化済み貿易統計レコードの分析ヘルパー。
 *
 * 入力: `estat.ts fetch` が出力する JSON（{records:[...]} 形式）。
 * stdin 経由のパイプ、または --in <file> で渡す。
 *
 * 各レコードは次元コード ＋ `_name` フィールド ＋ 数値 `value` を持つ。
 * 品別国別表 / 概況品別表の典型的な次元:
 *   tab   表章項目（数量1 / 数量2 / 金額）
 *   cat01 統計品目 または 概況品（HS / 品目）
 *   cat02 計測（数量/金額）と月の別が入る表もある（140=合計_金額, 170=1月_金額 …）
 *   area  国（国・地域）   ← 表によっては cat02 に入る
 *   time  時間軸（年 または 年月）
 *
 * モード:
 *   --mode timeseries  time で集約し value を合計（任意で tab/area/cat で絞り込み）
 *   --mode yoy         時系列の前年比
 *   --mode country     固定した時点（と品目）で国別に value をランキング
 *
 * 共通オプション:
 *   --tab <code|name>     表章項目を1つに絞る（例: 金額の計測）。tab 次元を持つ表のみ有効
 *   --area <code|name>    国・地域を1つに絞る
 *   --cat <code|name>     品目を1つに絞る（cat01 / cat02 の両方にマッチ）
 *   --top N               （country モード）上位 N 件を残す
 */

type Rec = Record<string, any> & { value: number | null };

function loadInput(file?: string): Promise<Rec[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const fs = require("fs");
    const stream = file ? fs.createReadStream(file) : process.stdin;
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      try {
        const txt = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(txt);
        resolve(parsed.records ?? parsed);
      } catch (e) {
        reject(e);
      }
    });
    stream.on("error", reject);
  });
}

// レコードの次元を、コード または 名称の部分一致で照合する
function dimMatches(rec: Rec, dim: string, q?: string): boolean {
  if (!q) return true;
  const code = rec[dim];
  const name = rec[`${dim}_name`];
  return code === q || (typeof name === "string" && name.includes(q));
}

// 「cat」は表によって cat01 か cat02 のどちらかに入る
function catMatches(rec: Rec, q?: string): boolean {
  if (!q) return true;
  return dimMatches(rec, "cat01", q) || dimMatches(rec, "cat02", q);
}

function applyFilters(records: Rec[], o: Record<string, string>): Rec[] {
  return records.filter(
    (r) =>
      dimMatches(r, "tab", o.tab) &&
      dimMatches(r, "area", o.area) &&
      catMatches(r, o.cat),
  );
}

function sumBy(records: Rec[], key: string): Map<string, { code: string; name: string; sum: number }> {
  const m = new Map<string, { code: string; name: string; sum: number }>();
  for (const r of records) {
    const code = r[key];
    if (code === undefined) continue;
    const entry = m.get(code) ?? { code, name: r[`${key}_name`] ?? code, sum: 0 };
    entry.sum += r.value ?? 0;
    m.set(code, entry);
  }
  return m;
}

function timeseries(records: Rec[]) {
  const m = sumBy(records, "time");
  return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function yoy(records: Rec[]) {
  const ts = timeseries(records);
  // コードに期間セグメントがあれば年をまたいで同じ期間でグループ化し、無ければ年単位で比較する。
  // 末尾セグメントを期間キーとして取り出し、同一期間の隣接する年同士を比較する。
  // （注: 貿易統計の time コードは年次のみ "yyyy000000" のことが多く、その場合は年次同士の比較になる。
  //   月の別は time ではなく cat02 に入るため、前年同月比は cat02 をその月に固定して使う。）
  const period = (code: string) => code.slice(-4); // 簡易的な期間キー
  const yearOf = (code: string) => code.slice(0, 4);
  const byPeriod = new Map<string, { code: string; name: string; sum: number }[]>();
  for (const p of ts) {
    const k = period(p.code);
    (byPeriod.get(k) ?? byPeriod.set(k, []).get(k)!).push(p);
  }
  const out: any[] = [];
  for (const points of byPeriod.values()) {
    points.sort((a, b) => yearOf(a.code).localeCompare(yearOf(b.code)));
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1].sum;
      const cur = points[i].sum;
      out.push({
        time: points[i].name ?? points[i].code,
        value: cur,
        prevValue: prev,
        yoyPct: prev ? +(((cur - prev) / prev) * 100).toFixed(2) : null,
      });
    }
  }
  return out.sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function country(records: Rec[], top: number) {
  const key = records.some((r) => r.area !== undefined) ? "area" : "cat02";
  const m = sumBy(records, key);
  return [...m.values()].sort((a, b) => b.sum - a.sum).slice(0, top);
}

// フィルタ後にデータが空のとき、または計測（金額/数量/月）が混在したまま合計すると
// 無意味になるときに警告する。貿易統計では計測は `tab` 次元ではなく cat02
// （140=合計_金額, 170=1月_金額 …）に入る。詳細は references/trade-tables.md を参照。
function sanityWarn(filtered: Rec[], raw: Rec[], o: Record<string, string>) {
  if (filtered.length === 0) {
    if (o.tab && !raw.some((r) => r.tab !== undefined)) {
      console.error(
        `WARNING: --tab ${o.tab} matched 0 records — this table has no 'tab' dimension. ` +
          `The measure is likely in cat02; fix it at fetch time with --cdCat02 <code> ` +
          `(e.g. 140=合計_金額, 170=1月_金額).`,
      );
    } else {
      console.error("WARNING: 0 records after filtering — check your --tab/--area/--cat values.");
    }
    return;
  }
  // 計測の次元に複数の異なる値が含まれていると、合計が数量・金額・各月を混ぜてしまう。
  const measureKey = filtered.some((r) => r.tab !== undefined) ? "tab" : "cat02";
  const measures = new Set(filtered.map((r) => r[measureKey]).filter((v) => v !== undefined));
  if (measures.size > 1) {
    const sample = [...measures].slice(0, 6).join(", ");
    console.error(
      `WARNING: aggregating over ${measures.size} different '${measureKey}' measures (${sample}${
        measures.size > 6 ? ", …" : ""
      }) — sums mix 金額/数量/月 and are likely meaningless. ` +
        `Fix the measure at fetch time, e.g. --cdCat02 140 (年計金額).`,
    );
  }
}

async function main() {
  const o: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = argv[i + 1]?.startsWith("--") ? "true" : argv[++i];
      o[k] = v ?? "true";
    }
  }

  const raw = await loadInput(o.in);
  const records = applyFilters(raw, o);
  sanityWarn(records, raw, o);
  let result: any;
  switch (o.mode) {
    case "yoy":
      result = { mode: "yoy", filters: { tab: o.tab, area: o.area, cat: o.cat }, series: yoy(records) };
      break;
    case "country":
      result = {
        mode: "country",
        top: country(records, o.top ? parseInt(o.top, 10) : 15),
      };
      break;
    case "timeseries":
    default:
      result = {
        mode: "timeseries",
        filters: { tab: o.tab, area: o.area, cat: o.cat },
        series: timeseries(records),
      };
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

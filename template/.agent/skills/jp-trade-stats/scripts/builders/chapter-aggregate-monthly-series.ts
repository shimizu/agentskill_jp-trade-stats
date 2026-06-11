#!/usr/bin/env -S npx tsx
/**
 * chapter-aggregate-monthly-series.ts — 章合算の月次輸入額系列を組み立てる
 *
 * 複数の類（HS 2桁の章）を合算した月次の輸入額系列を作る再利用可能なビルダー。
 * <outDir>/data/monthly-<NN>-<year>.json（estat.ts fetch の出力, 月別金額 cat02, 2025/2026）を読み、
 * 章別・月別の金額(千円)を合算し、2025年1月〜2026年4月の月次系列を作って
 * コンソール表示 ＋ <outDir>/petroleum-monthly-2025-2026.csv に出力する。
 *
 * 実行: npx tsx scripts/builders/chapter-aggregate-monthly-series.ts [outDir]
 *   - outDir 省略時は作業ディレクトリ直下の out/ を使う。
 *   - 入力データ（data/monthly-<NN>-<year>.json）は事前に estat.ts fetch で用意しておく。
 */
import * as fs from "fs";
import * as path from "path";

const OUT = path.resolve(process.argv[2] ?? "out");
const CHAPTERS = [
  { nn: "29", name: "有機化学品" },
  { nn: "39", name: "プラスチック" },
  { nn: "40", name: "ゴム" },
  { nn: "54", name: "人造繊維(長)" },
  { nn: "55", name: "人造繊維(短)" },
];
// cat02 月別金額コード → 月番号
const CODE_TO_MONTH: Record<string, number> = {
  "170": 1, "200": 2, "230": 3, "260": 4, "290": 5, "320": 6,
  "350": 7, "380": 8, "410": 9, "440": 10, "470": 11, "500": 12,
};

// (year, month) → 章 → 千円
const data: Record<string, Record<string, number>> = {};
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

for (const c of CHAPTERS) {
  for (const year of [2025, 2026]) {
    const file = path.join(OUT, "data", `monthly-${c.nn}-${year}.json`);
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const r of payload.records ?? []) {
      const mo = CODE_TO_MONTH[r.cat02];
      if (!mo) continue;
      const v = r.value ?? 0;
      if (v === 0) continue;
      const k = key(year, mo);
      (data[k] ??= {})[c.nn] = (data[k]?.[c.nn] ?? 0) + v;
    }
  }
}

// データのある月のみ（空月は除外）昇順
const months = Object.keys(data).sort();
const oku = (sen: number) => sen / 100_000; // 千円→億円
const fmt = (sen: number) => oku(sen).toLocaleString("ja-JP", { maximumFractionDigits: 0 });

// コンソール表示
console.log("石油由来素材(4分野5章) 月次輸入額 [億円]  出典: 財務省貿易統計/e-Stat");
console.log("（2025年=確々報, 2026年1-3月=確報・4月=速報）\n");
const header = ["月", ...CHAPTERS.map((c) => c.name), "合計"].map((h) => h.padStart(11)).join("");
console.log(header);
const csv = ["年月," + CHAPTERS.map((c) => `${c.nn}類_${c.name}_千円`).join(",") + ",合計_千円,合計_億円"];
let prevTotal = 0;
for (const m of months) {
  const row = data[m];
  const vals = CHAPTERS.map((c) => row[c.nn] ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  console.log([m, ...vals.map(fmt), fmt(total)].map((x) => String(x).padStart(11)).join(""));
  csv.push(`${m},${vals.join(",")},${total},${oku(total).toFixed(0)}`);
  prevTotal = total;
}

fs.writeFileSync(path.join(OUT, "petroleum-monthly-2025-2026.csv"), csv.join("\n") + "\n");
console.log(`\n対象期間: ${months[0]} 〜 ${months[months.length - 1]}（${months.length}か月）`);
console.log("CSV: out/petroleum-monthly-2025-2026.csv");

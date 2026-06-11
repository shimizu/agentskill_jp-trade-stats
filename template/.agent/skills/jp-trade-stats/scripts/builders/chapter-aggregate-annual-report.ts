#!/usr/bin/env -S npx tsx
/**
 * chapter-aggregate-annual-report.ts — 章合算の年次輸入額推計レポート生成
 *
 * 複数の類（HS 2桁の章）を合算した年次の輸入額推計を、Markdown レポート＋CSV にまとめる
 * 再利用可能なビルダー。<outDir>/data/chapter-<NN>.json（estat.ts fetch の出力,
 * cat02=140 合計金額, 2023-2024）を読み、章別の年計金額・前年比・構成比を集計して
 * <outDir> に書き出す。
 *
 * 実行: npx tsx scripts/builders/chapter-aggregate-annual-report.ts [outDir]
 *   - outDir 省略時は作業ディレクトリ直下の out/ を使う。
 *   - 入力データ（data/chapter-<NN>.json）は事前に estat.ts fetch で用意しておく。
 */
import * as fs from "fs";
import * as path from "path";

const OUT = path.resolve(process.argv[2] ?? "out");
const STATS_DATA_ID = "0003425294"; // 確速 品別国別表 輸入(2021-2024確定, 2025確々報)
const FETCHED = "2026-06-07"; // 取得日
const YEARS = ["2023年", "2024年"] as const;

// 推計対象（石油化学4分野）。note は推計上の留意（非石油由来の混在）。
const CHAPTERS = [
  { nn: "29", name: "有機化学品", note: "大半が石油化学由来。一部に非石油由来あり" },
  { nn: "39", name: "プラスチック及びその製品", note: "ほぼ全量が石油由来" },
  { nn: "40", name: "ゴム及びその製品", note: "合成ゴムは石油由来。天然ゴムを含む" },
  { nn: "54", name: "人造繊維の長繊維", note: "合成繊維は石油由来。再生繊維（セルロース系）を含む" },
  { nn: "55", name: "人造繊維の短繊維", note: "同上（合成＋再生繊維）" },
];

type Rec = { cat02?: string; time?: string; time_name?: string; value: number | null };

// 1章分の JSON から年別合計（千円）を求める。
function chapterTotals(nn: string): Record<string, number> {
  const file = path.join(OUT, "data", `chapter-${nn}.json`);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const recs: Rec[] = payload.records ?? [];
  const byYear: Record<string, number> = {};
  for (const r of recs) {
    const y = r.time_name ?? r.time ?? "";
    byYear[y] = (byYear[y] ?? 0) + (r.value ?? 0);
  }
  return byYear;
}

const yoy = (cur: number, prev: number) =>
  prev ? +(((cur - prev) / prev) * 100).toFixed(2) : NaN;

// 千円 → 億円（1億円 = 100,000 千円）
const oku = (sen: number) => sen / 100_000;
const fmtOku = (sen: number) => oku(sen).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
const fmtCho = (sen: number) => (sen / 1_000_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const fmtPct = (n: number) => (Number.isNaN(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%");

// 集計
const rows = CHAPTERS.map((c) => {
  const t = chapterTotals(c.nn);
  const v2023 = t["2023年"] ?? 0;
  const v2024 = t["2024年"] ?? 0;
  return { ...c, v2023, v2024, yoy: yoy(v2024, v2023) };
});
const total2023 = rows.reduce((s, r) => s + r.v2023, 0);
const total2024 = rows.reduce((s, r) => s + r.v2024, 0);
const totalYoY = yoy(total2024, total2023);

// ---- CSV ----
const csvLines = ["章,品目名,2023年_千円,2024年_千円,前年比_%,2024年構成比_%"];
for (const r of rows) {
  const share = ((r.v2024 / total2024) * 100).toFixed(2);
  csvLines.push(`${r.nn},${r.name},${r.v2023},${r.v2024},${Number.isNaN(r.yoy) ? "" : r.yoy},${share}`);
}
csvLines.push(`合計,石油由来素材(4分野),${total2023},${total2024},${totalYoY},100.00`);
fs.writeFileSync(path.join(OUT, "petroleum-derived-imports-2024.csv"), csvLines.join("\n") + "\n");

// ---- Markdown ----
const tableRows = rows
  .map((r) => {
    const share = ((r.v2024 / total2024) * 100).toFixed(1);
    return `| ${r.nn}類 | ${r.name} | ${fmtOku(r.v2024)} | ${fmtOku(r.v2023)} | ${fmtPct(r.yoy)} | ${share}% |`;
  })
  .join("\n");

const md = `# 石油由来素材 輸入額推計レポート（2024年）

> 出典: **財務省貿易統計（普通貿易統計）/ e-Stat API**　|　取得日: ${FETCHED}　|　統計表ID: \`${STATS_DATA_ID}\`（確定値）

## 推計サマリ

2024年の日本の**石油由来素材（石油化学4分野）の輸入額は約 ${fmtCho(total2024)} 兆円**（${fmtOku(total2024)} 億円）と推計される。
前年（2023年 約 ${fmtCho(total2023)} 兆円）からの増減は **${fmtPct(totalYoY)}**。

- 推計対象 = 有機化学品（29類）＋ プラスチック（39類）＋ ゴム（40類）＋ 人造繊維（54・55類）。
- 金額は CIF・確定値、単位は千円を億/兆円に換算（生値は CSV を参照）。

## 章別内訳（2024年）

| 章 | 品目（類） | 2024年(億円) | 2023年(億円) | 前年比 | 構成比 |
|---|---|--:|--:|--:|--:|
${tableRows}
| **計** | **石油由来素材（4分野）** | **${fmtOku(total2024)}** | **${fmtOku(total2023)}** | **${fmtPct(totalYoY)}** | **100.0%** |

- 構成比は2024年推計額に占める各章の割合。
- プラスチック（39類）と有機化学品（29類）の2章で大半を占める。

## 方法論

1. 「石油由来素材」に対応する単一の HS コードは存在しないため、関連する**類（HS 2桁の章）を合算した推計値**である。
2. 各章は \`品別国別表（輸入・確定）\` から、品目コードを章レンジ（例: 39類＝\`390000000\`〜\`399999999\`）で範囲指定し、
   計測は \`cat02=140\`（合計_金額）に固定、全相手国分を合算して年計金額とした。
3. 対象年は 2024年（確定値）。前年比は 2023年（確定値）との比較。
4. 集計に用いた生データは \`out/data/chapter-<章>.json\`、章別集計は \`out/petroleum-derived-imports-2024.csv\` に格納。

## 注意・限界

- **章単位の概算のため過大側**になりうる。各章には石油由来でない品目が一部含まれる:
  - 40類ゴム … 天然ゴムを含む。
  - 54・55類人造繊維 … レーヨン等の再生繊維（セルロース系）を含む。
  - 29類有機化学品 … 一部に非石油由来の有機化合物を含む。
- 逆に、塗料（32類）・界面活性剤（34類）・合成樹脂製品の一部など、他章に分散する石油由来品目は本推計に含めていない。
- 原油・石油製品そのもの（27類 鉱物性燃料）は「素材」ではなく燃料として本推計の対象外。
- 数値は確定値だが、統計表は将来差し替えられうる（statsDataId は取得時点のもの）。

---
*本レポートは財務省貿易統計（e-Stat API）を基に \`jp-trade-stats\` スキルで自動生成した推計です。*
`;

fs.writeFileSync(path.join(OUT, "petroleum-derived-imports-2024.md"), md);

// コンソール要約
console.log("生成完了:");
console.log("  out/petroleum-derived-imports-2024.md");
console.log("  out/petroleum-derived-imports-2024.csv");
console.log(`2024年 石油由来素材 輸入額推計 = ${fmtCho(total2024)} 兆円（前年比 ${fmtPct(totalYoY)}）`);

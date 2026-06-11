import * as fs from "node:fs";
import * as path from "node:path";
import { appendAuditEvent } from "../audit-log.ts";

type Rec = Record<string, any> & { value: number | null };

type Item = {
  code: string;
  name: string;
  note?: string;
  file?: string;
};

type DisplayConfig = {
  label: string;
  divisor?: number;
  maximumFractionDigits?: number;
};

type BaseConfig = {
  title: string;
  source?: string;
  fetched?: string;
  statsDataId?: string;
  valueUnit?: string;
  display?: DisplayConfig;
  items: Item[];
};

type AnnualConfig = BaseConfig & {
  kind: "annual-comparison";
  input: { pattern: string };
  years: { key: string; label?: string }[];
  outputs: { csv: string; markdown?: string };
  totalLabel?: string;
  summary?: string[];
  methodology?: string[];
  notes?: string[];
};

type MonthlyConfig = BaseConfig & {
  kind: "monthly-series";
  input: { pattern: string };
  years: number[];
  monthCodeMap?: Record<string, number>;
  outputs: { csv: string };
  consoleTitle?: string;
  consoleSubtitle?: string;
};

type ReportConfig = AnnualConfig | MonthlyConfig;

const DEFAULT_MONTH_CODE_MAP: Record<string, number> = {
  "170": 1,
  "200": 2,
  "230": 3,
  "260": 4,
  "290": 5,
  "320": 6,
  "350": 7,
  "380": 8,
  "410": 9,
  "440": 10,
  "470": 11,
  "500": 12,
};

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function recordsFrom(file: string): Rec[] {
  const payload = readJson(file);
  return Array.isArray(payload.records) ? payload.records : [];
}

function resolvePattern(outDir: string, pattern: string, vars: Record<string, string | number>) {
  let replaced = pattern;
  for (const [key, value] of Object.entries(vars)) {
    replaced = replaced.replaceAll(`{${key}}`, String(value));
  }
  return path.resolve(outDir, replaced);
}

function csvEscape(value: any) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: any[][]) {
  fs.writeFileSync(file, rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n");
}

function yoy(cur: number, prev: number) {
  return prev ? +(((cur - prev) / prev) * 100).toFixed(2) : NaN;
}

function fmtPct(n: number) {
  return Number.isNaN(n) ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function displayValue(value: number, display: DisplayConfig = { label: "値" }) {
  const divisor = display.divisor ?? 1;
  return (value / divisor).toLocaleString("ja-JP", {
    maximumFractionDigits: display.maximumFractionDigits ?? 0,
  });
}

function scaledValue(value: number, display: DisplayConfig = { label: "値" }) {
  const divisor = display.divisor ?? 1;
  const digits = display.maximumFractionDigits ?? 0;
  return (value / divisor).toFixed(digits);
}

function yearLabel(year: { key: string; label?: string }) {
  return year.label ?? year.key;
}

function annualTotals(outDir: string, config: AnnualConfig, item: Item): Record<string, number> {
  const file = item.file
    ? path.resolve(outDir, item.file)
    : resolvePattern(outDir, config.input.pattern, { code: item.code });
  const totals: Record<string, number> = {};
  for (const rec of recordsFrom(file)) {
    const key = rec.time_name ?? rec.time ?? "";
    totals[key] = (totals[key] ?? 0) + (rec.value ?? 0);
  }
  return totals;
}

function buildAnnual(outDir: string, config: AnnualConfig) {
  const comparePrevIndex = config.years.length >= 2 ? config.years.length - 2 : -1;
  const compareCurIndex = config.years.length >= 2 ? config.years.length - 1 : -1;
  const rows = config.items.map((item) => {
    const totals = annualTotals(outDir, config, item);
    const values = config.years.map((year) => totals[year.key] ?? 0);
    const comparison = config.years.length >= 2 ? yoy(values[compareCurIndex], values[comparePrevIndex]) : NaN;
    return { item, values, yoy: comparison };
  });

  const totals = config.years.map((_, i) => rows.reduce((sum, row) => sum + row.values[i], 0));
  const totalYoY = config.years.length >= 2 ? yoy(totals[compareCurIndex], totals[comparePrevIndex]) : NaN;
  const lastTotal = totals[totals.length - 1] ?? 0;
  const lastYear = config.years[config.years.length - 1];
  const valueUnit = config.valueUnit ?? "value";
  const display = config.display ?? { label: valueUnit };

  const csvRows: any[][] = [
    [
      "code",
      "name",
      ...config.years.map((year) => `${yearLabel(year)}_${valueUnit}`),
      config.years.length >= 2
        ? `${yearLabel(config.years[compareCurIndex])}_vs_${yearLabel(config.years[comparePrevIndex])}_%`
        : undefined,
      `${yearLabel(lastYear)}_share_%`,
      "note",
    ].filter(Boolean),
  ];
  for (const row of rows) {
    const share = lastTotal ? +(((row.values[row.values.length - 1] / lastTotal) * 100).toFixed(2)) : NaN;
    csvRows.push([
      row.item.code,
      row.item.name,
      ...row.values,
      config.years.length >= 2 ? row.yoy : undefined,
      share,
      row.item.note ?? "",
    ].filter((v) => v !== undefined));
  }
  csvRows.push([
    "total",
    config.totalLabel ?? "合計",
    ...totals,
    config.years.length >= 2 ? totalYoY : undefined,
    100,
    "",
  ].filter((v) => v !== undefined));
  writeCsv(path.join(outDir, config.outputs.csv), csvRows);

  if (config.outputs.markdown) {
    const tableHeader = [
      "| コード | 対象 |",
      ...config.years.map((year) => ` ${yearLabel(year)}(${display.label}) |`),
      config.years.length >= 2 ? " 前年比 |" : "",
      " 構成比 |",
    ].join("");
    const tableAlign = [
      "|---|---|",
      ...config.years.map(() => "--:|"),
      config.years.length >= 2 ? "--:|" : "",
      "--:|",
    ].join("");
    const tableRows = rows
      .map((row) => {
        const share = lastTotal ? (row.values[row.values.length - 1] / lastTotal) * 100 : NaN;
        return [
          `| ${row.item.code} | ${row.item.name} |`,
          ...row.values.map((value) => ` ${displayValue(value, display)} |`),
          config.years.length >= 2 ? ` ${fmtPct(row.yoy)} |` : "",
          ` ${Number.isNaN(share) ? "-" : share.toFixed(1)}% |`,
        ].join("");
      })
      .join("\n");
    const totalRow = [
      `| **計** | **${config.totalLabel ?? "合計"}** |`,
      ...totals.map((value) => ` **${displayValue(value, display)}** |`),
      config.years.length >= 2 ? ` **${fmtPct(totalYoY)}** |` : "",
      " **100.0%** |",
    ].join("");
    const sourceLine = [
      config.source ? `出典: **${config.source}**` : undefined,
      config.fetched ? `取得日: ${config.fetched}` : undefined,
      config.statsDataId ? `統計表ID: \`${config.statsDataId}\`` : undefined,
    ]
      .filter(Boolean)
      .join("　|　");
    const md = [
      `# ${config.title}`,
      "",
      sourceLine ? `> ${sourceLine}` : "",
      "",
      "## サマリ",
      "",
      `- ${yearLabel(lastYear)}の合計: **${displayValue(lastTotal, display)} ${display.label}**`,
      config.years.length >= 2
        ? `- ${yearLabel(config.years[comparePrevIndex])}比: **${fmtPct(totalYoY)}**`
        : undefined,
      ...(config.summary ?? []).map((line) => `- ${line}`),
      "",
      "## 内訳",
      "",
      tableHeader,
      tableAlign,
      tableRows,
      totalRow,
      "",
      ...(config.methodology?.length ? ["## 方法", "", ...config.methodology.map((line) => `- ${line}`), ""] : []),
      ...(config.notes?.length ? ["## 注意", "", ...config.notes.map((line) => `- ${line}`), ""] : []),
      "---",
      "*本レポートは財務省貿易統計（e-Stat API）を基に `jp-trade-stats` スキルで自動生成しました。*",
      "",
    ]
      .filter((line) => line !== undefined)
      .join("\n");
    fs.writeFileSync(path.join(outDir, config.outputs.markdown), md);
  }

  const outputs = [path.join(outDir, config.outputs.csv)];
  if (config.outputs.markdown) outputs.push(path.join(outDir, config.outputs.markdown));
  appendAuditEvent({
    type: "report",
    kind: config.kind,
    title: config.title,
    statsDataId: config.statsDataId,
    itemCount: config.items.length,
    inputs: config.items.map((item) =>
      item.file ? path.resolve(outDir, item.file) : resolvePattern(outDir, config.input.pattern, { code: item.code }),
    ),
    outputs,
    summary: {
      lastYear: yearLabel(lastYear),
      lastTotal,
      yoyPct: Number.isNaN(totalYoY) ? null : totalYoY,
    },
  });

  console.log("生成完了:");
  console.log(`  ${path.join(outDir, config.outputs.csv)}`);
  if (config.outputs.markdown) console.log(`  ${path.join(outDir, config.outputs.markdown)}`);
  console.log(`${config.title}: ${displayValue(lastTotal, display)} ${display.label}`);
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildMonthly(outDir: string, config: MonthlyConfig) {
  const monthCodeMap = config.monthCodeMap ?? DEFAULT_MONTH_CODE_MAP;
  const data: Record<string, Record<string, number>> = {};

  for (const item of config.items) {
    for (const year of config.years) {
      const file = item.file
        ? path.resolve(outDir, item.file)
        : resolvePattern(outDir, config.input.pattern, { code: item.code, year });
      for (const rec of recordsFrom(file)) {
        const month = monthCodeMap[rec.cat02];
        if (!month) continue;
        const value = rec.value ?? 0;
        if (value === 0) continue;
        const key = monthKey(year, month);
        (data[key] ??= {})[item.code] = (data[key]?.[item.code] ?? 0) + value;
      }
    }
  }

  const months = Object.keys(data).sort();
  if (months.length === 0) throw new Error("月次データが見つかりませんでした。入力ファイルと monthCodeMap を確認してください。");

  const valueUnit = config.valueUnit ?? "value";
  const display = config.display ?? { label: valueUnit };
  console.log(config.consoleTitle ?? config.title);
  if (config.consoleSubtitle) console.log(config.consoleSubtitle);
  console.log();
  console.log(["月", ...config.items.map((item) => item.name), "合計"].map((h) => h.padStart(12)).join(""));

  const csvRows: any[][] = [
    [
      "period",
      ...config.items.map((item) => `${item.code}_${item.name}_${valueUnit}`),
      `total_${valueUnit}`,
      `total_${display.label}`,
    ],
  ];
  for (const month of months) {
    const values = config.items.map((item) => data[month][item.code] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    console.log([month, ...values.map((value) => displayValue(value, display)), displayValue(total, display)].map((v) => String(v).padStart(12)).join(""));
    csvRows.push([month, ...values, total, scaledValue(total, display)]);
  }
  writeCsv(path.join(outDir, config.outputs.csv), csvRows);

  const inputs: string[] = [];
  for (const item of config.items) {
    for (const year of config.years) {
      inputs.push(
        item.file ? path.resolve(outDir, item.file) : resolvePattern(outDir, config.input.pattern, { code: item.code, year }),
      );
    }
  }
  appendAuditEvent({
    type: "report",
    kind: config.kind,
    title: config.title,
    statsDataId: config.statsDataId,
    itemCount: config.items.length,
    inputs,
    outputs: [path.join(outDir, config.outputs.csv)],
    summary: {
      range: [months[0], months[months.length - 1]],
      monthCount: months.length,
    },
  });

  console.log();
  console.log(`対象期間: ${months[0]} 〜 ${months[months.length - 1]}（${months.length}か月）`);
  console.log(`CSV: ${path.join(outDir, config.outputs.csv)}`);
}

export function runReport(outDir: string, configFile: string) {
  const config = readJson(configFile) as ReportConfig;
  if (config.kind === "annual-comparison") buildAnnual(outDir, config);
  else if (config.kind === "monthly-series") buildMonthly(outDir, config);
  else throw new Error(`未対応のレポート種別です: ${(config as any).kind}`);
}

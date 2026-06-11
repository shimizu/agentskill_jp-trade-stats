#!/usr/bin/env -S npx tsx
/**
 * chapter-aggregate-monthly-series.ts — 章合算の月次輸入額系列を組み立てる
 *
 * 互換用の入口。汎用ビルダー trade-report.ts と petroleum-monthly プリセットを使い、
 * 複数の類（HS 2桁の章）を合算した月次系列 CSV を生成する。
 *
 * 実行: npx tsx scripts/builders/chapter-aggregate-monthly-series.ts [outDir]
 *   - outDir 省略時は作業ディレクトリ直下の out/ を使う。
 *   - 入力データはプリセットの input.pattern（既定: data/monthly-{code}-{year}.json）に従って用意する。
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runReport } from "./report-core.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] ?? "out");
const configFile = path.join(here, "presets", "petroleum-monthly.json");

runReport(outDir, configFile);

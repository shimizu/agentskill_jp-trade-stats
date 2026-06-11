#!/usr/bin/env -S npx tsx
/**
 * chapter-aggregate-annual-report.ts — 章合算の年次輸入額推計レポート生成
 *
 * 互換用の入口。汎用ビルダー trade-report.ts と petroleum-annual プリセットを使い、
 * 複数の類（HS 2桁の章）を合算した年次比較レポート（Markdown＋CSV）を生成する。
 *
 * 実行: npx tsx scripts/builders/chapter-aggregate-annual-report.ts [outDir]
 *   - outDir 省略時は作業ディレクトリ直下の out/ を使う。
 *   - 入力データはプリセットの input.pattern（既定: data/chapter-{code}.json）に従って用意する。
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runReport } from "./report-core.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] ?? "out");
const configFile = path.join(here, "presets", "petroleum-annual.json");

runReport(outDir, configFile);

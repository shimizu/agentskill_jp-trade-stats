#!/usr/bin/env -S npx tsx
/**
 * trade-report.ts — 貿易統計データの汎用レポート生成
 *
 * `estat.ts fetch` が出力する JSON（{records:[...]}）を読み、設定ファイルに従って
 * 年次比較レポート（Markdown＋CSV）または月次系列（CSV）を生成する。
 *
 * 実行:
 *   npx tsx scripts/builders/trade-report.ts [outDir] --config scripts/builders/presets/petroleum-annual.json
 *   npx tsx scripts/builders/trade-report.ts [outDir] --preset petroleum-monthly
 *
 * outDir 省略時は作業ディレクトリ直下の out/ を使う。
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runReport } from "./report-core.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRESETS: Record<string, string> = {
  "petroleum-annual": path.join(HERE, "presets", "petroleum-annual.json"),
  "petroleum-monthly": path.join(HERE, "presets", "petroleum-monthly.json"),
};

function parseArgs(argv: string[]) {
  const opts: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) opts[key] = "true";
      else {
        opts[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { opts, positional };
}

function usage() {
  console.error(
    "Usage:\n" +
      "  trade-report.ts [outDir] --config <config.json>\n" +
      "  trade-report.ts [outDir] --preset petroleum-annual|petroleum-monthly",
  );
}

const { opts, positional } = parseArgs(process.argv.slice(2));
const outDir = path.resolve(positional[0] ?? "out");
const configFile = opts.config
  ? path.resolve(opts.config)
  : opts.preset
    ? PRESETS[opts.preset]
    : undefined;

if (!configFile) {
  usage();
  process.exit(1);
}

runReport(outDir, configFile);

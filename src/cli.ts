import { readdir, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(HERE, "../template");

interface Options {
  targetDir: string;
  force: boolean;
}

function parseOptions(args: string[]): Options {
  let targetDir = process.cwd();
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dir" && args[i + 1]) {
      targetDir = args[++i];
    } else if (a === "--force" || a === "-f") {
      force = true;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`不明なオプション: ${a}`);
      process.exit(1);
    }
  }
  return { targetDir: resolve(targetDir), force };
}

async function walk(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(p)));
    } else if (entry.isFile()) {
      results.push(p);
    }
  }
  return results;
}

async function copyTemplate(opts: Options, overwrite: boolean) {
  const files = await walk(TEMPLATE_DIR);
  const copied: string[] = [];
  const skipped: string[] = [];
  for (const src of files) {
    const rel = relative(TEMPLATE_DIR, src);
    const dst = join(opts.targetDir, rel);
    if (existsSync(dst) && !overwrite) {
      skipped.push(rel);
      continue;
    }
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
    copied.push(rel);
  }
  return { copied, skipped };
}

async function cmdInit(args: string[]) {
  const opts = parseOptions(args);
  const result = await copyTemplate(opts, opts.force);

  console.log(`📦 jp-trade-stats スキルをインストールしました`);
  console.log(`   ターゲット: ${opts.targetDir}`);
  console.log(`   作成: ${result.copied.length} ファイル`);
  for (const f of result.copied) console.log(`     + ${f}`);
  if (result.skipped.length > 0) {
    console.log(`   スキップ: ${result.skipped.length} ファイル（既存、--force で上書き可）`);
    for (const f of result.skipped) console.log(`     - ${f}`);
  }

  console.log();
  console.log(`次のステップ:`);
  console.log(`  1. npm install --save-dev tsx を実行`);
  console.log(`  2. e-Stat の appId を取得し 環境変数 ESTAT_APP_ID に設定`);
  console.log(`     （未登録: https://www.e-stat.go.jp/api/ ）`);
  console.log(`  3. Claude Code などで /jp-trade-stats を呼び出す`);

  if (!process.env.ESTAT_APP_ID) {
    console.log();
    console.warn(`⚠️  ESTAT_APP_ID が未設定です（export ESTAT_APP_ID=<your-application-id>）`);
  }
}

async function cmdUpdate(args: string[]) {
  const opts = parseOptions(args);
  const result = await copyTemplate(opts, true);
  console.log(`🔄 jp-trade-stats スキルを更新しました`);
  console.log(`   ターゲット: ${opts.targetDir}`);
  console.log(`   更新: ${result.copied.length} ファイル`);
  for (const f of result.copied) console.log(`     * ${f}`);
}

async function cmdDoctor(args: string[]) {
  const opts = parseOptions(args);
  const expected = await walk(TEMPLATE_DIR);
  const missing: string[] = [];
  for (const src of expected) {
    const rel = relative(TEMPLATE_DIR, src);
    const dst = join(opts.targetDir, rel);
    if (!existsSync(dst)) missing.push(rel);
  }
  if (missing.length === 0) {
    console.log(`✅ スキルは正常にインストールされています`);
    console.log(`   ターゲット: ${opts.targetDir}`);
  } else {
    console.log(`⚠️  ${missing.length} 個のファイルが不足しています:`);
    for (const f of missing) console.log(`     - ${f}`);
    console.log();
    console.log(`   npx jp-trade-stats init --force で再インストールしてください`);
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`jp-trade-stats

使用方法:
  npx jp-trade-stats <command> [options]

コマンド:
  init       スキルファイルをターゲットディレクトリに配置する
  update     既存のスキルファイルを最新版で上書きする
  doctor     インストール状態を確認する

オプション:
  --dir <path>   ターゲットディレクトリ（デフォルト: カレントディレクトリ）
  --force, -f    既存ファイルを上書きする（init のみ）
  --help, -h     このヘルプを表示
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  switch (command) {
    case "init":
      await cmdInit(args.slice(1));
      break;
    case "update":
      await cmdUpdate(args.slice(1));
      break;
    case "doctor":
      await cmdDoctor(args.slice(1));
      break;
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`不明なコマンド: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

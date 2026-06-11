/**
 * audit-log.ts — データ取得・分析の監査証跡を out/ に残すための共有ロギング。
 *
 * estat.ts / analyze.ts / builders から共通で使う。後から人が「どんなデータを
 * 取得し、どんな分析をしたか」の正当性を検証できるよう、2 系統のログを残す:
 *
 *   out/data/api-requests.jsonl  — API 呼び出しURL（appId は REDACTED）。低レベルの生の証拠。
 *   out/data/audit-log.jsonl     — fetch/analyze/report の操作レベル構造化イベント。
 *
 * 保存先（out/ のベース）は --logDir <dir> で変更でき、--noLog で両方とも無効化できる。
 */
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * out/ 配下の出力サブディレクトリ。機械処理向け（生データ JSON・JSONL ログ）と
 * 人間向け（Markdown・CSV・audit-note.md）を物理的に分離する。
 */
export const MACHINE_SUBDIR = "data"; // 機械処理向け: 生データ・ログ
export const REPORT_SUBDIR = "reports"; // 人間向け: md/csv/ノート

type LogConfig = {
  enabled: boolean;
  dir: string;
};

let config: LogConfig = {
  enabled: true,
  dir: path.resolve("out"),
};

/** CLI オプション（--logDir / --noLog）からログ設定を確定する。 */
export function configureAuditLog(opts: Record<string, string>) {
  config = {
    enabled: opts.noLog !== "true",
    dir: path.resolve(opts.logDir ?? "out"),
  };
}

function redactUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.searchParams.has("appId")) parsed.searchParams.set("appId", "REDACTED");
  return parsed.toString();
}

function appendLine(file: string, entry: Record<string, any>) {
  if (!config.enabled) return;
  const dir = path.join(config.dir, MACHINE_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, file), JSON.stringify(entry) + "\n");
}

/** API 呼び出しの URL を api-requests.jsonl に追記する（appId はマスク）。 */
export function appendApiRequest(endpoint: string, url: string) {
  appendLine("api-requests.jsonl", {
    timestamp: new Date().toISOString(),
    endpoint,
    url: redactUrl(url),
  });
}

/** 取得・分析・レポート生成の操作イベントを audit-log.jsonl に追記する。 */
export function appendAuditEvent(event: Record<string, any>) {
  appendLine("audit-log.jsonl", {
    timestamp: new Date().toISOString(),
    ...event,
  });
}

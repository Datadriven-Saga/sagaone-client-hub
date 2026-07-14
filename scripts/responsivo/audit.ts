/**
 * Fase 0 — Audit de responsividade (baseline)
 *
 * Roda Playwright em N rotas × M viewports, coleta:
 *  - hasHorizontalScroll   (scrollWidth > innerWidth)
 *  - smallHitboxCount      (elementos interativos com bbox < 44x44)
 *  - screenshot            (viewport only, não full-page)
 *
 * Uso:
 *   bun run responsivo:audit                    (roda todas as rotas padrão)
 *   bun run responsivo:audit -- --routes=/,/administracao
 *
 * Saída:
 *   /tmp/browser/responsivo/<timestamp>/
 *     screenshots/<rota>__<w>x<h>.png
 *     report.md
 *     report.json
 *
 * IMPORTANTE:
 *  - Requer a app rodando em http://localhost:8080 (Vite).
 *  - Auth: se LOVABLE_BROWSER_SUPABASE_* estiver definido, restaura sessão
 *    (mesmo padrão do runbook browser-use). Sem sessão, só rotas públicas.
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = process.env.RESPONSIVO_BASE_URL ?? "http://localhost:8080";

const DEFAULT_ROUTES = [
  "/",
  "/prospeccao",
  "/recepcao",
  "/resultados",
  "/pos-vendas/agendamentos",
  "/administracao",
  "/administracao/agentes",
  "/administracao/empresas",
  "/administracao/quarentena",
  "/administracao/webhooks",
  "/administracao/logs-disparos",
  "/administracao/cadeiras",
  "/administracao/acessos",
  "/clientes",
  "/minha-conta",
];

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "wide-1920", width: 1920, height: 1080 },
];

type Result = {
  route: string;
  viewport: string;
  width: number;
  height: number;
  hasHorizontalScroll: boolean;
  scrollWidth: number;
  smallHitboxCount: number;
  screenshot: string;
  error?: string;
};

function slug(s: string) {
  return s.replace(/^\//, "").replace(/[\/?&=]/g, "_") || "root";
}

async function restoreSession(context: BrowserContext, page: Page) {
  const status = process.env.LOVABLE_BROWSER_AUTH_STATUS;
  if (status !== "injected") return;

  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

  if (cookiesJson) {
    const cookies = JSON.parse(cookiesJson);
    for (const c of cookies) c.url = BASE_URL;
    await context.addCookies(cookies);
  }

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  if (storageKey && sessionJson) {
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k, v),
      [storageKey, sessionJson] as const
    );
  }
}

async function auditRoute(page: Page, route: string, viewport: typeof VIEWPORTS[number], outDir: string): Promise<Result> {
  const screenshotName = `${slug(route)}__${viewport.width}x${viewport.height}.png`;
  const screenshotPath = join(outDir, "screenshots", screenshotName);
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(400);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = viewport.width;
    const hasHorizontalScroll = scrollWidth > innerWidth + 1;

    // hitbox audit: interactive elements < 44x44
    const smallHitboxCount = await page.evaluate(() => {
      const sel = 'button, a[href], [role="button"], input, select, textarea, [role="tab"], [role="menuitem"]';
      let count = 0;
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) count++;
      }
      return count;
    });

    await page.screenshot({ path: screenshotPath });

    return {
      route,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      hasHorizontalScroll,
      scrollWidth,
      smallHitboxCount,
      screenshot: screenshotName,
    };
  } catch (err) {
    return {
      route,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      hasHorizontalScroll: false,
      scrollWidth: 0,
      smallHitboxCount: 0,
      screenshot: screenshotName,
      error: (err as Error).message,
    };
  }
}

function parseRoutesArg(): string[] {
  const arg = process.argv.find((a) => a.startsWith("--routes="));
  if (!arg) return DEFAULT_ROUTES;
  return arg.replace("--routes=", "").split(",").map((s) => s.trim()).filter(Boolean);
}

function toReport(results: Result[]): string {
  const mobile = results.filter((r) => r.width <= 480);
  const desktop = results.filter((r) => r.width >= 1024);

  const hScrollMobile = mobile.filter((r) => r.hasHorizontalScroll);
  const hScrollDesktop = desktop.filter((r) => r.hasHorizontalScroll);
  const totalSmallHitboxMobile = mobile.reduce((a, r) => a + r.smallHitboxCount, 0);

  const lines: string[] = [];
  lines.push(`# Responsividade — baseline`);
  lines.push(``);
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push(``);
  lines.push(`## Sumário`);
  lines.push(``);
  lines.push(`| Métrica | Valor |`);
  lines.push(`|---|---|`);
  lines.push(`| Rotas testadas | ${new Set(results.map((r) => r.route)).size} |`);
  lines.push(`| Viewports | ${VIEWPORTS.length} |`);
  lines.push(`| Rotas c/ scroll horizontal (mobile ≤ 480) | ${hScrollMobile.length} |`);
  lines.push(`| Rotas c/ scroll horizontal (desktop ≥ 1024) | ${hScrollDesktop.length} |`);
  lines.push(`| Hitboxes < 44px (soma mobile) | ${totalSmallHitboxMobile} |`);
  lines.push(`| Erros de navegação | ${results.filter((r) => r.error).length} |`);
  lines.push(``);

  lines.push(`## Detalhes por rota × viewport`);
  lines.push(``);
  lines.push(`| Rota | Viewport | Overflow-X | scrollWidth | Hitbox<44 | Erro |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const r of results) {
    lines.push(
      `| ${r.route} | ${r.viewport} | ${r.hasHorizontalScroll ? "🔴" : "✅"} | ${r.scrollWidth} | ${r.smallHitboxCount} | ${r.error ?? ""} |`
    );
  }

  return lines.join("\n");
}

async function main() {
  const routes = parseRoutesArg();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `/tmp/browser/responsivo/${stamp}`;
  await mkdir(join(outDir, "screenshots"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await restoreSession(context, page);

  const results: Result[] = [];
  for (const route of routes) {
    for (const vp of VIEWPORTS) {
      const r = await auditRoute(page, route, vp, outDir);
      results.push(r);
      process.stdout.write(
        `${r.hasHorizontalScroll ? "!" : "."} ${r.route} @ ${r.viewport}${r.error ? ` (erro: ${r.error})` : ""}\n`
      );
    }
  }

  await browser.close();

  const report = toReport(results);
  await writeFile(join(outDir, "report.md"), report, "utf8");
  await writeFile(join(outDir, "report.json"), JSON.stringify(results, null, 2), "utf8");

  console.log(`\nRelatório: ${join(outDir, "report.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
import { expect } from "@playwright/test";
import { test } from "../support/observed-test";

const api = "http://127.0.0.1:5011/api/v1";
const account = { email: "browser@example.test", password: "Browser-Test-Only42!" };

test("real server readiness, direct browser CORS, authentication and authorization contracts", async ({ page, request }) => {
  const health = await request.get("http://127.0.0.1:5011/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok", database: "connected" });
  const preflight = await request.fetch(`${api}/auth/login`, { method: "OPTIONS", headers: {
    Origin: "http://127.0.0.1:4173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization",
  } });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe("http://127.0.0.1:4173");
  const foreign = await request.get(`${api}/reports`, { headers: { Origin: "https://untrusted.example" } });
  expect(foreign.headers()["access-control-allow-origin"]).not.toBe("https://untrusted.example");
  await page.goto("/login");
  const direct = await page.evaluate(async ({ api, account }) => {
    const response = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(account) });
    const { data } = await response.json();
    const current = await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } });
    return { status: response.status, currentStatus: current.status, role: (await current.json()).data.role };
  }, { api, account });
  expect(direct).toEqual({ status: 200, currentStatus: 200, role: "admin" });
  for (const endpoint of ["/admin/reports", "/admin/dashboard", "/admin/emergencies"]) {
    expect((await request.get(`${api}${endpoint}`)).status()).toBe(401);
  }
});

test("server validation errors reach the existing report error area and preserve the draft", async ({ page }) => {
  await page.goto("/report");
  await page.getByRole("button", { name: "Choose on map" }).click();
  await page.getByRole("button", { name: "Use map centre" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("A few words, if you like").fill("A real validation integration check");
  await page.getByRole("button", { name: "Review report" }).click();
  // Alter the outbound request, then forward to the actual server: no fake response.
  await page.route("**/api/v1/reports", route => {
    if (route.request().method() !== "POST") return route.continue();
    return route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), latitude: 91 }) });
  });
  const failed = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/reports"));
  await page.getByRole("button", { name: "Send report" }).click();
  expect((await failed).status()).toBe(400);
  expect((await (await failed).json()).error.details[0].field).toBe("latitude");
  await expect(page.getByRole("alert")).toContainText("Flood location");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("A few words, if you like")).toHaveValue("A real validation integration check");
});

test("nearby home requests send the supported radius and return real stored observations", async ({ page, request, context }) => {
  const created = await request.post(`${api}/reports`, { data: { latitude: 13.47, longitude: -16.66, locationSource: "gps", description: "Nearby integration observation", community: "Nearby integration" } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id;
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.47, longitude: -16.66 });
  await page.goto("/");
  const nearby = page.waitForResponse(r => r.url().includes("/reports/nearby?"));
  await page.getByRole("button", { name: "Use my location" }).click();
  const response = await nearby;
  expect(response.status()).toBe(200);
  const query = new URL(response.url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({ latitude: "13.47", longitude: "-16.66", radiusKm: "25", limit: "5" });
  expect((await response.json()).data.some(r => r.id === id)).toBe(true);
  await expect(page.getByRole("link", { name: "Nearby integration", exact: true })).toBeVisible();
});

test("map centre wraps to valid longitude before sending to the server", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.47, longitude: 179.999 });
  await page.goto("/report");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("Device location found")).toBeVisible();
  await page.getByRole("button", { name: "Check on map" }).click();
  const map = page.locator(".leaflet-container");
  await map.focus(); await map.press("ArrowRight");
  // Keyboard pan completes before selecting the displayed location.
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Use map centre" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Road blocked", { exact: true }).check();
  await page.getByRole("button", { name: "Review report" }).click();
  const sent = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/reports"));
  const saved = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/reports"));
  await page.getByRole("button", { name: "Send report" }).click();
  const body = (await sent).postDataJSON();
  expect(body.longitude).toBeGreaterThanOrEqual(-180); expect(body.longitude).toBeLessThan(-179);
  expect((await saved).status()).toBe(201);
});

test("stale failed session checks cannot clear the active restored session", async ({ page, request }) => {
  const signedIn = await request.post(`${api}/auth/login`, { data: account });
  expect(signedIn.status()).toBe(200);
  const { token } = (await signedIn.json()).data;
  await page.goto("/login");
  await page.evaluate(token => sessionStorage.setItem("floodwatch-admin-token", token), token);
  await page.addInitScript(() => {
    const original = window.fetch;
    let checks = 0;
    window.fetch = (input, options) => {
      if (String(input).endsWith("/auth/me") && ++checks === 1) {
        return new Promise((_resolve, reject) => setTimeout(() => {
          window.__obsoleteSessionCheckSettled = true;
          reject(new TypeError("Simulated late failure from the cancelled session check"));
        }, 400));
      }
      return original(input, options);
    };
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.waitForFunction(() => window.__obsoleteSessionCheckSettled === true);
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Community reports" })).toBeVisible();
  expect(await page.evaluate(() => Boolean(sessionStorage.getItem("floodwatch-admin-token")))).toBe(true);
});

test("non-JSON unauthorized responses expire authentication and generic 503s do not mention uploads", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.route("**/api/v1/admin/reports?*", route => route.fulfill({ status: 401, contentType: "text/plain", body: "Session expired" }));
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.route("**/api/v1/safety", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Unavailable" } }) }));
  await page.goto("/safety");
  await expect(page.getByRole("alert")).toContainText("service is unavailable");
  await expect(page.getByRole("alert")).not.toContainText("storage");
});

test("authority map retrieves real private report data and unauthorized writes are rejected", async ({ page, request }) => {
  const created = await request.post(`${api}/reports`, { data: { latitude: 13.45, longitude: -16.57, locationSource: "gps", description: "Authority map integration observation", community: "Authority map integration" } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id;
  for (const [path, body] of [
    [`/admin/reports/${id}`, { adminNotes: "Unauthorized write must fail" }],
    [`/admin/reports/${id}/verification`, { verificationStatus: "verified" }],
    [`/admin/reports/${id}/response`, { responseStatus: "assigned" }],
    ["/admin/emergencies/000000000000000000000000", { status: "acknowledged" }],
  ]) expect((await request.patch(`${api}${path}`, { data: body })).status()).toBe(401);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  const listed = page.waitForResponse(async response => {
    if (!response.url().includes("/admin/reports?") ||
        new URL(response.url()).searchParams.get("limit") !== "20" ||
        response.request().method() !== "GET") return false;
    try {
      return response.status() === 200 &&
        (await response.json()).data.some(record => record._id === id);
    } catch { return false; } // Ignore a cancelled StrictMode request.
  });
  await page.getByRole("link", { name: "Incident map", exact: true }).click();
  const response = await listed;
  expect(response.status()).toBe(200);
  await expect(page.getByRole("link", { name: "Authority map integration", exact: true })).toBeVisible();
  expect(await page.locator(".leaflet-overlay-pane path").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("floodwatch-admin-token"))).toBeNull();
});

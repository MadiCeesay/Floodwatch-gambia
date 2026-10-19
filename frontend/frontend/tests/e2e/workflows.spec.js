import { expect } from "@playwright/test";
import { test } from "../support/observed-test";
import AxeBuilder from "@axe-core/playwright";
const api = "http://127.0.0.1:5011/api/v1";
async function newReport(request, extras = {}) {
  const response = await request.post(`${api}/reports`, {
    data: {
      latitude: 13.45,
      longitude: -16.57,
      locationSource: "gps",
      description: "Browser test: water beside the community school",
      community: "Test community",
      ...extras,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}
async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("browser@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-Test-Only42!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function pickMap(page) {
  await page.getByRole("button", { name: "Choose on map" }).click();
  await page.getByRole("button", { name: "Use map centre" }).click();
}
test("shows an honest empty state before any reports are submitted", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No reports here yet" }),
  ).toBeVisible();
  expect(await page.locator(".leaflet-overlay-pane path").count()).toBe(0);
});
test("submits through map fallback, prevents duplicates and retrieves a saved report", async ({
  page,
  context,
  request,
}) => {
  await context.clearPermissions();
  await page.goto("/report");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("share your location");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("We couldn’t use your location.")).toBeVisible();
  await page.getByRole("button", { name: "Use map centre" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Review report" }).click();
  await expect(page.getByRole("alert")).toContainText("one observation");
  await page
    .getByLabel("A few words, if you like")
    .fill("Flooding outside the market, submitted from the browser.");
  await page.getByLabel("Road blocked", { exact: true }).check();
  await page.getByRole("button", { name: "Review report" }).click();
  let submissions = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/reports"))
      submissions++;
  });
  await page.getByRole("button", { name: "Send report" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(
    page.getByRole("heading", { name: "Thank you for speaking up." }),
  ).toBeVisible();
  expect(submissions).toBe(1);
  await page.getByRole("link", { name: "View your report" }).click();
  await expect(
    page.getByText("Community report — not yet verified."),
  ).toBeVisible();
  const id = page.url().split("/").pop();
  const stored = (await (await request.get(`${api}/reports/${id}`)).json())
    .data;
  expect(stored.roadCondition).toBe("blocked");
  expect(stored.severityLevel).toBe("unassessed");
  await page.goto("/my-reports");
  await expect(
    page.getByText("Flooding outside the market, submitted from the browser."),
  ).toBeVisible();
});
test("captures permitted GPS and preserves the draft after a service error", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.46, longitude: -16.61 });
  await page.goto("/report");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("Device location found")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("A few words, if you like")
    .fill("Water entering the compound");
  await page.getByRole("button", { name: "Review report" }).click();
  await page.route("**/api/v1/reports", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Unavailable" } }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("alert")).toContainText("changes have been kept");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("A few words, if you like")).toHaveValue(
    "Water entering the compound",
  );
  await page.unroute("**/api/v1/reports");
  await page.getByRole("button", { name: "Review report" }).click();
  const payload = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().endsWith("/reports"),
  );
  await page.getByRole("button", { name: "Send report" }).click();
  const sent = (await payload).postDataJSON();
  expect(sent.latitude).toBe(13.46);
  expect(sent.locationSource).toBe("gps");
  await expect(
    page.getByRole("heading", { name: "Thank you for speaking up." }),
  ).toBeVisible();
});
test("uses the visible map centre when checking a device-selected incident location", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.469, longitude: -16.658 });
  await page.goto("/report");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("Device location found")).toBeVisible();
  await page.getByRole("button", { name: "Check on map" }).click();
  await page.getByRole("button", { name: "Use map centre" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Road blocked", { exact: true }).check();
  await page.getByRole("button", { name: "Review report" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for speaking up." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View your report" }).click();
  const id = page.url().split("/").pop();
  const result = (await (await request.get(`${api}/reports/${id}`)).json())
    .data;
  expect(result.locationSource).toBe("map");
  expect(result.location.coordinates[0]).toBeCloseTo(-16.658, 4);
  expect(result.location.coordinates[1]).toBeCloseTo(13.469, 4);
});
test("previews a real photo and handles unavailable media storage without losing text", async ({
  page,
}) => {
  await page.goto("/report");
  await pickMap(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("A few words, if you like")
    .fill("Water at the road crossing");
  await page.getByLabel("Choose from gallery", { exact: true }).setInputFiles({
    name: "flood.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("Your selected flood evidence")).toBeVisible();
  await page.getByRole("button", { name: "Review report" }).click();
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/reports"),
  );
  await page.getByRole("button", { name: "Send report" }).click();
  expect((await response).status()).toBe(503);
  await expect(page.getByRole("alert")).toContainText("storage is unavailable");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("A few words, if you like")).toHaveValue(
    "Water at the road crossing",
  );
  await page.getByRole("button", { name: "Remove photo" }).click();
  await page.getByRole("button", { name: "Review report" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for speaking up." }),
  ).toBeVisible();
});
test("records browser audio, previews it and reports unavailable persistent storage honestly", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.goto("/report");
  await pickMap(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Record a voice message", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByLabel("Your voice message preview")).toBeVisible();
  await page.getByRole("button", { name: "Review report" }).click();
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/reports"),
  );
  await page.getByRole("button", { name: "Send report" }).click();
  expect((await response).status()).toBe(503);
  await expect(page.getByRole("alert")).toContainText("storage is unavailable");
});
test("protects admin routes, restores the session, verifies and resolves real reports", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const report = await newReport(request);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get(`${api}/admin/dashboard`)).status()).toBe(401);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  await page.goto(`/admin/reports/${report.id}`);
  const verified = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/verification"));
  await page.getByRole("button", { name: "Mark as verified" }).click();
  expect((await verified).status()).toBe(200);
  await expect(page.locator(".page-heading .badge")).toHaveText("Verified");
  await page
    .getByText("Update observations and private notes", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Water level", exact: true })
    .selectOption("waist_or_higher");
  await page
    .getByRole("combobox", { name: "Road condition", exact: true })
    .selectOption("blocked");
  await page
    .getByRole("combobox", { name: "Homes affected", exact: true })
    .selectOption("yes");
  await page
    .getByLabel("Private administrator notes")
    .fill("Browser-only private note");
  const assessed = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().endsWith(`/admin/reports/${report.id}`),
  );
  await page.getByRole("button", { name: "Save observations" }).click();
  expect((await assessed).status()).toBe(200);
  await expect(page.getByText("Severe", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Response progress" })
    .selectOption("resolved");
  await page
    .getByLabel("Private response notes")
    .fill("Browser test resolution");
  const saved = page.waitForResponse(
    (r) => r.request().method() === "PATCH" && r.url().endsWith("/response"),
  );
  await page.getByRole("button", { name: "Save response" }).click();
  expect((await saved).status()).toBe(200);
  await expect(
    page.getByRole("combobox", { name: "Response progress" }),
  ).toHaveValue("resolved");
  const data = (await (await request.get(`${api}/reports/${report.id}`)).json())
    .data;
  expect(data.verificationStatus).toBe("verified");
  expect(data.responseStatus).toBe("resolved");
  expect(data.severityScore).toBe(70);
  expect(JSON.stringify(data)).not.toContain("Browser test resolution");
  expect(JSON.stringify(data)).not.toContain("Browser-only private note");
  await page.getByText("Review history", { exact: true }).click();
  await expect(
    page.getByText("Observations updated", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/login$/);
});
test("rejects with a reason and hides the rejected observation from public access", async ({
  page,
  request,
}) => {
  const report = await newReport(request, { community: "Rejection test" });
  await login(page);
  await page.goto(`/admin/reports/${report.id}`);
  await page.getByLabel("Reason for rejection").fill("Not a flood incident");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reject report" }).click();
  await expect(
    page.getByText("Previous rejection: Not a flood incident"),
  ).toBeVisible();
  expect((await request.get(`${api}/reports/${report.id}`)).status()).toBe(404);
});
test("maps real data, applies filters, and serves safety guidance and help requests", async ({
  page,
  request,
}) => {
  const r = await newReport(request, {
    community: "Map workflow",
    waterLevel: "waist_or_higher",
    roadCondition: "blocked",
    homesAffected: "yes",
  });
  await page.goto("/map");
  await page
    .getByRole("combobox", { name: "Assessment" })
    .selectOption("severe");
  await expect(
    page.getByRole("link", { name: "Map workflow", exact: true }),
  ).toBeVisible();
  expect(
    await page.locator(".leaflet-overlay-pane path").count(),
  ).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Map workflow", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(r.id));
  await page.goto("/safety");
  await expect(
    page.getByRole("heading", { name: "Stay out of floodwater" }),
  ).toBeVisible();
  await page.goto("/help");
  await expect(
    page.getByRole("button", { name: "Send for administrator review" }),
  ).toBeDisabled();
  await pickMap(page);
  await page.getByLabel("I understand this form").check();
  await page
    .getByRole("button", { name: "Send for administrator review" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request stored for review" }),
  ).toBeVisible();
  await login(page);
  await page.goto("/admin/emergencies");
  await page
    .getByRole("combobox", { name: "Review status", exact: true })
    .selectOption("acknowledged");
  await page
    .getByLabel("Private review note")
    .fill("Request reviewed by browser test");
  const reviewed = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().includes("/admin/emergencies/"),
  );
  await page.getByRole("button", { name: "Save review" }).click();
  expect((await reviewed).status()).toBe(200);
  await expect(page.locator(".emergency-row .badge")).toHaveText(
    "Acknowledged",
  );
});
test("expires an invalid administrator session without showing private content", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem("floodwatch-admin-token", "invalid-token"),
  );
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("shows network failures with retry and no fabricated report counts", async ({
  page,
}) => {
  await page.route("**/api/v1/reports?*", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("could not connect");
  await page.unroute("**/api/v1/reports?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("checks citizen and authority layouts at required widths and captures visual previews", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/", "/report", "/map", "/safety", "/login"]) {
      await page.goto(path);
      await expect(page.locator("#main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${path} at ${width}px`,
      ).toBe(true);
      if (path === "/report" && [320, 390, 1440].includes(width)) {
        await pickMap(page);
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "What are you seeing?" }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `Evidence step at ${width}px`,
        ).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await login(page);
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/reports");
    await expect(
      page.getByRole("heading", { name: "Community reports" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("has no serious accessibility violations on key citizen screens", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const path of ["/", "/report", "/login", "/safety"]) {
    await page.goto(path);
    await expect(page.locator("#main")).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .exclude(".leaflet-container")
      .analyze();
    expect(
      scan.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
      path,
    ).toEqual([]);
  }
});

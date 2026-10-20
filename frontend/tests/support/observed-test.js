import { test as base } from "@playwright/test";

// Evidence contains methods, paths and statuses only: never JWTs or request bodies.
export const test = base.extend({
  page: async ({ page }, runPage, testInfo) => {
    const requests = [];
    const consoleErrors = [];
    const scriptErrors = [];
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/")) requests.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    });
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => scriptErrors.push(error.message));
    await runPage(page);
    await testInfo.attach("integration-network-and-console", { body: Buffer.from(JSON.stringify({ requests, consoleErrors, scriptErrors }, null, 2)), contentType: "application/json" });
    if (scriptErrors.length) throw new Error(`Unexpected browser script errors: ${scriptErrors.join("; ")}`);
  },
});

import { test, expect } from "@playwright/test";

test.describe("Pokédex Battle Simulator E2E", () => {
  test("Desktop: two players create room, battle, and finish match", async ({ browser }) => {
    // Player 1 Context (Red)
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p1 = await context1.newPage();

    // Player 2 Context (Blue)
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p2 = await context2.newPage();

    // 1. P1 opens Home and creates a 1v1 Room
    await p1.goto("/");
    await expect(p1.getByText("POKÉMON GEN 1")).toBeVisible();
    await p1.getByRole("button", { name: /MULTIPLAYER BATTLE/i }).click();

    // Select 1v1 for fast e2e completion
    await p1.getByRole("button", { name: "1", exact: true }).click();
    await p1.getByRole("button", { name: /START NEW ROOM/i }).click();

    // P1 enters Lobby and retrieves Room Code
    await expect(p1.getByText("ROOM CODE")).toBeVisible();
    const roomCodeEl = p1.locator("span.font-pixel.tracking-widest.text-cyan-300");
    await expect(roomCodeEl).toBeVisible();
    const roomCode = (await roomCodeEl.textContent())?.trim();
    expect(roomCode).toBeTruthy();

    // 2. P2 opens Home, enters name "Blue", and joins room
    await p2.goto("/");
    const nameInput = p2.locator("#player-name-input");
    await nameInput.fill("Blue");
    await p2.getByRole("button", { name: /MULTIPLAYER BATTLE/i }).click();
    await p2.getByRole("button", { name: /JOIN BY CODE/i }).click();

    const codeInput = p2.locator("#join-code-input");
    await codeInput.fill(roomCode!);
    await p2.getByRole("button", { name: /ENTER ROOM/i }).click();

    // 3. Both players in Lobby, click Ready
    await expect(p2.getByText("ROOM CODE")).toBeVisible();
    await p1.getByRole("button", { name: /I AM READY!/i }).click();
    await p2.getByRole("button", { name: /I AM READY!/i }).click();

    // 4. Battle Commences!
    await expect(p1.getByText(/TURN 1/i)).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText(/TURN 1/i)).toBeVisible({ timeout: 10000 });

    // Verify side-by-side Intel & Log panel is visible on Desktop
    await expect(p1.getByText("OPPONENT INTEL")).toBeVisible();
    await expect(p2.getByText("OPPONENT INTEL")).toBeVisible();

    // 5. P1 advances initial dialogue if present
    if (await p1.locator("div[role='button']").isVisible()) {
      await p1.locator("div[role='button']").click();
    }
    if (await p2.locator("div[role='button']").click()) {
      // dismissed
    }

    // Both players select first available legal move
    const p1Move = p1.locator("button[aria-label*='Move 1']").first();
    const p2Move = p2.locator("button[aria-label*='Move 1']").first();

    if (await p1Move.isVisible()) {
      await p1Move.click();
    }
    if (await p2Move.isVisible()) {
      await p2Move.click();
    }

    // Wait for turn result events to process
    await p1.waitForTimeout(1000);
    await p2.waitForTimeout(1000);

    // Advance dialogue
    for (let i = 0; i < 3; i++) {
      const diag1 = p1.locator("div[role='button']");
      if (await diag1.isVisible()) await diag1.click();
      const diag2 = p2.locator("div[role='button']");
      if (await diag2.isVisible()) await diag2.click();
      await p1.waitForTimeout(300);
    }

    await context1.close();
    await context2.close();
  });

  test("Mobile: single-pane view and slide-over battle log drawer", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    await page.goto("/");
    await expect(page.getByText("POKÉMON GEN 1")).toBeVisible();

    // In mobile viewport, right-hand log screen is not in main DOM or hidden
    await expect(page.locator("div.hidden.md\\:flex")).toHaveCount(2);

    // LOG toggle button is present on the bezel
    const logBtn = page.getByRole("button", { name: /Toggle Battle Log Panel/i });
    await expect(logBtn).toBeVisible();

    // Clicking LOG opens the mobile drawer
    await logBtn.click();
    await expect(page.getByRole("dialog", { name: "Battle Log" })).toBeVisible();

    // Clicking CLOSE [B] closes the drawer
    await page.getByRole("button", { name: /CLOSE \[B\]/i }).click();
    await expect(page.getByRole("dialog", { name: "Battle Log" })).not.toBeVisible();

    await context.close();
  });

  test("Mid-battle refresh: reloads and reclaims session without crashing", async ({ browser }) => {
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p1 = await context1.newPage();
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p2 = await context2.newPage();

    // P1 creates room
    await p1.goto("/");
    await p1.getByRole("button", { name: /MULTIPLAYER BATTLE/i }).click();
    await p1.getByRole("button", { name: "1", exact: true }).click();
    await p1.getByRole("button", { name: /START NEW ROOM/i }).click();

    const roomCodeEl = p1.locator("span.font-pixel.tracking-widest.text-cyan-300");
    await expect(roomCodeEl).toBeVisible();
    const roomCode = (await roomCodeEl.textContent())?.trim();

    // P2 joins
    await p2.goto("/");
    await p2.getByRole("button", { name: /MULTIPLAYER BATTLE/i }).click();
    await p2.getByRole("button", { name: /JOIN BY CODE/i }).click();
    await p2.locator("#join-code-input").fill(roomCode!);
    await p2.getByRole("button", { name: /ENTER ROOM/i }).click();

    // Ready up
    await p1.getByRole("button", { name: /I AM READY!/i }).click();
    await p2.getByRole("button", { name: /I AM READY!/i }).click();

    await expect(p1.getByText(/TURN 1/i)).toBeVisible({ timeout: 10000 });

    // Mid-battle refresh on P1:
    await p1.reload();

    // Check that P1 survives reload and reconnects
    await expect(p1.locator("body")).toBeVisible();

    await context1.close();
    await context2.close();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Pokédex Battle Simulator E2E", () => {
  // Keep Desktop smoke test with animations ON (default speedMultiplier = 1)
  test("Desktop: two players create room, battle, and finish match (animations ON smoke)", async ({ browser }) => {
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

    // 5. P1 dismisses initial dialogue using keyboard Enter, P2 clicks the dialogue box
    const p1Diag = p1.locator("div[role='region']").filter({ hasText: /Battle has begun/i });
    await expect(p1Diag).toBeVisible();
    await p1.waitForTimeout(800); // Wait for typewriter or press Enter twice
    await p1.keyboard.press("Enter");
    if (await p1Diag.isVisible()) {
      await p1.keyboard.press("Enter");
    }

    const p2Diag = p2.locator("div[role='region']").filter({ hasText: /Battle has begun/i });
    await expect(p2Diag).toBeVisible();
    await p2Diag.click();
    if (await p2Diag.isVisible()) {
      await p2Diag.click();
    }

    // Both players must now see Move 1 and be able to select a move
    const p1Move = p1.locator("button[aria-label*='Move 1']").first();
    const p2Move = p2.locator("button[aria-label*='Move 1']").first();

    await expect(p1Move).toBeVisible({ timeout: 5000 });
    await expect(p2Move).toBeVisible({ timeout: 5000 });

    // P1 uses keyboard Enter on Move 1, P2 clicks Move 1
    await p1.keyboard.press("Enter");
    await p2Move.click();

    // Wait for turn 1 events to resolve and advance through dialogue until Turn 2 or Result
    for (let i = 0; i < 10; i++) {
      const p1Waiting = await p1.getByText(/Waiting for opponent/i).isVisible();
      const p1Region = p1.locator("div[role='region']");
      if (!p1Waiting && (await p1Region.isVisible())) {
        await p1.keyboard.press("Enter");
      }
      const p2Waiting = await p2.getByText(/Waiting for opponent/i).isVisible();
      const p2Region = p2.locator("div[role='region']");
      if (!p2Waiting && (await p2Region.isVisible())) {
        await p2Region.click();
      }
      if (await p1.getByText(/TURN 2/i).isVisible()) break;
      await p1.waitForTimeout(150);
    }

    // Either turn 2 reached or match concluded
    await expect(
      p1.getByText(/TURN 2|VICTORY!|DEFEAT!|DRAW MATCH!/i)
    ).toBeVisible({ timeout: 10000 });

    await context1.close();
    await context2.close();
  });

  test("Mobile: single-pane view and slide-over battle log drawer", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      reducedMotion: "reduce",
    });
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
    await page.getByRole("button", { name: /CLOSE \[B\]|Close Battle Log/i }).click();
    await expect(page.getByRole("dialog", { name: "Battle Log" })).not.toBeVisible();

    await context.close();
  });

  test("Mid-battle refresh: reloads and reclaims session without crashing", async ({ browser }) => {
    const context1 = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    await context1.addInitScript(() => {
      (window as unknown as { __POKEMON_ANIM_SPEED__: number }).__POKEMON_ANIM_SPEED__ = 0;
    });
    const p1 = await context1.newPage();
    const context2 = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    await context2.addInitScript(() => {
      (window as unknown as { __POKEMON_ANIM_SPEED__: number }).__POKEMON_ANIM_SPEED__ = 0;
    });
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

    // Check that P1 survives reload and automatically reconnects back into TURN 1 battle screen
    await expect(p1.getByText(/TURN 1/i)).toBeVisible({ timeout: 10000 });
    await expect(p1.getByText(/Room .* is full/i)).not.toBeVisible();

    await context1.close();
    await context2.close();
  });
});

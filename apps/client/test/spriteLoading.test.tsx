import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PokemonSprite } from "../src/battle/PokemonSprite.js";
import { SpriteUrlResolver } from "../src/battle/SpriteUrlResolver.js";
import { preloadPokemonSprites } from "../src/battle/spritePreloader.js";

describe("SpriteUrlResolver", () => {
  beforeEach(() => {
    SpriteUrlResolver.resetDefaults();
  });

  afterEach(() => {
    SpriteUrlResolver.resetDefaults();
  });

  it("builds correct default dev URLs for animated front and back", () => {
    const front = SpriteUrlResolver.getAnimatedSpriteUrl(25, "front");
    const back = SpriteUrlResolver.getAnimatedSpriteUrl(25, "back");

    expect(front).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif"
    );
    expect(back).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/25.gif"
    );
  });

  it("builds correct default dev URLs for static Gen 1 transparent front and back", () => {
    const front = SpriteUrlResolver.getStaticSpriteUrl("pikachu", "front");
    const back = SpriteUrlResolver.getStaticSpriteUrl("pikachu", "back");

    expect(front).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/transparent/25.png"
    );
    expect(back).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/transparent/back/25.png"
    );
  });

  it("builds correct default dev URL for Gen 5 party icon", () => {
    const icon = SpriteUrlResolver.getPartyIconUrl(1);
    expect(icon).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/icons/1.png"
    );
  });

  it("supports custom URL templates via configuration", () => {
    SpriteUrlResolver.configure({
      animatedTemplate: "https://my-cdn.com/anim/{view}/{id}.gif",
      staticTemplate: "https://my-cdn.com/static/{view}/{id}.png",
      partyIconTemplate: "https://my-cdn.com/icons/{id}.png",
    });

    expect(SpriteUrlResolver.getAnimatedSpriteUrl(6, "front")).toBe(
      "https://my-cdn.com/anim/front/6.gif"
    );
    expect(SpriteUrlResolver.getStaticSpriteUrl(6, "back")).toBe(
      "https://my-cdn.com/static/back/6.png"
    );
    expect(SpriteUrlResolver.getPartyIconUrl(6)).toBe(
      "https://my-cdn.com/icons/6.png"
    );
  });

  it("excludes animated sprites when prefersReducedMotion is true", () => {
    const normalCandidates = SpriteUrlResolver.getBattleSpriteCandidates(1, "front", false);
    const reducedCandidates = SpriteUrlResolver.getBattleSpriteCandidates(1, "front", true);

    expect(normalCandidates.some((url) => url.endsWith(".gif"))).toBe(true);
    expect(reducedCandidates.every((url) => url.endsWith(".png"))).toBe(true);
  });
});

describe("PokemonSprite Component", () => {
  let listeners: ((e: any) => void)[] = [];
  let matchesMotion = false;

  beforeEach(() => {
    listeners = [];
    matchesMotion = false;
    SpriteUrlResolver.resetDefaults();

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, cb: (e: any) => void) => {
        if (event === "change") listeners.push(cb);
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn((cb: (e: any) => void) => listeners.push(cb)),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders animated GIF candidate by default", () => {
    render(<PokemonSprite speciesId="25" name="Pikachu" variant="front" />);
    const img = screen.getByTestId("pokemon-sprite-image");

    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toContain("25.gif");
  });

  it("falls back to static sprite when animated GIF fails to load", () => {
    render(<PokemonSprite speciesId="25" name="Pikachu" variant="front" />);
    const img = screen.getByTestId("pokemon-sprite-image");

    // First candidate is local animated -> simulate error
    fireEvent.error(img);

    // Second candidate is remote animated -> simulate error
    const imgAfterFirstErr = screen.getByTestId("pokemon-sprite-image");
    fireEvent.error(imgAfterFirstErr);

    // Next candidate should be static PNG
    const imgAfterSecondErr = screen.getByTestId("pokemon-sprite-image");
    expect(imgAfterSecondErr.getAttribute("src")).toContain("25.png");
  });

  it("falls back to LCD badge placeholder when all candidates fail", () => {
    render(<PokemonSprite speciesId="25" name="Pikachu" variant="front" />);

    // Exhaust all image candidates by repeatedly firing error
    for (let i = 0; i < 6; i++) {
      const img = screen.queryByTestId("pokemon-sprite-image");
      if (img) {
        fireEvent.error(img);
      }
    }

    // Now fallback badge must be present
    expect(screen.getByTestId("pokemon-sprite-fallback")).toBeInTheDocument();
    expect(screen.getByText("#25")).toBeInTheDocument();
    expect(screen.getByText("Pikachu")).toBeInTheDocument();
  });

  it("directly serves static sprite when prefers-reduced-motion is active", () => {
    matchesMotion = true;
    render(<PokemonSprite speciesId="1" name="Bulbasaur" variant="front" />);

    const img = screen.getByTestId("pokemon-sprite-image");
    expect(img.getAttribute("src")).toContain("1.png");
    expect(img.getAttribute("src")).not.toContain(".gif");
  });

  it("reacts live when OS prefers-reduced-motion setting changes", () => {
    matchesMotion = false;
    render(<PokemonSprite speciesId="4" name="Charmander" variant="front" />);

    let img = screen.getByTestId("pokemon-sprite-image");
    expect(img.getAttribute("src")).toContain("4.gif");

    // Live OS change triggers media query change event
    act(() => {
      matchesMotion = true;
      listeners.forEach((fn) => fn({ matches: true }));
    });

    img = screen.getByTestId("pokemon-sprite-image");
    expect(img.getAttribute("src")).toContain("4.png");
  });
});

describe("Sprite Preloader", () => {
  it("preloads sprites for player team and only revealed opponent pokemon", () => {
    const createdImages: string[] = [];
    const originalImage = window.Image;

    // Mock Image constructor to spy on src sets
    window.Image = class MockImage {
      private _src = "";
      set src(url: string) {
        this._src = url;
        createdImages.push(url);
      }
      get src() {
        return this._src;
      }
    } as any;

    try {
      preloadPokemonSprites([{ name: "Squirtle", speciesId: "7" }], { includeBack: true });

      // Should have front, back, and icon for Squirtle
      expect(createdImages.some((u) => u.includes("7.gif"))).toBe(true);
      expect(createdImages.some((u) => u.includes("back") && u.includes("7.gif"))).toBe(true);
      expect(createdImages.some((u) => u.includes("7.png"))).toBe(true);
    } finally {
      window.Image = originalImage;
    }
  });
});

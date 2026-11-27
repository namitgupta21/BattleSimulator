/**
 * Centralized URL resolver for battle sprites and party icons.
 * Driven by configurable URL templates via Vite environment variables:
 * - VITE_ANIMATED_SPRITE_URL_TEMPLATE
 * - VITE_STATIC_SPRITE_URL_TEMPLATE
 * - VITE_PARTY_ICON_URL_TEMPLATE
 *
 * Defaults point to PokeAPI/sprites raw GitHub URLs (FOR DEVELOPMENT ONLY).
 */

import { getPokemonId } from "./pokedexNumbers.js";

export type SpriteView = "front" | "back";

export interface SpriteUrlConfig {
  animatedTemplate?: string;
  staticTemplate?: string;
  partyIconTemplate?: string;
  localSpritesEnabled?: boolean;
}

// Development default templates (PokeAPI raw GitHub)
export const DEFAULT_DEV_ANIMATED_TEMPLATE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{viewPath}{id}.gif";

export const DEFAULT_DEV_STATIC_TEMPLATE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/transparent/{viewPath}{id}.png";

export const DEFAULT_DEV_ICON_TEMPLATE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/icons/{id}.png";

function resolveTemplateEnv(key: string, devFallback: string): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const val = import.meta.env[key];
      if (typeof val === "string" && val.trim() !== "") {
        return val.trim();
      }
      // In production mode, do NOT fall back to PokeAPI/GitHub defaults unless explicitly set
      if (import.meta.env.PROD) {
        return "";
      }
    }
  } catch {}
  return devFallback;
}

function resolveBooleanEnv(key: string, defaultVal: boolean): boolean {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key] !== undefined) {
      return String(import.meta.env[key]).toLowerCase() !== "false";
    }
  } catch {}
  return defaultVal;
}

export class SpriteUrlResolver {
  private static animatedTemplate = resolveTemplateEnv(
    "VITE_ANIMATED_SPRITE_URL_TEMPLATE",
    DEFAULT_DEV_ANIMATED_TEMPLATE
  );

  private static staticTemplate = resolveTemplateEnv(
    "VITE_STATIC_SPRITE_URL_TEMPLATE",
    DEFAULT_DEV_STATIC_TEMPLATE
  );

  private static partyIconTemplate = resolveTemplateEnv(
    "VITE_PARTY_ICON_URL_TEMPLATE",
    DEFAULT_DEV_ICON_TEMPLATE
  );

  private static localEnabled = resolveBooleanEnv("VITE_LOCAL_SPRITES_ENABLED", true);

  /**
   * For testing or dynamic runtime reconfiguration.
   */
  static configure(config: SpriteUrlConfig): void {
    if (config.animatedTemplate !== undefined) {
      this.animatedTemplate = config.animatedTemplate;
    }
    if (config.staticTemplate !== undefined) {
      this.staticTemplate = config.staticTemplate;
    }
    if (config.partyIconTemplate !== undefined) {
      this.partyIconTemplate = config.partyIconTemplate;
    }
    if (config.localSpritesEnabled !== undefined) {
      this.localEnabled = config.localSpritesEnabled;
    }
  }

  static resetDefaults(): void {
    this.animatedTemplate = resolveTemplateEnv(
      "VITE_ANIMATED_SPRITE_URL_TEMPLATE",
      DEFAULT_DEV_ANIMATED_TEMPLATE
    );
    this.staticTemplate = resolveTemplateEnv(
      "VITE_STATIC_SPRITE_URL_TEMPLATE",
      DEFAULT_DEV_STATIC_TEMPLATE
    );
    this.partyIconTemplate = resolveTemplateEnv(
      "VITE_PARTY_ICON_URL_TEMPLATE",
      DEFAULT_DEV_ICON_TEMPLATE
    );
    this.localEnabled = resolveBooleanEnv("VITE_LOCAL_SPRITES_ENABLED", true);
  }

  /**
   * Resolve a Pokémon identifier (name or number) to a numeric National Dex ID (1..151).
   */
  static resolveDexId(identifier: number | string): number {
    if (typeof identifier === "number") {
      return identifier;
    }
    const parsed = parseInt(identifier, 10);
    if (!isNaN(parsed) && String(parsed) === identifier.trim()) {
      return parsed;
    }
    return getPokemonId(identifier);
  }

  /**
   * Builds the remote animated GIF URL.
   */
  static getAnimatedSpriteUrl(identifier: number | string, view: SpriteView): string {
    if (!this.animatedTemplate) return "";
    const id = this.resolveDexId(identifier);
    const viewPath = view === "back" ? "back/" : "";
    return this.animatedTemplate
      .replace("{viewPath}", viewPath)
      .replace("{view}", view)
      .replace("{id}", String(id));
  }

  /**
   * Builds the local static fallback animated URL.
   */
  static getLocalAnimatedSpriteUrl(identifier: number | string, view: SpriteView): string {
    const id = this.resolveDexId(identifier);
    const sub = view === "back" ? "back/" : "";
    return `/sprites/animated/${sub}${id}.gif`;
  }

  /**
   * Builds the remote Gen 1 static transparent fallback URL.
   */
  static getStaticSpriteUrl(identifier: number | string, view: SpriteView): string {
    if (!this.staticTemplate) return "";
    const id = this.resolveDexId(identifier);
    const viewPath = view === "back" ? "back/" : "";
    return this.staticTemplate
      .replace("{viewPath}", viewPath)
      .replace("{view}", view)
      .replace("{id}", String(id));
  }

  /**
   * Builds the local Gen 1 static transparent sprite URL.
   */
  static getLocalStaticSpriteUrl(identifier: number | string, view: SpriteView): string {
    const id = this.resolveDexId(identifier);
    const sub = view === "back" ? "back/" : "";
    return `/sprites/transparent/${sub}${id}.png`;
  }

  /**
   * Builds the remote Gen 5 Party Icon URL.
   */
  static getPartyIconUrl(identifier: number | string): string {
    if (!this.partyIconTemplate) return "";
    const id = this.resolveDexId(identifier);
    return this.partyIconTemplate.replace("{id}", String(id));
  }

  /**
   * Builds the local Gen 5 Party Icon URL.
   */
  static getLocalPartyIconUrl(identifier: number | string): string {
    const id = this.resolveDexId(identifier);
    return `/sprites/icons/${id}.png`;
  }

  /**
   * Returns an ordered candidate list of URLs for battle sprites:
   * In production (default):
   *   [localAnimated, localStatic] (or [localStatic] if prefersReducedMotion)
   * In development (default):
   *   [localAnimated, remoteAnimated, localStatic, remoteStatic]
   */
  static getBattleSpriteCandidates(
    identifier: number | string,
    view: SpriteView,
    prefersReducedMotion: boolean = false
  ): string[] {
    const candidates: string[] = [];

    if (prefersReducedMotion) {
      if (this.localEnabled) {
        candidates.push(this.getLocalStaticSpriteUrl(identifier, view));
      }
      const remoteStatic = this.getStaticSpriteUrl(identifier, view);
      if (remoteStatic) {
        candidates.push(remoteStatic);
      }
      return candidates;
    }

    if (this.localEnabled) {
      candidates.push(this.getLocalAnimatedSpriteUrl(identifier, view));
    }
    const remoteAnimated = this.getAnimatedSpriteUrl(identifier, view);
    if (remoteAnimated) {
      candidates.push(remoteAnimated);
    }

    if (this.localEnabled) {
      candidates.push(this.getLocalStaticSpriteUrl(identifier, view));
    }
    const remoteStatic = this.getStaticSpriteUrl(identifier, view);
    if (remoteStatic) {
      candidates.push(remoteStatic);
    }

    return candidates;
  }

  /**
   * Returns an ordered candidate list of URLs for Party Icons:
   * In production (default): [localIcon]
   * In development (default): [localIcon, remoteIcon]
   */
  static getPartyIconCandidates(identifier: number | string): string[] {
    const candidates: string[] = [];
    if (this.localEnabled) {
      candidates.push(this.getLocalPartyIconUrl(identifier));
    }
    const remoteIcon = this.getPartyIconUrl(identifier);
    if (remoteIcon) {
      candidates.push(remoteIcon);
    }
    return candidates;
  }
}

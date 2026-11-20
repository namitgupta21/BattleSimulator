# Pokémon Sprites & Assets Self-Hosting Guide

This project is a non-commercial, educational fan project. Sprite image files are copyright © Nintendo / Creatures Inc. / GAME FREAK inc. and sourced from PokeAPI/sprites. **Never commit sprite images to the Git repository.**

---

## 1. Development Default
By default in local development, sprite requests are served directly from the official PokeAPI GitHub raw repository via `SpriteUrlResolver`:
- **Animated Battle Sprites (Gen 5)**: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{viewPath}{id}.gif`
- **Static Fallback Sprites (Gen 1)**: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/transparent/{viewPath}{id}.png`
- **Bench Party Icons (Gen 5)**: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/icons/{id}.png`

> **Note:** The PokeAPI GitHub raw endpoints are for development and testing only, not for heavy production traffic.

---

## 2. Self-Hosting with Local Download Tool

You can download all 151 Gen 1 visual assets to a local folder with polite rate limiting using the built-in tool:

```bash
node tools/download-sprites.mjs
```

This downloads:
1. `apps/client/public/sprites/animated/{id}.gif` (Gen 5 animated front)
2. `apps/client/public/sprites/animated/back/{id}.gif` (Gen 5 animated back)
3. `apps/client/public/sprites/transparent/{id}.png` (Gen 1 static front transparent)
4. `apps/client/public/sprites/transparent/back/{id}.png` (Gen 1 static back transparent)
5. `apps/client/public/sprites/icons/{id}.png` (Gen 5 32x32 party icons)

The `apps/client/public/sprites/` directory is listed in `.gitignore` and protected by CI guards to ensure image files are never committed.

---

## 3. Configuring Custom Host / CDN via Environment Variables

To serve sprites from your own static web server, S3 bucket, Cloudflare R2, or CDN, configure the client environment variables in `apps/client/.env`:

```env
# Optional toggle to enable/disable local /sprites/ path checks (default: true)
VITE_LOCAL_SPRITES_ENABLED=true

# Custom URL templates (placeholders: {id}, {viewPath}, {view})
VITE_ANIMATED_SPRITE_URL_TEMPLATE=https://cdn.yourdomain.com/sprites/animated/{viewPath}{id}.gif
VITE_STATIC_SPRITE_URL_TEMPLATE=https://cdn.yourdomain.com/sprites/transparent/{viewPath}{id}.png
VITE_PARTY_ICON_URL_TEMPLATE=https://cdn.yourdomain.com/sprites/icons/{id}.png
```

---

## 4. Verification in CI

To ensure upstream PokeAPI paths remain healthy and have 100% coverage for all 151 Pokémon across all 5 asset sets, run:

```bash
node tools/verify-sprites.mjs
```

This check is automatically scheduled weekly in `.github/workflows/ci.yml`.

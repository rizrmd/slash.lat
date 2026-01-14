# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cardslash is a mobile-optimized Phaser v4 game featuring slash-based interactions with character targets. The game uses pixel-perfect collision detection and visual effects to create an interactive slashing experience.

## Development Commands

```bash
# Install dependencies
bun install

# Run development server with hot reload
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

The dev server runs on `http://0.0.0.0:5173` and is accessible on the local network.

## Architecture

### Game Initialization Flow

1. `index.html` loads `src/main.ts` as module entry point
2. `main.ts` calculates responsive dimensions based on device pixel ratio (DPR) and creates `GameConfig`
3. Phaser game instance is created with `GameScene` and DPR-aware scaling
4. Game uses `Phaser.Scale.NONE` mode with manual zoom calculation (`1/dpr`) for crisp rendering

### Core Systems

**GameConfig (`src/types/index.ts`)**
Central configuration object passed throughout the game containing:
- `dpr`: Device pixel ratio for high-DPI displays
- `maxGameWidth`: Logical game width (400px)
- `gameWidth`: Game logic coordinate space (always 400px)
- `canvasWidth`: Actual canvas width (follows screen width)
- `gameHeight`: Canvas height (follows screen height)

All positioning and sizing calculations must account for DPR to ensure consistent appearance across devices.

**GameScene (`src/scenes/GameScene.ts`)**
Main game scene that orchestrates:
- Asset preloading (images, audio)
- Input handling (pointer events for slash detection)
- Target lifecycle management
- Mobile orientation detection and warnings
- Collision detection using pixel-perfect algorithm with interpolated line sampling

**Target System (`src/characters/Target.ts`)**
Abstract base class for slashable characters providing:
- Pixel-perfect collision detection via extracted `ImageData`
- Slash damage visualization with procedural "fishbone" patterns
- Shake effects aligned with slash direction
- Damage number display with upward-fading animation
- Perspective entrance animation (zoom + fade in)

Character implementations (`OrangeBot`, `LeafBot`) extend `Target` and specify asset keys. To switch characters, modify the instantiation in `GameScene.create()` (line 73).

### Effects System

**SlashTrail (`src/effects/SlashTrail.ts`)**
Manages the visual trail following pointer movement:
- Stores trail points with timestamps and alpha values
- Draws smooth gradient lines between points
- Automatically fades and removes old points
- Controls slash start/end states

**Sparks (`src/effects/Sparks.ts`)**
Particle emitter for impact effects:
- Emits particles along slash marks on hit
- Stores slash marks for delayed particle emission
- Uses Phaser particle system with custom texture

### Managers

**AudioManager (`src/managers/AudioManager.ts`)**
Centralized audio playback:
- Preloads and caches sound files
- Provides simple `play(key)` interface
- Used for slash, hit, and spark sound effects

### Collision Detection Algorithm

The game uses a sophisticated pixel-perfect collision system:

1. **Line Interpolation**: When pointer moves, the system interpolates points every 2px along the line segment
2. **Bounds Check**: Each point is tested against target container bounds
3. **Pixel Alpha Check**: Points within bounds are checked against extracted `ImageData` alpha channel (threshold: 50)
4. **Slash Extension**: On hit, the system samples backward and forward along slash direction to find full slash entry/exit points across the opaque region
5. **Damage Calculation**: Slash length accumulates during pointer movement; damage (50-100) is based on total slash length

## Asset Organization

```
src/
  audio/          # Sound effects (.mp3)
  image/          # Character sprites (.webp)
  characters/     # Target classes (OrangeBot, LeafBot)
  effects/        # Visual effects (SlashTrail, Sparks)
  managers/       # Game systems (AudioManager)
  scenes/         # Phaser scenes (GameScene)
  types/          # TypeScript interfaces
```

## Mobile Optimization

- Portrait-only mode with orientation warnings
- Touch events handled via Phaser pointer system
- DPR-aware rendering for retina displays
- Fixed viewport with `user-scalable=no`
- Canvas uses `touch-action: none` to prevent scrolling
- All measurements (sizes, distances, speeds) multiplied by DPR for consistent visual appearance

## Key Technical Details

- **Vite** is used for bundling (not Bun's native bundler)
- Target images are loaded and their pixel data extracted to `ImageData` for collision detection
- Slash damage is drawn using Phaser Graphics with `MULTIPLY` blend mode for realistic integration
- All tweens and animations use DPR-scaled values
- The game uses ES2022 modules with TypeScript strict mode

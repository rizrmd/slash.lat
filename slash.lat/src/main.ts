import { Game, AUTO } from 'phaser';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';
import { GameConfig } from './types';

// ============================================================================
// GAME DIMENSIONS (matching commit 7e02a06 that WORKS!)
// ============================================================================

const dpr = window.devicePixelRatio || 1;
const maxGameWidth = 400; // Logical game width stays at 400px
const gameWidth = maxGameWidth; // Game logic ALWAYS uses 400px
const canvasWidth = window.innerWidth; // Canvas follows screen width
const gameHeight = window.innerHeight;

// ============================================================================
// GAME AREA CALCULATION
// ============================================================================

// Desktop: max 700px play area (up to breakpoint), centered
// Mobile: full width play area
const isMobile = window.innerWidth < 700; // Same breakpoint as UI
const maxPlayAreaWidth = 700;
const gameAreaWidth = isMobile ? canvasWidth : Math.min(canvasWidth, maxPlayAreaWidth);
const gameAreaOffsetX = isMobile ? 0 : (canvasWidth - gameAreaWidth) / 2;

// Reserve space at bottom for UI (HP bar, coins, weapon indicator)
// UI elements take approximately 100*dpr pixels at the bottom
const uiHeight = 100;
const gameAreaHeight = gameHeight - uiHeight;
const gameAreaOffsetY = 0; // Game area starts at top

// ============================================================================
// GRID DIMENSIONS (matching commit 7e02a06)
// ============================================================================

// Grid dimensions for character positioning and sizing
// Uses same margins as gridToGame() in GameScene
const gridMarginLeft = 30 * dpr;
const gridMarginRight = 30 * dpr;
const gridMarginTop = 30 * dpr;
const gridMarginBottom = 50 * dpr;
const hpBarOffset = 80 * dpr;
const gridWidth = gameAreaWidth * dpr - gridMarginLeft - gridMarginRight;
const gridHeight = gameAreaHeight * dpr - gridMarginTop - gridMarginBottom - hpBarOffset;

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const gameConfig: GameConfig = {
  dpr,
  maxGameWidth,
  gameWidth,
  canvasWidth,
  canvasHeight: gameHeight, // canvasHeight = gameHeight (window.innerHeight)
  gameHeight,
  gameAreaWidth,
  gameAreaOffsetX,
  gameAreaHeight,
  gameAreaOffsetY,
  gridWidth,
  gridHeight
};

// ============================================================================
// PHASER CONFIGURATION
// ============================================================================

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: canvasWidth * dpr,
  height: gameHeight * dpr,
  parent: 'game-container',
  backgroundColor: '#000',
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: 1 / dpr
  },
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false
  },
  scene: [new LoadingScene(gameConfig), new GameScene(gameConfig)]
};

// Log scaling info for debugging
console.log('=== Game Scaling Info ===');
console.log(`Game width (LOGICAL): ${gameWidth}px`);
console.log(`Canvas: ${canvasWidth}x${gameHeight}`);
console.log(`DPR: ${dpr}`);
console.log(`Game Area: ${gameAreaWidth}x${gameAreaHeight}`);
console.log(`Grid: ${gridWidth}x${gridHeight}`);
console.log('BUILD 2026-01-15: Restored from commit 7e02a06');
console.log('===========================================');

// Create game instance
new Game(config);

import { Game, AUTO } from 'phaser';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';
import { GameConfig } from './types';

// ============================================================================
// MULTI-ASPECT RATIO SUPPORT SYSTEM
// ============================================================================

/**
 * Get current window dimensions
 */
const windowWidth = window.innerWidth;
const windowHeight = window.innerHeight;
const windowAspectRatio = windowWidth / windowHeight;

/**
 * DETECT ORIENTATION & SELECT BASE RESOLUTION
 * - Portrait (mobile): 1080x1920 (9:16 aspect ratio)
 * - Landscape (laptop/MacBook): 1920x1080 (16:9 aspect ratio)
 */
const isPortrait = windowAspectRatio < 1; // Width < height
const isLandscape = !isPortrait;

let BASE_WIDTH: number;
let BASE_HEIGHT: number;
let BASE_ASPECT_RATIO: number;

if (isPortrait) {
  // Portrait mode for mobile devices
  BASE_WIDTH = 1080;
  BASE_HEIGHT = 1920;
  BASE_ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT; // 0.5625 (9:16)
} else {
  // Landscape mode for laptop/MacBook
  // Use 16:9 as industry standard (1920x1080)
  // Will scale well to 16:10 (MacBook) without significant distortion
  BASE_WIDTH = 1920;
  BASE_HEIGHT = 1080;
  BASE_ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT; // 1.777... (16:9)
}

/**
 * Calculate Device Pixel Ratio (DPR)
 * High-DPI displays (Retina, etc.) need higher resolution for crisp rendering
 */
const dpr = Math.min(window.devicePixelRatio || 1, 3); // Cap at 3x for performance

/**
 * SCALE CALCULATION
 * Game world matches canvas/window size for simpler coordinate system
 */
const canvasWidth = windowWidth;
const canvasHeight = windowHeight;
let scale: number;
let gameWidth: number;
let gameHeight: number;

if (isPortrait) {
  // Portrait: game dimensions match canvas
  gameWidth = canvasWidth;
  gameHeight = canvasHeight;
  scale = canvasWidth / BASE_WIDTH; // Scale factor relative to base resolution
} else {
  // Landscape: game dimensions match canvas
  gameWidth = canvasWidth;
  gameHeight = canvasHeight;
  scale = canvasHeight / BASE_HEIGHT; // Scale factor relative to base resolution
}

/**
 * SAFE AREA CALCULATION
 * Critical gameplay elements stay within safe area
 * Safe area is 90% for landscape (more horizontal space), 85% for portrait
 * This ensures content is visible on all aspect ratios (notch, rounded corners, etc.)
 */
const SAFE_AREA_PERCENTAGE = isLandscape ? 0.90 : 0.85;
const MARGIN_PERCENTAGE = (1 - SAFE_AREA_PERCENTAGE) / 2;

const safeAreaWidth = gameWidth * SAFE_AREA_PERCENTAGE;
const safeAreaHeight = gameHeight * SAFE_AREA_PERCENTAGE;
const safeAreaOffsetX = (gameWidth - safeAreaWidth) / 2;
const safeAreaOffsetY = (gameHeight - safeAreaHeight) / 2;

/**
 * UI AREA
 * Reserve space at bottom for UI (HP bar, coins, weapon indicator)
 * UI height scales with base resolution
 */
const uiHeight = isLandscape ? 120 : 150; // Smaller UI in landscape
const gameAreaHeight = safeAreaHeight - uiHeight;
const gameAreaWidth = safeAreaWidth;
const gameAreaOffsetX = safeAreaOffsetX;
const gameAreaOffsetY = safeAreaOffsetY;

/**
 * GRID SYSTEM
 * 5x3 grid for character positioning, with margins within safe area
 * Grid margins prevent character cropping at edges
 * Margins scale with base resolution
 */
const gridMarginLeft = isLandscape ? 100 : 80;
const gridMarginRight = isLandscape ? 100 : 80;
const gridMarginTop = isLandscape ? 100 : 80;
const gridMarginBottom = isLandscape ? 100 : 80;
const gridWidth = gameAreaWidth - gridMarginLeft - gridMarginRight;
const gridHeight = gameAreaHeight - gridMarginTop - gridMarginBottom;

/**
 * Desktop vs Mobile Detection
 * Mobile: width < 700 (typical tablet breakpoint)
 */
const isMobile = windowWidth < 700;

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const gameConfig: GameConfig = {
  // Base resolution
  baseWidth: BASE_WIDTH,
  baseHeight: BASE_HEIGHT,
  baseAspectRatio: BASE_ASPECT_RATIO,

  // Orientation
  isPortrait,
  isLandscape,

  // Scaled dimensions
  dpr,
  scale,
  gameWidth,
  gameHeight,
  canvasWidth,
  canvasHeight,
  windowAspectRatio,

  // Safe area
  safeAreaWidth,
  safeAreaHeight,
  safeAreaOffsetX,
  safeAreaOffsetY,

  // Game play area
  gameAreaWidth,
  gameAreaHeight,
  gameAreaOffsetX,
  gameAreaOffsetY,

  // Grid system
  gridWidth,
  gridHeight,
  gridMarginLeft,
  gridMarginRight,
  gridMarginTop,
  gridMarginBottom,

  // Device type
  isMobile,
};

// ============================================================================
// PHASER CONFIGURATION
// ============================================================================

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: canvasWidth * dpr,
  height: canvasHeight * dpr,
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
const aspectRatioName = isPortrait ? '9:16 (Portrait)' : '16:9 (Landscape)';
console.log('=== Game Scaling Info ===');
console.log(`Mode: ${aspectRatioName}`);
console.log(`Window: ${windowWidth}x${windowHeight} (ratio: ${windowAspectRatio.toFixed(3)})`);
console.log(`Base: ${BASE_WIDTH}x${BASE_HEIGHT} (ratio: ${BASE_ASPECT_RATIO.toFixed(3)})`);
console.log(`Game: ${gameWidth.toFixed(0)}x${gameHeight.toFixed(0)} (scale: ${scale.toFixed(2)})`);
console.log(`Safe Area: ${safeAreaWidth.toFixed(0)}x${safeAreaHeight.toFixed(0)} (offset: ${safeAreaOffsetX.toFixed(0)}, ${safeAreaOffsetY.toFixed(0)})`);
console.log(`DPR: ${dpr}`);
console.log('==========================');

// Create game instance
new Game(config);

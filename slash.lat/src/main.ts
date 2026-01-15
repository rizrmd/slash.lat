import { Game, AUTO } from 'phaser';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';
import { GameConfig } from './types';

// ============================================================================
// DEVICE DETECTION: SMARTPHONE vs LAPTOP/DESKTOP
// ============================================================================

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;
const isMobile = screenWidth < 700; // Smartphone portrait
const isDesktop = !isMobile; // Laptop, desktop, tablet landscape

console.log('=== DEVICE DETECTION ===');
console.log(`Screen: ${screenWidth}x${screenHeight}`);
console.log(`Device: ${isMobile ? '📱 SMARTPHONE (Mobile)' : '💻 LAPTOP/DESKTOP'}`);
console.log('=========================');

// ============================================================================
// COMMON SETTINGS (both smartphone and laptop)
// ============================================================================

const dpr = window.devicePixelRatio || 1;
const maxGameWidth = 400; // Logical game width ALWAYS 400px
const gameWidth = maxGameWidth; // Game logic uses 400px coordinate space
const canvasWidth = screenWidth;
const gameHeight = screenHeight;

// ============================================================================
// SMARTPHONE SETTINGS (Mobile Portrait)
// ============================================================================

if (isMobile) {
  console.log('📱 Using SMARTPHONE settings');

  // Game area: FULL WIDTH (no margins, no centering)
  // Mobile needs maximum space for gameplay
  const gameAreaWidth = canvasWidth; // Full screen width
  const gameAreaOffsetX = 0; // No centering on mobile

  // UI height: 100px at bottom
  const uiHeight = 100;
  const gameAreaHeight = gameHeight - uiHeight;
  const gameAreaOffsetY = 0;

  // Grid: tighter margins for small screens
  const gridMarginLeft = 30 * dpr;
  const gridMarginRight = 30 * dpr;
  const gridMarginTop = 30 * dpr;
  const gridMarginBottom = 50 * dpr;
  const hpBarOffset = 80 * dpr;
  const gridWidth = gameAreaWidth * dpr - gridMarginLeft - gridMarginRight;
  const gridHeight = gameAreaHeight * dpr - gridMarginTop - gridMarginBottom - hpBarOffset;

  const gameConfig: GameConfig = {
    dpr,
    maxGameWidth,
    gameWidth,
    canvasWidth,
    canvasHeight: gameHeight,
    gameHeight,
    gameAreaWidth,
    gameAreaOffsetX,
    gameAreaHeight,
    gameAreaOffsetY,
    gridWidth,
    gridHeight
  };

  // Create game
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

  console.log('=== SMARTPHONE CONFIG ===');
  console.log(`Game Area: ${gameAreaWidth}x${gameAreaHeight} (FULL WIDTH)`);
  console.log(`Grid: ${gridWidth}x${gridHeight}`);
  console.log(`Margins: L=${gridMarginLeft}, R=${gridMarginRight}, T=${gridMarginTop}`);
  console.log('========================');

  new Game(config);
}
// ============================================================================
// LAPTOP/DESKTOP SETTINGS
// ============================================================================
else if (isDesktop) {
  console.log('💻 Using LAPTOP/DESKTOP settings');

  // Game area: MAX 700px, CENTERED on screen
  // Desktop has more space, so we constrain play area for better gameplay
  const maxPlayAreaWidth = 700;
  const gameAreaWidth = Math.min(canvasWidth, maxPlayAreaWidth);
  const gameAreaOffsetX = (canvasWidth - gameAreaWidth) / 2; // CENTERED!

  // UI height: 100px at bottom
  const uiHeight = 100;
  const gameAreaHeight = gameHeight - uiHeight;
  const gameAreaOffsetY = 0;

  // Grid: same margins as mobile
  const gridMarginLeft = 30 * dpr;
  const gridMarginRight = 30 * dpr;
  const gridMarginTop = 30 * dpr;
  const gridMarginBottom = 50 * dpr;
  const hpBarOffset = 80 * dpr;
  const gridWidth = gameAreaWidth * dpr - gridMarginLeft - gridMarginRight;
  const gridHeight = gameAreaHeight * dpr - gridMarginTop - gridMarginBottom - hpBarOffset;

  const gameConfig: GameConfig = {
    dpr,
    maxGameWidth,
    gameWidth,
    canvasWidth,
    canvasHeight: gameHeight,
    gameHeight,
    gameAreaWidth,
    gameAreaOffsetX,
    gameAreaHeight,
    gameAreaOffsetY,
    gridWidth,
    gridHeight
  };

  // Create game
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

  console.log('=== LAPTOP/DESKTOP CONFIG ===');
  console.log(`Game Area: ${gameAreaWidth}x${gameAreaHeight} (MAX 700px, CENTERED)`);
  console.log(`Offset X: ${gameAreaOffsetX}px (centered on ${canvasWidth}px screen)`);
  console.log(`Grid: ${gridWidth}x${gridHeight}`);
  console.log('============================');

  new Game(config);
}

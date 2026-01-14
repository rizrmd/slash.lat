import { Game, AUTO } from 'phaser';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';
import { GameConfig } from './types';

// Calculate responsive game dimensions
const dpr = window.devicePixelRatio || 1;
const maxGameWidth = 400; // Logical game width stays at 400px
const gameWidth = maxGameWidth; // Game logic always uses 400px
const canvasWidth = window.innerWidth; // Canvas follows screen width
const gameHeight = window.innerHeight;

// Calculate game area dimensions
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

// Grid dimensions for character positioning and sizing
// Uses same margins as gridToGame() in GameScene
// INCREASED MARGINS to prevent enemy cropping at screen edges
const gridMarginLeft = 60 * dpr;   // Increased from 30 to 60
const gridMarginRight = 60 * dpr;  // Increased from 30 to 60
const gridMarginTop = 60 * dpr;    // Increased from 30 to 60
const gridMarginBottom = 80 * dpr; // Increased from 50 to 80
const hpBarOffset = 100 * dpr;     // Increased from 80 to 100
const gridWidth = gameAreaWidth * dpr - gridMarginLeft - gridMarginRight;
const gridHeight = gameAreaHeight * dpr - gridMarginTop - gridMarginBottom - hpBarOffset;

// Create game configuration object
const gameConfig: GameConfig = {
    dpr,
    maxGameWidth,
    gameWidth,
    canvasWidth,
    gameHeight,
    gameAreaWidth,
    gameAreaOffsetX,
    gameAreaHeight,
    gameAreaOffsetY,
    gridWidth,
    gridHeight
};

// Phaser game configuration
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

// Create game instance
new Game(config);

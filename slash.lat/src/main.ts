import { Game, AUTO, Scale } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

/**
 * Calculate Device Pixel Ratio (DPR)
 * Cap at 2x for performance on mobile devices (reduces lag)
 */
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#000',
  scale: {
    mode: Scale.RESIZE,
    width: '100%',
    height: '100%',
    autoCenter: Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false,
    powerPreference: 'high-performance'
  },
  audio: {
    disableWebAudio: false,
    noAudio: false
  },
  // Pass basic config, but Scene will handle dynamic resizing
  scene: [new LoadingScene(), new GameScene()]
};

// Create game instance
new Game(config);

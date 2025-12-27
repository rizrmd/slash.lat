import { Game, AUTO } from 'phaser';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';
import { AudioManager } from './managers/AudioManager';
import { GameConfig } from './types';

// Calculate responsive game dimensions
const dpr = window.devicePixelRatio || 1;
const maxGameWidth = 400; // Logical game width stays at 400px
const gameWidth = maxGameWidth; // Game logic always uses 400px
const canvasWidth = window.innerWidth; // Canvas follows screen width
const gameHeight = window.innerHeight;

// Create game configuration object
const gameConfig: GameConfig = {
    dpr,
    maxGameWidth,
    gameWidth,
    canvasWidth,
    gameHeight
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
    scene: [new LoadingScene(gameConfig), new GameScene(gameConfig)],
    callbacks: {
        preBoot: (game: Phaser.Game) => {
            // Initialize AudioManager and store in registry before scenes start
            const loadingScene = game.scene.getScene('LoadingScene') as LoadingScene;
            if (loadingScene) {
                const audioManager = new AudioManager(loadingScene);
                game.registry.set('managers', { audioManager });
            }
        }
    }
};

// Create game instance
new Game(config);

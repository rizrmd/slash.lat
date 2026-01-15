export interface TrailPoint {
    x: number;
    y: number;
    time: number;
    alpha: number;
}

export interface SlashMark {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    time: number;
}

/**
 * Game configuration (matching commit 7e02a06 that WORKS!)
 * Simple, straightforward configuration without complex safe area calculations
 */
export interface GameConfig {
    // Device pixel ratio for high-DPI displays
    dpr: number;

    // Maximum game width (fixed at 400px for consistent gameplay)
    maxGameWidth: number;

    // Game world dimensions (logical coordinate space)
    gameWidth: number; // Always 400px
    canvasWidth: number; // Screen width (e.g., 1080px)
    canvasHeight: number; // Screen height (same as gameHeight)
    gameHeight: number; // Screen height (e.g., 1920px)

    // Game play area (where characters can spawn)
    gameAreaWidth: number;
    gameAreaOffsetX: number;
    gameAreaHeight: number;
    gameAreaOffsetY: number;

    // Grid dimensions (5x3 for character positioning)
    gridWidth: number;
    gridHeight: number;
}

export interface Weapon {
    id: string;
    name: string;
    damage: number;
}

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
 * Game configuration with multi-aspect ratio support
 * All dimensions are in game coordinate space (not screen pixels)
 * Supports both portrait (mobile 9:16) and landscape (laptop 16:9) orientations
 */
export interface GameConfig {
    // Base resolution (design resolution)
    // Portrait: 1080x1920 (9:16), Landscape: 1920x1080 (16:9)
    baseWidth: number;
    baseHeight: number;
    baseAspectRatio: number;

    // Orientation detection
    isPortrait: boolean;
    isLandscape: boolean;

    // Scaling
    dpr: number;
    scale: number;
    gameWidth: number;
    gameHeight: number;
    canvasWidth: number;
    canvasHeight: number;
    windowAspectRatio: number;

    // Safe area (85-90% of screen, critical gameplay elements)
    // Ensures visibility on all aspect ratios (notch, rounded corners, etc.)
    safeAreaWidth: number;
    safeAreaHeight: number;
    safeAreaOffsetX: number;
    safeAreaOffsetY: number;

    // Game play area (safe area minus UI space)
    gameAreaWidth: number;
    gameAreaHeight: number;
    gameAreaOffsetX: number;
    gameAreaOffsetY: number;

    // Grid system (5x3 for character positioning)
    gridWidth: number;
    gridHeight: number;
    gridMarginLeft: number;
    gridMarginRight: number;
    gridMarginTop: number;
    gridMarginBottom: number;

    // Device type
    isMobile: boolean;

    // Legacy (for backward compatibility)
    maxGameWidth?: number;
}

export interface Weapon {
    id: string;
    name: string;
    damage: number;
}

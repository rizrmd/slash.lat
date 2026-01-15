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

export interface GameConfig {
    dpr: number;
    maxGameWidth: number;
    gameWidth: number;
    canvasWidth: number;
    gameHeight: number;
    gameAreaWidth: number;  // Actual play area width (max 500px desktop, full width mobile)
    gameAreaOffsetX: number; // X offset to center game area on desktop
    gameAreaHeight: number;  // Actual play area height (full height minus bottom UI space)
    gameAreaOffsetY: number; // Y offset for game area (always 0 at top)
    gridWidth?: number; // Grid width calculated from gameAreaWidth (for character sizing)
    gridHeight?: number; // Grid height calculated from gameAreaHeight (for character sizing)
}

export interface Weapon {
    id: string;
    name: string;
    damage: number;
}

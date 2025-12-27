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
}

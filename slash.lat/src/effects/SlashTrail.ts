import Phaser from "phaser";
import { TrailPoint, GameConfig } from "../types";

export class SlashTrail {
    private scene: Phaser.Scene;
    public graphics: Phaser.GameObjects.Graphics;
    public renderTexture!: Phaser.GameObjects.RenderTexture;
    private trailPoints: TrailPoint[] = [];
    private gameConfig: GameConfig;
    private isDrawing: boolean = false;
    private drawingStartTime: number = 0;
    private drawingEndTime: number = 0;
    private cachedSplinePoints: Array<{ x: number, y: number, progress: number }> | null = null;
    private lastTrailPointsLength: number = 0;

    private readonly MAX_SLASH_DURATION = 350; // Increased duration for longer strokes
    private readonly MAX_TRAIL_POINTS = 60; // Increased points capacity
    private readonly TRAIL_FADE_TIME = 100;
    private readonly TRAIL_FADE_DURATION = 150;
    private readonly MIN_POINT_DISTANCE = 4; // Reduced distance for smoother input capture

    constructor(scene: Phaser.Scene, gameConfig: GameConfig) {
        this.scene = scene;
        this.gameConfig = gameConfig;

        // Create single graphics object for the slash effect
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(100); // High depth to be on top

        // Dummy object to satisfy types/public interface if accessed elsewhere
        this.renderTexture = scene.add.renderTexture(0, 0, 1, 1);
        this.renderTexture.setVisible(false);
    }

    startDrawing(x: number, y: number): void {
        this.isDrawing = true;
        this.drawingStartTime = this.scene.time.now;
        this.drawingEndTime = 0;
        this.trailPoints = [];
        this.cachedSplinePoints = null;
        this.lastTrailPointsLength = 0;
        this.addTrailPoint(x, y, true);
    }

    addTrailPoint(x: number, y: number, force: boolean = false): boolean {
        const now = this.scene.time.now;

        // Check if exceeded maximum slash duration
        if (now - this.drawingStartTime >= this.MAX_SLASH_DURATION) {
            this.endDrawing();
            return false;
        }

        // Optimize: Check distance from last point
        if (!force && this.trailPoints.length > 0) {
            const last = this.trailPoints[this.trailPoints.length - 1];
            const distSq = (x - last.x) * (x - last.x) + (y - last.y) * (y - last.y);
            const minProps = this.MIN_POINT_DISTANCE * this.gameConfig.dpr;
            if (distSq < minProps * minProps) {
                return true; // Use existing point (skip adding close points)
            }
        }

        // Add new point
        this.trailPoints.push({
            x,
            y,
            time: now,
            alpha: 1.0
        });

        // Invalidate cache when points change
        this.cachedSplinePoints = null;

        // Check if reached maximum trail length
        if (this.trailPoints.length >= this.MAX_TRAIL_POINTS) {
            // Drop oldest point to keep trailing
            this.trailPoints.shift();
            this.cachedSplinePoints = null;
        }

        return true;
    }

    endDrawing(): void {
        this.isDrawing = false;
        this.drawingEndTime = this.scene.time.now;
    }

    getTrailPoints(): TrailPoint[] {
        return this.trailPoints;
    }

    getLastPoint(): TrailPoint | null {
        return this.trailPoints.length > 0 ? this.trailPoints[this.trailPoints.length - 1] : null;
    }

    isCurrentlyDrawing(): boolean {
        return this.isDrawing;
    }

    update(): void {
        this.drawTrail();
    }

    private drawTrail(): void {
        this.graphics.clear();

        const now = this.scene.time.now;
        const dpr = this.gameConfig.dpr;

        // Calculate uniform fade alpha for entire trail
        let trailFadeAlpha = 1.0;
        if (!this.isDrawing && this.drawingEndTime > 0) {
            const timeSinceEnd = now - this.drawingEndTime;
            if (timeSinceEnd > this.TRAIL_FADE_TIME) {
                const fadeProgress = (timeSinceEnd - this.TRAIL_FADE_TIME) / this.TRAIL_FADE_DURATION;
                trailFadeAlpha = Math.max(0, 1 - fadeProgress);
            }
        }

        // If trail is completely faded, clear points and return
        if (trailFadeAlpha <= 0) {
            this.trailPoints = [];
            return;
        }

        if (this.trailPoints.length < 2) return;

        // Use cached spline points if available and trail hasn't changed
        if (!this.cachedSplinePoints || this.lastTrailPointsLength !== this.trailPoints.length) {
            this.cachedSplinePoints = this.generateSplinePoints();
            this.lastTrailPointsLength = this.trailPoints.length;
        }

        const splinePoints = this.cachedSplinePoints;
        if (splinePoints.length < 2) return;

        // Calculate ending triangle tip point using spline
        let sharedEndTipX = 0;
        let sharedEndTipY = 0;
        if (splinePoints.length >= 2) {
            const lastPoint = splinePoints[splinePoints.length - 1];
            const secondLastPoint = splinePoints[splinePoints.length - 2];
            const endDx = lastPoint.x - secondLastPoint.x;
            const endDy = lastPoint.y - secondLastPoint.y;
            const endAngle = Math.atan2(endDy, endDx);
            const endTriangleLength = 10 * dpr * 3; // Triangle length
            sharedEndTipX = lastPoint.x + Math.cos(endAngle) * endTriangleLength;
            sharedEndTipY = lastPoint.y + Math.sin(endAngle) * endTriangleLength;
        }

        // Draw directly to graphics, no render texture overhead
        this.drawTrailLayer(5 * dpr, 1.0, 0xffffff, sharedEndTipX, sharedEndTipY, splinePoints, trailFadeAlpha);
    }

    private drawTrailLayer(
        lineWidth: number,
        alphaMultiplier: number,
        color: number,
        sharedEndTipX: number,
        sharedEndTipY: number,
        splinePoints: Array<{ x: number, y: number, progress: number }>,
        trailFadeAlpha: number
    ): void {
        // Draw trail as filled ribbon along spline with smooth gradient
        for (let i = 0; i < splinePoints.length - 1; i++) {
            const point = splinePoints[i];
            const nextPoint = splinePoints[i + 1];

            // Calculate direction angle
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            const angle = Math.atan2(dy, dx);
            const perpAngle = angle + Math.PI / 2;

            // Calculate alpha with smooth easing for spatial gradient
            const eased1 = point.progress * point.progress;
            const eased2 = nextPoint.progress * nextPoint.progress;
            // Apply both spatial gradient and uniform trail fade
            const alpha1 = alphaMultiplier * eased1 * trailFadeAlpha;
            const alpha2 = alphaMultiplier * eased2 * trailFadeAlpha;

            if (alpha1 <= 0 && alpha2 <= 0) continue;

            // Tapered width: gets thinner towards the start (oldest points)
            const width1 = lineWidth * eased1;
            const width2 = lineWidth * eased2;

            // Calculate perpendicular points for ribbon edges
            const p1x = point.x + Math.cos(perpAngle) * (width1 / 2);
            const p1y = point.y + Math.sin(perpAngle) * (width1 / 2);
            const p2x = point.x - Math.cos(perpAngle) * (width1 / 2);
            const p2y = point.y - Math.sin(perpAngle) * (width1 / 2);
            const p3x = nextPoint.x + Math.cos(perpAngle) * (width2 / 2);
            const p3y = nextPoint.y + Math.sin(perpAngle) * (width2 / 2);
            const p4x = nextPoint.x - Math.cos(perpAngle) * (width2 / 2);
            const p4y = nextPoint.y - Math.sin(perpAngle) * (width2 / 2);

            // Use average alpha for smooth appearance
            const avgAlpha = (alpha1 + alpha2) / 2;
            this.graphics.fillStyle(color, avgAlpha);

            // Draw quad as two triangles
            this.graphics.fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
            this.graphics.fillTriangle(p2x, p2y, p4x, p4y, p3x, p3y);
        }

        // Draw ending triangle with sharp tip
        if (splinePoints.length >= 2) {
            const lastSplinePoint = splinePoints[splinePoints.length - 1];
            const secondLastSplinePoint = splinePoints[splinePoints.length - 2];

            const endEased = lastSplinePoint.progress * lastSplinePoint.progress;
            const endAlpha = alphaMultiplier * endEased * trailFadeAlpha;
            const endTriangleWidth = lineWidth * endEased;

            // Calculate angle for perpendicular base
            const endDx = lastSplinePoint.x - secondLastSplinePoint.x;
            const endDy = lastSplinePoint.y - secondLastSplinePoint.y;
            const endAngle = Math.atan2(endDy, endDx);
            const endPerpAngle = endAngle + Math.PI / 2;

            // Base points at the last spline point
            const endBaseX1 = lastSplinePoint.x + Math.cos(endPerpAngle) * (endTriangleWidth / 2);
            const endBaseY1 = lastSplinePoint.y + Math.sin(endPerpAngle) * (endTriangleWidth / 2);
            const endBaseX2 = lastSplinePoint.x - Math.cos(endPerpAngle) * (endTriangleWidth / 2);
            const endBaseY2 = lastSplinePoint.y - Math.sin(endPerpAngle) * (endTriangleWidth / 2);

            this.graphics.fillStyle(color, endAlpha);
            this.graphics.fillTriangle(endBaseX1, endBaseY1, endBaseX2, endBaseY2, sharedEndTipX, sharedEndTipY);
        }
    }

    // Catmull-Rom spline interpolation for smooth curves
    private getCatmullRomPoint(
        p0: { x: number, y: number },
        p1: { x: number, y: number },
        p2: { x: number, y: number },
        p3: { x: number, y: number },
        t: number
    ): { x: number, y: number } {
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        const y = 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        return { x, y };
    }

    // Generate smooth spline points from trail points
    private generateSplinePoints(): Array<{ x: number, y: number, progress: number }> {
        if (this.trailPoints.length < 2) return [];

        const splinePoints: Array<{ x: number, y: number, progress: number }> = [];
        const segmentsPerPoint = 10; // Increased to 10 for 'totally smooth' curves

        for (let i = 0; i < this.trailPoints.length - 1; i++) {
            // Get 4 points for Catmull-Rom spline
            const p0 = i > 0 ? this.trailPoints[i - 1] : this.trailPoints[i];
            const p1 = this.trailPoints[i];
            const p2 = this.trailPoints[i + 1];
            const p3 = i < this.trailPoints.length - 2 ? this.trailPoints[i + 2] : this.trailPoints[i + 1];

            // Interpolate points along the curve
            for (let s = 0; s < segmentsPerPoint; s++) {
                const t = s / segmentsPerPoint;
                const point = this.getCatmullRomPoint(p0, p1, p2, p3, t);
                // Linear progress for alpha/width tapering
                const progress = (i + t) / (this.trailPoints.length - 1);
                splinePoints.push({ x: point.x, y: point.y, progress });
            }
        }

        // Add the last point
        const lastPoint = this.trailPoints[this.trailPoints.length - 1];
        splinePoints.push({ x: lastPoint.x, y: lastPoint.y, progress: 1.0 });

        return splinePoints;
    }
}

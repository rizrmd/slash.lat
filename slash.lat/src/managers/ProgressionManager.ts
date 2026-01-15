import Phaser from "phaser";
import type { GameConfig } from "../types";
import { OrangeBot } from "../characters/OrangeBot";
import { LeafBot } from "../characters/LeafBot";
import { FlyBot } from "../characters/FlyBot";

// Character class types
export type CharacterClass = typeof OrangeBot | typeof LeafBot | typeof FlyBot;

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Enemy spawn definition with weighted probability
 */
export interface EnemySpawn {
  characterClass: CharacterClass;
  weight: number; // Higher weight = more likely to spawn
}

/**
 * Wave configuration for wave-based progression
 */
export interface WaveConfig {
  waveNumber: number;
  enemies: EnemySpawn[]; // Which enemies can spawn in this wave
  totalEnemyCount: number; // Total enemies to spawn in this wave
  maxConcurrent: number; // Max enemies on screen at once
  spawnInterval: number; // Time between spawns in milliseconds
  delayBeforeStart?: number; // Delay before wave starts (ms)
}

/**
 * Difficulty tier for continuous progression
 */
export interface DifficultyTier {
  startTime: number; // When this tier starts (seconds from game start)
  enemies: EnemySpawn[]; // Available enemies with weights
  maxConcurrent: number; // Max enemies on screen
  spawnInterval: number; // Time between spawns in milliseconds
}

/**
 * Continuous mode configuration
 */
export interface ContinuousConfig {
  tiers: DifficultyTier[]; // Difficulty tiers over time
}

/**
 * Wave-based mode configuration
 */
export interface WaveBasedConfig {
  waves: WaveConfig[]; // Array of wave configurations
  delayBetweenWaves?: number; // Delay between waves (ms), default 3000
}

/**
 * Main progression configuration
 */
export interface ProgressionConfig {
  mode: "wave" | "continuous";
  waveConfig?: WaveBasedConfig;
  continuousConfig?: ContinuousConfig;
}

// ============================================================================
// PROGRESSION MANAGER
// ============================================================================

export interface ProgressionEvents {
  onSpawnEnemy: (characterClass: CharacterClass, position: { x: number; y: number }) => void;
  gridToGame: (column: number, row: number, width: number, height: number) => { x: number; y: number };
  onWaveStart?: (waveNumber: number) => void;
  onWaveComplete?: (waveNumber: number) => void;
  onAllWavesComplete?: () => void;
  onDifficultyChange?: (tierIndex: number) => void;
}

export class ProgressionManager {
  private scene: Phaser.Scene;
  private config: ProgressionConfig;
  private events: ProgressionEvents;
  private gameConfig: GameConfig;

  // State tracking
  private activeEnemyCount: number = 0;
  private gameStartTime: number = 0;
  private isActive: boolean = false;

  // Wave mode state
  private currentWaveIndex: number = 0;
  private enemiesSpawnedInWave: number = 0;
  private waveTimer?: Phaser.Time.TimerEvent;
  private waveDelayTimer?: Phaser.Time.TimerEvent;
  private isWaveActive: boolean = false;

  // Continuous mode state
  private currentTierIndex: number = 0;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private playerActive: boolean = false; // Track player activity for dynamic spawning

  constructor(
    scene: Phaser.Scene,
    config: ProgressionConfig,
    events: ProgressionEvents,
    gameConfig: GameConfig
  ) {
    this.scene = scene;
    this.config = config;
    this.events = events;
    this.gameConfig = gameConfig;
  }

  /**
   * Start the progression system
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.gameStartTime = Date.now();
    this.activeEnemyCount = 0;

    if (this.config.mode === "wave") {
      this.startNextWave();
    } else if (this.config.mode === "continuous") {
      this.startContinuousMode();
    }
  }

  /**
   * Stop the progression system
   */
  stop(): void {
    this.isActive = false;
    this.waveTimer?.remove();
    this.waveDelayTimer?.remove();
    this.spawnTimer?.remove();
  }

  /**
   * Call this when an enemy is killed
   */
  onEnemyKilled(): void {
    this.activeEnemyCount = Math.max(0, this.activeEnemyCount - 1);

    if (this.config.mode === "wave") {
      this.checkWaveCompletion();
    }
  }

  /**
   * Get current progression info
   */
  getInfo() {
    if (this.config.mode === "wave") {
      const currentWave = this.getCurrentWave();
      return {
        mode: "wave" as const,
        currentWave: this.currentWaveIndex + 1,
        totalWaves: this.config.waveConfig?.waves.length ?? 0,
        enemiesRemaining: currentWave ? currentWave.totalEnemyCount - this.enemiesSpawnedInWave + this.activeEnemyCount : 0,
        activeEnemies: this.activeEnemyCount,
      };
    } else {
      const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
      return {
        mode: "continuous" as const,
        elapsedTime: elapsedSeconds,
        currentTier: this.currentTierIndex + 1,
        activeEnemies: this.activeEnemyCount,
      };
    }
  }

  /**
   * Set player activity status for dynamic spawning
   * Active = faster spawns, more enemies
   * Idle = slower spawns, max 6 enemies
   */
  setPlayerActivity(isActive: boolean): void {
    this.playerActive = isActive;

    // Restart spawn timer with new parameters
    if (this.config.mode === "continuous") {
      this.spawnTimer?.remove();
      this.startSpawnTimer();
    }
  }

  // ============================================================================
  // WAVE MODE METHODS
  // ============================================================================

  private getCurrentWave(): WaveConfig | undefined {
    return this.config.waveConfig?.waves[this.currentWaveIndex];
  }

  private startNextWave(): void {
    const wave = this.getCurrentWave();
    if (!wave) {
      // All waves complete
      this.events.onAllWavesComplete?.();
      this.isActive = false;
      return;
    }

    this.enemiesSpawnedInWave = 0;
    this.isWaveActive = false;

    // Delay before wave starts (if specified)
    const delay = wave.delayBeforeStart ?? 0;
    if (delay > 0) {
      this.waveDelayTimer = this.scene.time.delayedCall(delay, () => {
        this.startWaveSpawning();
      });
    } else {
      this.startWaveSpawning();
    }
  }

  private startWaveSpawning(): void {
    const wave = this.getCurrentWave();
    if (!wave) return;

    this.isWaveActive = true;
    this.events.onWaveStart?.(wave.waveNumber);

    // Start spawn timer
    this.waveTimer = this.scene.time.addEvent({
      delay: wave.spawnInterval,
      callback: () => this.trySpawnWaveEnemy(),
      loop: true,
    });

    // Spawn first enemy immediately
    this.trySpawnWaveEnemy();
  }

  private trySpawnWaveEnemy(): void {
    const wave = this.getCurrentWave();
    if (!wave || !this.isWaveActive) return;

    // Check if we've spawned all enemies for this wave
    if (this.enemiesSpawnedInWave >= wave.totalEnemyCount) {
      this.waveTimer?.remove();
      return;
    }

    // Check if we're at max concurrent enemies
    if (this.activeEnemyCount >= wave.maxConcurrent) {
      return;
    }

    // Select enemy and its size
    const characterClass = this.selectEnemyFromPool(wave.enemies);

    // Create temp instance to get size
    const tempTarget = new characterClass({
      scene: this.scene,
      x: 0,
      y: 0,
      gameConfig: this.gameConfig,
      audioManager: {} as any
    });
    const size = tempTarget.getSize();
    tempTarget.destroy();

    const position = this.getRandomGridPositionForSize(size);

    this.spawnEnemy(characterClass, position);
    this.enemiesSpawnedInWave++;
  }

  private checkWaveCompletion(): void {
    const wave = this.getCurrentWave();
    if (!wave || !this.isWaveActive) return;

    // Wave is complete when all enemies spawned and all killed
    if (this.enemiesSpawnedInWave >= wave.totalEnemyCount && this.activeEnemyCount === 0) {
      this.isWaveActive = false;
      this.events.onWaveComplete?.(wave.waveNumber);

      // Move to next wave
      this.currentWaveIndex++;

      const delayBetweenWaves = this.config.waveConfig?.delayBetweenWaves ?? 3000;
      this.scene.time.delayedCall(delayBetweenWaves, () => {
        this.startNextWave();
      });
    }
  }

  // ============================================================================
  // CONTINUOUS MODE METHODS
  // ============================================================================

  private startContinuousMode(): void {
    this.currentTierIndex = 0;
    this.startSpawnTimer();

    // Check for tier changes every second
    this.scene.time.addEvent({
      delay: 1000,
      callback: () => this.checkTierChange(),
      loop: true,
    });
  }

  private getCurrentTier(): DifficultyTier | undefined {
    if (!this.config.continuousConfig) return undefined;

    const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
    const tiers = this.config.continuousConfig.tiers;

    // Find the appropriate tier based on elapsed time
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= tiers[i].startTime) {
        return tiers[i];
      }
    }

    return tiers[0];
  }

  private checkTierChange(): void {
    if (!this.config.continuousConfig) return;

    const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
    const tiers = this.config.continuousConfig.tiers;

    for (let i = 0; i < tiers.length; i++) {
      if (elapsedSeconds >= tiers[i].startTime && i > this.currentTierIndex) {
        this.currentTierIndex = i;
        this.events.onDifficultyChange?.(i);

        // Restart spawn timer with new interval
        this.spawnTimer?.remove();
        this.startSpawnTimer();
        break;
      }
    }
  }

  private startSpawnTimer(): void {
    const tier = this.getCurrentTier();
    if (!tier) return;

    // Adjust spawn rate based on player activity
    const spawnInterval = this.playerActive
      ? tier.spawnInterval * 0.6  // 40% faster when active
      : tier.spawnInterval * 1.5; // 50% slower when idle

    this.spawnTimer = this.scene.time.addEvent({
      delay: spawnInterval,
      callback: () => this.trySpawnContinuousEnemy(),
      loop: true,
    });

    // Spawn first enemy immediately
    this.trySpawnContinuousEnemy();
  }

  private trySpawnContinuousEnemy(): void {
    const tier = this.getCurrentTier();
    if (!tier) return;

    // Dynamic max concurrent based on player activity
    // Idle: max 6, Active: use tier's maxConcurrent
    const maxConcurrent = this.playerActive
      ? tier.maxConcurrent  // Use tier's normal max when active (can go up to 8)
      : Math.min(6, tier.maxConcurrent); // Cap at 6 when idle

    // Check if we're at max concurrent enemies
    if (this.activeEnemyCount >= maxConcurrent) {
      return;
    }

    // Spawn enemy
    const characterClass = this.selectEnemyFromPool(tier.enemies);

    // Create temp instance to get size
    const tempTarget = new characterClass({
      scene: this.scene,
      x: 0,
      y: 0,
      gameConfig: this.gameConfig,
      audioManager: {} as any
    });
    const size = tempTarget.getSize();
    tempTarget.destroy();

    const position = this.getRandomGridPositionForSize(size);

    this.spawnEnemy(characterClass, position);
  }

  // ============================================================================
  // SHARED HELPER METHODS
  // ============================================================================

  private selectEnemyFromPool(enemies: EnemySpawn[]): CharacterClass {
    // Calculate total weight
    const totalWeight = enemies.reduce((sum, e) => sum + e.weight, 0);

    // Random selection based on weights
    let random = Math.random() * totalWeight;

    for (const enemy of enemies) {
      random -= enemy.weight;
      if (random <= 0) {
        return enemy.characterClass;
      }
    }

    // Fallback to first enemy
    return enemies[0].characterClass;
  }

  private getRandomGridPositionForSize(size: { w: number, h: number }): { x: number; y: number } {
    // Get grid-based position as reference point
    const maxColumn = 5 - size.w + 1;
    let minColumn = 1;

    if (size.w > 1) {
      minColumn = Math.max(1, Math.min(2, maxColumn));
    }

    const column = Math.floor(Math.random() * (maxColumn - minColumn + 1)) + minColumn;
    const maxRow = 3 - size.h + 1;
    const minRow = 1;
    const row = Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow;

    // Use the grid conversion logic passed from GameScene
    const { x, y } = this.events.gridToGame(column, row, size.w, size.h);

    // SMALL RANDOM OFFSET for variety while staying within safe area
    const { gridWidth, gridHeight } = this.gameConfig;

    // Calculate safe bounds
    const cellWidth = gridWidth / 5;
    const cellHeight = gridHeight / 3;

    // Reduced offset (±30% of cell size)
    const maxOffsetX = cellWidth * 0.3;
    const maxOffsetY = cellHeight * 0.3;

    let randomOffsetX = (Math.random() - 0.5) * 2 * maxOffsetX;
    let randomOffsetY = (Math.random() - 0.5) * 2 * maxOffsetY;

    // gridToGame positions are already correct, just add small offset for variety
    return {
      x: x + randomOffsetX,
      y: y + randomOffsetY,
    };
  }

  private spawnEnemy(characterClass: CharacterClass, position: { x: number; y: number }): void {
    this.activeEnemyCount++;
    this.events.onSpawnEnemy(characterClass, position);
  }
}

// ============================================================================
// TEST CONFIGURATIONS
// ============================================================================

/**
 * LEVEL-BASED PROGRESSION: 10 Levels from Easy to Impossible
 */
export const LEVEL_WAVE_CONFIG: ProgressionConfig = {
  mode: "wave",
  waveConfig: {
    waves: [
      // LEVEL 1: Tutorial - Very Easy
      {
        waveNumber: 1,
        enemies: [{ characterClass: OrangeBot, weight: 1 }],
        totalEnemyCount: 5,
        maxConcurrent: 2,
        spawnInterval: 2000,
        delayBeforeStart: 1000,
      },
      // LEVEL 2: Easy - More OrangeBots
      {
        waveNumber: 2,
        enemies: [{ characterClass: OrangeBot, weight: 1 }],
        totalEnemyCount: 8,
        maxConcurrent: 3,
        spawnInterval: 1800,
      },
      // LEVEL 3: Easy-Medium - Introduce LeafBots
      {
        waveNumber: 3,
        enemies: [
          { characterClass: OrangeBot, weight: 8 },
          { characterClass: LeafBot, weight: 2 },
        ],
        totalEnemyCount: 10,
        maxConcurrent: 4,
        spawnInterval: 1600,
      },
      // LEVEL 4: Medium - Mix of Orange & Leaf
      {
        waveNumber: 4,
        enemies: [
          { characterClass: OrangeBot, weight: 6 },
          { characterClass: LeafBot, weight: 4 },
        ],
        totalEnemyCount: 12,
        maxConcurrent: 4,
        spawnInterval: 1500,
      },
      // LEVEL 5: Medium-Hard - More LeafBots, faster spawn
      {
        waveNumber: 5,
        enemies: [
          { characterClass: OrangeBot, weight: 5 },
          { characterClass: LeafBot, weight: 5 },
        ],
        totalEnemyCount: 15,
        maxConcurrent: 5,
        spawnInterval: 1400,
      },
      // LEVEL 6: Hard - Introduce FlyBots
      {
        waveNumber: 6,
        enemies: [
          { characterClass: OrangeBot, weight: 5 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 2 },
        ],
        totalEnemyCount: 15,
        maxConcurrent: 5,
        spawnInterval: 1300,
      },
      // LEVEL 7: Harder - More FlyBots
      {
        waveNumber: 7,
        enemies: [
          { characterClass: OrangeBot, weight: 4 },
          { characterClass: LeafBot, weight: 4 },
          { characterClass: FlyBot, weight: 3 },
        ],
        totalEnemyCount: 18,
        maxConcurrent: 6,
        spawnInterval: 1200,
      },
      // LEVEL 8: Very Hard - All types balanced
      {
        waveNumber: 8,
        enemies: [
          { characterClass: OrangeBot, weight: 3 },
          { characterClass: LeafBot, weight: 4 },
          { characterClass: FlyBot, weight: 4 },
        ],
        totalEnemyCount: 20,
        maxConcurrent: 6,
        spawnInterval: 1100,
      },
      // LEVEL 9: Extreme - Heavy FlyBots
      {
        waveNumber: 9,
        enemies: [
          { characterClass: OrangeBot, weight: 3 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 5 },
        ],
        totalEnemyCount: 22,
        maxConcurrent: 7,
        spawnInterval: 1000,
      },
      // LEVEL 10: BOSS WAVE - Maximum chaos
      {
        waveNumber: 10,
        enemies: [
          { characterClass: OrangeBot, weight: 2 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 6 },
        ],
        totalEnemyCount: 25,
        maxConcurrent: 8,
        spawnInterval: 800,
      },
    ],
    delayBetweenWaves: 3000,
  },
};

/**
 * ENDLESS MODE: Unlimited enemies for coin collection
 * Difficulty increases over time - never ends!
 */
export const ENDLESS_MODE_CONFIG: ProgressionConfig = {
  mode: "continuous",
  continuousConfig: {
    tiers: [
      // Tier 1: 0-30s - Tutorial (OrangeBots only)
      {
        startTime: 0,
        enemies: [
          { characterClass: OrangeBot, weight: 10 },
        ],
        maxConcurrent: 2,
        spawnInterval: 2500,
      },
      // Tier 2: 30-60s - Add LeafBots
      {
        startTime: 30,
        enemies: [
          { characterClass: OrangeBot, weight: 7 },
          { characterClass: LeafBot, weight: 3 },
        ],
        maxConcurrent: 3,
        spawnInterval: 2200,
      },
      // Tier 3: 60-90s - More LeafBots
      {
        startTime: 60,
        enemies: [
          { characterClass: OrangeBot, weight: 6 },
          { characterClass: LeafBot, weight: 4 },
        ],
        maxConcurrent: 4,
        spawnInterval: 2000,
      },
      // Tier 4: 90-120s - Balanced mix
      {
        startTime: 90,
        enemies: [
          { characterClass: OrangeBot, weight: 5 },
          { characterClass: LeafBot, weight: 5 },
        ],
        maxConcurrent: 4,
        spawnInterval: 1800,
      },
      // Tier 5: 120-150s - Introduce FlyBots!
      {
        startTime: 120,
        enemies: [
          { characterClass: OrangeBot, weight: 6 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 1 },
        ],
        maxConcurrent: 5,
        spawnInterval: 1600,
      },
      // Tier 6: 150-180s - More FlyBots
      {
        startTime: 150,
        enemies: [
          { characterClass: OrangeBot, weight: 5 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 2 },
        ],
        maxConcurrent: 5,
        spawnInterval: 1500,
      },
      // Tier 7: 180-210s - All types increasing
      {
        startTime: 180,
        enemies: [
          { characterClass: OrangeBot, weight: 4 },
          { characterClass: LeafBot, weight: 4 },
          { characterClass: FlyBot, weight: 3 },
        ],
        maxConcurrent: 6,
        spawnInterval: 1400,
      },
      // Tier 8: 210-240s - FlyBots dominating
      {
        startTime: 210,
        enemies: [
          { characterClass: OrangeBot, weight: 4 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 4 },
        ],
        maxConcurrent: 6,
        spawnInterval: 1300,
      },
      // Tier 9: 240-270s - Very fast spawns
      {
        startTime: 240,
        enemies: [
          { characterClass: OrangeBot, weight: 3 },
          { characterClass: LeafBot, weight: 4 },
          { characterClass: FlyBot, weight: 4 },
        ],
        maxConcurrent: 7,
        spawnInterval: 1200,
      },
      // Tier 10: 270-300s - Extreme mode
      {
        startTime: 270,
        enemies: [
          { characterClass: OrangeBot, weight: 3 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 5 },
        ],
        maxConcurrent: 7,
        spawnInterval: 1100,
      },
      // Tier 11: 300-360s - MAXIMUM CHAOS
      {
        startTime: 300,
        enemies: [
          { characterClass: OrangeBot, weight: 2 },
          { characterClass: LeafBot, weight: 3 },
          { characterClass: FlyBot, weight: 6 },
        ],
        maxConcurrent: 8,
        spawnInterval: 1000,
      },
      // Tier 12: 360s+ - IMPOSSIBLE (for hardcore players!)
      {
        startTime: 360,
        enemies: [
          { characterClass: OrangeBot, weight: 2 },
          { characterClass: LeafBot, weight: 2 },
          { characterClass: FlyBot, weight: 7 },
        ],
        maxConcurrent: 8,
        spawnInterval: 900,
      },
    ],
  },
};

/**
 * Full wave-based game configuration
 */
export const FULL_WAVE_CONFIG: ProgressionConfig = {
  mode: "wave",
  waveConfig: {
    waves: [
      {
        waveNumber: 1,
        enemies: [{ characterClass: OrangeBot, weight: 1 }],
        totalEnemyCount: 3,
        maxConcurrent: 2,
        spawnInterval: 2000,
      },
      {
        waveNumber: 2,
        enemies: [
          { characterClass: OrangeBot, weight: 7 },
          { characterClass: LeafBot, weight: 3 },
        ],
        totalEnemyCount: 5,
        maxConcurrent: 3,
        spawnInterval: 2000,
      },
      {
        waveNumber: 3,
        enemies: [
          { characterClass: OrangeBot, weight: 5 },
          { characterClass: LeafBot, weight: 5 },
        ],
        totalEnemyCount: 7,
        maxConcurrent: 4,
        spawnInterval: 1800,
      },
      {
        waveNumber: 4,
        enemies: [
          { characterClass: OrangeBot, weight: 3 },
          { characterClass: LeafBot, weight: 5 },
          { characterClass: FlyBot, weight: 2 },
        ],
        totalEnemyCount: 10,
        maxConcurrent: 5,
        spawnInterval: 1500,
      },
    ],
    delayBetweenWaves: 3000,
  },
};

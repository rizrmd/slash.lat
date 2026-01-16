import { Weapon, GameConfig } from "../types";

export class WeaponManager {
  private scene: Phaser.Scene;
  private gameConfig: GameConfig;
  private uiLayer: Phaser.GameObjects.Container;
  private currentWeapon: Weapon;
  private weaponIndicator?: Phaser.GameObjects.Graphics;
  private weaponText?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    gameConfig: GameConfig,
    uiLayer: Phaser.GameObjects.Container,
    initialWeapon: Weapon
  ) {
    this.scene = scene;
    this.gameConfig = gameConfig;
    this.uiLayer = uiLayer;
    this.currentWeapon = initialWeapon;
  }

  createWeaponIndicator(): void {
    if (this.weaponIndicator) {
      this.weaponIndicator.destroy();
    }
    if (this.weaponText) {
      this.weaponText.destroy();
    }

    const { canvasWidth, gameHeight, dpr } = this.gameConfig;
    const padding = 20 * dpr;
    const bottomY = gameHeight * dpr - padding;

    // Weapon Indicator (position and shape depends on screen width)
    const isDesktop = window.innerWidth > 700;

    const weaponWidth = 100 * dpr;
    const weaponHeight = 25 * dpr;
    const weaponSkew = 8 * dpr;

    let weaponX: number;
    let weaponY: number;

    if (isDesktop) {
      // Desktop: bottom center
      weaponX = (canvasWidth * dpr) / 2 - weaponWidth / 2;
      weaponY = bottomY - weaponHeight;
    } else {
      // Mobile: on top of HP bar
      const hpBarX = padding;
      const hpBarHeight = 20 * dpr;
      weaponX = hpBarX;
      weaponY = bottomY - hpBarHeight - weaponHeight - 15 * dpr; // 15px gap above HP bar
    }

    // Create weapon indicator
    this.weaponIndicator = this.scene.add.graphics();
    this.uiLayer.add(this.weaponIndicator);
    this.weaponIndicator.setDepth(100);

    // Single border (white)
    this.weaponIndicator.lineStyle(2 * dpr, 0xffffff, 1);
    this.weaponIndicator.beginPath();

    if (isDesktop) {
      // Desktop: parallelogram
      this.weaponIndicator.moveTo(weaponX, weaponY + weaponHeight);
      this.weaponIndicator.lineTo(
        weaponX + weaponWidth,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + weaponWidth + weaponSkew, weaponY);
      this.weaponIndicator.lineTo(weaponX + weaponSkew, weaponY);
    } else {
      // Mobile: regular box
      this.weaponIndicator.moveTo(weaponX, weaponY + weaponHeight);
      this.weaponIndicator.lineTo(
        weaponX + weaponWidth,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + weaponWidth, weaponY);
      this.weaponIndicator.lineTo(weaponX, weaponY);
    }

    this.weaponIndicator.closePath();
    this.weaponIndicator.strokePath();

    // Add double border on left side only (thicker, touching the first border)
    const leftBorderWidth = 5 * dpr;
    const doubleInset = leftBorderWidth - 2 * dpr; // Position to make borders touch
    this.weaponIndicator.lineStyle(leftBorderWidth, 0xffffff, 1);
    this.weaponIndicator.beginPath();

    if (isDesktop) {
      // Desktop: parallelogram left border
      this.weaponIndicator.moveTo(
        weaponX + doubleInset,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + weaponSkew + doubleInset, weaponY);
    } else {
      // Mobile: regular box left border
      this.weaponIndicator.moveTo(
        weaponX + doubleInset,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + doubleInset, weaponY);
    }

    this.weaponIndicator.strokePath();

    // Weapon text (centered differently for box vs parallelogram)
    const textX = isDesktop
      ? weaponX + weaponWidth / 2 + weaponSkew / 2
      : weaponX + weaponWidth / 2;
    this.weaponText = this.scene.add
      .text(textX, weaponY + weaponHeight / 2, this.currentWeapon.name, {
        fontFamily: "Jura, sans-serif",
        fontSize: `${14 * dpr}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2 * dpr,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(101);
    this.uiLayer.add(this.weaponText);
  }

  getCurrentWeapon(): Weapon {
    return this.currentWeapon;
  }

  setCurrentWeapon(weapon: Weapon): void {
    this.currentWeapon = weapon;
    if (this.weaponText) {
      this.weaponText.setText(weapon.name);
    }
  }

  // Available weapons in the game
  static getAvailableWeapons(): Weapon[] {
    return [
      {
        id: "knife",
        name: "Knife",
        damage: 100,
      },
    ];
  }

  static getWeaponById(id: string): Weapon | undefined {
    return WeaponManager.getAvailableWeapons().find((w) => w.id === id);
  }
}

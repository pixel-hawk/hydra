import { levelKeys, gamesSublevel } from "@main/level";
import path from "node:path";
import * as tar from "tar";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import type { GameShop, GameArtifact } from "@types";
import { backupsPath } from "@main/constants";
import { normalizePath, parseRegFile, addTrailingSlash } from "@main/helpers";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import { Ludusavi } from "./ludusavi";
import { formatDate } from "@shared";
import i18next, { t } from "i18next";
import { SystemPath } from "./system-path";
import YAML from "yaml";

export interface LocalBackupMetadata {
  id: string;
  objectId: string;
  shop: GameShop;
  label: string;
  createdAt: number;
  size: number;
  hostname: string;
  platform: string;
  winePrefixPath?: string | null;
  homeDir?: string;
  downloadOptionTitle?: string | null;
  isFrozen: boolean;
}

export class LocalSaveBackup {
  private static localBackupsPath = path.join(SystemPath.getPath("userData"), "LocalBackups");
  private static metadataFile = path.join(this.localBackupsPath, "metadata.json");

  public static getWindowsLikeUserProfilePath(winePrefixPath?: string | null) {
    if (process.platform === "linux") {
      if (!winePrefixPath) {
        throw new Error("Wine prefix path is required");
      }

      const userReg = fs.readFileSync(
        path.join(winePrefixPath, "user.reg"),
        "utf8"
      );

      const entries = parseRegFile(userReg);
      const volatileEnvironment = entries.find(
        (entry: any) => entry.path === "Volatile Environment"
      );

      if (!volatileEnvironment) {
        throw new Error("Volatile environment not found in user.reg");
      }

      const { values } = volatileEnvironment;
      const userProfile = String(values["USERPROFILE"]);

      if (userProfile) {
        return normalizePath(userProfile);
      } else {
        throw new Error("User profile not found in user.reg");
      }
    }

    return normalizePath(SystemPath.getPath("home"));
  }

  public static getBackupLabel(automatic: boolean) {
    const language = i18next.language;
    const date = formatDate(new Date(), language);

    if (automatic) {
      return t("automatic_backup_from", {
        ns: "game_details",
        date,
      });
    }

    return t("backup_from", {
      ns: "game_details",
      date,
    });
  }

  private static ensureLocalBackupsDirectory() {
    if (!fs.existsSync(this.localBackupsPath)) {
      fs.mkdirSync(this.localBackupsPath, { recursive: true });
    }
  }

  private static async getMetadata(): Promise<LocalBackupMetadata[]> {
    this.ensureLocalBackupsDirectory();
    
    if (!fs.existsSync(this.metadataFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.metadataFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error("Failed to read local backup metadata", error);
      return [];
    }
  }

  private static async saveMetadata(metadata: LocalBackupMetadata[]) {
    this.ensureLocalBackupsDirectory();
    
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      logger.error("Failed to save local backup metadata", error);
      throw error;
    }
  }

  private static async bundleBackup(
    shop: GameShop,
    objectId: string,
    winePrefix: string | null
  ) {
    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    // Remove existing backup
    if (fs.existsSync(backupPath)) {
      try {
        await fs.promises.rm(backupPath, { recursive: true });
      } catch (error) {
        logger.error("Failed to remove backup path", error);
      }
    }

    await Ludusavi.backupGame(shop, objectId, backupPath, winePrefix);

    const backupId = crypto.randomUUID();
    const tarLocation = path.join(this.localBackupsPath, `${backupId}.tar`);

    await tar.create(
      {
        gzip: false,
        file: tarLocation,
        cwd: backupPath,
      },
      ["."]
    );

    return { tarLocation, backupId };
  }

  public static async createLocalBackup(
    objectId: string,
    shop: GameShop,
    downloadOptionTitle: string | null,
    label?: string
  ): Promise<string> {
    try {
      const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

      const { tarLocation, backupId } = await this.bundleBackup(
        shop,
        objectId,
        game?.winePrefixPath ?? null
      );

      const stat = await fs.promises.stat(tarLocation);
      
      const metadata = await this.getMetadata();
      
      const newBackup: LocalBackupMetadata = {
        id: backupId,
        objectId,
        shop,
        label: label || this.getBackupLabel(false),
        createdAt: Date.now(),
        size: stat.size,
        hostname: os.hostname(),
        platform: process.platform,
        winePrefixPath: game?.winePrefixPath
          ? fs.realpathSync(game.winePrefixPath)
          : null,
        homeDir: this.getWindowsLikeUserProfilePath(game?.winePrefixPath ?? null),
        downloadOptionTitle,
        isFrozen: false,
      };

      metadata.push(newBackup);
      await this.saveMetadata(metadata);

      WindowManager.mainWindow?.webContents.send(
        `on-upload-complete-${objectId}-${shop}`,
        true
      );

      logger.info(`Local backup created successfully: ${backupId}`);
      return backupId;
    } catch (error) {
      logger.error("Failed to create local backup", error);
      throw error;
    }
  }

  public static async getLocalBackups(objectId: string, shop: GameShop): Promise<GameArtifact[]> {
    const metadata = await this.getMetadata();
    
    return metadata
      .filter(backup => backup.objectId === objectId && backup.shop === shop)
      .map(backup => ({
        id: backup.id,
        artifactLengthInBytes: backup.size,
        downloadOptionTitle: backup.downloadOptionTitle || null,
        createdAt: new Date(backup.createdAt).toISOString(),
        updatedAt: new Date(backup.createdAt).toISOString(),
        hostname: backup.hostname,
        downloadCount: 0,
        label: backup.label,
        isFrozen: backup.isFrozen,
      }));
  }

  public static async deleteLocalBackup(backupId: string): Promise<void> {
    const metadata = await this.getMetadata();
    let backup: LocalBackupMetadata | undefined;
    
    for (let i = 0; i < metadata.length; i++) {
      if (metadata[i].id === backupId) {
        backup = metadata[i];
        break;
      }
    }
    
    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found`);
    }

    const tarLocation = path.join(this.localBackupsPath, `${backupId}.tar`);
    
    // Remove the tar file
    if (fs.existsSync(tarLocation)) {
      try {
        await fs.promises.unlink(tarLocation);
      } catch (error) {
        logger.error(`Failed to delete backup file: ${tarLocation}`, error);
      }
    }

    // Remove from metadata
    const updatedMetadata = metadata.filter(b => b.id !== backupId);
    await this.saveMetadata(updatedMetadata);

    logger.info(`Local backup deleted: ${backupId}`);
  }

  public static async toggleFreezeLocalBackup(backupId: string, freeze: boolean): Promise<void> {
    const metadata = await this.getMetadata();
    let backup: LocalBackupMetadata | undefined;
    
    for (let i = 0; i < metadata.length; i++) {
      if (metadata[i].id === backupId) {
        backup = metadata[i];
        break;
      }
    }
    
    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found`);
    }

    backup.isFrozen = freeze;
    await this.saveMetadata(metadata);

    logger.info(`Local backup ${freeze ? 'frozen' : 'unfrozen'}: ${backupId}`);
  }

  public static async renameLocalBackup(backupId: string, newLabel: string): Promise<void> {
    const metadata = await this.getMetadata();
    let backup: LocalBackupMetadata | undefined;
    
    for (let i = 0; i < metadata.length; i++) {
      if (metadata[i].id === backupId) {
        backup = metadata[i];
        break;
      }
    }
    
    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found`);
    }

    backup.label = newLabel;
    await this.saveMetadata(metadata);

    logger.info(`Local backup renamed: ${backupId} -> ${newLabel}`);
  }

  public static async restoreLocalBackup(
    backupId: string,
    objectId: string,
    shop: GameShop
  ): Promise<void> {
    const metadata = await this.getMetadata();
    let backup: LocalBackupMetadata | undefined;
    
    for (let i = 0; i < metadata.length; i++) {
      if (metadata[i].id === backupId) {
        backup = metadata[i];
        break;
      }
    }
    
    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found`);
    }

    const tarLocation = path.join(this.localBackupsPath, `${backupId}.tar`);
    
    if (!fs.existsSync(tarLocation)) {
      throw new Error(`Backup file not found: ${tarLocation}`);
    }

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
    const restorePath = path.join(backupsPath, `restore-${backupId}`);

    // Clean up any existing restore path
    if (fs.existsSync(restorePath)) {
      await fs.promises.rm(restorePath, { recursive: true });
    }

    fs.mkdirSync(restorePath, { recursive: true });

    // Extract the backup
    await tar.x({
      file: tarLocation,
      cwd: restorePath,
    });

    // Restore using the same logic as cloud sync
    await this.restoreLudusaviBackup(
      restorePath,
      objectId,
      backup.homeDir || this.getWindowsLikeUserProfilePath(game?.winePrefixPath ?? null),
      game?.winePrefixPath,
      backup.winePrefixPath
    );

    // Clean up
    await fs.promises.rm(restorePath, { recursive: true });

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-complete-${objectId}-${shop}`,
      true
    );

    logger.info(`Local backup restored: ${backupId}`);
  }

  private static async restoreLudusaviBackup(
    backupPath: string,
    title: string,
    homeDir: string,
    winePrefixPath?: string | null,
    artifactWinePrefixPath?: string | null
  ) {
    const gameBackupPath = path.join(backupPath, title);
    const mappingYamlPath = path.join(gameBackupPath, "mapping.yaml");

    if (!fs.existsSync(mappingYamlPath)) {
      throw new Error(`Mapping file not found: ${mappingYamlPath}`);
    }

    const data = fs.readFileSync(mappingYamlPath, "utf8");
    const manifest = YAML.parse(data) as {
      backups: any[];
      drives: Record<string, string>;
    };

    const userProfilePath = this.getWindowsLikeUserProfilePath(winePrefixPath);
    const publicProfilePath = "/c/users/Public"; // Adjust as needed

    manifest.backups.forEach((backup) => {
      Object.keys(backup.files).forEach((key) => {
        const sourcePathWithDrives = Object.keys(manifest.drives).reduce(
          (prev, driveKey) => {
            const driveValue = manifest.drives[driveKey];
            return prev.replace(driveValue, driveKey);
          },
          key
        );

        const sourcePath = path.join(gameBackupPath, sourcePathWithDrives);

        logger.info(`Source path: ${sourcePath}`);

        const destinationPath = this.transformLudusaviBackupPathIntoWindowsPath(
          key,
          artifactWinePrefixPath
        )
          .replace(
            homeDir,
            this.addWinePrefixToWindowsPath(userProfilePath, winePrefixPath)
          )
          .replace(
            publicProfilePath,
            this.addWinePrefixToWindowsPath(publicProfilePath, winePrefixPath)
          );

        logger.info(`Moving ${sourcePath} to ${destinationPath}`);

        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

        if (fs.existsSync(destinationPath)) {
          fs.unlinkSync(destinationPath);
        }

        if (fs.existsSync(sourcePath)) {
          fs.renameSync(sourcePath, destinationPath);
        }
      });
    });
  }

  private static transformLudusaviBackupPathIntoWindowsPath(
    backupPath: string,
    winePrefixPath?: string | null
  ) {
    return backupPath
      .replace(winePrefixPath ? addTrailingSlash(winePrefixPath) : "", "")
      .replace("drive_c", "C:");
  }

  private static addWinePrefixToWindowsPath(
    windowsPath: string,
    winePrefixPath?: string | null
  ) {
    if (!winePrefixPath) {
      return windowsPath;
    }

    return path.join(winePrefixPath, windowsPath.replace("C:", "drive_c"));
  }
}

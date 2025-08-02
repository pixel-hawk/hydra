import { CloudSync } from "@main/services";
import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const uploadSaveGame = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  downloadOptionTitle: string | null,
  useLocalBackup: boolean = false
) => {
  if (useLocalBackup) {
    return LocalSaveBackup.createLocalBackup(
      objectId,
      shop,
      downloadOptionTitle,
      LocalSaveBackup.getBackupLabel(false)
    );
  } else {
    return CloudSync.uploadSaveGame(
      objectId,
      shop,
      downloadOptionTitle,
      CloudSync.getBackupLabel(false)
    );
  }
};

registerEvent("uploadSaveGame", uploadSaveGame);

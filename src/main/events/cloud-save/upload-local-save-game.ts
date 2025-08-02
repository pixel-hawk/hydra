import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const uploadLocalSaveGame = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  downloadOptionTitle: string | null
) => {
  return LocalSaveBackup.createLocalBackup(
    objectId,
    shop,
    downloadOptionTitle,
    LocalSaveBackup.getBackupLabel(false)
  );
};

registerEvent("uploadLocalSaveGame", uploadLocalSaveGame);

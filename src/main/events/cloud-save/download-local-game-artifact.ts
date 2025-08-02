import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const downloadLocalGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  gameArtifactId: string
) => {
  return LocalSaveBackup.restoreLocalBackup(gameArtifactId, objectId, shop);
};

registerEvent("downloadLocalGameArtifact", downloadLocalGameArtifact);

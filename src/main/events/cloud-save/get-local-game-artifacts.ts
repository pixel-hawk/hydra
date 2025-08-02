import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";
import type { GameShop } from "@types";

const getLocalGameArtifacts = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  return LocalSaveBackup.getLocalBackups(objectId, shop);
};

registerEvent("getLocalGameArtifacts", getLocalGameArtifacts);

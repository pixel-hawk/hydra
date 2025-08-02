import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";

const toggleLocalArtifactFreeze = async (
  _event: Electron.IpcMainInvokeEvent,
  gameArtifactId: string,
  freeze: boolean
) => {
  return LocalSaveBackup.toggleFreezeLocalBackup(gameArtifactId, freeze);
};

registerEvent("toggleLocalArtifactFreeze", toggleLocalArtifactFreeze);

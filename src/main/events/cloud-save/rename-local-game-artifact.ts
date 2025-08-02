import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";

const renameLocalGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  gameArtifactId: string,
  label: string
) => {
  return LocalSaveBackup.renameLocalBackup(gameArtifactId, label);
};

registerEvent("renameLocalGameArtifact", renameLocalGameArtifact);

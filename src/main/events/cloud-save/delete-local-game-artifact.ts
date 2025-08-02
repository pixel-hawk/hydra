import { LocalSaveBackup } from "@main/services/local-save-backup";
import { registerEvent } from "../register-event";

const deleteLocalGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  gameArtifactId: string
) => {
  return LocalSaveBackup.deleteLocalBackup(gameArtifactId);
};

registerEvent("deleteLocalGameArtifact", deleteLocalGameArtifact);

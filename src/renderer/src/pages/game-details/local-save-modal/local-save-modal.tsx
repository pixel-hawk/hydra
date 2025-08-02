import { Button, Modal, ModalProps } from "@renderer/components";
import { useContext, useEffect, useMemo, useState } from "react";
import { localSaveContext, gameDetailsContext } from "@renderer/context";
import "./local-save-modal.scss";
import { formatBytes } from "@shared";
import {
  ClockIcon,
  DeviceDesktopIcon,
  HistoryIcon,
  InfoIcon,
  PencilIcon,
  PinIcon,
  PinSlashIcon,
  SyncIcon,
  TrashIcon,
  UploadIcon,
} from "@primer/octicons-react";
import { useDate, useToast } from "@renderer/hooks";
import { useTranslation } from "react-i18next";
import { AxiosProgressEvent } from "axios";
import { formatDownloadProgress } from "@renderer/helpers";
import { GameArtifact } from "@types";
import { motion, AnimatePresence } from "framer-motion";
import { orderBy } from "lodash-es";

export interface LocalSaveModalProps
  extends Omit<ModalProps, "children" | "title"> {}

export function LocalSaveModal({ visible, onClose }: LocalSaveModalProps) {
  const [deletingArtifact, setDeletingArtifact] = useState(false);
  const [backupDownloadProgress, setBackupDownloadProgress] =
    useState<AxiosProgressEvent | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_artifactToRename, setArtifactToRename] = useState<GameArtifact | null>(
    null
  );

  const { t } = useTranslation("game_details");
  const { formatDateTime } = useDate();

  const {
    artifacts,
    backupPreview,
    uploadingBackup,
    restoringBackup,
    loadingPreview,
    freezingArtifact,
    uploadSaveGame,
    downloadGameArtifact,
    deleteGameArtifact,
    toggleArtifactFreeze,
    setShowLocalSaveFilesModal,
    getGameBackupPreview,
  } = useContext(localSaveContext);

  const { objectId, shop, gameTitle, game, lastDownloadedOption } =
    useContext(gameDetailsContext);

  const { showSuccessToast, showErrorToast } = useToast();

  const handleDeleteArtifactClick = async (gameArtifactId: string) => {
    setDeletingArtifact(true);
    try {
      await deleteGameArtifact(gameArtifactId);
      showSuccessToast(t("backup_deleted"));
    } catch (err) {
      showErrorToast("backup_deletion_failed");
    } finally {
      setDeletingArtifact(false);
    }
  };

  useEffect(() => {
    const removeBackupDownloadProgressListener =
      window.electron.onBackupDownloadProgress(
        objectId!,
        shop,
        (progressEvent) => {
          setBackupDownloadProgress(progressEvent);
        }
      );
    return () => {
      removeBackupDownloadProgressListener();
    };
  }, [backupPreview, objectId, shop]);

  const handleBackupInstallClick = async (artifactId: string) => {
    setBackupDownloadProgress(null);
    downloadGameArtifact(artifactId);
  };

  const handleFreezeArtifactClick = async (
    artifactId: string,
    isFrozen: boolean
  ) => {
    try {
      await toggleArtifactFreeze(artifactId, isFrozen);
      showSuccessToast(isFrozen ? t("backup_frozen") : t("backup_unfrozen"));
    } catch (err) {
      showErrorToast(
        t("backup_freeze_failed"),
        t("backup_freeze_failed_description")
      );
    }
  };

  useEffect(() => {
    if (visible) {
      getGameBackupPreview();
    }
  }, [getGameBackupPreview, visible]);

  // For local backups, we can have unlimited backups
  // const backupsPerGameLimit = 999;

  const backupStateLabel = useMemo(() => {
    if (uploadingBackup) {
      return (
        <span className="local-save-modal__backup-state-label">
          <SyncIcon className="local-save-modal__sync-icon" />
          {t("uploading_backup")}
        </span>
      );
    }
    if (restoringBackup) {
      return (
        <span className="local-save-modal__backup-state-label">
          <SyncIcon className="local-save-modal__sync-icon" />
          {t("restoring_backup", {
            progress: formatDownloadProgress(
              backupDownloadProgress?.progress ?? 0
            ),
          })}
        </span>
      );
    }
    if (loadingPreview) {
      return (
        <span className="local-save-modal__backup-state-label">
          <SyncIcon className="local-save-modal__sync-icon" />
          {t("loading_save_preview")}
        </span>
      );
    }
    if (!backupPreview) {
      return t("no_backup_preview");
    }
    if (artifacts.length === 0) {
      return t("no_backups");
    }
    return "";
  }, [
    uploadingBackup,
    backupDownloadProgress?.progress,
    backupPreview,
    restoringBackup,
    loadingPreview,
    artifacts,
    t,
  ]);

  const disableActions =
    uploadingBackup || restoringBackup || deletingArtifact || freezingArtifact;
  const isMissingWinePrefix =
    window.electron.platform === "linux" && !game?.winePrefixPath;

  return (
    <>
      <Modal
        visible={visible}
        title={t("local_save_backup")}
        description={t("local_save_backup_description")}
        onClose={onClose}
        large
      >
        <div className="local-save-modal__header">
          <div className="local-save-modal__title-container">
            <h2>{gameTitle}</h2>
            <small>
              <InfoIcon />
              {t("local_backup_info")}
            </small>
          </div>

          <div className="local-save-modal__state-container">
            <p>{backupStateLabel}</p>
            <button
              type="button"
              className="local-save-modal__manage-files-button"
              onClick={() => setShowLocalSaveFilesModal(true)}
              disabled={disableActions}
            >
              {t("manage_files")}
            </button>
          </div>

          <Button
            type="button"
            onClick={() => uploadSaveGame(lastDownloadedOption?.title ?? null)}
            tooltip={isMissingWinePrefix ? t("missing_wine_prefix") : undefined}
            tooltipPlace="left"
            disabled={
              disableActions ||
              !backupPreview?.overall.totalGames ||
              isMissingWinePrefix
            }
          >
            {uploadingBackup ? (
              <SyncIcon className="local-save-modal__sync-icon" />
            ) : (
              <UploadIcon />
            )}
            {t("create_backup")}
          </Button>
        </div>

        <div className="local-save-modal__backups-header">
          <h2>{t("backups")}</h2>
          <small>
            {artifacts.length} {t("local_backups")}
          </small>
        </div>

        {artifacts.length > 0 ? (
          <ul className="local-save-modal__artifacts">
            <AnimatePresence>
              {orderBy(artifacts, [(a) => !a.isFrozen], ["asc"]).map(
                (artifact) => (
                  <motion.li
                    key={artifact.id}
                    className="local-save-modal__artifact"
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="local-save-modal__artifact-info">
                      <div className="local-save-modal__artifact-header">
                        <button
                          type="button"
                          className="local-save-modal__artifact-title"
                          onClick={() => setArtifactToRename(artifact)}
                          disabled={disableActions}
                        >
                          <PencilIcon />
                          {artifact.label || artifact.downloadOptionTitle || t("untitled_backup")}
                        </button>
                        {artifact.isFrozen && <PinIcon />}
                      </div>
                      <div className="local-save-modal__artifact-details">
                        <small>
                          <ClockIcon />
                          {formatDateTime(artifact.createdAt)}
                        </small>
                        <small>{formatBytes(artifact.artifactLengthInBytes)}</small>
                        <small>
                          <DeviceDesktopIcon />
                          {artifact.hostname}
                        </small>
                      </div>
                    </div>

                    <div className="local-save-modal__artifact-actions">
                      <Button
                        type="button"
                        tooltip={
                          artifact.isFrozen
                            ? t("unfreeze_backup")
                            : t("freeze_backup")
                        }
                        theme={artifact.isFrozen ? "primary" : "outline"}
                        onClick={() =>
                          handleFreezeArtifactClick(
                            artifact.id,
                            !artifact.isFrozen
                          )
                        }
                        disabled={disableActions}
                      >
                        {artifact.isFrozen ? <PinSlashIcon /> : <PinIcon />}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleBackupInstallClick(artifact.id)}
                        disabled={disableActions}
                        theme="outline"
                      >
                        {restoringBackup ? (
                          <SyncIcon className="local-save-modal__sync-icon" />
                        ) : (
                          <HistoryIcon />
                        )}
                        {t("install_backup")}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleDeleteArtifactClick(artifact.id)}
                        disabled={disableActions || artifact.isFrozen}
                        theme="outline"
                        tooltip={t("delete_backup")}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </motion.li>
                )
              )}
            </AnimatePresence>
          </ul>
        ) : (
          <p>{t("no_backups_created")}</p>
        )}
      </Modal>
    </>
  );
}

import { useToast } from "@renderer/hooks";
import { logger } from "@renderer/logger";
import type { LudusaviBackup, GameArtifact, GameShop } from "@types";
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

export enum LocalBackupState {
  New,
  Different,
  Same,
  Unknown,
}

export interface LocalSaveContext {
  backupPreview: LudusaviBackup | null;
  artifacts: GameArtifact[];
  showLocalSaveModal: boolean;
  showLocalSaveFilesModal: boolean;
  backupState: LocalBackupState;
  setShowLocalSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
  downloadGameArtifact: (gameArtifactId: string) => Promise<void>;
  uploadSaveGame: (downloadOptionTitle: string | null) => Promise<void>;
  deleteGameArtifact: (gameArtifactId: string) => Promise<void>;
  setShowLocalSaveFilesModal: React.Dispatch<React.SetStateAction<boolean>>;
  getGameBackupPreview: () => Promise<void>;
  getGameArtifacts: () => Promise<void>;
  toggleArtifactFreeze: (
    gameArtifactId: string,
    freeze: boolean
  ) => Promise<void>;
  restoringBackup: boolean;
  uploadingBackup: boolean;
  loadingPreview: boolean;
  freezingArtifact: boolean;
}

export const localSaveContext = createContext<LocalSaveContext>({
  backupPreview: null,
  showLocalSaveModal: false,
  backupState: LocalBackupState.Unknown,
  setShowLocalSaveModal: () => {},
  downloadGameArtifact: async () => {},
  uploadSaveGame: async () => {},
  artifacts: [],
  deleteGameArtifact: async () => {},
  showLocalSaveFilesModal: false,
  setShowLocalSaveFilesModal: () => {},
  getGameBackupPreview: async () => {},
  toggleArtifactFreeze: async () => {},
  getGameArtifacts: async () => {},
  restoringBackup: false,
  uploadingBackup: false,
  loadingPreview: false,
  freezingArtifact: false,
});

const { Provider } = localSaveContext;
export const { Consumer: LocalSaveContextConsumer } = localSaveContext;

export interface LocalSaveContextProviderProps {
  children: React.ReactNode;
  objectId: string;
  shop: GameShop;
}

export function LocalSaveContextProvider({
  children,
  objectId,
  shop,
}: LocalSaveContextProviderProps) {
  const { t } = useTranslation("game_details");

  const [artifacts, setArtifacts] = useState<GameArtifact[]>([]);
  const [showLocalSaveModal, setShowLocalSaveModal] = useState(false);
  const [backupPreview, setBackupPreview] = useState<LudusaviBackup | null>(
    null
  );
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [showLocalSaveFilesModal, setShowLocalSaveFilesModal] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [freezingArtifact, setFreezingArtifact] = useState(false);

  const { showSuccessToast } = useToast();

  const downloadGameArtifact = useCallback(
    async (gameArtifactId: string) => {
      setRestoringBackup(true);
      window.electron.downloadLocalGameArtifact(objectId, shop, gameArtifactId);
    },
    [objectId, shop]
  );

  const getGameArtifacts = useCallback(async () => {
    const results = await window.electron.getLocalGameArtifacts(objectId, shop);
    setArtifacts(results);
  }, [objectId, shop]);

  const getGameBackupPreview = useCallback(async () => {
    setLoadingPreview(true);

    try {
      const preview = await window.electron.getGameBackupPreview(
        objectId,
        shop
      );

      setBackupPreview(preview);
    } catch (err) {
      logger.error("Failed to get game backup preview", objectId, shop, err);
    } finally {
      setLoadingPreview(false);
    }
  }, [objectId, shop]);

  const uploadSaveGame = useCallback(
    async (downloadOptionTitle: string | null) => {
      setUploadingBackup(true);
      window.electron.uploadLocalSaveGame(objectId, shop, downloadOptionTitle);
    },
    [objectId, shop]
  );

  const toggleArtifactFreeze = useCallback(
    async (gameArtifactId: string, freeze: boolean) => {
      setFreezingArtifact(true);
      try {
        await window.electron.toggleLocalArtifactFreeze(gameArtifactId, freeze);
        getGameArtifacts();
      } catch (err) {
        logger.error("Failed to toggle artifact freeze", objectId, shop, err);
        throw err;
      } finally {
        setFreezingArtifact(false);
      }
    },
    [objectId, shop, getGameArtifacts]
  );

  useEffect(() => {
    const removeUploadCompleteListener = window.electron.onUploadComplete(
      objectId,
      shop,
      () => {
        showSuccessToast(t("backup_uploaded"));
        setUploadingBackup(false);
        getGameArtifacts();
        getGameBackupPreview();
      }
    );

    const removeDownloadCompleteListener =
      window.electron.onBackupDownloadComplete(objectId, shop, () => {
        showSuccessToast(t("backup_restored"));

        setRestoringBackup(false);
        getGameArtifacts();
        getGameBackupPreview();
      });

    return () => {
      removeUploadCompleteListener();
      removeDownloadCompleteListener();
    };
  }, [
    objectId,
    shop,
    showSuccessToast,
    t,
    getGameBackupPreview,
    getGameArtifacts,
  ]);

  const deleteGameArtifact = useCallback(
    async (gameArtifactId: string) => {
      return window.electron.deleteLocalGameArtifact(gameArtifactId).then(() => {
        getGameBackupPreview();
        getGameArtifacts();
      });
    },
    [getGameBackupPreview, getGameArtifacts]
  );

  useEffect(() => {
    setBackupPreview(null);
    setArtifacts([]);
    setShowLocalSaveModal(false);
    setRestoringBackup(false);
    setUploadingBackup(false);
  }, [objectId, shop]);

  const backupState = useMemo(() => {
    if (!backupPreview) return LocalBackupState.Unknown;
    if (backupPreview.overall.changedGames.new) return LocalBackupState.New;
    if (backupPreview.overall.changedGames.different)
      return LocalBackupState.Different;
    if (backupPreview.overall.changedGames.same) return LocalBackupState.Same;

    return LocalBackupState.Unknown;
  }, [backupPreview]);

  return (
    <Provider
      value={{
        backupPreview,
        showLocalSaveModal,
        artifacts,
        backupState,
        restoringBackup,
        uploadingBackup,
        showLocalSaveFilesModal,
        loadingPreview,
        freezingArtifact,
        setShowLocalSaveModal,
        uploadSaveGame,
        downloadGameArtifact,
        deleteGameArtifact,
        setShowLocalSaveFilesModal,
        getGameBackupPreview,
        getGameArtifacts,
        toggleArtifactFreeze,
      }}
    >
      {children}
    </Provider>
  );
}

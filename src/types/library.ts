export type LibraryStudioKey = 'code' | 'vision' | 'cinema' | 'music' | 'document';

export interface LibraryAssetDownloadOption {
  label: string;
  format: string;
  url: string;
}

export interface LibraryAsset {
  id: string; // `${studio}:${rawId}`
  rawId: string;
  studio: LibraryStudioKey;
  categoryLabel: string;
  subCategory: string;
  title: string;
  originalTitle: string;
  subtitle: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  contentPreview?: string;
  model: string;
  format: string;
  fileSizeBytes: number;
  version: number;
  rootId?: string | null;
  parentId?: string | null;
  tags: string[];
  shareUrl?: string;
  createdAt: string;
  updatedAt: string;
  trashedAt?: string | null;
  isFavorite: boolean;
  downloads: LibraryAssetDownloadOption[];
  metadata?: Record<string, any>;
}

export interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
  itemIds: string[];
}

export interface LibraryStudioStat {
  count: number;
  bytes: number;
}

export interface LibraryVaultStats {
  totalAssets: number;
  activeAssets: number;
  trashedAssets: number;
  favoritesCount: number;
  totalBytes: number;
  byStudio: Record<LibraryStudioKey, LibraryStudioStat>;
}

export interface LibraryAssetMetaOverride {
  customTitle?: string;
  tags?: string[];
  trashedAt?: string | null;
  isFavorite?: boolean;
}

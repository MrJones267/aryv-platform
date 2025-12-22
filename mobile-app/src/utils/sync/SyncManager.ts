/**
 * @fileoverview Sync Manager stub for production builds
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

export interface SyncStatus {
  isEnabled: boolean;
  lastSync: Date | null;
  pendingChanges: number;
}

export class SyncManager {
  static getInstance(): SyncManager {
    return new SyncManager();
  }

  getSyncStatus(): SyncStatus {
    return {
      isEnabled: false,
      lastSync: null,
      pendingChanges: 0
    };
  }

  async enableSync(): Promise<boolean> {
    return false;
  }

  async disableSync(): Promise<boolean> {
    return false;
  }
}

export default SyncManager;
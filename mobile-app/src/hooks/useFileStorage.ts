/**
 * @fileoverview File storage hook for managing file uploads and downloads
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import { useState, useCallback } from 'react';

export interface StoredFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface UseFileStorageReturn {
  files: StoredFile[];
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  uploadFile: (uri: string, name: string, type: string) => Promise<string | null>;
  deleteFile: (fileId: string) => Promise<boolean>;
  getFileUrl: (fileId: string) => string | null;
}

export const useFileStorage = (): UseFileStorageReturn => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (
    uri: string,
    name: string,
    type: string
  ): Promise<string | null> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(i);
      }

      const newFile: StoredFile = {
        id: Date.now().toString(),
        name,
        url: uri,
        type,
        size: 0,
        uploadedAt: new Date(),
      };

      setFiles(prev => [...prev, newFile]);
      return newFile.url;
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      setFiles(prev => prev.filter(f => f.id !== fileId));
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
      return false;
    }
  }, []);

  const getFileUrl = useCallback((fileId: string): string | null => {
    const file = files.find(f => f.id === fileId);
    return file?.url || null;
  }, [files]);

  return {
    files,
    isUploading,
    uploadProgress,
    error,
    uploadFile,
    deleteFile,
    getFileUrl,
  };
};

export default useFileStorage;

import { useState, useCallback } from 'react';
import { uploadTopologyFile, startProvisioning, type UploadResponse } from '../api/topologyUpload';

export function useTopologyUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadTopologyFile(file);
      setUploadResult(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploadResult(null);
    setUploadError(null);
  }, []);

  return { upload, uploading, uploadResult, uploadError, reset };
}

export function useProvisionStart() {
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await startProvisioning();
      setSessionId(res.session_id);
      return res.session_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start provisioning';
      setError(msg);
      throw err;
    } finally {
      setStarting(false);
    }
  }, []);

  return { start, starting, sessionId, error };
}

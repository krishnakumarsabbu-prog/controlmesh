import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CircleCheck as CheckCircle, X, CircleAlert as AlertCircle, Table2 } from 'lucide-react';
import type { UploadResponse } from '../../api/topologyUpload';

interface Props {
  onUpload: (file: File) => Promise<UploadResponse>;
  uploading: boolean;
  uploadResult: UploadResponse | null;
  uploadError: string | null;
  onReset: () => void;
}

export default function UploadTopology({ onUpload, uploading, uploadResult, uploadError, onReset }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const valid = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!valid) return;
    await onUpload(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (uploadResult) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0d1f17] border border-emerald-700/50 text-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/60 border border-emerald-700 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">{uploadResult.filename}</span>
            </div>
            <span className="text-xs text-text-muted mt-0.5 block">
              {uploadResult.row_count} rows · {uploadResult.node_count} nodes · {uploadResult.edge_count} edges
            </span>
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-text-muted hover:text-text-primary transition-colors p-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        animate={{ borderColor: dragOver ? 'rgb(16,185,129)' : 'rgb(51,65,85)' }}
        className="relative flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed border-surface-border bg-surface-card cursor-pointer hover:border-emerald-600/60 hover:bg-surface-overlay transition-all duration-200 group"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-700/50 flex items-center justify-center">
                <span className="w-6 h-6 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
              </div>
              <span className="text-sm text-blue-300 font-medium">Parsing topology file...</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                dragOver
                  ? 'bg-emerald-900/40 border-emerald-600'
                  : 'bg-surface-overlay border-surface-border group-hover:bg-emerald-900/20 group-hover:border-emerald-700/60'
              }`}>
                <Upload className={`w-5 h-5 transition-colors ${dragOver ? 'text-emerald-400' : 'text-text-muted group-hover:text-emerald-400'}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">
                  Drop your IBM MQ topology file
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Supports .csv and .xlsx — click or drag to upload
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-overlay border border-surface-border text-xs text-text-muted">
                  <Table2 className="w-3 h-3" />
                  CSV
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-overlay border border-surface-border text-xs text-text-muted">
                  <FileSpreadsheet className="w-3 h-3" />
                  XLSX
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {uploadError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {uploadError}
        </motion.div>
      )}
    </div>
  );
}

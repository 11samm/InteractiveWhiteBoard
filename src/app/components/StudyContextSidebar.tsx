import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, FolderOpen, Loader2, AlertCircle } from 'lucide-react';
import { deleteBoardFile, listBoardFiles, uploadBoardFile, UploadError, type FileSummary } from '../lib/api';

interface StudyContextSidebarProps {
  theme: 'light' | 'dark';
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  boardId: string;
}

const ACCEPTED_TYPE = 'application/pdf';
const POLL_INTERVAL_MS = 2000;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudyContextSidebar({ theme, isCollapsed, onCollapsedChange, boardId }: StudyContextSidebarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setFiles(await listBoardFiles(boardId));
    } catch {
      // Transient network hiccups shouldn't clear the currently-shown list.
    }
  }, [boardId]);

  // Shared ingestion progress (PLAN.md 4.5): every participant sees the same
  // upload/processing state, so we poll rather than assume only this tab's
  // uploads can change it. Polls a bit faster while something is still
  // processing, otherwise settles down.
  useEffect(() => {
    refresh();
    const hasProcessing = files.some((f) => f.status === 'processing');
    const interval = setInterval(refresh, hasProcessing ? POLL_INTERVAL_MS : POLL_INTERVAL_MS * 3);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, files.some((f) => f.status === 'processing')]);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const list = Array.from(fileList);
      for (const file of list) {
        try {
          const record = await uploadBoardFile(boardId, file);
          setFiles((prev) => [...prev, record]);
        } catch (err) {
          const message = err instanceof UploadError ? err.message : 'Upload failed. Please try again.';
          setUploadErrors((prev) => [...prev, `${file.name}: ${message}`]);
        }
      }
    },
    [boardId],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleBrowseClick = () => fileInputRef.current?.click();

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = async (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    try {
      await deleteBoardFile(id);
    } catch {
      refresh(); // put it back if the delete actually failed
    }
  };

  return (
    <>
      <button
        onClick={() => onCollapsedChange(!isCollapsed)}
        className={`fixed top-1/2 -translate-y-1/2 z-40 p-3 rounded-r-xl backdrop-blur-xl transition-all shadow-lg border border-l-0 ${
          isCollapsed ? 'left-0' : 'left-80'
        } ${
          theme === 'dark'
            ? 'bg-white/10 border-white/20 text-slate-300 hover:bg-white/20 hover:text-white'
            : 'bg-slate-900/10 border-slate-900/20 text-slate-600 hover:bg-slate-900/20 hover:text-slate-900'
        }`}
        title={isCollapsed ? 'Open files sidebar' : 'Close files sidebar'}
        aria-label={isCollapsed ? 'Open files sidebar' : 'Close files sidebar'}
      >
        <FolderOpen className={`w-5 h-5 transition-transform ${isCollapsed ? 'scale-x-[-1]' : ''}`} />
      </button>

      <div
        className={`fixed top-0 left-0 h-full w-80 backdrop-blur-sm border-r shadow-2xl transition-transform duration-300 z-30 ${
          isCollapsed ? '-translate-x-full' : 'translate-x-0'
        } ${theme === 'dark' ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100/95 border-slate-300'}`}
      >
        <div className="flex flex-col h-full p-6">
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Study Context
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPE}
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          <button
            type="button"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            className={`border-2 border-dashed rounded-xl p-8 mb-4 transition-all text-left ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : theme === 'dark'
                  ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  : 'border-slate-300 bg-slate-200/50 hover:border-slate-400'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <Upload className={`w-10 h-10 mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Drop a PDF here
              </p>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                or click to browse (max 20 MB)
              </p>
            </div>
          </button>

          {uploadErrors.length > 0 && (
            <div className="mb-4 space-y-1">
              {uploadErrors.map((message, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{message}</span>
                  <button
                    onClick={() => setUploadErrors((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Dismiss"
                    className="hover:opacity-70"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <h3 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Active Files ({files.length})
            </h3>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                    theme === 'dark' ? 'bg-slate-800/70 hover:bg-slate-800' : 'bg-slate-200/70 hover:bg-slate-200'
                  }`}
                  title={file.status === 'error' ? (file.error ?? 'Failed to process') : undefined}
                >
                  {file.status === 'processing' ? (
                    <Loader2 className="w-5 h-5 text-slate-400 flex-shrink-0 animate-spin" />
                  ) : file.status === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}
                    >
                      {file.filename}
                    </p>
                    <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                      {file.status === 'processing' && 'Processing…'}
                      {file.status === 'error' && (file.error ?? 'Failed to process')}
                      {file.status === 'ready' &&
                        `${formatSize(file.sizeBytes)}${file.pageCount ? ` · ${file.pageCount} pages` : ''}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                      theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-300'
                    }`}
                    title="Remove file"
                    aria-label="Remove file"
                  >
                    <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                  </button>
                </div>
              ))}
              {files.length === 0 && (
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  No files yet — upload a PDF to give the AI tutor something to reference.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

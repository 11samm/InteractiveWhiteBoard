import { useState } from 'react';
import { Upload, FileText, X, FolderOpen } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
}

interface StudyContextSidebarProps {
  theme: 'light' | 'dark';
}

export function StudyContextSidebar({ theme }: StudyContextSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([
    { id: '1', name: 'Linear_Algebra_Ch3.pdf', size: '2.4 MB' },
    { id: '2', name: 'Lecture_Notes_Week5.pdf', size: '1.8 MB' },
  ]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Mock file upload
    const newFile = {
      id: Date.now().toString(),
      name: 'New_Document.pdf',
      size: '3.2 MB',
    };
    setFiles([...files, newFile]);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  return (
    <>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`fixed top-1/2 -translate-y-1/2 z-40 p-3 rounded-l-xl backdrop-blur-xl transition-all shadow-lg border border-r-0 ${
          isCollapsed ? 'right-0' : 'right-80'
        } ${
          theme === 'dark'
            ? 'bg-white/10 border-white/20 text-slate-300 hover:bg-white/20 hover:text-white'
            : 'bg-slate-900/10 border-slate-900/20 text-slate-600 hover:bg-slate-900/20 hover:text-slate-900'
        }`}
        aria-label={isCollapsed ? 'Open files sidebar' : 'Close files sidebar'}
      >
        <FolderOpen className={`w-5 h-5 transition-transform ${
          isCollapsed ? '' : 'scale-x-[-1]'
        }`} />
      </button>

      <div
        className={`fixed top-0 right-0 h-full w-80 backdrop-blur-sm border-l shadow-2xl transition-transform duration-300 z-30 ${
          isCollapsed ? 'translate-x-full' : 'translate-x-0'
        } ${
          theme === 'dark'
            ? 'bg-slate-900/95 border-slate-800'
            : 'bg-slate-100/95 border-slate-300'
        }`}
      >
        <div className="flex flex-col h-full p-6">
          <h2 className={`text-xl font-semibold mb-6 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Study Context</h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 mb-6 transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : theme === 'dark'
                  ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  : 'border-slate-300 bg-slate-200/50 hover:border-slate-400'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <Upload className={`w-10 h-10 mb-3 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
              }`} />
              <p className={`text-sm mb-1 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Drop PDFs or slides here
              </p>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>
                or click to browse
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <h3 className={`text-sm font-medium mb-3 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Active Files ({files.length})
            </h3>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-800/70 hover:bg-slate-800'
                      : 'bg-slate-200/70 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${
                      theme === 'dark' ? 'text-slate-200' : 'text-slate-900'
                    }`}>{file.name}</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                    }`}>{file.size}</p>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                      theme === 'dark' 
                        ? 'hover:bg-slate-700' 
                        : 'hover:bg-slate-300'
                    }`}
                    aria-label="Remove file"
                  >
                    <X className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
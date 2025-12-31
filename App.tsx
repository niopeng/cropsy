import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Download, Layers, Loader2, Info, PlusCircle, ImageIcon, AlertCircle } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { BoundingBoxOverlay } from './components/BoundingBoxOverlay';
import { ImageFile, Rect, FolderData } from './types';
import { getImagesFromDirectory, processFilesFromInput } from './utils/fileSystem';
import { clampRectToImage, defaultRect } from './utils/geometry';

export default function App() {
  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  // --- Workspace State ---
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
  
  // --- Editor State ---
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{width: number, height: number}>({ width: 0, height: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  
  // --- Processing State ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // --- Computed ---
  const activeFolder = folders.find(f => f.id === activeFolderId) || null;
  const currentFile = activeFolder?.files[selectedFileIndex] || null;

  // --- Effects ---

  // Load image when selection changes
  useEffect(() => {
    let active = true;
    if (currentFile) {
      const load = async () => {
        try {
          const file = currentFile.handle ? await currentFile.handle.getFile() : currentFile.nativeFile!;
          const url = URL.createObjectURL(file);
          if (active) {
            setImageUrl(url);
          }
        } catch (err) {
          console.error("Failed to load file", err);
          setStatusMsg("Error loading image file.");
        }
      };
      load();
    } else {
      setImageUrl(null);
    }
    return () => { 
      active = false;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [activeFolderId, selectedFileIndex, folders]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    setImgSize({ width: naturalWidth, height: naturalHeight });
    updateDisplayScale(img);
    
    if (activeFolderId) {
      setFolders(prev => prev.map(f => {
        if (f.id === activeFolderId) {
          const newRect = f.rect ? clampRectToImage(f.rect, naturalWidth, naturalHeight) : defaultRect(naturalWidth, naturalHeight);
          return { ...f, rect: newRect };
        }
        return f;
      }));
    }
  };

  const updateDisplayScale = (img: HTMLImageElement) => {
     if (!containerRef.current) return;
     setDisplayScale(img.width / img.naturalWidth);
  };
  
  useEffect(() => {
     const handleResize = () => {
        const img = document.querySelector('img.main-image') as HTMLImageElement;
        if (img) updateDisplayScale(img);
     };
     window.addEventListener('resize', handleResize);
     return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Actions ---

  const handleOpenFolder = async () => {
    try {
      // Check for iframe or missing API
      if (!window.showDirectoryPicker) {
        setIsFallbackMode(true);
        fallbackInputRef.current?.click();
        return;
      }

      const handle = await window.showDirectoryPicker({ mode: 'read' });
      setStatusMsg("Scanning folder...");
      setIsProcessing(true);
      
      const imageFiles = await getImagesFromDirectory(handle);
      const newFolderId = Math.random().toString(36).substr(2, 9);
      
      const newFolder: FolderData = {
        id: newFolderId,
        name: handle.name,
        files: imageFiles,
        handle: handle,
        rect: defaultRect(1000, 1000),
        isExpanded: true
      };

      setFolders(prev => [...prev, newFolder]);
      setActiveFolderId(newFolderId);
      setSelectedFileIndex(imageFiles.length > 0 ? 0 : -1);
      setStatusMsg(`Added ${imageFiles.length} images.`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStatusMsg("Selection cancelled.");
      } else {
        console.warn("Restricted environment detected, using fallback selector.");
        setIsFallbackMode(true);
        fallbackInputRef.current?.click();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFallbackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      setStatusMsg("Processing files...");
      
      const imageFiles = processFilesFromInput(e.target.files);
      const newFolderId = Math.random().toString(36).substr(2, 9);
      const folderName = (e.target.files[0] as any).webkitRelativePath?.split('/')[0] || "Imported Folder";

      const newFolder: FolderData = {
        id: newFolderId,
        name: folderName,
        files: imageFiles,
        rect: defaultRect(1000, 1000),
        isExpanded: true
      };

      setFolders(prev => [...prev, newFolder]);
      setActiveFolderId(newFolderId);
      setSelectedFileIndex(imageFiles.length > 0 ? 0 : -1);
      setStatusMsg(`Imported ${imageFiles.length} images.`);
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  /**
   * Triggers a browser download for a specific blob
   */
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleExport = async () => {
    const targetFolder = folders.find(f => f.id === activeFolderId);
    if (!targetFolder || targetFolder.files.length === 0) {
      setStatusMsg("Nothing to export.");
      return;
    }

    if (targetFolder.files.length > 5 && !window.confirm(`You are about to download ${targetFolder.files.length} individual images. Your browser may ask for permission to allow multiple downloads. Continue?`)) {
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: targetFolder.files.length });
    setStatusMsg("Starting batch download...");

    const exportedMetadata: Record<string, Rect> = {};

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas initialization failed.");

      for (let i = 0; i < targetFolder.files.length; i++) {
        const entry = targetFolder.files[i];
        setStatusMsg(`Processing: ${entry.name}`);
        
        try {
          const file = entry.handle ? await entry.handle.getFile() : entry.nativeFile!;
          const bitmap = await createImageBitmap(file);
          
          const activeRect = clampRectToImage(targetFolder.rect, bitmap.width, bitmap.height);
          exportedMetadata[entry.name] = activeRect;

          canvas.width = activeRect.width;
          canvas.height = activeRect.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            bitmap, 
            activeRect.x, activeRect.y, activeRect.width, activeRect.height, 
            0, 0, activeRect.width, activeRect.height
          );

          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          if (blob) {
            triggerDownload(blob, entry.name);
          }
          
          bitmap.close();
          // Small delay to prevent browser download queue from choking
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 150));

        } catch (fileErr) {
          console.error(`Failed to process ${entry.name}`, fileErr);
        }

        setProgress({ current: i + 1, total: targetFolder.files.length });
      }

      // Download crops.json
      const metaBlob = new Blob([JSON.stringify(exportedMetadata, null, 2)], { type: 'application/json' });
      triggerDownload(metaBlob, 'crops.json');
      
      setStatusMsg("Batch download complete.");
    } catch (err: any) {
      console.error("Export error:", err);
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleUpdateRect = (newRect: Rect) => {
    if (!activeFolderId) return;
    setFolders(prev => prev.map(f => f.id === activeFolderId ? { ...f, rect: newRect } : f));
  };

  const handleSelectFile = (folderId: string, fileIndex: number) => {
    setActiveFolderId(folderId);
    setSelectedFileIndex(fileIndex);
  };

  const handleToggleFolder = (folderId: string) => {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f));
    if (activeFolderId !== folderId) {
      setActiveFolderId(folderId);
      setSelectedFileIndex(0);
    }
  };

  const handleRemoveFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    if (activeFolderId === folderId) {
      setActiveFolderId(null);
      setSelectedFileIndex(-1);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-slate-800 overflow-hidden font-sans">
      <input 
        type="file" 
        ref={fallbackInputRef} 
        className="hidden" 
        multiple 
        {...({ webkitdirectory: "", directory: "" } as any)} 
        onChange={handleFallbackInputChange} 
      />

      <header className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-blue-200 shadow-md">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-800 leading-tight">Cropsy</h1>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Image Batch Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 mr-4 font-medium truncate max-w-[250px] italic">
            {statusMsg || (activeFolder ? `Viewing: ${activeFolder.name}` : 'Ready')}
          </span>

          <button 
            onClick={handleOpenFolder}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isProcessing && folders.length === 0 ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
            Add Folder
          </button>
          
          <button 
            onClick={handleExport}
            disabled={!activeFolder || isProcessing}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg transition-all border
              ${(!activeFolder || isProcessing) 
                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm active:scale-95'}`}
          >
            {isProcessing && folders.length > 0 ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download Crops
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          folders={folders} 
          activeFolderId={activeFolderId} 
          selectedFileIndex={selectedFileIndex} 
          onSelectFile={handleSelectFile} 
          onToggleFolder={handleToggleFolder}
          onRemoveFolder={handleRemoveFolder}
          disabled={isProcessing} 
        />

        <main className="flex-1 bg-slate-50 relative flex flex-col">
          <div className="h-10 border-b border-slate-200 bg-white flex items-center px-4 justify-between text-xs text-gray-400">
             <div className="flex gap-6">
                {activeFolder && (
                  <>
                    <span>Workspace: <strong className="text-gray-700">{activeFolder.name}</strong></span>
                    <span>File: <strong className="text-gray-700">{currentFile?.name || '-'}</strong></span>
                    {imgSize.width > 0 && <span>Size: <strong className="text-gray-700">{imgSize.width}x{imgSize.height}</strong></span>}
                  </>
                )}
             </div>
             {isFallbackMode && (
               <div className="flex gap-2 items-center bg-amber-50 text-amber-600 px-3 py-1 rounded-full font-medium">
                  <AlertCircle size={12} />
                  <span>Downloads will trigger individually.</span>
               </div>
             )}
          </div>

          <div className="flex-1 relative overflow-auto p-12 flex items-center justify-center" ref={containerRef}>
            {folders.length === 0 ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-300">
                  <FolderOpen size={40} />
                </div>
                <h2 className="text-xl font-bold text-gray-700 mb-2">Import Image Folder</h2>
                <p className="text-sm text-gray-400 max-w-sm mx-auto mb-8">
                  Import a folder of images, define a crop area, and download the results as individual files.
                </p>
                <button 
                  onClick={handleOpenFolder}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1"
                >
                  Select Folder to Start
                </button>
              </div>
            ) : !currentFile ? (
              <div className="text-center text-gray-400">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p>Select an image to preview crop</p>
              </div>
            ) : !imageUrl ? (
              <div className="flex items-center gap-3 text-gray-400 font-medium"><Loader2 className="animate-spin" /> Preparing image...</div>
            ) : (
              <div className="relative shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] ring-1 ring-black/5 bg-white line-0">
                <img 
                  src={imageUrl} 
                  alt="Target"
                  className="main-image max-w-full max-h-[75vh] block object-contain select-none"
                  onLoad={onImageLoad}
                  draggable={false}
                />
                {activeFolder && imgSize.width > 0 && (
                  <BoundingBoxOverlay 
                    rect={activeFolder.rect} 
                    imageWidth={imgSize.width} 
                    imageHeight={imgSize.height} 
                    displayScale={displayScale} 
                    onChange={handleUpdateRect} 
                  />
                )}
              </div>
            )}
          </div>

          {isProcessing && progress && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white">
              <div className="bg-white p-8 rounded-2xl shadow-2xl w-80 text-center">
                <div className="w-full bg-gray-100 rounded-full h-3 mb-6 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Downloading</h3>
                <p className="text-gray-400 text-sm mb-6">{progress.current} of {progress.total} processed</p>
                
                <div className="py-2 px-4 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Generating downloads...
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

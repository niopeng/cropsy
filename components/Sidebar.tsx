import React from 'react';
import { FolderData } from '../types';
import { ChevronDown, ChevronRight, Folder, ImageIcon, Trash2 } from 'lucide-react';

interface Props {
  folders: FolderData[];
  activeFolderId: string | null;
  selectedFileIndex: number;
  onSelectFile: (folderId: string, fileIndex: number) => void;
  onToggleFolder: (folderId: string) => void;
  onRemoveFolder: (folderId: string) => void;
  disabled?: boolean;
}

export const Sidebar: React.FC<Props> = ({ 
  folders, 
  activeFolderId, 
  selectedFileIndex, 
  onSelectFile, 
  onToggleFolder,
  onRemoveFolder,
  disabled 
}) => {
  return (
    <div className="w-72 flex-shrink-0 bg-gray-50 border-r border-gray-200 h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex items-center justify-between">
        <h2 className="font-bold text-gray-700 text-sm tracking-tight flex items-center gap-2">
          WORKSPACE
        </h2>
        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 font-mono">
          {folders.length} FOLDERS
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 px-4 text-center">
            <Folder className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs">No folders added to your workspace yet.</p>
          </div>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-white">
              {/* Folder Header */}
              <div 
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors
                  ${activeFolderId === folder.id ? 'bg-blue-50 border-b border-blue-100' : 'hover:bg-gray-50'}`}
                onClick={() => onToggleFolder(folder.id)}
              >
                <button className="text-gray-400 group-hover:text-blue-500 transition-colors">
                  {folder.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <Folder size={16} className={activeFolderId === folder.id ? 'text-blue-600' : 'text-gray-400'} />
                <span className={`text-sm truncate flex-1 ${activeFolderId === folder.id ? 'text-blue-700 font-semibold' : 'text-gray-600'}`}>
                  {folder.name}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFolder(folder.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* File List */}
              {folder.isExpanded && (
                <div className="bg-white py-1 max-h-60 overflow-y-auto">
                  {folder.files.length === 0 ? (
                    <div className="px-8 py-4 text-xs text-gray-400 italic">No images in this folder</div>
                  ) : (
                    folder.files.map((file, idx) => (
                      <button
                        key={file.id}
                        disabled={disabled}
                        onClick={() => onSelectFile(folder.id, idx)}
                        className={`w-full text-left px-8 py-1.5 text-xs truncate transition-colors flex items-center gap-2
                          ${activeFolderId === folder.id && selectedFileIndex === idx 
                            ? 'bg-blue-600 text-white font-medium' 
                            : 'hover:bg-blue-50 text-gray-500 hover:text-blue-600'}
                          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <ImageIcon size={12} className="flex-shrink-0" />
                        {file.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
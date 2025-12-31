// Extended Window interface for File System Access API
declare global {
  interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
  }
}

export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

export interface ImageFile {
  id: string;
  name: string;
  handle?: FileSystemFileHandle;
  nativeFile?: File; // Fallback for when we don't have a handle (e.g. from <input type="file">)
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FolderData {
  id: string;
  name: string;
  files: ImageFile[];
  rect: Rect;
  handle?: FileSystemDirectoryHandle;
  isExpanded: boolean;
}

export interface ExportConfig {
  prefix: string;
  format: 'png' | 'jpeg';
  quality: number;
}

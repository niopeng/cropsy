import { FileSystemDirectoryHandle, ImageFile } from '../types';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];

export async function getImagesFromDirectory(dirHandle: FileSystemDirectoryHandle): Promise<ImageFile[]> {
  const images: ImageFile[] = [];
  
  try {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'file') {
        const lowerName = name.toLowerCase();
        if (IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
          images.push({
            id: name,
            name: name,
            handle: entry as any
          });
        }
      }
    }
  } catch (error) {
    console.error("Error iterating directory:", error);
    throw new Error("Could not read directory contents.");
  }
  
  return images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * Fallback: Process files from a standard <input type="file" webkitdirectory>
 */
export function processFilesFromInput(fileList: FileList): ImageFile[] {
  const images: ImageFile[] = [];
  const filesArray = Array.from(fileList);

  for (const file of filesArray) {
    const lowerName = file.name.toLowerCase();
    if (IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
      images.push({
        id: Math.random().toString(36).substr(2, 9), // Generate a temp ID
        name: file.name,
        nativeFile: file
      });
    }
  }

  return images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export async function saveBlobToHandle(dirHandle: FileSystemDirectoryHandle, filename: string, blob: Blob) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveTextToHandle(dirHandle: FileSystemDirectoryHandle, filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  await saveBlobToHandle(dirHandle, filename, blob);
}

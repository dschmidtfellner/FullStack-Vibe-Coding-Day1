import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './core';

/**
 * Upload file to Firebase Storage
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    if (import.meta.env.DEV) {
      console.log('Uploading file:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    if (import.meta.env.DEV) {
      console.log('File uploaded successfully');
    }
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}
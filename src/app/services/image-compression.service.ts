import { inject, Injectable } from '@angular/core';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

@Injectable({
  providedIn: 'root',
})
export class ImageCompressionService {
  /**
   * Compresses and resizes an image file
   * @param file - The image file to compress
   * @param options - Compression options
   * @returns Promise that resolves to a compressed File
   */
  async compressImage(
    file: File,
    options: ImageCompressionOptions = {},
  ): Promise<File> {
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      quality = 0.85,
      outputFormat = 'image/jpeg',
    } = options;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => {
          try {
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              const aspectRatio = width / height;
              if (width > height) {
                width = maxWidth;
                height = width / aspectRatio;
                if (height > maxHeight) {
                  height = maxHeight;
                  width = height * aspectRatio;
                }
              } else {
                height = maxHeight;
                width = height * aspectRatio;
                if (width > maxWidth) {
                  width = maxWidth;
                  height = width / aspectRatio;
                }
              }
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }

            // Use better image rendering quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }

                // Create a new File with the compressed blob
                const compressedFile = new File([blob], file.name, {
                  type: outputFormat,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              },
              outputFormat,
              quality,
            );
          } catch (error) {
            reject(error);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compresses multiple image files
   * @param files - Array of image files to compress
   * @param options - Compression options
   * @returns Promise that resolves to an array of compressed Files
   */
  async compressImages(
    files: File[],
    options: ImageCompressionOptions = {},
  ): Promise<File[]> {
    return Promise.all(files.map((file) => this.compressImage(file, options)));
  }

  /**
   * Checks if a file is an image
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
}

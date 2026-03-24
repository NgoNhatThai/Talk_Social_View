/**
 * Cloudinary Upload Service
 * Handles uploading files (images, videos) directly to Cloudinary from the frontend.
 */

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  width: number;
  height: number;
  duration?: number;
}

export const uploadToCloudinary = async (file: File): Promise<CloudinaryUploadResult> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default';
  
  if (!cloudName) {
    throw new Error('Cloudinary Cloud Name is not configured in .env');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  // Optional: Add tags or folder from .env if needed
  // formData.append('folder', 'talk_social');

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload to Cloudinary');
    }

    const data = await response.json();
    return {
      public_id: data.public_id,
      secure_url: data.secure_url,
      resource_type: data.resource_type,
      format: data.format,
      width: data.width,
      height: data.height,
      duration: data.duration,
    };
  } catch (error: any) {
    console.error('Cloudinary Upload Error:', error);
    throw error;
  }
};

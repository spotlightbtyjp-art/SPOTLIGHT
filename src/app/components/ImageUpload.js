"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { storage } from '@/app/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

const Icons = {
    Upload: () => (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
    ),
    Trash: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    Image: () => (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    )
};

export default function ImageUpload({ imageUrl, onImageChange, folder = 'services' }) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [imageError, setImageError] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('ขนาดไฟล์ต้องไม่เกิน 5MB');
            return;
        }

        setError('');
        setUploading(true);
        setProgress(0);

        try {
            // Create unique filename
            const timestamp = Date.now();
            const filename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const storageRef = ref(storage, `${folder}/${filename}`);

            // Upload file
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(Math.round(prog));
                },
                (error) => {
                    console.error('Upload error:', error);
                    setError('เกิดข้อผิดพลาดในการอัพโหลด: ' + error.message);
                    setUploading(false);
                },
                async () => {
                    // Upload completed successfully
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    onImageChange(downloadURL);
                    setImageError(false);
                    setUploading(false);
                    setProgress(0);
                }
            );
        } catch (err) {
            console.error('Upload error:', err);
            setError('เกิดข้อผิดพลาดในการอัพโหลด: ' + err.message);
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!imageUrl) return;

        try {
            // Try to delete from storage if it's a Firebase Storage URL
            if (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('firebasestorage.app')) {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
            }
        } catch (err) {
            // Ignore "object-not-found" error as it means the file is already gone
            if (err.code !== 'storage/object-not-found') {
                console.error('Delete error:', err);
            }
        }

        onImageChange('');
        setImageError(false);
    };

    return (
        <div className="space-y-4">
            {/* Current Image Preview */}
            {imageUrl && (
                <div className="relative group">
                    <div className="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                        {!imageError ? (
                            <Image
                                src={imageUrl}
                                alt="Service preview"
                                fill
                                className="object-cover"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Icons.Image />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg transform hover:scale-110 transition-transform"
                            >
                                <Icons.Trash />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Area */}
            <div className="space-y-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {!imageUrl && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex flex-col items-center gap-3 text-gray-500">
                            <Icons.Image />
                            <div className="text-center">
                                <p className="font-medium text-gray-700">
                                    {uploading ? 'กำลังอัพโหลด...' : 'คลิกเพื่ออัพโหลดรูปภาพ'}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    PNG, JPG, GIF (สูงสุด 5MB)
                                </p>
                            </div>
                        </div>
                    </button>
                )}

                {imageUrl && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Icons.Upload />
                            {uploading ? 'กำลังอัพโหลด...' : 'เปลี่ยนรูปภาพ'}
                        </div>
                    </button>
                )}

                {/* Progress Bar */}
                {uploading && (
                    <div className="space-y-2">
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-center text-gray-600">{progress}%</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}
            </div>

            {/* Manual URL Input (Optional) */}
            <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    หรือใส่ URL รูปภาพ
                </label>
                <input
                    type="url"
                    value={imageUrl || ''}
                    onChange={(e) => onImageChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white text-sm"
                    placeholder="https://example.com/image.jpg"
                    disabled={uploading}
                />
            </div>
        </div>
    );
}

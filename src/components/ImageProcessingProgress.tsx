import React from "react";
import { useImageProcessingStore } from "../stores/imageProcessingStore";

export function ImageProcessingProgress() {
    const { isProcessing, totalImages, processedImages, currentImage, startTime } = useImageProcessingStore();

    if (!isProcessing) return null;

    const progress = totalImages > 0 ? (processedImages / totalImages) * 100 : 0;
    const elapsed = startTime ? Date.now() - startTime : 0;

    return (
        <div className="fixed top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg z-50 min-w-80">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Processing Images</span>
                <span className="text-sm text-gray-300">{processedImages}/{totalImages}</span>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            {currentImage && (
                <div className="text-xs text-gray-400 truncate">
                    Processing: {currentImage}
                </div>
            )}
            
            <div className="text-xs text-gray-500 mt-1">
                {Math.round(elapsed / 1000)}s elapsed
            </div>
        </div>
    );
}


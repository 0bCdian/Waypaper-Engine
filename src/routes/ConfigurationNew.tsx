import React from "react";

/**
 * Configuration Route Component
 * 
 * This component now serves as a simple placeholder since configuration
 * is handled directly in the sidebar, similar to Upscayl's approach.
 */
const Configuration: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-base-content mb-4">
          Configuration
        </h1>
        <p className="text-base-content/70">
          Settings are now available in the sidebar for easy access.
        </p>
        <p className="text-sm text-base-content/50 mt-2">
          Use the toggle button to expand/collapse the sidebar if needed.
        </p>
      </div>
    </div>
  );
};

export default Configuration;

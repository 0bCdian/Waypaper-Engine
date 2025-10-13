/**
 * Settings Page Component for Waypaper Engine
 * 
 * Main settings page that loads the SettingsTabs component.
 * Handles routing and provides the main settings interface.
 */

import React from 'react';
import SettingsTabs from '../components/settings/SettingsTabs';

/**
 * Settings page component
 */
const Settings: React.FC = () => {
  return (
    <div className="h-full w-full">
      <SettingsTabs />
    </div>
  );
};

export default Settings;

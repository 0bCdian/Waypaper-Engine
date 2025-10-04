export interface FrontendConfig {
  selectedMonitors: string[];
  imageSetType: 'individual' | 'extend' | 'clone';
  lastActivePlaylist?: string;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  theme?: string;
  sidebarCollapsed?: boolean;
  imagesPerPage?: number;
  sortBy?: 'name' | 'date' | 'size';
  sortOrder?: 'asc' | 'desc';
}

class FrontendConfigManager {
  private config: FrontendConfig | null = null;

  async loadConfig(): Promise<FrontendConfig> {
    if (this.config) {
      return this.config;
    }

    // For now, use in-memory config only
    // TODO: Implement proper IPC-based config persistence
    console.log('🟡 FrontendConfig: Using in-memory config (fs not available in renderer)');
    this.config = this.getDefaultConfig();
    return this.config;
  }

  async saveConfig(): Promise<void> {
    if (!this.config) {
      console.warn('🟡 FrontendConfig: No config to save');
      return;
    }

    // For now, just log that we would save
    // TODO: Implement proper IPC-based config persistence
    console.log('🟡 FrontendConfig: Would save config (fs not available in renderer):', this.config);
  }

  async updateConfig(updates: Partial<FrontendConfig>): Promise<void> {
    const currentConfig = await this.loadConfig();
    this.config = { ...currentConfig, ...updates };
    await this.saveConfig();
  }

  async getConfig(): Promise<FrontendConfig> {
    return await this.loadConfig();
  }

  private getDefaultConfig(): FrontendConfig {
    return {
      selectedMonitors: [],
      imageSetType: 'individual',
      lastActivePlaylist: undefined,
      windowBounds: undefined,
      theme: 'dark',
      sidebarCollapsed: false,
      imagesPerPage: 20,
      sortBy: 'name',
      sortOrder: 'asc'
    };
  }

  // Convenience methods for specific settings
  async getSelectedMonitors(): Promise<string[]> {
    const config = await this.getConfig();
    return config.selectedMonitors;
  }

  async setSelectedMonitors(monitors: string[]): Promise<void> {
    await this.updateConfig({ selectedMonitors: monitors });
  }

  async getImageSetType(): Promise<'individual' | 'extend' | 'clone'> {
    const config = await this.getConfig();
    return config.imageSetType;
  }

  async setImageSetType(type: 'individual' | 'extend' | 'clone'): Promise<void> {
    await this.updateConfig({ imageSetType: type });
  }

  async getLastActivePlaylist(): Promise<string | undefined> {
    const config = await this.getConfig();
    return config.lastActivePlaylist;
  }

  async setLastActivePlaylist(playlistName: string | undefined): Promise<void> {
    await this.updateConfig({ lastActivePlaylist: playlistName });
  }

  async getWindowBounds(): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    const config = await this.getConfig();
    return config.windowBounds;
  }

  async setWindowBounds(bounds: { x: number; y: number; width: number; height: number } | undefined): Promise<void> {
    await this.updateConfig({ windowBounds: bounds });
  }

  async getTheme(): Promise<string> {
    const config = await this.getConfig();
    return config.theme || 'dark';
  }

  async setTheme(theme: string): Promise<void> {
    await this.updateConfig({ theme });
  }

  async getSidebarCollapsed(): Promise<boolean> {
    const config = await this.getConfig();
    return config.sidebarCollapsed || false;
  }

  async setSidebarCollapsed(collapsed: boolean): Promise<void> {
    await this.updateConfig({ sidebarCollapsed: collapsed });
  }

  async getImagesPerPage(): Promise<number> {
    const config = await this.getConfig();
    return config.imagesPerPage || 20;
  }

  async setImagesPerPage(count: number): Promise<void> {
    await this.updateConfig({ imagesPerPage: count });
  }

  async getSortSettings(): Promise<{ sortBy: 'name' | 'date' | 'size'; sortOrder: 'asc' | 'desc' }> {
    const config = await this.getConfig();
    return {
      sortBy: config.sortBy || 'name',
      sortOrder: config.sortOrder || 'asc'
    };
  }

  async setSortSettings(sortBy: 'name' | 'date' | 'size', sortOrder: 'asc' | 'desc'): Promise<void> {
    await this.updateConfig({ sortBy, sortOrder });
  }
}

// Export a singleton instance
export const frontendConfig = new FrontendConfigManager();

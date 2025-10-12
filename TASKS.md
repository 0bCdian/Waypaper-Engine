# Waypaper Engine Refactor - LLM Actionable Plan

## 🎯 **Project Overview**
Refactor Waypaper Engine to adopt modern React patterns inspired by Upscayl's architecture, implementing a comprehensive theme system with multiple themes and improved component organization.

## 📋 **Phase 1: Theme System Foundation**

### Task 1.1: Create Theme Type Definitions ✅ COMPLETED
- [x] Create `src/themes/types.ts` with ThemeConfig interface
- [x] Define color palette structure
- [x] Add theme metadata types (name, description, etc.)
- [x] Export theme-related TypeScript types

### Task 1.2: Implement Theme Configurations ✅ COMPLETED
- [x] Create `src/themes/themes.ts` with theme definitions
- [x] Implement dark theme configuration
- [x] Implement light theme configuration
- [x] Implement gruvbox theme configuration
- [x] Implement nord theme configuration
- [x] Implement catppuccin theme configuration
- [x] Implement dracula theme configuration
- [x] Implement monokai theme configuration
- [x] Implement tokyo night theme configuration

### Task 1.3: Create Theme Context System ✅ COMPLETED
- [x] Create `src/contexts/ThemeContext.tsx`
- [x] Implement ThemeProvider component
- [x] Add theme state management
- [x] Implement theme switching logic
- [x] Add theme persistence to frontend config
- [x] Create useTheme hook

### Task 1.4: Update Tailwind Configuration ✅ COMPLETED
- [x] Modify `tailwind.config.js` to support multiple themes
- [x] Add custom color palette definitions
- [x] Configure DaisyUI with new themes
- [x] Add custom animations and transitions
- [x] Update content paths for new structure

### Task 1.5: Create CSS Custom Properties System ✅ COMPLETED
- [x] Create `src/styles/themes.css` with CSS variables
- [x] Define color palettes for each theme
- [x] Add transition utilities
- [x] Create theme-specific overrides
- [x] Update `src/index.css` to import theme styles

### Task 1.6: Implement Theme Selector Component ✅ COMPLETED
- [x] Create `src/components/ThemeSelector.tsx`
- [x] Add theme preview functionality
- [x] Implement theme switching UI
- [x] Add keyboard shortcuts for theme switching
- [x] Create theme preview cards

### Task 1.7: Integrate Theme System into App ✅ COMPLETED
- [x] Update `src/App.tsx` with ThemeProvider
- [x] Update `src/components/NavBar.tsx` with ThemeSelector
- [x] Add theme transition classes
- [x] Test theme switching functionality

## 📋 **Phase 2: Component Architecture Modernization**

### Task 2.1: Create UI Component Library ✅ COMPLETED
- [x] Create `src/components/ui/` directory structure
- [x] Implement `Button.tsx` component with variants
- [x] Implement `Modal.tsx` component
- [x] Implement `Card.tsx` component
- [x] Implement `Input.tsx` component
- [x] Implement `LoadingSpinner.tsx` component
- [x] Create `src/components/ui/index.ts` for exports
- [x] Add proper TypeScript interfaces for all components
- [x] Create utility function `cn.ts` for class name concatenation
- [x] Implement `ThemeToggle.tsx` component

### Task 2.2: Create Layout Components ✅ COMPLETED
- [x] Create `src/components/layout/` directory
- [x] Implement `AppLayout.tsx` main layout component
- [x] Implement `Sidebar.tsx` navigation component
- [x] Implement `Header.tsx` with theme selector
- [x] Implement `Footer.tsx` component
- [x] Refactor existing `Drawer.tsx` to use new layout
- [x] Create `src/components/layout/index.ts` for exports
- [x] Add proper TypeScript interfaces for all components

### Task 2.3: Organize Feature Components
- [ ] Create `src/components/features/gallery/` directory
- [ ] Move and refactor `Gallery.tsx` to new structure
- [ ] Move and refactor `ImageCard.tsx` to new structure
- [ ] Move and refactor `PaginatedGallery.tsx` to new structure
- [ ] Move and refactor `Filters.tsx` to new structure
- [ ] Create `src/components/features/playlist/` directory
- [ ] Move and refactor playlist components
- [ ] Create `src/components/features/settings/` directory
- [ ] Move and refactor settings components

### Task 2.4: Create Common Components
- [ ] Create `src/components/common/` directory
- [ ] Implement `ErrorBoundary.tsx` component
- [ ] Implement `Toast.tsx` component
- [ ] Refactor existing `ToastContainer.tsx`
- [ ] Create utility components for common patterns

## 📋 **Phase 3: Enhanced State Management**

### Task 3.1: Refactor Store Architecture ✅ COMPLETED
- [x] Create `src/stores/index.ts` for centralized exports
- [x] Refactor `src/stores/appConfig.tsx` with better organization
- [x] Refactor `src/stores/images.tsx` with improved patterns
- [x] Refactor `src/stores/playlist.tsx` with better structure
- [x] Create `src/stores/theme.ts` for theme management
- [x] Create `src/stores/settings.ts` for app settings

### Task 3.2: Implement Theme Store ✅ COMPLETED
- [x] Create theme state interface
- [x] Implement theme actions (setTheme, toggleTheme, etc.)
- [x] Add theme persistence with Zustand persist
- [x] Implement system theme detection
- [x] Add theme validation and fallbacks

### Task 3.3: Create Custom Hooks ✅ COMPLETED
- [x] Create `src/hooks/useTheme.ts` hook
- [x] Create `src/hooks/useElectronTheme.ts` hook
- [x] Refactor existing hooks with better patterns
- [x] Add `src/hooks/useLocalStorage.ts` hook
- [x] Add `src/hooks/useDebounce.ts` hook
- [x] Create `src/hooks/useMediaQuery.ts` hook

### Task 3.4: Create Store Utilities ✅ COMPLETED
- [x] Create `src/stores/types.ts` with common types
- [x] Create `src/stores/utils/createStore.ts` utility functions
- [x] Create `src/stores/hooks/useStoreSelector.ts` custom hooks
- [x] Add store validation and error handling
- [x] Add store performance monitoring
- [x] Add store debugging utilities

## 📋 **Phase 4: Enhanced Styling System**

### Task 4.1: Create CSS Custom Properties System ✅ COMPLETED
- [x] Create `src/styles/themes.css` with CSS variables
- [x] Define color palettes for each theme
- [x] Add transition utilities
- [x] Create theme-specific overrides
- [x] Update `src/index.css` to import theme styles

### Task 4.2: Implement Theme Selector Component ✅ COMPLETED
- [x] Create `src/components/ThemeSelector.tsx`
- [x] Add theme preview functionality
- [x] Implement theme switching UI
- [x] Add keyboard shortcuts for theme switching
- [x] Create theme preview cards

### Task 4.3: Update Existing Styles ✅ COMPLETED
- [x] Refactor `src/custom.css` to use CSS variables
- [x] Update component styles to use theme variables
- [x] Remove hardcoded colors from components
- [x] Add theme transition animations
- [x] Ensure responsive design across themes

## 📋 **Phase 5: Enhanced Electron Integration**

### Task 5.1: Improve Main Process Architecture ✅ COMPLETED
- [x] Create `electron/managers/ThemeManager.ts`
- [x] Create `electron/managers/WindowManager.ts`
- [x] Create `electron/managers/IPCManager.ts`
- [x] Refactor `electron/main.ts` with better organization
- [x] Implement native theme synchronization

### Task 5.2: Enhance Preload Script ✅ COMPLETED
- [x] Update `electron/preload.ts` with theme API
- [x] Add native theme detection methods
- [x] Implement theme change listeners
- [x] Add theme source setting functionality
- [x] Ensure proper context bridge setup

### Task 5.3: Update IPC Handlers ✅ COMPLETED
- [x] Add theme-related IPC handlers
- [x] Implement theme persistence in main process
- [x] Add theme validation in main process
- [x] Update existing handlers with better error handling
- [x] Add theme change notifications

## 📋 **Phase 6: App Structure Modernization**

### Task 6.1: Refactor App Component
- [ ] Update `src/App.tsx` with new architecture
- [ ] Add ThemeProvider wrapper
- [ ] Implement ErrorBoundary
- [ ] Add AppLayout wrapper
- [ ] Integrate theme synchronization

### Task 6.2: Create Route Structure
- [ ] Create `src/routes/AppRoutes.tsx`
- [ ] Refactor existing route components
- [ ] Add route-level theme support
- [ ] Implement route transitions
- [ ] Add route-specific layouts

### Task 6.3: Update Main Entry Point
- [ ] Update `src/main.tsx` with theme initialization
- [ ] Add theme loading on app start
- [ ] Implement theme fallback logic
- [ ] Add development theme tools

## 📋 **Phase 7: Testing & Polish**

### Task 7.1: Theme Testing
- [ ] Test all themes across different components
- [ ] Verify theme persistence across app restarts
- [ ] Test theme switching performance
- [ ] Validate theme accessibility
- [ ] Test cross-platform theme behavior

### Task 7.2: Component Testing
- [ ] Test new UI components
- [ ] Verify component theme integration
- [ ] Test responsive behavior across themes
- [ ] Validate component accessibility
- [ ] Test component performance

### Task 7.3: Integration Testing
- [ ] Test Electron theme synchronization
- [ ] Verify IPC theme communication
- [ ] Test theme persistence in main process
- [ ] Validate theme fallback mechanisms
- [ ] Test theme switching edge cases

### Task 7.4: Performance Optimization
- [ ] Optimize theme switching performance
- [ ] Implement theme preloading
- [ ] Add theme caching mechanisms
- [ ] Optimize CSS bundle size
- [ ] Implement lazy theme loading

## 📋 **Phase 8: Documentation & Cleanup**

### Task 8.1: Update Documentation
- [ ] Update README.md with new theme system
- [ ] Document theme development process
- [ ] Create theme customization guide
- [ ] Update component documentation
- [ ] Add architecture documentation

### Task 8.2: Code Cleanup
- [ ] Remove unused theme-related code
- [ ] Clean up old component files
- [ ] Remove deprecated styling
- [ ] Update import statements
- [ ] Fix TypeScript errors

### Task 8.3: Final Testing
- [ ] End-to-end testing of theme system
- [ ] Cross-platform compatibility testing
- [ ] Performance benchmarking
- [ ] Accessibility testing
- [ ] User experience validation

## 🎯 **Success Criteria**

- [ ] All 8+ themes working correctly
- [ ] Smooth theme transitions
- [ ] Theme persistence across app restarts
- [ ] Native OS theme synchronization
- [ ] Improved component organization
- [ ] Better state management
- [ ] Enhanced user experience
- [ ] Maintained existing functionality
- [ ] Cross-platform compatibility
- [ ] Performance improvements

## 📝 **Notes**

- Each task should be completed and tested before moving to the next
- Maintain backward compatibility during refactor
- Keep existing functionality intact
- Test on multiple platforms (Linux, Windows, macOS)
- Document any breaking changes
- Ensure accessibility compliance
- Optimize for performance

## 🚀 **Getting Started**

Start with Phase 1, Task 1.1: Create Theme Type Definitions. Each task builds upon the previous ones, so follow the order for best results.
---
name: tauri-development
description: Tauri development guidelines for building cross-platform desktop applications with TypeScript, Rust, and modern web technologies
---

# Tauri Development Guidelines

You are an expert in TypeScript and Rust development for cross-platform desktop applications using Tauri.

## Core Principles

- Write clean, maintainable TypeScript and Rust code
- Use TailwindCSS and ShadCN-UI for styling
- Follow step-by-step planning for complex features
- Prioritize code quality, security, and performance

## Technology Stack

- **Frontend**: TypeScript, React/Next.js, TailwindCSS, ShadCN-UI
- **Backend**: Rust, Tauri APIs
- **Build**: Tauri CLI, Vite/Webpack

## Project Structure

```
src/
├── app/                # Next.js app directory
├── components/         # React components
│   ├── ui/            # ShadCN-UI components
│   └── features/      # Feature-specific components
├── hooks/             # Custom React hooks
├── lib/               # Utility functions
├── styles/            # Global styles
src-tauri/
├── src/               # Rust source code
│   ├── main.rs       # Entry point
│   └── commands/     # Tauri commands
├── Cargo.toml        # Rust dependencies
└── tauri.conf.json   # Tauri configuration
```

## TypeScript Guidelines

### Code Style
- Use functional components with TypeScript
- Define proper interfaces for all data structures
- Use async/await for asynchronous operations
- Implement proper error handling

### Tauri Integration
```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Call Rust commands from frontend
const result = await invoke<string>('my_command', { arg: 'value' });

// Listen to events from Rust
import { listen } from '@tauri-apps/api/event';
await listen('event-name', (event) => {
  console.log(event.payload);
});
```

## Rust Guidelines

### Command Definitions
```rust
#[tauri::command]
fn my_command(arg: String) -> Result<String, String> {
    // Implementation
    Ok(format!("Received: {}", arg))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![my_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Error Handling
- Use Result types for fallible operations
- Define custom error types when needed
- Propagate errors appropriately
- Log errors for debugging

### Security
- Validate all inputs from the frontend
- Use Tauri's security features (CSP, allowlist)
- Minimize permissions in tauri.conf.json
- Sanitize file paths and user inputs

## UI Development

### TailwindCSS
- Use utility-first approach
- Implement responsive design
- Use dark mode support
- Follow consistent spacing and sizing

### ShadCN-UI Components
- Use pre-built accessible components
- Customize with TailwindCSS
- Maintain consistent theming
- Follow accessibility best practices

## State Management

- Use React Context for global state
- Consider Zustand for complex state
- Keep state close to where it's used
- Implement proper state synchronization with Rust

## File System Operations

```rust
use std::fs;
use tauri::api::path::app_data_dir;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| e.to_string())
}
```

## Building and Distribution

- Configure proper app metadata
- Set up code signing for distribution
- Use Tauri's updater for auto-updates
- Test on all target platforms

## Performance

- Minimize IPC calls between frontend and Rust
- Use batch operations where possible
- Implement proper caching
- Profile and optimize hot paths

## Testing

- Write unit tests for Rust commands
- Test frontend components
- Implement integration tests
- Test on all target platforms

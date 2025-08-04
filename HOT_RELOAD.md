# Hot Reload Setup for Noctool

## Overview

This project now supports hot reload functionality that **only reloads the webview**, preventing full Electron app restarts for a better development experience.

## How It Works

### 1. **React Renderer (Frontend)**
- ✅ **Already has hot reload** - React's development server automatically reloads when you change frontend code
- ✅ **Instant updates** - Changes to React components are reflected immediately
- ✅ **No restart needed** - Just save the file and see changes instantly

### 2. **Electron Main Process (Backend)**
- ✅ **Webview-only reload** - Only reloads the webview, not the entire Electron app
- ✅ **File watching** - Uses `chokidar` to watch `src/main/**/*.js` and `src/main/**/*.json` files
- ✅ **Preserved state** - Electron app state, DevTools, and console are preserved
- ✅ **Faster development** - No waiting for full app restarts

## Available Scripts

### `npm run dev` (Recommended)
```bash
npm run dev
```
- Starts both React renderer and Electron main process with hot reload
- React: Hot reloads on frontend changes
- Electron: Reloads only webview on main process changes

### `npm run dev:hot` (Alternative)
```bash
npm run dev:hot
```
- Uses electron-reloader for more advanced hot reload
- Better for development but may have some limitations

### Individual Commands
```bash
# Start only React renderer with hot reload
npm run dev:renderer

# Start only Electron main process with nodemon
npm run dev:electron
```

## What Gets Watched

### Main Process Files (Webview reload only)
- `src/main/**/*.js` - All JavaScript files in main process
- `src/main/**/*.json` - Configuration files

### Package Changes (Full restart)
- `package.json` - Project configuration (triggers full restart)

### Renderer Files (Hot reload)
- `src/renderer/src/**/*.js` - React components
- `src/renderer/src/**/*.jsx` - React components
- `src/renderer/src/**/*.css` - Stylesheets

### Ignored Files
- `src/renderer/**/*` - Renderer files (handled by React)
- `node_modules/**/*` - Dependencies
- `dist/**/*` - Build output
- `*.log` - Log files

## Configuration Files

### `nodemon.json` (Minimal Restart)
```json
{
  "watch": [
    "package.json"
  ],
  "ignore": [
    "src/**/*",
    "node_modules/**/*",
    "dist/**/*",
    "*.log"
  ],
  "ext": "json",
  "env": {
    "NODE_ENV": "development"
  },
  "exec": "electron .",
  "delay": "2000",
  "restartable": "rs",
  "verbose": true,
  "colours": true,
  "legacyWatch": true
}
```

### `src/main/main.js`
```javascript
// Manual reload for development (prevents full app restart)
if (isDev) {
  // Watch for file changes and reload only the webview
  const chokidar = require('chokidar');
  const watcher = chokidar.watch([
    'src/main/**/*.js',
    'src/main/**/*.json'
  ], {
    ignored: [
      'src/renderer/**/*',
      'node_modules/**/*',
      'dist/**/*',
      '*.log'
    ],
    persistent: true
  });

  watcher.on('change', (path) => {
    console.log(`🔄 File changed: ${path}`);
    console.log('🔄 Reloading webview only...');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });

  console.log('✅ Hot reload configured - only webview will reload');
}
```

## Manual Reload

You can manually reload the webview from the renderer process:

```javascript
// In any React component
if (window.electronAPI.reloadWebview) {
  window.electronAPI.reloadWebview();
}
```

## Development Workflow

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Make changes to files:**
   - **Frontend changes** (React components): Automatically reload
   - **Backend changes** (Main process): Automatically reload webview only
   - **Package changes** (package.json): Full app restart

3. **See changes immediately:**
   - No manual restart required for most changes
   - Application state is preserved
   - DevTools and console state maintained

## Troubleshooting

### If hot reload isn't working:

1. **Check if processes are running:**
   ```bash
   # Look for node and electron processes
   Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*electron*"}
   ```

2. **Restart the development server:**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart
   npm run dev
   ```

3. **Check file permissions:**
   - Ensure you have write permissions to the project directory

4. **Clear cache:**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

### Manual reload commands:
```javascript
// In browser console or React component
window.electronAPI.reloadWebview();
```

## Benefits

- ✅ **Faster development** - No full app restarts for code changes
- ✅ **Better debugging** - DevTools and console state preserved
- ✅ **Preserved state** - Application state maintained
- ✅ **Reduced resource usage** - Less CPU and memory overhead
- ✅ **Immediate feedback** - Changes reflected instantly

## When Full Restart is Needed

The app will only fully restart when:
- `package.json` changes (new dependencies)
- Critical system-level changes
- Manual restart via `Ctrl+C` and `npm run dev`

## Performance Notes

- **No full app restarts**: Only webview reloads, preserving app state
- **Faster development**: No need to wait for Electron to restart
- **Better debugging**: DevTools and console state preserved
- **Reduced resource usage**: Less CPU and memory overhead 
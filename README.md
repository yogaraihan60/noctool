# Noctool - Network Utility Tool

A comprehensive network utility tool built with Electron and React, featuring real-time network diagnostics and monitoring capabilities.

## Features

### 🔄 **Persistent Display System**
- **Background Process Continuity**: All network operations (ping, traceroute, port scanning) continue running when switching between tabs
- **Real-time Updates**: Live progress updates and results are maintained across tab navigation
- **Process Management**: Centralized process tracking with active and completed operation monitoring
- **State Persistence**: Each tab maintains its own persistent state for seamless user experience

### 🌐 Network Tools
- **Ping Tool**: ICMP and HTTP ping with real-time statistics
- **Traceroute**: Advanced traceroute with hop-by-hop analysis
- **Port Scanner**: TCP port scanning with service detection
- **Network Information**: Interface details and network statistics
- **DNS Lookup**: Domain resolution and WHOIS information

### ⚡ Real-time Features
- Live progress updates for all operations
- Real-time statistics and charts
- Continuous monitoring capabilities
- Background process management

## Persistent Display Architecture

### Process Management
The application implements a sophisticated process management system that ensures:

1. **Process Continuity**: Operations continue running when switching tabs
2. **State Persistence**: Each tab maintains its own persistent state
3. **Real-time Updates**: Live updates are delivered to the correct tab
4. **Resource Management**: Automatic cleanup of completed processes

### Key Components

#### Main Process (`src/main/main.js`)
- **Process Tracking**: Maintains active processes across the application
- **State Management**: Manages persistent state for each tab/operation
- **IPC Handlers**: Provides communication between main and renderer processes

#### Persistent State Manager (`src/main/services/PersistentStateManager.js`)
- **State Storage**: Maintains state for each tab and operation type
- **Process Tracking**: Tracks active and completed processes
- **Event System**: Notifies subscribers of state changes

#### React Hooks
- **useProcessManager**: Manages global process state and navigation
- **usePersistentState**: Provides persistent state for individual components

### Usage Example

```javascript
// In a component that needs persistent state
import usePersistentState from '../hooks/usePersistentState';

const MyComponent = () => {
  const { state, addProcess, updateProcess, setData } = usePersistentState('tab-id', 'operation-type');
  
  // State persists across tab switches
  // Processes continue running in background
  // Real-time updates are maintained
};
```

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd noctool

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Development

### Project Structure
```
src/
├── main/                 # Electron main process
│   ├── services/        # Network services
│   ├── main.js         # Main process entry point
│   └── preload.js      # Preload script
└── renderer/           # React renderer process
    ├── src/
    │   ├── components/ # React components
    │   ├── hooks/      # Custom React hooks
    │   └── pages/      # Page components
    └── public/
```

### Key Services
- **TracerouteService**: Handles traceroute operations
- **PingService**: Manages ping operations (ICMP/HTTP)
- **PortScannerService**: Handles port scanning
- **NetworkService**: Provides network information
- **PersistentStateManager**: Manages persistent state

### Hot Reload
The application supports hot reload during development:
- Main process changes trigger automatic reload
- Renderer process changes are reflected immediately
- State is preserved during reloads

## Usage

### Starting Operations
1. Navigate to the desired tool tab
2. Configure operation parameters
3. Start the operation
4. Switch to other tabs while operation continues
5. Return to see real-time updates and results

### Process Management
- **Active Processes**: Shown in sidebar with real-time status
- **Completed Processes**: Maintained for review and analysis
- **Cleanup**: Manual cleanup of completed processes
- **Stop All**: Emergency stop for all active operations

### Tab Navigation
- **Seamless Switching**: No interruption to running operations
- **State Preservation**: Each tab maintains its configuration and results
- **Real-time Updates**: Live updates continue across tab switches

## Configuration

### Network Settings
- **Timeout Values**: Configurable for each operation type
- **Concurrency**: Adjustable for port scanning operations
- **Protocols**: Support for various network protocols

### Display Settings
- **Update Frequency**: Configurable refresh rates
- **Data Retention**: Automatic cleanup policies
- **UI Preferences**: Customizable interface options

## Troubleshooting

### Common Issues
1. **Process Not Starting**: Check network permissions and firewall settings
2. **Updates Not Showing**: Verify IPC communication is working
3. **State Not Persisting**: Check PersistentStateManager initialization

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` and checking the console for detailed logs.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
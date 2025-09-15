# Fleet Tracker Dashboard

A modern, real-time fleet management dashboard built with React, TypeScript, and Tailwind CSS. Monitor your vehicle fleet with live tracking, historical playback, and comprehensive vehicle management.

## 🚛 Features

### Real-Time Monitoring
- **Live Dashboard**: Overview of fleet statistics with online, idle, and offline vehicle counts
- **Real-Time Updates**: Server-Sent Events (SSE) for instant data updates
- **Connection Status**: Visual indicators for API connectivity and data freshness

### Vehicle Tracking
- **Live Map View**: Interactive map showing current vehicle positions
- **Vehicle Status**: Color-coded status indicators (Online/Idle/Offline)
- **Vehicle Details**: Comprehensive information including last seen times, coordinates, and device data

### Historical Analysis
- **Track Playback**: Replay vehicle routes for any time period
- **Flexible Search**: Query by Vehicle ID or Device ID
- **Time Range Selection**: Custom date/time filtering for historical data

### Fleet Management
- **Vehicle Registry**: Complete list of all fleet vehicles
- **Device Management**: Link devices to vehicles and monitor their status
- **Real-Time Statistics**: Fleet health monitoring with ping times and connection status

## 🛠 Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI with shadcn/ui
- **State Management**: SWR for data fetching and caching
- **Routing**: React Router v6
- **Maps**: Leaflet with React Leaflet
- **Real-Time**: Server-Sent Events (SSE)
- **Build Tool**: Vite

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Fleet tracking backend API server

### Installation

1. **Clone the repository**
   ```sh
   git clone <your-repository-url>
   cd fleet-tracker-dashboard
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Configure API settings**
   
   The app connects to your fleet tracking API. Configure the API base URL and key:
   
   - **API Base URL**: Set in `src/api/client.ts` (default: `http://31.97.156.77:8080`)
   - **API Key**: Required for device registration and management features
   
   You can also store these in localStorage for runtime configuration:
   ```javascript
   localStorage.setItem('apiBase', 'https://your-api-server.com');
   localStorage.setItem('apiKey', 'your-api-key');
   ```

4. **Start the development server**
   ```sh
   npm run dev
   ```

5. **Open the application**
   
   Navigate to `http://localhost:5173` in your browser.

## 📱 Application Views

### Dashboard (`/`)
- Fleet statistics overview
- Real-time connection status
- Quick access to vehicles and their current status
- Health monitoring with API ping times

### Live Map (`/map`)
- Interactive map showing all vehicle positions
- Real-time position updates
- Vehicle status indicators
- Click vehicles for detailed information

### Vehicles (`/vehicles`)
- Complete vehicle registry
- Detailed vehicle information panels
- Device linking and management
- Quick navigation to map and playback views

### Playback (`/playback`)
- Historical route replay
- Flexible time range selection
- Search by Vehicle ID or Device ID
- Track visualization on interactive map

## 🔧 Configuration

### API Endpoints
The application expects the following API endpoints:

- `GET /api/health` - System health check
- `GET /api/vehicles` - List all vehicles
- `GET /api/devices/{id}` - Get device information
- `GET /api/telemetry/latest` - Get latest telemetry data
- `GET /api/vehicles/{id}/track` - Get vehicle track data
- `GET /api/devices/{id}/track` - Get device track data
- `POST /api/devices` - Register new device (requires API key)

### Real-Time Updates
The dashboard connects to SSE endpoint at `/api/telemetry/latest/stream` for real-time updates. The connection includes:

- Automatic reconnection with exponential backoff
- Connection status monitoring
- Graceful fallback to polling when SSE is unavailable

### Vehicle Status Logic
Vehicles are classified based on their last seen timestamp:
- **Online**: Last seen within 5 minutes
- **Idle**: Last seen between 5-30 minutes ago  
- **Offline**: Last seen more than 30 minutes ago

## 🎨 Design System

The application uses a custom design system with semantic color tokens:

- **Status Colors**: `--online`, `--idle`, `--offline` for vehicle states
- **Theme Support**: Light and dark mode compatibility
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Accessibility**: ARIA labels and keyboard navigation support

## 🚀 Deployment

### Build for Production
```sh
npm run build
```

### Deploy with Lovable
1. Open your project in [Lovable](https://lovable.dev)
2. Click the "Publish" button in the top right
3. Your app will be deployed to a Lovable subdomain

### Custom Domain
To use a custom domain:
1. Navigate to Project > Settings > Domains in Lovable
2. Click "Connect Domain" and follow the setup instructions
3. Note: A paid Lovable plan is required for custom domains

## 📊 Data Flow

1. **Initial Load**: App fetches vehicle list and health status
2. **Real-Time Updates**: SSE connection provides live telemetry updates
3. **Fallback Polling**: If SSE fails, app falls back to periodic API polling
4. **State Management**: SWR handles caching, revalidation, and error states
5. **UI Updates**: React components automatically re-render with new data

## 🛠 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

### Project Structure
```
src/
├── api/           # API client and SSE handling
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks
├── pages/         # Route components
├── types/         # TypeScript type definitions
├── views/         # Main application views
└── lib/           # Utility functions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the [Lovable Documentation](https://docs.lovable.dev/)
- Join the [Lovable Discord Community](https://discord.com/channels/1119885301872070706/1280461670979993613)
- Review the API documentation for your fleet tracking backend

---

Built with ❤️ using [Lovable](https://lovable.dev)
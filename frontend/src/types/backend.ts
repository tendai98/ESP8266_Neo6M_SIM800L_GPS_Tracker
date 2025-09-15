// Fleet Tracker Backend Types

export type LatestItem = {
  vId: string;    // Vehicle ID
  lt: number;     // Latitude
  ln: number;     // Longitude
  s: number;      // Speed (km/h)
  h: number;      // Heading (degrees)
  ts: number;     // Timestamp (milliseconds)
  ip: string;     // IP address
};

export type LatestSnapshot = Record<string, LatestItem>; // Map<Device ID, LatestItem>

export type VehicleItem = {
  id: string;           // Device ID
  vehicleId: string;    // Vehicle ID
  lastSeenTs: number;   // Last seen timestamp
  ip?: string;          // IP address
};

export type TrackPoint = {
  vId: string;    // Vehicle ID
  lt: number;     // Latitude
  ln: number;     // Longitude
  s: number;      // Speed (km/h)
  h: number;      // Heading (degrees)
  ts: number;     // Timestamp (milliseconds)
};

export type HealthResponse = {
  ok: boolean;
  rtMs: number;    // Response time in milliseconds
  now: number;     // Current timestamp
};

export type VehiclesResponse = {
  items: VehicleItem[];
};

export type DeviceResponse = {
  device: {
    vehicleId: string;
    lastSeenTs: number;
    ip: string;
  };
  latest?: LatestItem;
};

export type LatestResponse = {
  latest?: LatestItem;
};

export type TrackResponse = {
  points: TrackPoint[];
};

// Fleet status enums
export enum VehicleStatus {
  ONLINE = 'online',   // < 2 minutes
  IDLE = 'idle',       // < 10 minutes
  OFFLINE = 'offline'  // >= 10 minutes
}

// Helper function to determine vehicle status
export function getVehicleStatus(lastSeenTs: number): VehicleStatus {
  const now = Date.now();
  const diff = now - lastSeenTs;
  
  if (diff < 120000) return VehicleStatus.ONLINE; // < 2 minutes
  if (diff < 600000) return VehicleStatus.IDLE;   // < 10 minutes
  return VehicleStatus.OFFLINE;                   // >= 10 minutes
}

// Helper to format relative time
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Helper to validate coordinates
export function isValidCoordinate(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);
}
// Fleet Tracker API Client

import type { 
  HealthResponse, 
  VehiclesResponse, 
  DeviceResponse, 
  LatestResponse, 
  TrackResponse 
} from '@/types/backend';

const getApiBase = () => {
  return localStorage.getItem('apiBase') || import.meta.env.VITE_API_BASE || 'http://31.97.156.77:8080';
};

const getApiKey = () => {
  return localStorage.getItem('apiKey') || import.meta.env.VITE_API_KEY || '';
};

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBase();
    const url = `${baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Health check
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  }

  // Get all vehicles
  async getVehicles(): Promise<VehiclesResponse> {
    return this.request<VehiclesResponse>('/api/vehicles');
  }

  // Get device by ID
  async getDevice(id: string): Promise<DeviceResponse> {
    return this.request<DeviceResponse>(`/api/devices/${encodeURIComponent(id)}`);
  }

  // Get latest telemetry by device ID
  async getLatestByDevice(deviceId: string): Promise<LatestResponse> {
    return this.request<LatestResponse>(`/api/telemetry/latest?deviceId=${encodeURIComponent(deviceId)}`);
  }

  // Get latest telemetry by vehicle ID
  async getLatestByVehicle(vehicleId: string): Promise<LatestResponse> {
    return this.request<LatestResponse>(`/api/telemetry/latest?vehicleId=${encodeURIComponent(vehicleId)}`);
  }

  // Get track by vehicle ID
  async getTrackByVehicle(vehicleId: string, from: number, to: number): Promise<TrackResponse> {
    return this.request<TrackResponse>(
      `/api/vehicles/${encodeURIComponent(vehicleId)}/track?from=${from}&to=${to}`
    );
  }

  // Get track by device ID
  async getTrackByDevice(deviceId: string, from: number, to: number): Promise<TrackResponse> {
    return this.request<TrackResponse>(
      `/api/devices/${encodeURIComponent(deviceId)}/track?from=${from}&to=${to}`
    );
  }

  // Admin: Register/map a device (requires API key)
  async postDevice(id: string, vehicleId: string): Promise<{ ok: boolean }> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('API key required for device registration');
    }

    return this.request<{ ok: boolean }>('/api/devices', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ id, vehicleId }),
    });
  }
}

export const apiClient = new ApiClient();
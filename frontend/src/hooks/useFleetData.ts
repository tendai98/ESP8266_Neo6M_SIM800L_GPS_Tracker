// Fleet data management with SWR and SSE integration

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/api/client';
import { createLatestSSE, type SSEStatus } from '@/api/sse';
import type { LatestSnapshot, VehicleItem, LatestItem } from '@/types/backend';
import { toast } from '@/hooks/use-toast';

// Fleet data hook with SSE integration
export function useFleetData() {
  const [latestSnapshot, setLatestSnapshot] = useState<LatestSnapshot>({});
  const [sseStatus, setSSEStatus] = useState<SSEStatus>('disconnected');
  const [sseClient, setSSEClient] = useState<ReturnType<typeof createLatestSSE> | null>(null);

  // Fetch vehicles list
  const { 
    data: vehiclesData, 
    error: vehiclesError, 
    mutate: refreshVehicles,
    isLoading: vehiclesLoading
  } = useSWR('/api/vehicles', () => apiClient.getVehicles());

  // Fetch health status
  const { 
    data: healthData, 
    error: healthError,
    isLoading: healthLoading
  } = useSWR('/api/health', () => apiClient.getHealth(), {
    refreshInterval: 30000, // Refresh every 30s
    onError: (error) => {
      toast({
        title: "Connection Error",
        description: "Failed to connect to fleet backend",
        variant: "destructive",
      });
    }
  });

  // Initialize SSE connection
  useEffect(() => {
    const client = createLatestSSE(
      (snapshot: LatestSnapshot) => {
        setLatestSnapshot(snapshot);
      },
      (status: SSEStatus) => {
        setSSEStatus(status);
        
        if (status === 'connected') {
          toast({
            title: "Real-time Connected",
            description: "Receiving live fleet updates",
          });
        } else if (status === 'error') {
          toast({
            title: "Connection Lost",
            description: "Falling back to polling updates",
            variant: "destructive",
          });
        }
      },
      (error) => {
        console.error('SSE error:', error);
      }
    );

    setSSEClient(client);
    client.connect();

    return () => {
      client.destroy();
    };
  }, []);

  // Fallback polling when SSE is disconnected
  useEffect(() => {
    if (sseStatus === 'connected') return;

    const pollInterval = setInterval(async () => {
      try {
        await refreshVehicles();
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 10000); // Poll every 10s when SSE is down

    return () => clearInterval(pollInterval);
  }, [sseStatus, refreshVehicles]);

  // Get latest data for a specific device
  const getLatestForDevice = useCallback((deviceId: string): LatestItem | null => {
    return latestSnapshot[deviceId] || null;
  }, [latestSnapshot]);

  // Get enriched vehicle data (vehicles + latest positions)
  const enrichedVehicles = (vehiclesData?.items || []).map(vehicle => {
    const latest = getLatestForDevice(vehicle.id);
    return {
      ...vehicle,
      latest,
      status: latest ? 'online' : 'offline' // Simplified for now
    };
  });

  // Fleet statistics
  const stats = {
    total: vehiclesData?.items.length || 0,
    online: enrichedVehicles.filter(v => v.latest && (Date.now() - v.latest.ts < 120000)).length,
    idle: enrichedVehicles.filter(v => v.latest && (Date.now() - v.latest.ts >= 120000 && Date.now() - v.latest.ts < 600000)).length,
    offline: enrichedVehicles.filter(v => !v.latest || (Date.now() - v.latest.ts >= 600000)).length,
  };

  return {
    // Data
    vehicles: enrichedVehicles,
    latestSnapshot,
    health: healthData,
    stats,
    
    // Status
    sseStatus,
    vehiclesLoading,
    healthLoading,
    vehiclesError,
    healthError,
    
    // Actions
    refreshVehicles,
    getLatestForDevice,
    
    // SSE control
    reconnectSSE: () => sseClient?.connect(),
    disconnectSSE: () => sseClient?.disconnect(),
  };
}

// Individual device hook
export function useDeviceData(deviceId: string) {
  return useSWR(
    deviceId ? `/api/devices/${deviceId}` : null,
    () => apiClient.getDevice(deviceId),
    {
      onError: (error) => {
        toast({
          title: "Device Error",
          description: `Failed to load device ${deviceId}`,
          variant: "destructive",
        });
      }
    }
  );
}

// Track data hook for playback
export function useTrackData(type: 'vehicle' | 'device', id: string, from: number, to: number) {
  return useSWR(
    id && from && to ? `/api/${type}/${id}/track?from=${from}&to=${to}` : null,
    () => type === 'vehicle' 
      ? apiClient.getTrackByVehicle(id, from, to)
      : apiClient.getTrackByDevice(id, from, to),
    {
      onError: (error) => {
        toast({
          title: "Track Error",
          description: `Failed to load track data for ${id}`,
          variant: "destructive",
        });
      }
    }
  );
}
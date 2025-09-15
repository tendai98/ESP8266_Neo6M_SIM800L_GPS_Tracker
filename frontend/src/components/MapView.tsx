// Leaflet map component for fleet tracking

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidCoordinate } from '@/types/backend';
import type { LatestItem, TrackPoint } from '@/types/backend';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapHandle {
  fitToMarkers: () => void;
  fitToTrack: (points: TrackPoint[]) => void;
  panToLocation: (lat: number, lng: number, zoom?: number) => void;
}

interface MapViewProps {
  vehicles?: Array<{
    id: string;
    vehicleId: string;
    latest?: LatestItem;
    lastSeenTs: number;
  }>;
  track?: TrackPoint[];
  onMarkerClick?: (vehicleId: string, deviceId: string) => void;
  className?: string;
  showUnknownPoints?: boolean;
}

export const MapView = forwardRef<MapHandle, MapViewProps>(({
  vehicles = [],
  track,
  onMarkerClick,
  className = '',
  showUnknownPoints = false
}, ref) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const trackLayerRef = useRef<L.LayerGroup>(new L.LayerGroup());

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const tileUrl = localStorage.getItem('tileUrl') || 
                   import.meta.env.VITE_TILE_URL || 
                   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const map = L.map(mapContainerRef.current, {
      center: [-17.8216, 31.0492], // Default to Harare, Zimbabwe
      zoom: 10,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer(tileUrl, {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Add layer groups
    markersRef.current.addTo(map);
    trackLayerRef.current.addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Create vehicle status markers
  const createVehicleMarker = (vehicle: any): L.Marker | null => {
    if (!vehicle.latest || !isValidCoordinate(vehicle.latest.lt, vehicle.latest.ln)) {
      if (!showUnknownPoints) return null;
    }

    const lat = vehicle.latest?.lt || 0;
    const lng = vehicle.latest?.ln || 0;
    
    // Determine status color
    const timeDiff = Date.now() - (vehicle.latest?.ts || vehicle.lastSeenTs);
    let color: string;
    if (timeDiff < 120000) color = '#059669'; // Online (green)
    else if (timeDiff < 600000) color = '#d97706'; // Idle (amber)
    else color = '#dc2626'; // Offline (red)

    // Create custom icon with rotation
    const heading = vehicle.latest?.h || 0;
    const iconHtml = `
      <div style="transform: rotate(${heading}deg); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 16px; height: 16px; background-color: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'custom-vehicle-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([lat, lng], { icon: customIcon });
    
    // Tooltip
    const speed = vehicle.latest?.s?.toFixed(1) || '0.0';
    const timestamp = new Date(vehicle.latest?.ts || vehicle.lastSeenTs).toLocaleString();
    marker.bindTooltip(`
      <strong>${vehicle.vehicleId}</strong><br/>
      Speed: ${speed} km/h<br/>
      Last seen: ${timestamp}
    `, {
      direction: 'top',
      offset: [0, -20]
    });

    // Click handler
    if (onMarkerClick) {
      marker.on('click', () => {
        onMarkerClick(vehicle.vehicleId, vehicle.id);
      });
    }

    return marker;
  };

  // Update vehicle markers
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.clearLayers();

    vehicles.forEach(vehicle => {
      const marker = createVehicleMarker(vehicle);
      if (marker) {
        markersRef.current.addLayer(marker);
      }
    });
  }, [vehicles, showUnknownPoints, onMarkerClick]);

  // Update track
  useEffect(() => {
    if (!mapRef.current) return;

    trackLayerRef.current.clearLayers();

    if (track && track.length > 0) {
      const validPoints = track.filter(point => 
        isValidCoordinate(point.lt, point.ln)
      );

      if (validPoints.length > 1) {
        // Create polyline
        const coords = validPoints.map(point => [point.lt, point.ln] as L.LatLngTuple);
        const polyline = L.polyline(coords, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8
        });

        trackLayerRef.current.addLayer(polyline);

        // Add start marker (green)
        if (validPoints.length > 0) {
          const startPoint = validPoints[0];
          const startMarker = L.marker([startPoint.lt, startPoint.ln], {
            icon: L.divIcon({
              html: '<div style="background-color: #059669; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
              className: 'custom-track-marker',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })
          });
          startMarker.bindTooltip('Start', { direction: 'top' });
          trackLayerRef.current.addLayer(startMarker);
        }

        // Add end marker (red)
        if (validPoints.length > 1) {
          const endPoint = validPoints[validPoints.length - 1];
          const endMarker = L.marker([endPoint.lt, endPoint.ln], {
            icon: L.divIcon({
              html: '<div style="background-color: #dc2626; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
              className: 'custom-track-marker',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })
          });
          endMarker.bindTooltip('End', { direction: 'top' });
          trackLayerRef.current.addLayer(endMarker);
        }
      }
    }
  }, [track]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    fitToMarkers: () => {
      if (!mapRef.current || markersRef.current.getLayers().length === 0) return;
      
      const group = L.featureGroup(markersRef.current.getLayers());
      mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
    },
    
    fitToTrack: (points: TrackPoint[]) => {
      if (!mapRef.current || !points || points.length === 0) return;
      
      const validPoints = points.filter(p => isValidCoordinate(p.lt, p.ln));
      if (validPoints.length === 0) return;
      
      const bounds = L.latLngBounds(validPoints.map(p => [p.lt, p.ln]));
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    },
    
    panToLocation: (lat: number, lng: number, zoom = 15) => {
      if (!mapRef.current || !isValidCoordinate(lat, lng)) return;
      
      mapRef.current.setView([lat, lng], zoom);
    }
  }));

  return (
    <div 
      ref={mapContainerRef} 
      className={`w-full h-full min-h-[400px] rounded-lg ${className}`}
      style={{ zIndex: 1 }}
    />
  );
});

MapView.displayName = 'MapView';
// Playback - Historical track visualization

import { useState, useRef, useEffect } from 'react';
import { MapView } from '@/components/MapView';
import { useTrackData, useFleetData } from '@/hooks/useFleetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Play, Download, MapPin, Clock, Gauge, TrendingUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { TrackPoint } from '@/types/backend';

// Helper function to calculate distance using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate track statistics
function calculateTrackStats(points: TrackPoint[]) {
  if (points.length === 0) {
    return { totalDistance: 0, avgSpeed: 0, maxSpeed: 0, duration: 0 };
  }

  let totalDistance = 0;
  let totalSpeed = 0;
  let maxSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    
    totalDistance += calculateDistance(prev.lt, prev.ln, curr.lt, curr.ln);
    totalSpeed += curr.s;
    maxSpeed = Math.max(maxSpeed, curr.s);
  }

  const avgSpeed = totalSpeed / points.length;
  const duration = points.length > 1 ? points[points.length - 1].ts - points[0].ts : 0;

  return {
    totalDistance: totalDistance,
    avgSpeed,
    maxSpeed,
    duration
  };
}

export function Playback() {
  const location = useLocation();
  const mapRef = useRef<any>(null);
  const { vehicles } = useFleetData();
  
  // Form state
  const [trackType, setTrackType] = useState<'vehicle' | 'device'>('vehicle');
  const [trackId, setTrackId] = useState(location.state?.selectedVehicleId || '');
  const [timeRange, setTimeRange] = useState('2h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Calculate time range
  const getTimeRange = () => {
    if (timeRange === 'custom' && customFrom && customTo) {
      return {
        from: new Date(customFrom).getTime(),
        to: new Date(customTo).getTime()
      };
    }
    
    const now = Date.now();
    const ranges: Record<string, number> = {
      '30m': 30 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    
    return {
      from: now - (ranges[timeRange] || ranges['2h']),
      to: now
    };
  };

  const { from, to } = getTimeRange();

  // Fetch track data
  const { data: trackData, error, isLoading } = useTrackData(
    trackType,
    trackId,
    from,
    to
  );

  const points = trackData?.points || [];
  const stats = calculateTrackStats(points);

  // Fit map to track when data loads
  useEffect(() => {
    if (points.length > 0 && mapRef.current) {
      setTimeout(() => {
        mapRef.current.fitToTrack(points);
      }, 100);
    }
  }, [points]);

  // Export track as GeoJSON
  const exportTrack = () => {
    if (points.length === 0) return;

    const geojson = {
      type: 'Feature',
      properties: {
        vehicleId: trackId,
        trackType,
        timeRange: `${new Date(from).toISOString()} to ${new Date(to).toISOString()}`,
        stats
      },
      geometry: {
        type: 'LineString',
        coordinates: points.map(p => [p.ln, p.lt, p.s]) // [lng, lat, speed]
      }
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `track-${trackId}-${timeRange}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Controls sidebar */}
      <div className="w-80 border-r bg-card p-4 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Track Playback</h2>
          
          {/* Track type selection */}
          <div className="space-y-2">
            <Label>Track by</Label>
            <Select value={trackType} onValueChange={(value) => setTrackType(value as 'vehicle' | 'device')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Vehicle ID</SelectItem>
                <SelectItem value="device">Device ID</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ID selection */}
          <div className="space-y-2">
            <Label>{trackType === 'vehicle' ? 'Vehicle ID' : 'Device ID'}</Label>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${trackType}...`} />
              </SelectTrigger>
              <SelectContent>
                {trackType === 'vehicle' 
                  ? vehicles.map(vehicle => (
                      <SelectItem key={vehicle.vehicleId} value={vehicle.vehicleId}>
                        {vehicle.vehicleId}
                      </SelectItem>
                    ))
                  : vehicles.map(vehicle => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.id} ({vehicle.vehicleId})
                      </SelectItem>
                    ))
                }
              </SelectContent>
            </Select>
          </div>

          {/* Time range */}
          <div className="space-y-2">
            <Label>Time Range</Label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30m">Last 30 minutes</SelectItem>
                <SelectItem value="2h">Last 2 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom time range */}
          {timeRange === 'custom' && (
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Label>To</Label>
              <Input
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}

          {/* Load button */}
          <Button 
            onClick={() => window.location.reload()} // Simple reload for now
            disabled={!trackId || isLoading}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {isLoading ? 'Loading...' : 'Load Track'}
          </Button>
        </div>

        <Separator />

        {/* Track statistics */}
        {points.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Track Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Points
                </div>
                <p className="text-lg font-semibold">{points.length}</p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Duration
                </div>
                <p className="text-lg font-semibold">
                  {Math.round(stats.duration / (1000 * 60))}m
                </p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Distance
                </div>
                <p className="text-lg font-semibold">
                  {stats.totalDistance.toFixed(1)} km
                </p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Gauge className="h-3 w-3" />
                  Avg Speed
                </div>
                <p className="text-lg font-semibold">
                  {stats.avgSpeed.toFixed(1)} km/h
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Badge variant="outline">
                Max Speed: {stats.maxSpeed.toFixed(1)} km/h
              </Badge>
            </div>

            {/* Export button */}
            <Button 
              variant="outline" 
              onClick={exportTrack}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Export GeoJSON
            </Button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-destructive text-sm">Failed to load track data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Map area */}
      <div className="flex-1">
        <MapView
          ref={mapRef}
          track={points}
          className="h-full"
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p>Loading track data...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
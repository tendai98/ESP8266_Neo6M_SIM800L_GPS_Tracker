// Vehicle list with search and status filtering

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { Search, MapPin, RotateCcw, Eye } from 'lucide-react';
import { formatRelativeTime } from '@/types/backend';
import type { VehicleItem, LatestItem } from '@/types/backend';

interface EnrichedVehicle extends VehicleItem {
  latest?: LatestItem;
}

interface VehicleListProps {
  vehicles: EnrichedVehicle[];
  onViewOnMap?: (vehicle: EnrichedVehicle) => void;
  onPlayback?: (vehicle: EnrichedVehicle) => void;
  className?: string;
  compact?: boolean;
}

export function VehicleList({ 
  vehicles, 
  onViewOnMap, 
  onPlayback, 
  className,
  compact = false
}: VehicleListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'idle' | 'offline'>('all');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        vehicle.vehicleId.toLowerCase().includes(searchLower) ||
        vehicle.id.toLowerCase().includes(searchLower);

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        const lastSeenTs = vehicle.latest?.ts || vehicle.lastSeenTs;
        const timeDiff = Date.now() - lastSeenTs;
        
        switch (statusFilter) {
          case 'online':
            matchesStatus = timeDiff < 120000; // < 2 minutes
            break;
          case 'idle':
            matchesStatus = timeDiff >= 120000 && timeDiff < 600000; // 2-10 minutes
            break;
          case 'offline':
            matchesStatus = timeDiff >= 600000; // >= 10 minutes
            break;
        }
      }

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, search, statusFilter]);

  if (compact) {
    return (
      <div className={className}>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-1 flex-wrap">
            {['all', 'online', 'idle', 'offline'].map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status as any)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 mt-4 max-h-96 overflow-y-auto">
          {filteredVehicles.map(vehicle => {
            const lastSeenTs = vehicle.latest?.ts || vehicle.lastSeenTs;
            return (
              <div key={vehicle.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                   onClick={() => onViewOnMap?.(vehicle)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge lastSeenTs={lastSeenTs} size="sm" />
                    <p className="font-medium truncate">{vehicle.vehicleId}</p>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{vehicle.id}</p>
                  {vehicle.latest && (
                    <p className="text-xs text-muted-foreground">
                      {vehicle.latest.s.toFixed(1)} km/h
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(lastSeenTs)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Vehicle ID or Device ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {['all', 'online', 'idle', 'offline'].map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status as any)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {filteredVehicles.map(vehicle => {
            const lastSeenTs = vehicle.latest?.ts || vehicle.lastSeenTs;
            return (
              <div key={vehicle.id} className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge lastSeenTs={lastSeenTs} />
                    <div>
                      <h3 className="font-semibold">{vehicle.vehicleId}</h3>
                      <p className="text-sm text-muted-foreground">{vehicle.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatRelativeTime(lastSeenTs)}
                    </p>
                    {vehicle.latest && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>{vehicle.latest.s.toFixed(1)} km/h</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{Math.round(vehicle.latest.h)}°</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewOnMap?.(vehicle)}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    View on Map
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPlayback?.(vehicle)}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Playback
                  </Button>
                </div>
              </div>
            );
          })}

          {filteredVehicles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No vehicles found matching your criteria</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
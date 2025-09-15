// Live Map - Real-time fleet tracking

import { useState, useRef, useEffect } from 'react';
import { MapView } from '@/components/MapView';
import { VehicleList } from '@/components/VehicleList';
import { useFleetData } from '@/hooks/useFleetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Menu, Navigation, X, RotateCcw, Eye, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime, isValidCoordinate } from '@/types/backend';

export function LiveMap() {
  const navigate = useNavigate();
  const mapRef = useRef<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { vehicles, sseStatus, reconnectSSE } = useFleetData();

  // Filter vehicles with valid coordinates
  const vehiclesWithLocation = vehicles.filter(vehicle => 
    vehicle.latest && isValidCoordinate(vehicle.latest.lt, vehicle.latest.ln)
  );

  const handleMarkerClick = (vehicleId: string, deviceId: string) => {
    const vehicle = vehicles.find(v => v.vehicleId === vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicle);
    }
  };

  const handleViewOnMap = (vehicle: any) => {
    if (vehicle.latest && isValidCoordinate(vehicle.latest.lt, vehicle.latest.ln)) {
      mapRef.current?.panToLocation(vehicle.latest.lt, vehicle.latest.ln, 16);
      setSelectedVehicle(vehicle);
    }
    setSidebarOpen(false);
  };

  const handlePlayback = (vehicle: any) => {
    navigate('/playbook', { 
      state: { 
        selectedVehicleId: vehicle.vehicleId,
        selectedDeviceId: vehicle.id
      }
    });
  };

  const handleFitToMarkers = () => {
    mapRef.current?.fitToMarkers();
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Fleet Vehicles</SheetTitle>
            <SheetDescription>
              Click on a vehicle to view on map
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <VehicleList
              vehicles={vehicles}
              onViewOnMap={handleViewOnMap}
              onPlayback={handlePlayback}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-80 border-r bg-card">
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Fleet Vehicles</h2>
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1 ${
                sseStatus === 'connected' 
                  ? 'border-online text-online' 
                  : 'border-offline text-offline'
              }`}
            >
              {sseStatus === 'connected' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {sseStatus === 'connected' ? 'Live' : 'Offline'}
            </Badge>
          </div>
          
          <VehicleList
            vehicles={vehicles}
            onViewOnMap={handleViewOnMap}
            onPlayback={handlePlayback}
            compact
          />
        </div>
      </div>

      {/* Main map area */}
      <div className="flex-1 relative">
        {/* Map controls */}
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
          {/* Mobile menu button */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden bg-background/80 backdrop-blur"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Fit to markers */}
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur"
            onClick={handleFitToMarkers}
          >
            <Navigation className="h-4 w-4" />
            Center View
          </Button>

          {/* Reconnect button */}
          {sseStatus !== 'connected' && (
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur"
              onClick={reconnectSSE}
            >
              <WifiOff className="h-4 w-4" />
              Reconnect
            </Button>
          )}
        </div>

        {/* Map */}
        <MapView
          ref={mapRef}
          vehicles={vehiclesWithLocation}
          onMarkerClick={handleMarkerClick}
          className="h-full"
        />

        {/* Vehicle details drawer */}
        {selectedVehicle && (
          <div className="absolute bottom-4 right-4 z-[1000]">
            <Card className="w-80 bg-background/95 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selectedVehicle.vehicleId}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedVehicle.id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedVehicle(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedVehicle.latest ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Position</p>
                        <p className="font-mono">
                          {selectedVehicle.latest.lt.toFixed(6)}, {selectedVehicle.latest.ln.toFixed(6)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Speed</p>
                        <p>{selectedVehicle.latest.s.toFixed(1)} km/h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Heading</p>
                        <p>{Math.round(selectedVehicle.latest.h)}°</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Seen</p>
                        <p>{formatRelativeTime(selectedVehicle.latest.ts)}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePlayback(selectedVehicle)}
                        className="flex-1"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Playback (2h)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No recent location data</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
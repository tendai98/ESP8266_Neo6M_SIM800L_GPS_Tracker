// Vehicles - Fleet management and device registration

import { useState } from 'react';
import { useFleetData, useDeviceData } from '@/hooks/useFleetData';
import { VehicleList } from '@/components/VehicleList';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, MapPin, RotateCcw, Truck, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '@/types/backend';
import { apiClient } from '@/api/client';
import { toast } from '@/hooks/use-toast';

export function Vehicles() {
  const navigate = useNavigate();
  const { vehicles, refreshVehicles } = useFleetData();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Device registration form
  const [deviceId, setDeviceId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);

  // Get device details for selected vehicle
  const { data: deviceData } = useDeviceData(selectedVehicleId || '');

  const handleViewOnMap = (vehicle: any) => {
    navigate('/map', { state: { selectedVehicleId: vehicle.vehicleId } });
  };

  const handlePlayback = (vehicle: any) => {
    navigate('/playback', { 
      state: { 
        selectedVehicleId: vehicle.vehicleId,
        selectedDeviceId: vehicle.id 
      }
    });
  };

  const handleRegisterDevice = async () => {
    if (!deviceId.trim() || !vehicleId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both Device ID and Vehicle ID",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    try {
      await apiClient.postDevice(deviceId.trim(), vehicleId.trim());
      
      toast({
        title: "Device Registered",
        description: `Device ${deviceId} successfully mapped to vehicle ${vehicleId}`,
      });
      
      // Reset form and refresh data
      setDeviceId('');
      setVehicleId('');
      setRegistrationDialogOpen(false);
      refreshVehicles();
      
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register device",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Check if API key is available for device registration
  const hasApiKey = !!localStorage.getItem('apiKey');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fleet Vehicles</h1>
          <p className="text-muted-foreground">
            Manage your fleet vehicles and devices
          </p>
        </div>
        
        {/* Register device button */}
        {hasApiKey && (
          <Dialog open={registrationDialogOpen} onOpenChange={setRegistrationDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Register Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Device</DialogTitle>
                <DialogDescription>
                  Map a device to a vehicle for tracking
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="device-id">Device ID</Label>
                  <Input
                    id="device-id"
                    placeholder="Enter device identifier..."
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vehicle-id">Vehicle ID</Label>
                  <Input
                    id="vehicle-id"
                    placeholder="Enter vehicle identifier..."
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={handleRegisterDevice}
                  disabled={isRegistering}
                  className="w-full"
                >
                  {isRegistering ? 'Registering...' : 'Register Device'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicles list */}
        <div className="lg:col-span-2">
          <VehicleList
            vehicles={vehicles}
            onViewOnMap={handleViewOnMap}
            onPlayback={handlePlayback}
          />
        </div>

        {/* Vehicle details sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedVehicleId && deviceData ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">{deviceData.device.vehicleId}</h3>
                    <p className="text-sm text-muted-foreground">{selectedVehicleId}</p>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <StatusBadge lastSeenTs={deviceData.device.lastSeenTs} />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Seen</span>
                      <span className="text-sm">{formatRelativeTime(deviceData.device.lastSeenTs)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">IP Address</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {deviceData.device.ip}
                      </Badge>
                    </div>
                    
                    {deviceData.latest && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Live Tracker Data</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Position</span>
                              <div className="text-right">
                                <p className="font-mono text-xs">{deviceData.latest.lt.toFixed(6)}, {deviceData.latest.ln.toFixed(6)}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Speed</span>
                              <Badge variant="outline" className="bg-primary/10">
                                {deviceData.latest.s.toFixed(1)} km/h
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Heading</span>
                              <Badge variant="outline">
                                {Math.round(deviceData.latest.h)}°
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Last Update</span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(deviceData.latest.ts)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                        if (vehicle) handleViewOnMap(vehicle);
                      }}
                      className="flex-1"
                    >
                      <MapPin className="h-4 w-4" />
                      View Map
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                        if (vehicle) handlePlayback(vehicle);
                      }}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Playback
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    Click on a vehicle to view details
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
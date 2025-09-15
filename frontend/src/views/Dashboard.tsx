// Fleet Dashboard - Main overview page

import { StatsCards } from '@/components/StatsCards';
import { VehicleList } from '@/components/VehicleList';
import { useFleetData } from '@/hooks/useFleetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const { 
    vehicles, 
    health, 
    stats, 
    sseStatus, 
    vehiclesLoading, 
    vehiclesError,
    reconnectSSE 
  } = useFleetData();

  const handleViewOnMap = (vehicle: any) => {
    navigate('/map', { state: { selectedVehicleId: vehicle.vehicleId } });
  };

  const handlePlayback = (vehicle: any) => {
    navigate('/playback', { state: { selectedVehicleId: vehicle.vehicleId } });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fleet Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time overview of your fleet operations
          </p>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1 ${
              sseStatus === 'connected' 
                ? 'border-online text-online' 
                : sseStatus === 'connecting'
                ? 'border-idle text-idle'
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
          
          {sseStatus !== 'connected' && (
            <button 
              onClick={reconnectSSE}
              className="text-muted-foreground hover:text-foreground"
              title="Reconnect"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Connection alert */}
      {sseStatus === 'error' && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Real-time connection lost. Falling back to periodic updates every 10 seconds.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats cards */}
      <StatsCards 
        stats={stats} 
        healthPing={health?.rtMs}
      />

      {/* Vehicles table */}
      <div className="grid grid-cols-1 gap-6">
        <VehicleList
          vehicles={vehicles}
          onViewOnMap={handleViewOnMap}
          onPlayback={handlePlayback}
        />
      </div>

      {/* Error states */}
      {vehiclesError && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive">Failed to load fleet data</p>
              <p className="text-sm text-muted-foreground mt-1">
                {vehiclesError.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
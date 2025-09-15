// Fleet status badge component

import { Badge } from '@/components/ui/badge';
import { VehicleStatus, getVehicleStatus } from '@/types/backend';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  lastSeenTs: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ lastSeenTs, className, size = 'md' }: StatusBadgeProps) {
  const status = getVehicleStatus(lastSeenTs);
  
  const variants = {
    [VehicleStatus.ONLINE]: 'bg-online text-online-foreground',
    [VehicleStatus.IDLE]: 'bg-idle text-idle-foreground', 
    [VehicleStatus.OFFLINE]: 'bg-offline text-offline-foreground'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base'
  };

  const labels = {
    [VehicleStatus.ONLINE]: 'Online',
    [VehicleStatus.IDLE]: 'Idle',
    [VehicleStatus.OFFLINE]: 'Offline'
  };

  return (
    <Badge 
      className={cn(
        variants[status], 
        sizes[size], 
        'font-medium rounded-full border-0',
        className
      )}
    >
      {labels[status]}
    </Badge>
  );
}

// Variant for just the dot indicator
export function StatusDot({ lastSeenTs, className }: { lastSeenTs: number; className?: string }) {
  const status = getVehicleStatus(lastSeenTs);
  
  const colors = {
    [VehicleStatus.ONLINE]: 'bg-online',
    [VehicleStatus.IDLE]: 'bg-idle',
    [VehicleStatus.OFFLINE]: 'bg-offline'
  };

  return (
    <div 
      className={cn(
        'w-2 h-2 rounded-full',
        colors[status],
        className
      )}
    />
  );
}
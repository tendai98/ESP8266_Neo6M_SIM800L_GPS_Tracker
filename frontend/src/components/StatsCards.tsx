// Fleet statistics dashboard cards

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Truck, Clock, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FleetStats {
  total: number;
  online: number;
  idle: number;
  offline: number;
}

interface StatsCardsProps {
  stats: FleetStats;
  healthPing?: number;
  className?: string;
}

export function StatsCards({ stats, healthPing, className }: StatsCardsProps) {
  const cards = [
    {
      label: 'Total Vehicles',
      value: stats.total,
      icon: Truck,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      label: 'Online',
      value: stats.online,
      icon: Zap,
      color: 'text-online',
      bgColor: 'bg-online/10'
    },
    {
      label: 'Idle',
      value: stats.idle,
      icon: Clock,
      color: 'text-idle',
      bgColor: 'bg-idle/10'
    },
    {
      label: 'Offline',
      value: stats.offline,
      icon: WifiOff,
      color: 'text-offline',
      bgColor: 'bg-offline/10'
    }
  ];

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4', className)}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {card.label}
                  </p>
                  <p className="text-3xl font-bold tracking-tight">
                    {card.value}
                  </p>
                </div>
                <div className={cn(
                  'p-3 rounded-full',
                  card.bgColor
                )}>
                  <Icon className={cn('h-6 w-6', card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Health Status Card */}
      <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                System Health
              </p>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'text-xs',
                    healthPing !== undefined 
                      ? healthPing < 500 
                        ? 'bg-online/20 text-online' 
                        : 'bg-idle/20 text-idle'
                      : 'bg-offline/20 text-offline'
                  )}
                >
                  {healthPing !== undefined ? `${healthPing}ms` : 'Error'}
                </Badge>
              </div>
            </div>
            <div className={cn(
              'p-3 rounded-full',
              healthPing !== undefined 
                ? healthPing < 500 
                  ? 'bg-online/10'
                  : 'bg-idle/10'
                : 'bg-offline/10'
            )}>
              <Activity className={cn(
                'h-6 w-6',
                healthPing !== undefined 
                  ? healthPing < 500 
                    ? 'text-online'
                    : 'text-idle'
                  : 'text-offline'
              )} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
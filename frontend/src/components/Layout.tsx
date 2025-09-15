// Main application layout with navigation

import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Map, 
  RotateCcw, 
  Truck,
  Navigation
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    href: '/map',
    label: 'Live Map',
    icon: Map
  },
  {
    href: '/playback',
    label: 'Playback',
    icon: RotateCcw
  },
  {
    href: '/vehicles',
    label: 'Vehicles',
    icon: Truck
  }
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          {/* Logo/Brand */}
          <div className="mr-6 flex items-center space-x-2">
            <Navigation className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">FleetTracker</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-1 flex-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  asChild
                  className={cn(
                    'flex items-center gap-2',
                    isActive && 'bg-primary text-primary-foreground shadow-sm'
                  )}
                >
                  <Link to={item.href}>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>

          {/* Right side - could add user menu, etc. */}
          <div className="flex items-center space-x-2">
            {/* Future: user avatar, notifications, etc. */}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
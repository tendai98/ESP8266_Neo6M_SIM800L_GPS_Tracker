// Settings - Configuration management

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, RefreshCw, AlertCircle, CheckCircle, Settings as SettingsIcon, Globe, Key, Map } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SettingsState {
  apiBase: string;
  sseUrl: string;
  tileUrl: string;
  apiKey: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  apiBase: import.meta.env.VITE_API_BASE || 'http://31.97.156.77:8080',
  sseUrl: '',
  tileUrl: import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  apiKey: import.meta.env.VITE_API_KEY || ''
};

export function Settings() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadedSettings = {
      apiBase: localStorage.getItem('apiBase') || DEFAULT_SETTINGS.apiBase,
      sseUrl: localStorage.getItem('sseUrl') || `${DEFAULT_SETTINGS.apiBase}/api/stream/latest`,
      tileUrl: localStorage.getItem('tileUrl') || DEFAULT_SETTINGS.tileUrl,
      apiKey: localStorage.getItem('apiKey') || DEFAULT_SETTINGS.apiKey
    };
    
    setSettings(loadedSettings);
  }, []);

  // Auto-generate SSE URL when API base changes
  useEffect(() => {
    if (settings.apiBase && !localStorage.getItem('sseUrl')) {
      const autoSseUrl = `${settings.apiBase}/api/stream/latest`;
      setSettings(prev => ({ ...prev, sseUrl: autoSseUrl }));
    }
  }, [settings.apiBase]);

  const handleSettingChange = (key: keyof SettingsState, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Validate URLs
      if (settings.apiBase && !isValidUrl(settings.apiBase)) {
        throw new Error('Invalid API Base URL');
      }
      if (settings.sseUrl && !isValidUrl(settings.sseUrl)) {
        throw new Error('Invalid SSE URL');
      }

      // Save to localStorage
      Object.entries(settings).forEach(([key, value]) => {
        if (value.trim()) {
          localStorage.setItem(key, value.trim());
        } else {
          localStorage.removeItem(key);
        }
      });

      setHasChanges(false);
      
      toast({
        title: "Settings Saved",
        description: "Configuration updated successfully. Reload the page for changes to take effect.",
      });

    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Clear localStorage
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Reset to defaults
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    
    toast({
      title: "Settings Reset",
      description: "Configuration reset to defaults",
    });
  };

  const handleReload = () => {
    window.location.reload();
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure API endpoints and application preferences
        </p>
      </div>

      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Connection Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiBase">API Base URL</Label>
            <Input
              id="apiBase"
              value={settings.apiBase}
              onChange={(e) => handleSettingChange('apiBase', e.target.value)}
              placeholder="https://your-api.example.com"
            />
            <p className="text-sm text-muted-foreground">
              Base URL for the fleet tracking API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sseUrl">SSE Stream URL</Label>
            <Input
              id="sseUrl"
              value={settings.sseUrl}
              onChange={(e) => handleSettingChange('sseUrl', e.target.value)}
              placeholder="https://your-api.example.com/api/stream/latest"
            />
            <p className="text-sm text-muted-foreground">
              Server-Sent Events endpoint for real-time updates
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tileUrl">Map Tile URL</Label>
            <Input
              id="tileUrl"
              value={settings.tileUrl}
              onChange={(e) => handleSettingChange('tileUrl', e.target.value)}
              placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <p className="text-sm text-muted-foreground">
              Map tile provider URL pattern. Use OpenStreetMap or your preferred provider.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admin Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Admin Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Admin API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={settings.apiKey}
              onChange={(e) => handleSettingChange('apiKey', e.target.value)}
              placeholder="Enter admin API key..."
            />
            <p className="text-sm text-muted-foreground">
              Required for device registration and management operations
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Admin API key is stored locally and used for privileged operations. 
              Keep it secure and don't share it.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Status Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">API Connection</span>
              <Badge variant={settings.apiBase ? "default" : "secondary"}>
                {settings.apiBase ? "Configured" : "Not Set"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Real-time Updates</span>
              <Badge variant={settings.sseUrl ? "default" : "secondary"}>
                {settings.sseUrl ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Map Tiles</span>
              <Badge variant={settings.tileUrl ? "default" : "secondary"}>
                {settings.tileUrl ? "Configured" : "Default"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Admin Access</span>
              <Badge variant={settings.apiKey ? "default" : "secondary"}>
                {settings.apiKey ? "Available" : "Limited"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        
        <Button 
          variant="outline"
          onClick={handleReset}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset to Defaults
        </Button>

        {!hasChanges && (
          <Button 
            variant="outline"
            onClick={handleReload}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Application
          </Button>
        )}
      </div>

      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Save settings and reload the application for changes to take effect.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
// Server-Sent Events (SSE) client for real-time fleet updates

import type { LatestSnapshot } from '@/types/backend';

export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SSEClient {
  status: SSEStatus;
  connect: () => void;
  disconnect: () => void;
  destroy: () => void;
}

export function createLatestSSE(
  onMessage: (snapshot: LatestSnapshot) => void,
  onStatusChange: (status: SSEStatus) => void,
  onError?: (error: Event) => void
): SSEClient {
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let status: SSEStatus = 'disconnected';
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let isDestroyed = false;

  const getSSEUrl = () => {
    const apiBase = localStorage.getItem('apiBase') || import.meta.env.VITE_API_BASE || 'http://31.97.156.77:8080';
    return localStorage.getItem('sseUrl') || `${apiBase}/api/stream/latest`;
  };

  const updateStatus = (newStatus: SSEStatus) => {
    if (status !== newStatus) {
      status = newStatus;
      onStatusChange(status);
    }
  };

  const scheduleReconnect = () => {
    if (isDestroyed || reconnectAttempts >= maxReconnectAttempts) return;
    
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
    reconnectTimeout = setTimeout(() => {
      if (!isDestroyed) {
        connect();
      }
    }, delay);
  };

  const connect = () => {
    if (isDestroyed) return;
    
    // Clean up existing connection
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    updateStatus('connecting');

    try {
      const url = getSSEUrl();
      eventSource = new EventSource(url);

      eventSource.addEventListener('open', () => {
        reconnectAttempts = 0; // Reset on successful connection
        updateStatus('connected');
        console.log('SSE connected to:', url);
      });

      eventSource.addEventListener('latest', (event: MessageEvent) => {
        try {
          const snapshot = JSON.parse(event.data) as LatestSnapshot;
          onMessage(snapshot);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      });

      eventSource.addEventListener('error', (event) => {
        console.error('SSE error:', event);
        updateStatus('error');
        
        if (onError) {
          onError(event);
        }

        // Reconnect on error
        reconnectAttempts++;
        scheduleReconnect();
      });

      eventSource.addEventListener('close', () => {
        updateStatus('disconnected');
        console.log('SSE connection closed');
        
        // Attempt to reconnect unless manually disconnected
        if (!isDestroyed && status !== 'disconnected') {
          reconnectAttempts++;
          scheduleReconnect();
        }
      });

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      updateStatus('error');
      if (onError && error instanceof Event) {
        onError(error);
      }
      reconnectAttempts++;
      scheduleReconnect();
    }
  };

  const disconnect = () => {
    updateStatus('disconnected');
    
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  const destroy = () => {
    isDestroyed = true;
    disconnect();
  };

  return {
    get status() { return status; },
    connect,
    disconnect,
    destroy
  };
}
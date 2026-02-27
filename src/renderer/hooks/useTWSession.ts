import { useState, useEffect, useCallback } from 'react';
import { getTWCredentials } from '../services/timesService';

export interface TWSessionState {
  isConfigured: boolean; // credentials are saved
  username: string;
  domain: string;
  isLoading: boolean;
  refresh: () => void;
}

// Custom event name used to notify the hook when credentials change
export const TW_SESSION_UPDATED_EVENT = 'tw-session-updated';

function useTWSession(): TWSessionState {
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const creds = await getTWCredentials();
      setUsername(creds.username || '');
      setDomain(creds.domain || '');
    } catch {
      setUsername('');
      setDomain('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener(TW_SESSION_UPDATED_EVENT, handler);
    return () => window.removeEventListener(TW_SESSION_UPDATED_EVENT, handler);
  }, [load]);

  return {
    isConfigured: !!(username && domain),
    username,
    domain,
    isLoading,
    refresh: load
  };
}

export default useTWSession;

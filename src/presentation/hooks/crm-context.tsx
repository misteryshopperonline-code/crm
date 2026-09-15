'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Snapshot } from '@/domain/models';
import { ApiError, request } from '../api-client';
interface CrmContextValue {
  data: Snapshot;
  mutate: (path: string, input: unknown) => Promise<{ inviteToken?: string }>;
  logout: () => Promise<void>;
}
const Context = createContext<CrmContextValue | null>(null);
export function CrmProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState('');
  const router = useRouter(),
    generation = useRef(0);
  const report = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setData(null);
        router.replace('/');
      } else setError(error instanceof Error ? error.message : 'No se pudo cargar el CRM.');
    },
    [router],
  );
  const load = useCallback(async () => {
    const current = ++generation.current;
    try {
      const result = await request<Snapshot>('state');
      if (current === generation.current) {
        setData(result);
        setError('');
      }
    } catch (error) {
      if (current === generation.current) report(error);
    }
  }, [report]);
  useEffect(() => {
    const tracker = generation;
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !document.querySelector('dialog[open]') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
      )
        void load();
    }, 60000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      tracker.current++;
    };
  }, [load]);
  async function mutate(path: string, input: unknown) {
    const current = ++generation.current;
    try {
      const { inviteToken, ...result } = await request<Snapshot & { inviteToken?: string }>(
        path,
        input,
      );
      if (current === generation.current) {
        setData(result);
        setError('');
      }
      return { inviteToken };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) report(error);
      throw error;
    }
  }
  async function logout() {
    await request('auth/logout', {});
    generation.current++;
    setData(null);
    router.replace('/');
  }
  if (!data)
    return (
      <div className="loading-panel">
        <h1>Pulso CRM</h1>
        <p role="status">{error || 'Cargando tu espacio…'}</p>
        {error && <button onClick={() => void load()}>Reintentar</button>}
      </div>
    );
  return (
    <Context.Provider value={{ data, mutate, logout }}>
      {error && (
        <div className="connection-error" role="alert">
          {error} <button onClick={() => void load()}>Reintentar</button>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function useCrm() {
  const value = useContext(Context);
  if (!value) throw Error('CRM context missing');
  return value;
}

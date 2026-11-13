import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useState } from 'react';
import './styles/tokens.css';
import './styles/app.css';
import { initApi } from './api';
import { usePath, linkProps } from './lib/router';
import { Verify } from './pages/Verify';
import { Logo } from './components/bits';

// The game and the standalone app share one lazily loaded chunk (Three.js); /verify stays light.
const GamePage = lazy(() => import('./game/GamePage').then(m => ({ default: m.GamePage })));
const AppPage = lazy(() => import('./game/AppPage').then(m => ({ default: m.AppPage })));
const Loading = () => <div className="boot" aria-busy="true"><Logo /><span>building the island…</span></div>;

function App() {
  const path = usePath();
  const machine = path.match(/^\/m\/([^/]+)\/?$/);
  useEffect(() => {
    document.title = machine ? `${decodeURIComponent(machine[1])} · worldworks` : path.startsWith('/verify') ? 'Verify · worldworks' : 'worldworks · the money factory';
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (path === '/' || path === '') return <Suspense fallback={<Loading />}><GamePage /></Suspense>;
  if (machine) return <Suspense fallback={<Loading />}><AppPage key={machine[1]} machineId={decodeURIComponent(machine[1])} /></Suspense>;
  if (/^\/verify\/?$/.test(path)) return <Verify />;
  return (
    <main className="plain-page">
      <Logo />
      <h1>Nothing here.</h1>
      <p>This page does not exist. <a {...linkProps('/')}>Back to the game</a>.</p>
    </main>
  );
}

function Boot() {
  const [state, setState] = useState<'loading' | 'ready' | string>('loading');
  useEffect(() => { initApi().then(() => setState('ready'), e => setState((e as Error).message || 'unknown error')); }, []);
  if (state === 'ready') return <App />;
  if (state === 'loading') return <div className="boot" aria-busy="true"><Logo /><span>warming up the machines…</span></div>;
  return <main className="plain-page"><Logo /><h1>The engine did not start.</h1><p>{state}</p><p>Reload the page to try again.</p></main>;
}

createRoot(document.getElementById('root')!).render(<Boot />);

import { createRoot } from 'react-dom/client';
import { Component, lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { restoreLedger } from './lib/store';
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

function decode(value:string) { try { return decodeURIComponent(value); } catch { return value; } }
class RouteBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError() { return {error:true}; }
  render() { return this.state.error ? <main className="plain-page"><h1>New version available, reload</h1><p>The page could not be loaded.</p><button className="btn" onClick={()=>location.reload()}>Reload</button></main> : this.props.children; }
}
function App() {
  const path = usePath();
  const machine = path.match(/^\/m\/([^/]+)\/?$/);
  useEffect(() => {
    document.title = machine ? `${decode(machine[1])} · worldworks` : path.startsWith('/verify') ? 'Verify · worldworks' : 'worldworks · the money factory';
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (path === '/' || path === '') return <RouteBoundary key={path}><Suspense fallback={<Loading />}><GamePage /></Suspense></RouteBoundary>;
  if (machine) return <RouteBoundary key={path}><Suspense fallback={<Loading />}><AppPage key={machine[1]} machineId={decode(machine[1])} /></Suspense></RouteBoundary>;
  if (/^\/verify\/?$/.test(path)) return <RouteBoundary key={path}><Verify /></RouteBoundary>;
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
  useEffect(() => { initApi().then(() => {restoreLedger();setState('ready');}, e => setState((e as Error).message || 'unknown error')); }, []);
  if (state === 'ready') return <App />;
  if (state === 'loading') return <div className="boot" aria-busy="true"><Logo /><span>warming up the machines…</span></div>;
  return <main className="plain-page"><Logo /><h1>{/module|chunk/i.test(state)?'New version available, reload':'The engine did not start.'}</h1><p>{state}</p><button className="btn" onClick={()=>location.reload()}>Reload</button></main>;
}

createRoot(document.getElementById('root')!).render(<Boot />);

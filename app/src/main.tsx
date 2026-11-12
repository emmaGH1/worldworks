import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';

const path = window.location.pathname;
const machine = path.match(/^\/m\/([^/]+)\/?$/);
let title = 'Workshop';
let description = 'The workshop is coming soon.';
if (machine) {
  title = 'Machine app';
  description = `Machine ${decodeURIComponent(machine[1])} is not available yet.`;
} else if (/^\/verify\/?$/.test(path)) {
  title = 'Verify';
  description = 'Contract and explorer information will appear here.';
} else if (path !== '/') {
  title = 'Page not found';
  description = 'This page does not exist.';
}

createRoot(document.getElementById('root')!).render(
  <main><p className="brand">WORLDWORKS</p><h1>{title}</h1><p>{description}</p><a href="/">Workshop</a></main>,
);

import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { CaptureBar } from './CaptureBar';

const isCaptureBar = new URLSearchParams(window.location.search).get('view') === 'capture';
createRoot(document.getElementById('root')!).render(isCaptureBar ? <CaptureBar /> : <App />);

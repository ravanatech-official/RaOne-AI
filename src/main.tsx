import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { installAuthenticatedApiFetch } from './utils/authFetch';

installAuthenticatedApiFetch();

createRoot(document.getElementById('root')!).render(<App />);

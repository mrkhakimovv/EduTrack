import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirebaseAuthProvider } from './components/FirebaseAuthProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </StrictMode>,
);

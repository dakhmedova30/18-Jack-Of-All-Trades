import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { SpeechReader } from './components/SpeechReader';
import { AppearanceProvider } from './hooks/useAppearance';
import { AuthProvider } from './hooks/useAuth';
import { PreferencesProvider } from './hooks/usePreferences';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AppearanceProvider>
      <BrowserRouter>
        <AuthProvider>
          <PreferencesProvider>
            <SpeechReader />
            <App />
          </PreferencesProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppearanceProvider>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';

async function bootstrap() {
  const themePromise = useThemeStore.getState().fetchTheme();
  
  const token = localStorage.getItem('accessToken');
  if (token) {
    await useAuthStore.getState().fetchMe();
  } else {
    useAuthStore.setState({ isLoading: false });
  }

  await themePromise;

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();

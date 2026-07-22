import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Entrada from './pages/Entrada';
import Verificacao from './pages/Verificacao';
import Home from './pages/Home';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<Entrada />} />
        <Route path="/verificar" element={<Verificacao />} />
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

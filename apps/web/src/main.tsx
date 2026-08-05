import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Entrada from './pages/Entrada';
import Verificacao from './pages/Verificacao';
import Garagem from './pages/Garagem';
import Motorista from './pages/Motorista';
import Analisar from './pages/Analisar';
import Resultado from './pages/Resultado';
import Perfil from './pages/Perfil';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<Entrada />} />
        <Route path="/verificar" element={<Verificacao />} />
        <Route path="/" element={<Garagem />} />
        <Route path="/motorista" element={<Motorista />} />
        <Route path="/analisar" element={<Analisar />} />
        <Route path="/resultado" element={<Resultado />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

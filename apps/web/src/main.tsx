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
import BuscarFrete from './pages/BuscarFrete';
import AdminLayout from './admin/AdminLayout';
import VisaoGeral from './admin/pages/VisaoGeral';
import Motoristas from './admin/pages/Motoristas';
import FretesPublicados from './admin/pages/FretesPublicados';
import ConsultasWhatsapp from './admin/pages/ConsultasWhatsapp';
import Administradores from './admin/pages/Administradores';
import Auditoria from './admin/pages/Auditoria';
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
        <Route path="/resultado/:id" element={<Resultado />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/buscar-frete" element={<BuscarFrete />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<VisaoGeral />} />
          <Route path="motoristas" element={<Motoristas />} />
          <Route path="fretes" element={<FretesPublicados />} />
          <Route path="whatsapp" element={<ConsultasWhatsapp />} />
          <Route path="admins" element={<Administradores />} />
          <Route path="auditoria" element={<Auditoria />} />
        </Route>
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

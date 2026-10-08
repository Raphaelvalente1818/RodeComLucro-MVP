// apps/web/src/components/LayoutMotorista.tsx
//
// Barra de abas do app do motorista (08/10/2026). Mockup aprovado pelo
// Raphael em Docs/mockup-navegacao-app.html: quatro destinos fixos embaixo
// (Início · Calcular · Fretes · Caminhão), ícone + uma palavra, o atual em
// amarelo. O problema que resolve: "fica confuso saber onde estou, quantas
// telas tem, pra qual tela eu vou".
//
// Fase 1 (esta): só ADICIONA a barra, como rota de layout envolvendo as
// telas que já existem — nenhuma tela muda por dentro. Fase 2 (depois do
// print do iPhone): tirar os "← Voltar para a Garagem" e os botões de
// navegação improvisados que ficaram redundantes.
//
// Telas filhas (Resultado, Meu perfil) continuam com a barra visível e
// acendem a aba "pai" (Resultado → Calcular; Meu perfil → Início), pra o
// motorista nunca ficar sem saída.

import { NavLink, Outlet, useLocation } from 'react-router-dom';

type Aba = {
  rotulo: string;
  para: string;
  /** Prefixos de rota que acendem esta aba (além de `para`). */
  acendeEm: string[];
  icone: () => JSX.Element;
};

const ABAS: Aba[] = [
  {
    rotulo: 'Início',
    para: '/',
    acendeEm: ['/motorista'],
    icone: () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    rotulo: 'Calcular',
    para: '/analisar',
    acendeEm: ['/resultado'],
    icone: () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h3M13 11h3M8 15h3M13 15h3" />
      </svg>
    ),
  },
  {
    rotulo: 'Fretes',
    para: '/buscar-frete',
    acendeEm: [],
    // caixa de carga: é a lista de fretes publicados pra pegar
    icone: () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 20 7v10l-8 4-8-4V7z" />
        <path d="M4 7l8 4 8-4M12 11v10" />
      </svg>
    ),
  },
  {
    rotulo: 'Caminhão',
    para: '/perfil',
    acendeEm: [],
    // mesmo desenho do card "Meu Caminhão" da Garagem (IconesCard.tsx)
    icone: () => (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M1 4.5h13v11H1z" />
        <path d="M14 9h4.2l3.3 3.3v3.2H14z" />
        <circle cx="5.5" cy="18.2" r="2.2" />
        <circle cx="17.5" cy="18.2" r="2.2" />
        <path d="M7.7 18.2h7.1" />
      </svg>
    ),
  },
];

function abaAtiva(pathname: string, aba: Aba): boolean {
  if (aba.para === '/') return pathname === '/' || aba.acendeEm.some((p) => pathname.startsWith(p));
  return pathname.startsWith(aba.para) || aba.acendeEm.some((p) => pathname.startsWith(p));
}

export default function LayoutMotorista() {
  const { pathname } = useLocation();

  return (
    <div className="com-abas">
      <Outlet />
      <nav className="barra-abas" aria-label="Navegação principal">
        {ABAS.map((aba) => {
          const Icone = aba.icone;
          const ativa = abaAtiva(pathname, aba);
          return (
            <NavLink
              key={aba.para}
              to={aba.para}
              className={`aba${ativa ? ' aba-ativa' : ''}`}
              aria-current={ativa ? 'page' : undefined}
            >
              <Icone />
              <span>{aba.rotulo}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

// apps/web/src/components/IconesCard.tsx
//
// Ícones dos cards "Meu Caminhão" / "Meu Perfil" na Garagem. SVG inline
// (estilo outline, herda cor via currentColor) — o projeto não usa
// nenhuma lib de ícones, então não faz sentido adicionar uma só por
// causa de dois ícones. Trocaram o emoji (🚛/😊) inicial, que ficava com
// cara de rascunho — pedido do Raphael pra ficar mais profissional.

export function IconeCaminhao() {
  return (
    <svg
      className="icone-card"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 4.5h13v11H1z" />
      <path d="M14 9h4.2l3.3 3.3v3.2H14z" />
      <circle cx="5.5" cy="18.2" r="2.2" />
      <circle cx="17.5" cy="18.2" r="2.2" />
      <path d="M7.7 18.2h7.1" />
    </svg>
  );
}

export function IconePerfil() {
  return (
    <svg
      className="icone-card"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="7.5" r="3.8" />
      <path d="M4.5 20.5v-1.2a4.8 4.8 0 0 1 4.8-4.8h5.4a4.8 4.8 0 0 1 4.8 4.8v1.2" />
    </svg>
  );
}

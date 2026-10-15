// Apresentação pros sócios — Rode com Lucro / Sofrete, outubro/2026
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const THEME = {
  name: "Rode com Lucro",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1C2421", lt1: "FFFFFF", dk2: "0B0E0D", lt2: "F4F1E8",
    accent1: "F2B01E", accent2: "C9901A", accent3: "2FD46E", accent4: "FF9F1C", accent5: "FF5A5A", accent6: "7E8C88",
    hlink: "C9901A", folHlink: "7E8C88",
  },
};
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Rode com Lucro / Sofrete — reunião de sócios, out/2026";
const C = pres.SchemeColor;
const W = 10, H = 5.625;

// Layouts
pres.defineSlideMaster({
  title: "ESCURO", background: { color: THEME.colors.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 8.8, h: 0.9, fontSize: 32, bold: true, color: C.accent1, margin: 0, valign: "top", align: "left" } } },
    { text: { text: "Rode com Lucro · Sofrete — reunião de sócios, outubro/2026", options: { x: 0.6, y: 5.2, w: 7, h: 0.3, fontSize: 9, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 9.1, y: 5.2, w: 0.5, h: 0.3, fontSize: 9, color: C.accent6 },
});
pres.defineSlideMaster({
  title: "CLARO", background: { color: THEME.colors.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 8.8, h: 0.8, fontSize: 28, bold: true, color: C.text1, margin: 0, valign: "top", align: "left" } } },
    { text: { text: "Rode com Lucro · Sofrete — reunião de sócios, outubro/2026", options: { x: 0.6, y: 5.2, w: 7, h: 0.3, fontSize: 9, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 9.1, y: 5.2, w: 0.5, h: 0.3, fontSize: 9, color: C.accent6 },
});

const txt = (slide, t, o) => slide.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 14, color: C.text1 }, o));
const box = (slide, o) => slide.addShape(pres.ShapeType.roundRect, Object.assign({ rectRadius: 0.08, line: { color: THEME.colors.lt2, width: 0 } }, o));

// Stat callout
function stat(slide, x, y, w, num, label, opts = {}) {
  const dark = !!opts.dark;
  box(slide, { x, y, w, h: 1.25, fill: { color: dark ? THEME.colors.dk1 : THEME.colors.lt2 }, objectName: "card " + label });
  txt(slide, num, { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.65, fontSize: opts.size || 30, bold: true, color: opts.color || C.accent1, fontFace: "Arial", objectName: "stat " + label });
  txt(slide, label, { x: x + 0.15, y: y + 0.75, w: w - 0.3, h: 0.45, fontSize: 11, color: dark ? C.background2 : C.text1, objectName: "label " + label });
}

// ---------- 1. Capa
pres.addSection({ title: "Abertura" });
{
  const s = pres.addSlide({ masterName: "ESCURO", sectionTitle: "Abertura" });
  s.addText("Rode com Lucro · Sofrete", { placeholder: "title" });
  txt(s, "Onde estamos, o que aprendemos com os concorrentes\ne o que precisamos decidir", { x: 0.6, y: 1.6, w: 8.5, h: 1.2, fontSize: 24, color: C.background1, objectName: "subtitulo" });
  txt(s, "Reunião de sócios · outubro de 2026 · 45 min + demo ao vivo", { x: 0.6, y: 3.0, w: 8.5, h: 0.4, fontSize: 14, color: C.accent6, objectName: "data" });
  box(s, { x: 0.6, y: 3.7, w: 3.4, h: 0.9, fill: { color: THEME.colors.accent1 }, objectName: "chamada" });
  txt(s, "Saímos daqui com 5 decisões tomadas", { x: 0.75, y: 3.7, w: 3.1, h: 0.9, fontSize: 15, bold: true, color: C.text1, valign: "middle", objectName: "chamada txt" });
  s.addNotes("Reunião de decisão, não de informação. Mostrar números crus, concorrente, problema do telefone, solução, ordem do MVP, decisões. Fechar com demo no WhatsApp.");
}

// ---------- 2. Onde estamos
pres.addSection({ title: "Onde estamos" });
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Onde estamos" });
  s.addText("Onde estamos hoje", { placeholder: "title" });
  stat(s, 0.6, 1.35, 2.1, "21", "motoristas cadastrados");
  stat(s, 2.85, 1.35, 2.1, "112", "consultas pelo WhatsApp");
  stat(s, 5.1, 1.35, 2.1, "87", "análises no app");
  stat(s, 7.35, 1.35, 2.05, "1 / 160", "gate de validação", { color: C.accent5 });
  txt(s, "No ar", { x: 0.6, y: 2.95, w: 4, h: 0.35, fontSize: 16, bold: true, objectName: "no ar h" });
  s.addText([
    { text: "Bot no WhatsApp (v88): calcula, cota, busca frete, lê CNH/CRLV por foto, memória da conversa", options: { bullet: true, breakLine: true } },
    { text: "App do motorista com barra de abas, custo real, piso ANTT, pneus por eixo", options: { bullet: true, breakLine: true } },
    { text: "Sofrete: empresa publica, pausa e fecha frete; painel admin com moderação", options: { bullet: true, breakLine: true } },
    { text: "Compartilhar frete com um colega + indicação (viral) — no ar desde 09/10", options: { bullet: true } },
  ], { x: 0.6, y: 3.3, w: 5.6, h: 1.8, fontSize: 13, color: C.text1, paraSpaceAfter: 4, isTextBox: true, margin: 0, objectName: "no ar lista" });
  box(s, { x: 6.5, y: 2.95, w: 2.9, h: 2.1, fill: { color: THEME.colors.dk1 }, objectName: "alerta" });
  txt(s, "O gargalo é aquisição", { x: 6.7, y: 3.1, w: 2.6, h: 0.4, fontSize: 15, bold: true, color: C.accent1, objectName: "alerta h" });
  txt(s, "810 fretes na base são de agosto (importados). 3 empresas cadastradas. Tudo que vem a seguir ataca isso.", { x: 6.7, y: 3.55, w: 2.6, h: 1.4, fontSize: 12, color: C.background1, objectName: "alerta p" });
  s.addNotes("Números do banco em 12/10. 21 motoristas reais (sem os números de teste). Gate 1/160 = só 1 motorista completou a jornada inteira.");
}

// ---------- 3. Concorrente: quem é
pres.addSection({ title: "Concorrente" });
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Concorrente" });
  s.addText("Zé Boléia por dentro", { placeholder: "title" });
  txt(s, "App nas lojas, só app (sem WhatsApp). Calculadora vs. ANTT, controle de viagens e uma comunidade com 8 abas. Medido na tela em 12/10/2026.", { x: 0.6, y: 1.25, w: 8.8, h: 0.5, fontSize: 13, color: C.accent6, objectName: "intro" });
  stat(s, 0.6, 1.9, 2.1, "50 mil+", "downloads · nota 3,6", { size: 26 });
  stat(s, 2.85, 1.9, 2.1, "10", "fretes abertos (4 agenciadores)", { color: C.accent5 });
  stat(s, 5.1, 1.9, 2.1, "36", "motoristas \"tô vazio\" em 24 h", { color: C.accent3 });
  stat(s, 7.35, 1.9, 2.05, "133", "anúncios no Brique (~1/dia)");
  stat(s, 0.6, 3.35, 2.1, "4", "postos de diesel informados", { color: C.accent5 });
  stat(s, 2.85, 3.35, 2.1, "45", "posts no feed em 17 dias");
  stat(s, 5.1, 3.35, 2.1, "9", "relatos de golpe em 17 dias", { color: C.accent5 });
  stat(s, 7.35, 3.35, 2.05, "0", "parceiros ativos no clube", { color: C.accent5 });
  s.addNotes("Fretes: rolei até o fim, 10 ofertas, texto colado de grupo de WhatsApp com link do grupo. Tô vazio é a única área viva. Golpe: golpista chama quem se declara vazio e pede taxa da seguradora.");
}

// ---------- 4. Lado a lado
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Concorrente" });
  s.addText("Lado a lado: os dois concorrentes e nós", { placeholder: "title" });
  const hdr = { bold: true, color: THEME.colors.dk1, fill: { color: THEME.colors.accent1 }, fontSize: 12, fontFace: "Arial" };
  const c = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 10.5, color: THEME.colors.dk1, valign: "middle" }, o) });
  const ok = (t) => c("✔  " + t, { color: "1D7A45" });
  const no = (t) => c("✘  " + t, { color: "9E2F2F" });
  const rows = [
    [c("Função", hdr), c("Zé Boléia", hdr), c("Fretebras (motorista)", hdr), c("Rode com Lucro", hdr)],
    [c("Onde usa", { bold: true }), no("Só app"), no("Só app; bloqueia print"), ok("WhatsApp + web + app")],
    [c("Cálculo", { bold: true }), no("Só vs. ANTT"), no("Calculadora simples"), ok("Custo real, lucro, veredito")],
    [c("Fretes", { bold: true }), no("10, de agenciador"), ok("Muitos (é o incumbente)"), no("810 de agosto (velhos)")],
    [c("Contato", { bold: true }), no("Chat interno"), no("Chat interno"), ok("Direto ou WhatsApp do motorista")],
    [c("Verificação", { bold: true }), no("Opcional; golpe no app"), ok("Pesada: ANTT, PIX, selfie"), ok("CNH por foto + indicação")],
    [c("Reputação da empresa", { bold: true }), no("Não tem"), no("Só no VIP pago"), ok("Grátis (proposta)")],
    [c("Pagamento", { bold: true }), no("Não tem"), ok("Carteira, antecipação, garantia"), no("Fora do escopo")],
    [c("Plano pago", { bold: true }), no("Clube sem parceiros"), ok("VIP: vê frete antes, destaque"), ok("PRO (igual ao VIP) — pronto")],
  ];
  s.addTable(rows, { x: 0.6, y: 1.3, w: 8.8, colW: [1.7, 2.2, 2.45, 2.45], rowH: 0.4, border: { type: "solid", color: "D8D2C2", pt: 0.5 }, fontFace: "Calibri", objectName: "tabela lado a lado" });
  s.addNotes("Placar honesto: eles ganham em presença (loja, tô vazio, brique). Nós ganhamos onde o dinheiro está: canal, cálculo, contato e confiança. Fretes velhos é o nosso ponto fraco — igual ao deles.");
}

// ---------- 5. Por que não decolou
{
  const s = pres.addSlide({ masterName: "ESCURO", sectionTitle: "Concorrente" });
  s.addText("Por que o frete deles não decolou", { placeholder: "title" });
  const itens = [
    ["1", "Pediram pro mercado se mudar", "O frete vive nos grupos de WhatsApp. Eles copiaram o grupo numa tela e pediram pro caminhoneiro olhar outra tela."],
    ["2", "Marketplace sem o lado da carga", "Tem motorista (lado fácil), não tem embarcador. O agenciador preenche o vazio — e posta onde já posta."],
    ["3", "Confiança zero", "Qualquer número entra e chama. O feed virou mural de golpe em 17 dias."],
    ["4", "Largura em vez de profundidade", "Oito abas, três vazias. A calculadora, que seria o núcleo, não diz se dá lucro."],
    ["5", "Monetização antes da massa", "Clube de descontos sem nenhum parceiro ativo. Sem receita, sem fôlego."],
  ];
  itens.forEach(([n, h, p], i) => {
    const y = 1.35 + i * 0.72;
    s.addShape(pres.ShapeType.ellipse, { x: 0.6, y: y + 0.05, w: 0.5, h: 0.5, fill: { color: THEME.colors.accent1 }, line: { width: 0 }, objectName: "num " + n });
    txt(s, n, { x: 0.6, y: y + 0.05, w: 0.5, h: 0.5, fontSize: 16, bold: true, align: "center", valign: "middle", color: C.text1, fontFace: "Arial", objectName: "num txt " + n });
    txt(s, h, { x: 1.3, y: y, w: 3.0, h: 0.6, fontSize: 14, bold: true, color: C.accent1, valign: "middle", objectName: "h " + n });
    txt(s, p, { x: 4.4, y: y, w: 5.0, h: 0.6, fontSize: 12, color: C.background1, valign: "middle", objectName: "p " + n });
  });
  txt(s, "A carga é o gargalo deles — e vai ser o nosso.", { x: 0.6, y: 4.85, w: 8.8, h: 0.35, fontSize: 14, bold: true, italic: true, color: C.accent1, objectName: "takeaway" });
  s.addNotes("Ressalva: foto de domingo, do que aparece na tela. Não sabemos a receita deles. Mas pra decidir o nosso MVP a conclusão fica de pé.");
}

// ---------- 5b. Fretebras por dentro
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Concorrente" });
  s.addText("Fretebras por dentro (lado do motorista)", { placeholder: "title" });
  txt(s, "Teste real de um sócio em 13/10. Só app nativo, sem web e sem WhatsApp.", { x: 0.6, y: 1.2, w: 8.8, h: 0.35, fontSize: 13, color: C.accent6, objectName: "intro" });
  const esq = [
    ["Verificação pesada", "ANTT consultada na hora (acusa titular diferente), CNH, endereço, PIX confirmado, selfie, localização."],
    ["O produto é pagamento", "Carteira, antecipação de saldo (R$ 3 mil pré-aprovado), garantia contra calote. A viagem só conta quando o PIX passa por eles."],
    ["VIP = nosso PRO", "Ver frete antes, perfil em destaque, ver reputação da empresa. Valida o desenho do PRO."],
    ["Contato e print", "Chat interno esconde o telefone; print da lista sai em branco. Eles guardam o frete; nós espalhamos."],
  ];
  esq.forEach(([h, p], i) => {
    const y = 1.65 + i * 0.82;
    box(s, { x: 0.6, y, w: 5.3, h: 0.72, fill: { color: THEME.colors.lt2 }, objectName: "f " + h });
    txt(s, h, { x: 0.8, y: y + 0.06, w: 4.9, h: 0.28, fontSize: 13, bold: true, objectName: "fh " + h });
    txt(s, p, { x: 0.8, y: y + 0.33, w: 4.9, h: 0.38, fontSize: 10.5, color: C.accent6, objectName: "fp " + h });
  });
  box(s, { x: 6.2, y: 1.65, w: 3.2, h: 3.28, fill: { color: THEME.colors.dk1 }, objectName: "copiar" });
  txt(s, "O que copiamos (barato)", { x: 6.4, y: 1.8, w: 2.8, h: 0.35, fontSize: 14, bold: true, color: C.accent1, objectName: "copiar h" });
  s.addText([
    { text: "RNTRC no cartão verificado (o embarcador precisa pro CIOT)", options: { bullet: true, breakLine: true } },
    { text: "Foto do caminhão, opcional, só pra empresa aprovada", options: { bullet: true, breakLine: true } },
    { text: "\"Quer que as empresas te vejam?\" na hora da busca — o tô vazio sem aba nova", options: { bullet: true, breakLine: true } },
    { text: "Reputação da empresa grátis (lá é VIP pago)", options: { bullet: true } },
  ], { x: 6.4, y: 2.2, w: 2.8, h: 2.1, fontSize: 11.5, color: C.background1, paraSpaceAfter: 5, isTextBox: true, margin: 0, objectName: "copiar lista" });
  txt(s, "Não copiamos: carteira (financeiro regulado), selfie e comprovante (atrito), bloqueio de print, chat interno.", { x: 6.4, y: 4.3, w: 2.8, h: 0.6, fontSize: 9.5, italic: true, color: C.accent6, objectName: "nao" });
  s.addNotes("Prints do teste real de 13/10. Fretebras é o incumbente: tem a carga e o dinheiro. Não competimos no pagamento; competimos no canal (WhatsApp), no cálculo honesto e na confiança barata (CNH + indicação + RNTRC).");
}

// ---------- 6. O problema
pres.addSection({ title: "Problema e solução" });
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Problema e solução" });
  s.addText("O problema: o telefone do contratante", { placeholder: "title" });
  box(s, { x: 0.6, y: 1.35, w: 4.2, h: 3.6, fill: { color: THEME.colors.lt2 }, objectName: "hoje" });
  txt(s, "Hoje", { x: 0.85, y: 1.5, w: 3.7, h: 0.4, fontSize: 18, bold: true, objectName: "hoje h" });
  s.addText([
    { text: "Mostramos o telefone de todo frete, no bot e no app", options: { bullet: true, breakLine: true } },
    { text: "Quando a empresa publicar pela Sofrete, ela decide se o telefone aparece", options: { bullet: true, breakLine: true } },
    { text: "Se não aparecer, motorista e empresa não têm como falar", options: { bullet: true } },
  ], { x: 0.85, y: 2.0, w: 3.7, h: 2.8, fontSize: 13, color: C.text1, paraSpaceAfter: 8, isTextBox: true, margin: 0, objectName: "hoje lista" });
  box(s, { x: 5.2, y: 1.35, w: 4.2, h: 3.6, fill: { color: THEME.colors.dk1 }, objectName: "descartado" });
  txt(s, "O que descartamos", { x: 5.45, y: 1.5, w: 3.7, h: 0.4, fontSize: 18, bold: true, color: C.accent1, objectName: "desc h" });
  s.addText([
    { text: "Chat interno completo: ~6 dias", options: { bullet: true, breakLine: true } },
    { text: "Dependeria de o caminhoneiro abrir o app pra ler a resposta — o Zé Boléia prova que ele não abre", options: { bullet: true, breakLine: true } },
    { text: "Mandar WhatsApp pra empresa que não nos conhece: a Meta exige opt-in; disparo frio derruba a nota do número e corta o bot", options: { bullet: true } },
  ], { x: 5.45, y: 2.0, w: 3.7, h: 2.8, fontSize: 13, color: C.background1, paraSpaceAfter: 8, isTextBox: true, margin: 0, objectName: "desc lista" });
}

// ---------- 7. Solução: fluxo
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Problema e solução" });
  s.addText("A solução: \"Tenho interesse\"", { placeholder: "title" });
  txt(s, "O motorista se candidata e entrega o contato dele, verificado. O embarcador escolhe e chama.", { x: 0.6, y: 1.2, w: 8.8, h: 0.4, fontSize: 13, color: C.accent6, objectName: "intro" });
  const passos = [
    ["Tenho\ninteresse", "no bot ou no app"],
    ["CNH\npor foto", "só depois vale; ganha selo"],
    ["Cartão\nverificado", "nome, caminhão, nota, link"],
    ["Mensagem\npronta", "do WhatsApp dele pro embarcador"],
    ["Embarcador\nchama", "e conhece a Sofrete"],
    ["Fases +\navaliação", "no portal e no app"],
  ];
  const bw = 1.3, gap = 0.2, x0 = 0.6;
  passos.forEach(([h, p], i) => {
    const x = x0 + i * (bw + gap);
    box(s, { x, y: 1.85, w: bw, h: 1.5, fill: { color: i === 3 ? THEME.colors.accent1 : THEME.colors.lt2 }, objectName: "passo " + (i + 1) });
    txt(s, String(i + 1), { x: x + 0.1, y: 1.92, w: 0.4, h: 0.3, fontSize: 11, bold: true, color: C.accent6, objectName: "n " + (i + 1) });
    txt(s, h, { x: x + 0.1, y: 2.2, w: bw - 0.2, h: 0.7, fontSize: 13, bold: true, color: C.text1, objectName: "h " + (i + 1) });
    txt(s, p, { x: x + 0.1, y: 2.9, w: bw - 0.2, h: 0.42, fontSize: 9.5, color: i === 3 ? C.text1 : C.accent6, objectName: "p " + (i + 1) });
    if (i < passos.length - 1) s.addShape(pres.ShapeType.rightArrow, { x: x + bw + 0.02, y: 2.45, w: 0.16, h: 0.25, fill: { color: THEME.colors.accent2 }, line: { width: 0 }, objectName: "seta " + (i + 1) });
  });
  box(s, { x: 0.6, y: 3.6, w: 8.8, h: 1.35, fill: { color: THEME.colors.dk1 }, objectName: "msg" });
  txt(s, "A mensagem que o motorista manda (pronta pelo bot):", { x: 0.8, y: 3.68, w: 8.4, h: 0.3, fontSize: 11, color: C.accent6, objectName: "msg h" });
  txt(s, "\"Olá! Vi o frete Itajaí → Jundiaí no Rode com Lucro e tenho interesse. Carreta sider 6 eixos, estou em Itajaí. Meu cadastro verificado: rodecomlucro.app/m/8CAENY — Publique seus fretes grátis na Sofrete: sofrete.app\"", { x: 0.8, y: 3.98, w: 8.4, h: 0.9, fontSize: 12.5, italic: true, color: C.background1, objectName: "msg p" });
  s.addNotes("Conversa pessoa-pra-pessoa, fora do nosso número: compatível com a Meta. Depois que a empresa se cadastra com opt-in, o bot pode avisá-la por template e o fluxo segue por dentro da Sofrete.");
}

// ---------- 8. Efeitos colaterais
{
  const s = pres.addSlide({ masterName: "ESCURO", sectionTitle: "Problema e solução" });
  s.addText("Uma limitação que vira três produtos", { placeholder: "title" });
  const cards = [
    ["Verificação", "Todo motorista que se candidata manda a CNH; o cartão traz RNTRC e foto do caminhão. Selo \"Verificado\" em todo lugar. É o antídoto do golpe que infesta o concorrente."],
    ["Venda da Sofrete", "Cada interesse num frete de empresa não cadastrada é uma apresentação da Sofrete feita por um caminhoneiro verificado, na hora em que ela mais precisa de caminhão."],
    ["Reputação", "Avaliação dos dois lados, só depois de frete fechado. Nota da empresa no anúncio; nota do motorista no cartão. Ninguém no mercado tem."],
  ];
  cards.forEach(([h, p], i) => {
    const x = 0.6 + i * 2.95;
    box(s, { x, y: 1.4, w: 2.75, h: 3.5, fill: { color: THEME.colors.dk1 }, objectName: "card " + h });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: 1.6, w: 0.55, h: 0.55, fill: { color: THEME.colors.accent1 }, line: { width: 0 }, objectName: "dot " + h });
    txt(s, String(i + 1), { x: x + 0.2, y: 1.6, w: 0.55, h: 0.55, fontSize: 18, bold: true, align: "center", valign: "middle", color: C.text1, fontFace: "Arial", objectName: "dot n " + h });
    txt(s, h, { x: x + 0.2, y: 2.3, w: 2.35, h: 0.45, fontSize: 18, bold: true, color: C.accent1, objectName: "h " + h });
    txt(s, p, { x: x + 0.2, y: 2.8, w: 2.35, h: 2.0, fontSize: 12.5, color: C.background1, valign: "top", objectName: "p " + h });
  });
}

// ---------- 9. MVP ordem (timeline)
pres.addSection({ title: "Plano" });
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Plano" });
  s.addText("O que entra no MVP, em ordem", { placeholder: "title" });
  const itens = [
    ["Fretes vivos", "robô diário ou só Sofrete", "1 dia", true],
    ["Pedágio pago pelo embarcador", "toggle no app, entendido pelo bot", "horas", true],
    ["Tenho interesse — etapa 1", "botão, CNH, cartão, mensagem pronta", "3 dias", true],
    ["Tenho interesse — etapas 2 a 5", "fases na Sofrete, disponível na busca, RNTRC, foto, avaliações", "9 dias", false],
    ["Tô vazio", "bot + app, expira em 24 h", "2 dias", false],
    ["Vários destinos", "no cálculo (app e bot)", "1 dia", false],
  ];
  s.addShape(pres.ShapeType.line, { x: 1.0, y: 1.55, w: 0, h: 3.45, line: { color: THEME.colors.accent1, width: 2 }, objectName: "linha" });
  itens.forEach(([h, p, d, agora], i) => {
    const y = 1.4 + i * 0.6;
    s.addShape(pres.ShapeType.ellipse, { x: 0.86, y: y + 0.12, w: 0.28, h: 0.28, fill: { color: agora ? THEME.colors.accent1 : THEME.colors.lt1 }, line: { color: THEME.colors.accent1, width: 2 }, objectName: "ponto " + (i + 1) });
    txt(s, h, { x: 1.4, y: y, w: 3.6, h: 0.5, fontSize: 15, bold: true, valign: "middle", objectName: "h " + (i + 1) });
    txt(s, p, { x: 5.0, y: y, w: 3.0, h: 0.5, fontSize: 12, color: C.accent6, valign: "middle", objectName: "p " + (i + 1) });
    box(s, { x: 8.2, y: y + 0.08, w: 1.2, h: 0.36, fill: { color: agora ? THEME.colors.accent1 : THEME.colors.lt2 }, objectName: "dias " + (i + 1) });
    txt(s, d, { x: 8.2, y: y + 0.08, w: 1.2, h: 0.36, fontSize: 12, bold: true, align: "center", valign: "middle", objectName: "dias txt " + (i + 1) });
  });
  txt(s, "Total ≈ 16 dias úteis. Os três primeiros (≈ 4 dias) já resolvem telefone, custo real e lista velha.", { x: 0.6, y: 4.95, w: 8.8, h: 0.3, fontSize: 11, italic: true, color: C.accent6, objectName: "total" });
  s.addNotes("A ordem vem da conclusão do concorrente: carga primeiro. Tô vazio só depois de ter frete vivo, senão vira cidade fantasma.");
}

// ---------- 10. PRO
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Plano" });
  s.addText("PRO: o código está pronto, falta a decisão", { placeholder: "title" });
  txt(s, "Tabela completa em Docs/decisoes-pagamento-2026-10-09.xlsx. Parado desde 09/10.", { x: 0.6, y: 1.2, w: 8.8, h: 0.35, fontSize: 12, color: C.accent6, objectName: "intro" });
  const hdr = { bold: true, color: THEME.colors.dk1, fill: { color: THEME.colors.accent1 }, fontSize: 12, fontFace: "Arial" };
  const c = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 11.5, color: THEME.colors.dk1, valign: "middle" }, o) });
  const rows = [
    [c("Decisão", hdr), c("Proposta", hdr), c("Por quê", hdr)],
    [c("Quem paga", { bold: true }), c("Motorista — plano \"Rode com Lucro PRO\""), c("É quem usa todo dia; a empresa entra depois")],
    [c("Modelo e preço", { bold: true }), c("Mensal, sugestão R$ 29,90; sem trial"), c("O grátis com limite já é a degustação")],
    [c("O que libera", { bold: true }), c("Fretes ilimitados + primeira mão (< 2 h) + WhatsApp sem limite"), c("Valor claro pra quem vive de carga")],
    [c("Limite do grátis", { bold: true }), c("5 consultas/dia no WhatsApp (hoje 20)"), c("Só cálculo, cotação e busca contam")],
    [c("Provedor / meio", { bold: true }), c("Stripe, só cartão; PIX pronto pra ligar depois"), c("Checkout hospedado; 3,99% + R$ 0,39")],
    [c("Onde compra", { bold: true }), c("Site/PWA e link no WhatsApp — nunca dentro do app da Play"), c("Play Billing custa 4× mais")],
    [c("Quando ligar", { bold: true }), c("Depois da semeadura (30–50 ativos)"), c("Cobrar antes do uso é cobrar de ninguém")],
  ];
  s.addTable(rows, { x: 0.6, y: 1.6, w: 8.8, colW: [1.8, 3.9, 3.1], rowH: 0.38, border: { type: "solid", color: "D8D2C2", pt: 0.5 }, fontFace: "Calibri", objectName: "tabela pro" });
  s.addNotes("Código dormente: migration aplicada, functions stripe-webhook e assinar, bot ASSINAR/PLANO, card no app. Nada aparece sem as chaves do Stripe. Precisa: fechar a tabela, abrir a conta Stripe, contador pra NFS-e.");
}

// ---------- 11. Fica pra depois
{
  const s = pres.addSlide({ masterName: "CLARO", sectionTitle: "Plano" });
  s.addText("O que fica pra depois, e o gatilho de cada um", { placeholder: "title" });
  const cards = [
    ["Comunidade dos Caminhoneiros", "Comunidade só de verificados, grátis, com anúncios, indicações, avaliações e encontros. Propaganda paga é a receita.", "Gatilho: 300 motoristas"],
    ["Google Play", "App na loja via TWA. Domínio próprio, conta de organização e D-U-N-S já pedidos.", "Gatilho: domínio + conta chegarem"],
    ["App Store", "Só com push/câmera nativos. Antes disso o PWA cobre o iPhone.", "Gatilho: Play no ar + demanda"],
  ];
  cards.forEach(([h, p, g], i) => {
    const x = 0.6 + i * 2.95;
    box(s, { x, y: 1.4, w: 2.75, h: 3.5, fill: { color: THEME.colors.lt2 }, objectName: "card " + h });
    txt(s, h, { x: x + 0.2, y: 1.6, w: 2.35, h: 0.7, fontSize: 16, bold: true, objectName: "h " + h });
    txt(s, p, { x: x + 0.2, y: 2.35, w: 2.35, h: 1.6, fontSize: 12.5, valign: "top", objectName: "p " + h });
    box(s, { x: x + 0.2, y: 4.1, w: 2.35, h: 0.55, fill: { color: THEME.colors.dk1 }, objectName: "g " + h });
    txt(s, g, { x: x + 0.3, y: 4.1, w: 2.15, h: 0.55, fontSize: 11, bold: true, color: C.accent1, valign: "middle", objectName: "g txt " + h });
  });
}

// ---------- 12. Decisões
pres.addSection({ title: "Decisões" });
{
  const s = pres.addSlide({ masterName: "ESCURO", sectionTitle: "Decisões" });
  s.addText("As 5 decisões de hoje", { placeholder: "title" });
  const dec = [
    ["Aprovar o \"Tenho interesse\" (21 itens) e a ordem do MVP", "fretes vivos → pedágio → interesse etapa 1 → resto"],
    ["CNH obrigatória pra se candidatar a um frete", "o interesse só chega ao embarcador depois da CNH lida"],
    ["Fechar a tabela do PRO", "preço, limite do grátis em 5, Stripe só cartão, ligar após semeadura"],
    ["Quem traz as 3 primeiras empresas pra Sofrete", "sem carga viva nada do resto funciona"],
    ["Fretes: robô diário ou só Sofrete", "os 810 de agosto saem do ar de qualquer jeito"],
  ];
  dec.forEach(([h, p], i) => {
    const y = 1.4 + i * 0.7;
    s.addShape(pres.ShapeType.rect, { x: 0.6, y: y + 0.1, w: 0.4, h: 0.4, fill: { color: THEME.colors.dk2 }, line: { color: THEME.colors.accent1, width: 2 }, objectName: "check " + (i + 1) });
    txt(s, h, { x: 1.2, y: y, w: 8.2, h: 0.32, fontSize: 16, bold: true, color: C.background1, objectName: "h " + (i + 1) });
    txt(s, p, { x: 1.2, y: y + 0.32, w: 8.2, h: 0.3, fontSize: 12, color: C.accent6, objectName: "p " + (i + 1) });
  });
}

// ---------- 13. Demo
{
  const s = pres.addSlide({ masterName: "ESCURO", sectionTitle: "Decisões" });
  s.addText("Demo ao vivo", { placeholder: "title" });
  txt(s, "Peguem o celular e mandem pro Rode com Lucro:", { x: 0.6, y: 1.5, w: 8.8, h: 0.4, fontSize: 16, color: C.background1, objectName: "cta" });
  box(s, { x: 0.6, y: 2.05, w: 8.8, h: 1.0, fill: { color: THEME.colors.accent1 }, objectName: "numero" });
  txt(s, "(11) 99991-9971  ·  \"Sinop pra Santos, 14 mil\"", { x: 0.8, y: 2.05, w: 8.4, h: 1.0, fontSize: 24, bold: true, color: C.text1, valign: "middle", fontFace: "Arial", objectName: "numero txt" });
  s.addText([
    { text: "Em segundos: custo real, lucro, piso ANTT e veredito — sem instalar nada", options: { bullet: true, breakLine: true } },
    { text: "Depois: \"tem carga saindo de Cuiabá?\" → lista de fretes → toque num → \"Mandar pra um colega\"", options: { bullet: true, breakLine: true } },
    { text: "Manda a foto da CNH → cadastro preenchido, imagem apagada, CPF nunca lido", options: { bullet: true } },
  ], { x: 0.6, y: 3.3, w: 8.8, h: 1.6, fontSize: 14, color: C.background1, paraSpaceAfter: 6, isTextBox: true, margin: 0, objectName: "roteiro" });
  s.addNotes("A demo vale mais que os slides. Deixar cada sócio mandar a própria rota.");
}

(async () => {
  const out = process.env.OUT;
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("ok", out);
})();

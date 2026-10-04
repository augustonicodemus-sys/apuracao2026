/* Página inicial — Câmara dos Deputados no Brasil: hemiciclo, partidos (atual / agora / garantidas) e top 20 */
(function () {
  "use strict";
  const T = window.TSE, M = window.Motor;
  const ANO = 2026, CARGO = 6, INTERVALO = 90; // s
  const TOTAL = 513;

  // Bancada em exercício na Câmara, por partido (API de Dados Abertos da Câmara, consulta de 03/10/2026)
  const BANCADA_ATUAL = { data: "03/10/2026", fonte: "Dados Abertos da Câmara dos Deputados",
    p: { PL: 98, PT: 65, "UNIÃO": 52, PSD: 48, PP: 46, REPUBLICANOS: 42, MDB: 38, PODE: 27, PSDB: 17, PSB: 17, PSOL: 13, PCdoB: 11, PDT: 9, PV: 6, NOVO: 5, AVANTE: 5, SOLIDARIEDADE: 4, REDE: 3, PRD: 3, CIDADANIA: 2, DC: 1, "MISSÃO": 1 } };

  // Federações de 2026 (reserva até os arquivos do TSE responderem; o TSE prevalece)
  const FED_RESERVA = { "FE BRASIL": ["PT", "PCDOB", "PV"], "PSOL/REDE": ["PSOL", "REDE"], "PSDB/CIDADANIA": ["PSDB", "CIDADANIA"], "UNIAO/PP": ["UNIAO", "PP"], "PRD/SOLIDARIEDADE": ["PRD", "SOLIDARIEDADE"] };

  const CORES = {
    "PL": "#1D3D8F", "FE BRASIL": "#D7263D", "PT": "#D7263D", "UNIAO/PP": "#3E86C9", "PSD": "#F2A900", "REPUBLICANOS": "#7CC7E8",
    "MDB": "#2F9E5B", "PODE": "#8CC63F", "PSDB/CIDADANIA": "#0E7C86", "PSB": "#F08CA8", "PSOL/REDE": "#F7D046", "PDT": "#A23B72",
    "NOVO": "#FF8C1A", "AVANTE": "#00B3A1", "PRD/SOLIDARIEDADE": "#8E6C3A", "MISSAO": "#6C3BAA", "DC": "#9C8FC4",
  };
  const EXTRAS = ["#B5838D", "#6D597A", "#99A88C", "#C9A227", "#5F7A8A", "#BC6C25", "#7A9E9F", "#A68A64", "#8D99AE", "#C08497"];
  const cor = (id) => CORES[id] || EXTRAS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % EXTRAS.length];

  const params = new URLSearchParams(location.search);
  const fonteLocal = params.get("src");
  let eleicao = params.get("eleicao") ? Number(params.get("eleicao")) : null;
  let nomeEleicao = "";
  let modo = null; // "agora" | "atual" | "garantidas"
  let ultimo = null, timer = null;

  const $ = (s) => document.querySelector(s);
  const fmt = M.fmt;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sigla = (p) => ({ PCDOB: "PCdoB", UNIAO: "União", MISSAO: "Missão" }[p] || p);
  const nomeLeg = (id) => id.split("/").map(sigla).join("/");

  // ------------------------------------------------------------ coleta e cálculo
  async function carregar() {
    const st = $("#status");
    st.textContent = "atualizando…"; st.className = "st busy";
    try {
      if (!eleicao && !fonteLocal) { const e = await T.descobrirEleicao(ANO, CARGO); eleicao = e.cd; nomeEleicao = e.nm; }
      const ufs = await Promise.all(T.UFS.map(async (u) => {
        try {
          const bruto = await T.getJson(fonteLocal || T.urlUf(ANO, eleicao, u, CARGO));
          const d = T.parseU(window.Sim ? Sim.aplicar(bruto, u) : bruto, CARGO);
          const soma = d.candidatos.reduce((s, c) => s + c.votos, 0) + Object.values(d.legenda).reduce((s, v) => s + v, 0);
          const res = M.calcular(d.candidatos, d.legenda, d.vagasTse || T.VAGAS[u], d.federacoes, d.vv > 0 && d.vv >= soma ? d.vv : null);
          const restantes = d.eleitoradoNaoApurado != null ? d.eleitoradoNaoApurado + d.vansj : (d.eleitorado || Infinity);
          return { u, d, res, gar: M.garantidas(res, Number.isFinite(restantes) ? restantes : 1e12) };
        } catch (e) { return { u, erro: e.message }; }
      }));
      ultimo = consolidar(ufs);
      render(ultimo);
      const falhas = ufs.filter((r) => r.erro).length;
      const hora = ufs.find((r) => !r.erro);
      st.textContent = (falhas ? `${falhas} estado(s) sem resposta do TSE agora · ` : "") +
        `TSE: ${hora ? hora.d.hora.trim() : "–"} · atualizado ${new Date().toLocaleTimeString("pt-BR")}` + (nomeEleicao ? ` · ${nomeEleicao}` : "");
      st.className = falhas ? "st erro" : "st";
    } catch (e) {
      st.textContent = "falha ao buscar no TSE: " + e.message + " — nova tentativa em " + INTERVALO + " s";
      st.className = "st erro";
    }
    clearTimeout(timer);
    timer = setTimeout(carregar, INTERVALO * 1000);
  }

  function consolidar(ufs) {
    const ok = ufs.filter((r) => !r.erro);
    // membro -> legenda (federação) a partir do TSE; reserva estática se faltar
    const fedDe = {};
    for (const [id, ps] of Object.entries(FED_RESERVA)) for (const p of ps) fedDe[p] = id;
    for (const r of ok) for (const [id, ps] of Object.entries(r.d.federacoes)) for (const p of ps) fedDe[p] = id;
    const legOf = (p) => fedDe[T.normSigla(p)] || T.normSigla(p);

    const linhas = {};
    const L = (id) => (linhas[id] = linhas[id] || { id, membros: new Set(), atual: 0, agora: 0, garantidas: 0, agoraPorPartido: {}, votos: 0, ufs15: 0, ufsCad: new Set() });
    for (const [p, n] of Object.entries(BANCADA_ATUAL.p)) { const x = L(legOf(p)); x.atual += n; x.membros.add(T.normSigla(p)); }
    let secoes = 0, nSec = 0, distribuidas = 0, garantidas = 0, validosBR = 0;
    const candidatos = [];
    for (const r of ok) {
      const p = parseFloat(String(r.d.pst || "0").replace(",", "."));
      if (!isNaN(p)) { secoes += p; nSec++; }
      validosBR += r.res.validos || 0;
      for (const Lg of Object.values(r.res.legendas)) {
        const tot = Lg.votosNominais + Lg.votosLegenda;
        if (!tot) continue;
        const x = L(Lg.id); x.votos += tot;
        if (r.res.validos && tot / r.res.validos * 100 >= M.CLAUSULA.pctUf) x.ufs15++;
      }
      for (const c of r.res.eleitos) {
        const x = L(c.legendaId); x.agora++; x.membros.add(c.partido); x.ufsCad.add(r.u);
        x.agoraPorPartido[c.partido] = (x.agoraPorPartido[c.partido] || 0) + 1; distribuidas++;
      }
      for (const [id, n] of Object.entries(r.gar.porLegenda)) { L(id).garantidas += n; garantidas += n; }
      for (const c of r.d.candidatos) if (c.votos > 0) candidatos.push({ ...c, uf: r.u, qe: r.res.qe });
    }
    for (const id of Object.keys(FED_RESERVA)) if (linhas[id]) for (const m of FED_RESERVA[id]) linhas[id].membros.add(m);
    candidatos.sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome));
    return {
      linhas: Object.values(linhas), distribuidas, garantidas, validosBR, falhas: ufs.length - ok.length,
      secoes: nSec ? secoes / nSec : 0, top: candidatos.slice(0, 20), comVotos: candidatos.length > 0,
    };
  }

  // ------------------------------------------------------------ hemiciclo (SVG)
  const LUGARES = (() => {
    const filas = 12, r0 = 0.44, r1 = 1;
    const raios = Array.from({ length: filas }, (_, i) => r0 + (r1 - r0) * i / (filas - 1));
    const somaR = raios.reduce((s, r) => s + r, 0);
    const porFila = raios.map((r) => Math.round(TOTAL * r / somaR));
    porFila[filas - 1] += TOTAL - porFila.reduce((s, n) => s + n, 0);
    const pts = [];
    raios.forEach((r, i) => { const n = porFila[i]; for (let j = 0; j < n; j++) { const a = Math.PI * (1 - j / (n - 1)); pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a }); } });
    pts.sort((p, q) => q.a - p.a || Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
    return pts;
  })();

  function hemiciclo(linhas, campo) {
    const ordem = linhas.filter((x) => x[campo] > 0).sort((a, b) => b[campo] - a[campo] || a.id.localeCompare(b.id));
    const cores = [];
    for (const x of ordem) for (let i = 0; i < x[campo]; i++) cores.push({ c: cor(x.id), t: `${nomeLeg(x.id)}: ${x[campo]}` });
    const usados = cores.length;
    const circ = LUGARES.map((p, i) => {
      const k = cores[i];
      return `<circle cx="${(p.x * 100).toFixed(2)}" cy="${(-p.y * 100).toFixed(2)}" r="2.55" fill="${k ? k.c : "var(--line)"}"><title>${k ? esc(k.t) : "cadeira ainda não definida"}</title></circle>`;
    }).join("");
    const rot = campo === "atual" ? "bancada atual" : campo === "agora" ? "se terminasse agora" : "matematicamente garantidas";
    return `<svg viewBox="-104 -104 208 110" role="img" aria-label="Câmara dos Deputados, ${rot}: ${usados} de ${TOTAL} cadeiras">${circ}
      <text x="0" y="-13" text-anchor="middle" class="h-num">${usados}</text><text x="0" y="-3" text-anchor="middle" class="h-rot">de ${TOTAL} cadeiras</text></svg>`;
  }

  // ------------------------------------------------------------ render
  function render(R) {
    if (!modo) modo = R.distribuidas ? "agora" : "atual";
    document.querySelectorAll("#modos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === modo)));
    $("#camara").innerHTML = hemiciclo(R.linhas, modo);
    $("#k-secoes").textContent = R.secoes.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    $("#k-agora").textContent = `${TOTAL}`;
    $("#k-gar").textContent = `${R.garantidas}`;
    $("#nota-camara").textContent = !R.comVotos ? "A apuração ainda não começou: o hemiciclo mostra a bancada atual. Quando os votos chegarem, ele passa a mostrar quem estaria eleito agora." :
      (R.falhas ? `${R.falhas} estado(s) não responderam nesta atualização; os totais estão incompletos.` : "");

    // tabela de partidos
    const linhas = [...R.linhas].sort((a, b) => b.agora - a.agora || b.garantidas - a.garantidas || b.atual - a.atual || a.id.localeCompare(b.id));
    const tAt = linhas.reduce((s, x) => s + x.atual, 0);
    const delta = (x) => { if (!R.comVotos) return ""; const d = x.agora - x.atual; return `<span class="d ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${d}</span>`; };
    const pc1 = (x) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    $("#partidos").innerHTML = `<table><thead><tr><th class="l">Partido / federação</th><th title="Deputados em exercício hoje">Atual</th><th title="Cadeiras se a apuração terminasse agora">Agora</th><th title="Cadeiras que nenhum resultado das urnas ainda não apuradas pode tirar">Garant.</th><th title="Votos válidos para deputado federal no Brasil (meta da cláusula: 2,5%)">% Brasil</th><th title="Estados em que a legenda tem pelo menos 1,5% dos votos válidos (meta: 9)">UFs ≥1,5%</th><th title="Cláusula de barreira se a apuração terminasse agora">Cláusula</th></tr></thead><tbody>` +
      linhas.map((x) => {
        const membros = [...x.membros].filter((m) => m !== x.id);
        const sub = membros.length > 1 ? `<small>${membros.map((m) => sigla(m) + (x.agoraPorPartido[m] ? " " + x.agoraPorPartido[m] : "")).join(" · ")}</small>` : "";
        let pctTd = "–", ufTd = "–", clTd = "–";
        if (R.comVotos) {
          const c = M.clausula({ votos: x.votos, validos: R.validosBR, ufs15: x.ufs15, deputados: x.agora, ufsDeputados: x.ufsCad.size });
          pctTd = `<span class="${c.pct >= M.CLAUSULA.pctBrasil ? "okc" : ""}">${pc1(c.pct)}</span>`;
          ufTd = `<span class="${x.ufs15 >= M.CLAUSULA.minUfs ? "okc" : ""}">${x.ufs15}</span>`;
          const por = c.porVotos && c.porEleitos ? "por votos e por eleitos" : c.porVotos ? "por votos (2,5% e 1,5% em 9 UFs)" : c.porEleitos ? `por eleitos (${x.agora} deputados em ${x.ufsCad.size} UFs)` : `não atinge: ${pc1(c.pct)} no Brasil e ${x.ufs15} UFs com 1,5%; ${x.agora} deputados em ${x.ufsCad.size} UFs`;
          clTd = c.ok ? `<span class="cl sim" title="Passa ${por}">✓</span>` : `<span class="cl nao" title="${por}">✗</span>`;
        }
        return `<tr><td class="l"><i class="dot" style="background:${cor(x.id)}"></i><b>${esc(nomeLeg(x.id))}</b>${sub}</td><td>${x.atual || "–"}</td><td><b>${x.agora || "–"}</b>${delta(x)}</td><td>${x.garantidas || "–"}</td><td>${pctTd}</td><td>${ufTd}</td><td class="c">${clTd}</td></tr>`;
      }).join("") +
      `</tbody><tfoot><tr><td class="l">Total</td><td>${tAt}</td><td>${R.distribuidas}</td><td>${R.garantidas}</td><td></td><td></td><td></td></tr></tfoot></table><p class="nota">Cláusula de barreira 2026: ✓ com 2,5% dos votos válidos no Brasil e 1,5% em pelo menos 9 estados — ou com 13 deputados eleitos em pelo menos 9 estados. Federações contam como um partido só. Passe o mouse sobre ✓/✗ para ver o critério.</p>`;

    // top 20
    $("#top").innerHTML = R.top.length ? `<table><thead><tr><th>#</th><th class="l">Candidato</th><th class="l">Partido</th><th>Votos</th></tr></thead><tbody>` +
      R.top.map((c, i) => `<tr><td class="m">${i + 1}</td><td class="l nm" title="${esc(c.nome)}">${c.eleito ? '<span class="ok" title="eleito se a apuração terminasse agora">✓</span> ' : '<span class="ok-n">✓</span> '}${esc(c.urna || c.nome)}</td><td class="l pt"><i class="dot" style="background:${cor(c.legendaId || c.partido)}"></i>${esc(sigla(c.partido))}<small>${c.uf}</small></td><td>${fmt(c.votos)}</td></tr>`).join("") +
      `</tbody></table><p class="nota"><span class="ok">✓</span> eleito se a apuração terminasse agora</p>` : '<p class="vazio">Sem votos apurados ainda. O ranking aparece quando a totalização começar.</p>';
  }

  // ------------------------------------------------------------ eventos
  function init() {
    document.querySelectorAll("#modos button").forEach((b) => b.addEventListener("click", () => { modo = b.dataset.m; if (ultimo) render(ultimo); }));
    $("#atualizar").addEventListener("click", carregar);
    $("#fonte-atual").textContent = `${BANCADA_ATUAL.fonte}, ${BANCADA_ATUAL.data}`;
    carregar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

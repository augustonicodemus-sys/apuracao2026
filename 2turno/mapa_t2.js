/* Mapa das páginas do 2º turno: Brasil por estado → estado por município, 1º ou 2º turno.
 * Chamado por t2.js a cada atualização: MapaT2.atualizar({ corrida, uf, d1, d2, ufs, aoVivo }).
 * 1º turno por município: arquivos gerados (../dados/2026/{presidente|governador}_t1/{uf}.json).
 * 2º turno por município: arquivos do TSE, um por município, buscados só para o estado aberto,
 * de novo a cada 3 min e só para os que ainda não chegaram a 100% das seções. */
(function () {
  "use strict";
  const T = window.TSE, M = window.Mapa, S = window.Sim, BASE = "../";
  const ANO = 2026, REFAZ_MUN = 180e3, PARALELO = 10;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => (Math.round(n) || 0).toLocaleString("pt-BR");
  const pct = (x, d = 1) => { if (Math.abs(x - 0.5) < 0.0005) d = 2; return (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%"; };
  const pp = (x) => (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " p.p.";
  const simAtivo = !!(S && S.ativo);
  const PARTIDO_COR = { PL: "#12286B", PT: "#D7263D", PSD: "#8B5E3C", MDB: "#A47551", UNIAO: "#3F8FD8", "UNIÃO": "#3F8FD8", PP: "#6FB4EA", REPUBLICANOS: "#8DCBF0", NOVO: "#FF7A00", PSOL: "#7B2CBF", PSB: "#2E8B57", PDT: "#5DAE6B", PSDB: "#6E7C91", PODE: "#7D8590", "MISSÃO": "#F2C230", MISSAO: "#F2C230", DC: "#B3DCF5", PCO: "#9CCC65", PSTU: "#6E9F3F", UP: "#4F9A5E", AVANTE: "#6B5B4E" };
  // vantagem compacta: até 999 votos o número exato; daí em diante em milhares ("+1.100K")
  const fmtK = (n) => { n = Math.round(Math.abs(n)) || 0; return n < 1000 ? n.toLocaleString("pt-BR") : Math.round(n / 1000).toLocaleString("pt-BR") + "K"; };
  const curto = (nome) => { const w = String(nome).split(" "); return /^Profess/.test(w[0]) && w[1] ? w[1] : w[0]; };
  const slug = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const tituloNome = (s) => String(s).toLowerCase().replace(/(^|[\s'-])(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E|D')\b/g, (m) => m.toLowerCase());

  let E = null; // estado da tela
  const cacheT1 = {}, cacheT2 = {}; // por uf

  // ------------------------------------------------------------ candidatos e cores
  function quem(n, partido, nome) {
    const f = E.corrida.fin[String(n)];
    if (f) return { nome: f[0], partido: f[1], cor: f[2] };
    const sg = String(partido || "").toUpperCase();
    return { nome: tituloNome(nome || "Nº " + n), partido: partido || "", cor: PARTIDO_COR[sg] || "#9AA3AE" };
  }
  // valores de uma área: {votos:{n:v}, vv, nomes:{n:[nome,partido]}} → ordem, líder, vantagem
  function analisa(x) {
    const ord = Object.entries(x.votos || {}).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);
    const vv = x.vv || ord.reduce((s, c) => s + c.v, 0);
    if (!vv || !ord.length || !ord[0].v) return { vv: 0, ord };
    const dif = ord[0].v - (ord[1] ? ord[1].v : 0);
    return { vv, ord, lider: ord[0].n, vant: dif / vv, dif };
  }
  function corArea(x) {
    const a = analisa(x);
    if (!a.vv) return "#E3E7ED";
    const q = quem(a.lider, (x.nomes && x.nomes[a.lider] || [])[1], (x.nomes && x.nomes[a.lider] || [])[0]);
    return M.tom(q.cor, a.vant);
  }

  // ------------------------------------------------------------ dados: estados (já carregados por t2.js)
  function deParse(d) { // saída de TSE.parseMaj → formato do mapa
    if (!d) return null;
    const votos = {}, nomes = {};
    for (const c of d.cands) { votos[c.numero] = c.votos; nomes[c.numero] = [c.urna, c.partido]; }
    return { votos, nomes, vv: d.vv, pst: d.pst, te: d.eleitorado, hora: d.hora };
  }
  function valoresEstados() {
    const out = {};
    for (const x of E.ufs || []) {
      const d = E.turno === 1 ? x.d1 : x.d2;
      let v = deParse(d);
      if (!v && E.turno === 2 && x.d1) v = { votos: {}, nomes: {}, vv: 0, pst: "0,00", te: x.d1.eleitorado }; // 2º turno antes da apuração: estado listado com 0%
      if (!v) continue;
      out[codUF(x.u)] = Object.assign(v, { nome: T.NOMES[x.u], uf: x.u });
    }
    return out;
  }
  const UF_COD = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
  const codUF = (u) => String(UF_COD[u]);
  const ufDeCod = (c) => Object.keys(UF_COD).find((u) => String(UF_COD[u]) === String(c));

  // ------------------------------------------------------------ dados: municípios
  async function muniT1(uf) {
    if (!cacheT1[uf]) cacheT1[uf] = fetch(`${BASE}dados/2026/${E.arquivoT1}/${uf.toLowerCase()}.json`).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((j) => {
      const nomes = {}; j.c.forEach(([n, nome, p]) => { nomes[n] = [nome, p]; });
      const m = {};
      for (const [cdi, a] of Object.entries(j.m)) {
        const [nome, te, c, vv, pst, ...vs] = a, votos = {};
        j.c.forEach(([n], i) => { votos[n] = vs[i] || 0; });
        m[cdi] = { nome, te, c, vv, pst, votos, nomes };
      }
      return m;
    });
    return cacheT1[uf];
  }
  // lista de municípios do TSE (código TSE → código IBGE), uma vez por eleição
  const listas = {};
  async function listaMun(ele) {
    if (!listas[ele]) listas[ele] = T.getJson(`${T.BASE}/ele${ANO}/${ele}/config/mun-e${String(ele).padStart(6, "0")}-cm.json`).catch(() => null);
    return listas[ele];
  }
  async function muniT2(uf, forcar) {
    const c = cacheT2[uf] || (cacheT2[uf] = { m: {}, quando: 0, carregando: false, falta: null, erro: "" });
    if (c.carregando || (!forcar && Date.now() - c.quando < REFAZ_MUN)) return c;
    c.carregando = true;
    try {
      let lista = await listaMun(E.corrida.e2);
      let abr = lista && lista.abr.find((a) => a.cd === uf.toLowerCase());
      if (!abr) { const l1 = await listaMun(E.corrida.e1); abr = l1 && l1.abr.find((a) => a.cd === uf.toLowerCase()); }
      if (!abr) throw new Error("lista de municípios indisponível");
      const pend = abr.mu.filter((m) => !(c.m[m.cdi] && c.m[m.cdi].pst === "100,00"));
      let i = 0, feitos = 0, falhas = 0;
      const prog = () => { c.falta = pend.length - feitos; atualizarSub(); };
      const trab = async () => {
        while (i < pend.length) {
          const m = pend[i++];
          const url = `${T.BASE}/ele${ANO}/${E.corrida.e2}/dados/${uf.toLowerCase()}/${uf.toLowerCase()}${m.cd}-c${String(E.corrida.cargo).padStart(4, "0")}-e${String(E.corrida.e2).padStart(6, "0")}-u.json`;
          try {
            let d = await T.getJson(url);
            if (simAtivo) d = S.aplicar(d, uf + m.cd);
            const p = T.parseMaj(d, E.corrida.cargo), v = deParse(p);
            c.m[m.cdi] = Object.assign(v, { nome: tituloNome(m.nm), hora: p.hora.trim() });
          } catch (e) { falhas++; if (!c.m[m.cdi]) c.m[m.cdi] = { nome: tituloNome(m.nm), votos: {}, vv: 0, erro: true }; }
          feitos++; if (feitos % 25 === 0) { prog(); if (E.nivel === uf && E.turno === 2) desenharNivel(); }
        }
      };
      await Promise.all(Array.from({ length: PARALELO }, trab));
      c.quando = Date.now(); c.falta = 0;
      c.erro = falhas ? `${falhas} município(s) sem resposta do TSE agora` : "";
    } catch (e) { c.erro = e.message; }
    c.carregando = false;
    return c;
  }

  // ------------------------------------------------------------ desenho
  function atualizarSub() {
    const sub = $("#mapa-sub"); if (!sub) return;
    const t = E.turno === 1 ? "1º turno · resultado final" : E.aoVivo ? "2º turno" : "2º turno · apuração a partir das 17h de 25/10";
    if (E.nivel === "BR") { sub.textContent = `${t} · clique no estado para ver municípios`; return; }
    let s = `${t} · por município`;
    if (E.turno === 2) {
      const c = cacheT2[E.nivel];
      if (c && c.carregando) s += ` · carregando municípios… faltam ${c.falta == null ? "–" : c.falta}`;
      else if (c && c.quando) s += ` · municípios atualizados às ${new Date(c.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` + (E.horaEstado ? ` · total do estado: TSE ${E.horaEstado}` : "") + (c.erro ? ` · ${c.erro}` : "");
    }
    sub.textContent = s;
  }

  let svgAtual = null, valoresAtuais = {}, desenhando = 0;
  async function desenharNivel() {
    const meu = ++desenhando;
    const nivel = E.nivel, br = nivel === "BR";
    let vals = {};
    try {
      if (br) vals = valoresEstados();
      else if (E.turno === 1) vals = await muniT1(nivel);
      else if (!E.aoVivo) vals = {}; // 2º turno ainda sem votos: mapa cinza
      else { const c = cacheT2[nivel] || await muniT2(nivel); vals = c.m; if (!c.quando && !c.carregando) muniT2(nivel); }
    } catch (e) { $("#mapa").innerHTML = `<p class="aviso">Sem dados para o mapa agora (${esc(e.message)}).</p>`; return; }
    let geo;
    try { geo = await M.carregar(BASE, br ? "br" : nivel.toLowerCase()); } catch (e) { $("#mapa").innerHTML = `<p class="aviso">${esc(e.message)}</p>`; return; }
    if (meu !== desenhando) return;
    valoresAtuais = vals;
    if (E.selSlug && !br) { const c = Object.keys(vals).find((k) => slug(vals[k].nome) === E.selSlug); if (c) E.sel = c; E.selSlug = null; }
    svgAtual = M.desenhar($("#mapa"), geo, {
      rotulo: br ? "Mapa do Brasil por estado" : `Mapa de ${T.NOMES[nivel]} por município`,
      sel: E.sel,
      cor: (cod) => vals[cod] ? corArea(vals[cod]) : "#E3E7ED",
      dica: (cod) => dicaHtml(cod, vals[cod], br),
      clique: (cod) => br ? abrir(ufDeCod(cod)) : selecionar(cod, false),
    });
    $("#mapa").classList.toggle("mun", !br);
    trilha(); legenda(vals); lista(vals); atualizarSub();
    if (E.sel && !br) detalhe(E.sel);
  }

  function dicaHtml(cod, x, br) {
    const nome = br ? (x && x.nome) || "" : (x && x.nome) || "";
    if (!x || !analisa(x).vv) return `<b>${esc(nome || "sem dados")}</b><br><small>sem votos apurados</small>`;
    const a = analisa(x);
    const linhas = a.ord.slice(0, 3).map((c) => { const q = quem(c.n, (x.nomes[c.n] || [])[1], (x.nomes[c.n] || [])[0]); return `<div><i class="dot" style="background:${q.cor}"></i>${esc(q.nome)} <b>${pct(c.v / a.vv)}</b></div>`; }).join("");
    const ql = quem(a.lider, (x.nomes[a.lider] || [])[1], (x.nomes[a.lider] || [])[0]);
    return `<b>${esc(nome)}</b>${x.pst && x.pst !== "100,00" ? ` <small>${x.pst}% das seções</small>` : ""}${linhas}<small>vantagem: ${esc(curto(ql.nome))} +${fmt(a.dif)} votos</small>`;
  }

  function trilha() {
    const el = $("#mapa-trilha"); if (!el) return;
    el.classList.toggle("so-br", E.nivel === "BR");
    if (E.nivel === "BR") { el.innerHTML = "<b>Brasil</b>"; return; }
    const gov = E.podeBrasil && window.T2 && T2.GOV.includes(E.nivel) ? ` <a class="mapa-gov" href="governador-${E.nivel.toLowerCase()}.html${simAtivo ? "?sim=" + S.pct : ""}">Governador de ${E.nivel} no 2º turno →</a>` : "";
    el.innerHTML = (E.podeBrasil ? `<button type="button" class="volta-br" data-ir="BR" title="Voltar ao mapa do Brasil"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 3l6 1 4 3 4 2-1 4-4 3-2 5-4 1-2-4-3-2 1-4-3-3 2-4z" fill="currentColor"/></svg> Voltar ao Brasil</button> ` : "") + `<b>${esc(T.NOMES[E.nivel])}</b>` + gov;
    const a = el.querySelector("[data-ir]"); if (a) a.addEventListener("click", (ev) => { ev.preventDefault(); abrir("BR"); });
  }

  function legenda(vals) {
    const el = $("#mapa-leg"); if (!el) return;
    const conta = {};
    for (const x of Object.values(vals)) { const a = analisa(x); if (a.vv) conta[a.lider] = (conta[a.lider] || 0) + 1; }
    const amostra = Object.values(vals).find((x) => x.nomes) || { nomes: {} };
    const itens = Object.entries(conta).sort((a, b) => b[1] - a[1]).map(([n, k]) => {
      const q = quem(n, (amostra.nomes[n] || [])[1], (amostra.nomes[n] || [])[0]);
      return `<span><i class="dot" style="background:${q.cor}"></i>${esc(q.nome)} <b>${k}</b></span>`;
    }).join("");
    el.innerHTML = (itens ? `<span class="leg-t">${E.nivel === "BR" ? "Estados" : "Municípios"} em que lidera:</span>${itens}` : "") +
      `<span class="leg-tons">quanto mais forte a cor, mais folgada a vitória (diferença de menos de 5, de 5 a 15 ou de mais de 15 pontos percentuais)</span>`;
  }

  function lista(vals) {
    const el = $("#mapa-lista"); if (!el) return;
    const [na, nb] = E.corrida.nums;
    const qa = quem(na), qb = quem(nb);
    const filtro = ($("#mapa-filtro") && $("#mapa-filtro").value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const br = E.nivel === "BR";
    let linhas = Object.entries(vals).map(([cod, x]) => ({ cod, x, a: analisa(x) }));
    if (filtro) linhas = linhas.filter((l) => String(l.x.nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(filtro));
    linhas.sort((p, q) => (q.x.te || q.a.vv) - (p.x.te || p.a.vv));
    const vez = (x, n) => x.votos && x.vv ? pct((x.votos[n] || 0) / x.vv) : "–";
    const t2 = E.turno === 2 && !br;
    const sec = (p) => { const n = parseFloat(String(p == null ? "" : p).replace(",", ".")); return isFinite(n) ? (n >= 100 ? "100%" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%") : "–"; };
    const corpo = linhas.map(({ cod, x, a }) => {
      let lid = "–";
      if (a.vv) { const q = quem(a.lider, (x.nomes[a.lider] || [])[1], (x.nomes[a.lider] || [])[0]); lid = `<span title="${esc(q.nome)} +${fmt(a.dif)} votos"><i class="dot" style="background:${q.cor}"></i>+${fmtK(a.dif)}</span>`; }
      return `<tr data-cod="${cod}" class="clic${cod === E.sel ? " sel" : ""}"><td class="l">${br && x.uf ? `<span class="nm-l">${esc(x.nome)}</span><span class="nm-c">${x.uf}</span>` : esc(x.nome || cod)}</td><td>${vez(x, na)}</td><td>${vez(x, nb)}</td><td class="l">${lid}</td>${br ? `<td>${sec(x.pst)}</td>` : ""}${t2 ? `<td>${x.pst ? x.pst + "%" : "–"}</td><td>${x.hora ? esc(x.hora.split(" ").pop().slice(0, 5)) : "–"}</td>` : ""}</tr>`;
    }).join("");
    el.innerHTML = `<table><thead><tr><th class="l">${br ? "Estado" : "Município"}</th><th>${esc(curto(qa.nome))}</th><th>${esc(curto(qb.nome))}</th><th class="l" title="Diferença de votos para o 2º colocado; K = mil votos">Vantagem</th>${br ? '<th title="Seções apuradas no estado">Seções</th>' : ""}${t2 ? "<th>Seções</th><th>TSE</th>" : ""}</tr></thead><tbody>${corpo || `<tr><td colspan="6" class="l">${filtro ? "nenhum município com esse nome" : E.turno === 2 && !E.aoVivo ? "a apuração do 2º turno começa às 17h de 25/10" : "carregando…"}</td></tr>`}</tbody></table>`;
    const f = $("#mapa-filtro"); if (f) f.hidden = br;
  }

  function detalhe(cod) {
    const el = $("#mapa-det"); if (!el) return;
    const x = valoresAtuais[cod];
    if (!x) { el.innerHTML = ""; return; }
    const a = analisa(x);
    if (!a.vv) { el.innerHTML = `<h3>${esc(x.nome)}</h3><p class="vazio">Sem votos apurados ainda.</p>`; return; }
    const max = a.ord[0].v / a.vv;
    const barras = a.ord.filter((c) => c.v > 0).slice(0, 8).map((c) => {
      const q = quem(c.n, (x.nomes[c.n] || [])[1], (x.nomes[c.n] || [])[0]);
      return `<div class="cb in"><div class="cn"><i class="dot" style="background:${q.cor}"></i><b>${esc(q.nome)}</b> <small>${esc(q.partido)}</small></div><div class="ct"><div class="cf" style="width:${(c.v / a.vv / max * 100).toFixed(1)}%;background:${q.cor}"></div></div><div class="cv"><b>${pct(c.v / a.vv)}</b> <small>${fmt(c.v)}</small></div></div>`;
    }).join("");
    const extra = [x.vv ? `${fmt(x.vv)} votos válidos` : "", x.te ? `${fmt(x.te)} eleitores` : "", x.c ? `comparecimento ${pct(x.c / x.te)}` : "", x.pst && x.pst !== "100,00" ? `${x.pst}% das seções` : "", x.hora && E.turno === 2 ? `TSE ${esc(x.hora)}` : ""].filter(Boolean).join(" · ");
    el.innerHTML = `<h3>${esc(x.nome)} <small>${E.turno}º turno</small></h3><div class="cbs">${barras}</div><p class="nota">${extra}</p>`;
  }

  function selecionar(cod, rolar) {
    E.sel = cod; M.selecionar(svgAtual, cod);
    document.querySelectorAll("#mapa-lista tr.sel").forEach((t) => t.classList.remove("sel"));
    const tr = document.querySelector(`#mapa-lista tr[data-cod="${cod}"]`);
    if (tr) { tr.classList.add("sel"); if (rolar !== false) tr.scrollIntoView({ block: "nearest" }); }
    detalhe(cod); urlEstado();
  }
  function abrir(nivel) {
    E.nivel = nivel; E.sel = null; M.esconderDica();
    const f = $("#mapa-filtro"); if (f) f.value = "";
    $("#mapa-det").innerHTML = "";
    if (nivel !== "BR" && E.turno === 2 && E.aoVivo) muniT2(nivel, true).then(() => { if (E.nivel === nivel) desenharNivel(); });
    desenharNivel(); urlEstado();
  }
  function urlEstado() {
    const q = new URLSearchParams(location.search);
    if (E.nivel !== "BR" && E.podeBrasil) q.set("mapa", E.nivel.toLowerCase()); else q.delete("mapa");
    q.delete("mun");
    if (E.turno === 1) q.set("turno", "1"); else q.delete("turno");
    const xs = E.sel && valoresAtuais[E.sel];
    if (xs && E.nivel !== "BR") q.set("cidade", slug(xs.nome)); else q.delete("cidade");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
  }
  function botoesTurno() {
    document.querySelectorAll("#mapa-turnos button, .turno-chave button").forEach((b) => {
      const t = Number(b.dataset.t);
      b.setAttribute("aria-pressed", String(t === E.turno));
      b.disabled = false;
      b.title = t === 2 && !E.aoVivo ? "A apuração do 2º turno começa às 17h de 25/10: até lá o mapa fica cinza" : "";
    });
  }

  // ------------------------------------------------------------ turno (o mesmo para o cartão de cima e o mapa)
  function turnoInicial() { const t = new URLSearchParams(location.search).get("turno"); return t === "1" ? 1 : 2; }
  function mudarTurno(t) {
    if (!E || t === E.turno) return;
    E.turno = t; botoesTurno(); abrir(E.nivel);
    window.dispatchEvent(new CustomEvent("t2-turno", { detail: t }));
  }

  // ------------------------------------------------------------ entrada
  function atualizar({ corrida, uf, ufs, aoVivo, horaEstado, total }) {
    const primeira = !E;
    if (primeira) {
      const q = new URLSearchParams(location.search);
      const podeBrasil = uf === "BR";
      let nivel = podeBrasil ? "BR" : uf;
      const pedido = (q.get("mapa") || "").toUpperCase();
      if (podeBrasil && T.NOMES[pedido]) nivel = pedido;
      E = { corrida, podeBrasil, nivel, sel: q.get("mun") || null, selSlug: q.get("cidade") || null, total, turno: turnoInicial(), aoVivo, ufs, arquivoT1: corrida.cargo === 1 ? "presidente_t1" : "governador_t1" };
      document.querySelectorAll("#mapa-turnos button, .turno-chave button").forEach((b) => b.addEventListener("click", () => mudarTurno(Number(b.dataset.t))));
      $("#mapa-filtro").addEventListener("input", () => lista(valoresAtuais));
      $("#mapa-lista").addEventListener("click", (ev) => {
        const tr = ev.target.closest("tr[data-cod]"); if (!tr) return;
        if (E.nivel === "BR") abrir(ufDeCod(tr.dataset.cod)); else selecionar(tr.dataset.cod, false);
      });
    }
    Object.assign(E, { ufs, aoVivo, horaEstado, total });
    botoesTurno();
    if (E.turno === 2 && E.nivel !== "BR") muniT2(E.nivel).then(() => desenharNivel());
    desenharNivel();
  }

  // ------------------------------------------------------------ Story do Instagram
  function somar(vals) { const v = {}, nomes = {}; let vv = 0; for (const x of Object.values(vals)) { vv += x.vv || 0; for (const [n, k] of Object.entries(x.votos || {})) v[n] = (v[n] || 0) + k; Object.assign(nomes, x.nomes || {}); } return { votos: v, vv, nomes }; }
  window.StoryDados = function () {
    if (!E) return { selo: "2º TURNO · 25/10", titulo: "Eleições 2026", sub: "", linhas: [], svg: null };
    const cargo = E.corrida.cargo === 1 ? "Presidente" : "Governador";
    const turno = E.turno === 1 ? "1º turno · resultado final" : "2º turno · apuração";
    let x, titulo, arq;
    if (E.sel && E.nivel !== "BR" && valoresAtuais[E.sel]) { x = valoresAtuais[E.sel]; titulo = `${x.nome} (${E.nivel})`; arq = slug(x.nome); }
    else if (E.nivel === "BR") { const d = E.total && (E.turno === 1 ? E.total.d1 : E.total.d2); x = d ? deParse(d) : somar(valoresAtuais); titulo = "Brasil"; arq = "brasil"; }
    else { const u = (E.ufs || []).find((y) => y.u === E.nivel); const d = u ? (E.turno === 1 ? u.d1 : u.d2) : (E.total && (E.turno === 1 ? E.total.d1 : E.total.d2)); x = d ? deParse(d) : somar(valoresAtuais); titulo = T.NOMES[E.nivel]; arq = slug(titulo); }
    const a = analisa(x);
    const linhas = a.ord.filter((c) => c.v > 0).slice(0, E.turno === 1 ? 3 : 2).map((c) => { const q = quem(c.n, (x.nomes[c.n] || [])[1], (x.nomes[c.n] || [])[0]); return { nome: q.nome, partido: q.partido, cor: q.cor, pct: a.vv ? c.v / a.vv : 0, votos: c.v }; });
    const lider = linhas[0];
    return {
      selo: E.turno === 1 ? "1º TURNO 2026" : "2º TURNO · AO VIVO", titulo, sub: `${cargo} · ${turno}`, linhas, svg: document.querySelector("#mapa svg"), arquivo: arq,
      rodape: E.nivel === "BR" ? "Veja o seu estado e a sua cidade:" : "Veja a sua cidade no mapa:",
      textoCompartilhar: lider ? `${titulo}: ${lider.nome} ${(lider.pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% para ${cargo.toLowerCase()} (${E.turno}º turno), no mapa do Radar Numérico` : document.title,
    };
  };

  window.MapaT2 = { atualizar, turno: () => (E ? E.turno : turnoInicial()) };
})();

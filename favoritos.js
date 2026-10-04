/* "Meus candidatos": o visitante escolhe candidatos de qualquer cargo e estado e acompanha a situação de cada um.
 * A lista fica no navegador (localStorage) e pode ser compartilhada por link (?f=6-SP-1234,5-RJ-555).
 * Só busca no TSE os arquivos dos cargos/estados que estão na lista ou na busca. */
(function () {
  "use strict";
  const T = window.TSE, M = window.Motor;
  const ANO = 2026, INTERVALO = 60, CHAVE = "rn_favoritos_2026";
  const NOME_CARGO = { 6: "Deputado Federal", 7: "Deputado Estadual", 5: "Senador", 3: "Governador", 1: "Presidente" };
  const VAGAS_EST = { AC: 24, AL: 27, AP: 24, AM: 24, BA: 63, CE: 46, DF: 24, ES: 30, GO: 41, MA: 42, MT: 24, MS: 24, MG: 77, PA: 41, PB: 36, PR: 54, PE: 49, PI: 30, RJ: 70, RN: 24, RS: 55, RO: 24, RR: 24, SC: 40, SP: 94, SE: 24, TO: 24 };
  const PROP = (c) => c === 6 || c === 7;
  const cargoReal = (c, uf) => (c === 7 && uf === "DF" ? 8 : c);

  const $ = (s) => document.querySelector(s);
  const fmt = M.fmt;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (x, d = 1) => (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
  const sigla = (p) => ({ PCDOB: "PCdoB", UNIAO: "União", MISSAO: "Missão", "S/PARTIDO": "sem partido" }[p] || p);
  const norm = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const CORES = {
    "PL": "#12286B", "PT": "#D7263D", "MISSAO": "#F2C230", "PSOL": "#7B2CBF", "NOVO": "#FF7A00", "PSB": "#2E8B57", "PDT": "#5DAE6B", "PCDOB": "#1B6E3A", "PV": "#8BC58F", "REDE": "#A8D5A2", "PCO": "#9CCC65", "PSTU": "#6E9F3F", "UP": "#4F9A5E", "UNIAO": "#3F8FD8", "PP": "#6FB4EA", "REPUBLICANOS": "#8DCBF0", "DC": "#B3DCF5", "PRTB": "#5FA8D3", "DEMOCRATA": "#A3C9E8", "PSD": "#8B5E3C", "MDB": "#A47551", "PODE": "#7D8590", "PSDB": "#9AA3AE", "CIDADANIA": "#B8BFC7", "AVANTE": "#6B5B4E", "SOLIDARIEDADE": "#C2A07E", "PRD": "#8C7B6B",
  };
  const EXTRAS = ["#9E9E9E", "#B7A99A", "#7F8C8D", "#A1887F", "#BDBDBD", "#8D7B6A", "#90A4AE", "#C2B8A3", "#757575", "#A69C90"];
  const cor = (p) => CORES[p] || EXTRAS[[...String(p)].reduce((s, c) => s + c.charCodeAt(0), 0) % EXTRAS.length];
  const dot = (p) => `<i class="dot" style="background:${cor(p)}"></i>`;

  // ------------------------------------------------------------ lista (navegador + link)
  const idDe = (f) => `${f.c}-${f.uf}-${f.n}`;
  const deId = (s) => { const m = String(s).trim().match(/^(1|3|5|6|7)-([A-Z]{2})-(\d{2,6})$/i); return m ? { c: Number(m[1]), uf: m[2].toUpperCase(), n: m[3] } : null; };
  function lerLista() {
    let l = [];
    try { l = JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch (e) { l = []; }
    return Array.isArray(l) ? l.filter((f) => f && deId(idDe(f))) : [];
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { /* navegador sem armazenamento: a lista vale só nesta visita */ } }
  let lista = lerLista();
  const doLink = new URLSearchParams(location.search).get("f");
  if (doLink) { // lista recebida por link: soma à lista do navegador
    for (const s of doLink.split(",")) { const f = deId(s); if (f && !lista.some((x) => idDe(x) === idDe(f))) lista.push(f); }
    salvar();
  }
  const tem = (c, uf, n) => lista.some((f) => f.c === c && f.uf === uf && f.n === n);

  // ------------------------------------------------------------ dados do TSE (com cache de 60 s)
  const eleicoes = {}, cache = {};
  async function eleicaoDe(cr) {
    if (!eleicoes[cr]) eleicoes[cr] = T.descobrirEleicao(ANO, cr).then((e) => e.cd).catch((e) => { delete eleicoes[cr]; throw e; });
    return eleicoes[cr];
  }
  async function arquivo(c, uf, forcar) {
    const k = `${c}-${uf}`, agora = Date.now();
    if (!forcar && cache[k] && agora - cache[k].t < INTERVALO * 1000) return cache[k].p;
    const p = (async () => {
      const cr = cargoReal(c, uf), el = await eleicaoDe(cr);
      let d = await T.getJson(T.urlUf(ANO, el, uf, cr));
      if (window.Sim && Sim.ativo) d = Sim.aplicar(d, uf);
      return PROP(c) ? proporcional(T.parseU(d, cr), c, uf) : majoritario(T.parseMaj(d, cr), c);
    })();
    cache[k] = { t: agora, p };
    p.catch(() => { if (cache[k] && cache[k].p === p) delete cache[k]; });
    return p;
  }
  function proporcional(d, c, uf) {
    const soma = d.candidatos.reduce((s, x) => s + x.votos, 0) + Object.values(d.legenda).reduce((s, v) => s + v, 0);
    const vagas = d.vagasTse || (c === 6 ? T.VAGAS[uf] : VAGAS_EST[uf]);
    const res = M.calcular(d.candidatos, d.legenda, vagas, d.federacoes, d.vv >= soma && d.vv > 0 ? d.vv : null);
    return { tipo: "prop", pst: d.pst, hora: d.hora, cands: d.candidatos, res };
  }
  function majoritario(d, c) {
    const a = M.majoritaria(d.cands, d.vv, T.restantes(d), d.vagas, c !== 5);
    return { tipo: "maj", pst: d.pst, hora: d.hora, cands: d.cands, a, vagas: d.vagas };
  }

  // ------------------------------------------------------------ situação de cada candidato
  function linhaProp(f, arq) {
    const k = arq.cands.find((x) => x.numero === f.n);
    if (!k) return null;
    const { res } = arq, semVotos = !res.qe;
    let sit;
    if (semVotos) sit = '<span class="tag nao">aguardando votos</span>';
    else if (k.eleito === "QP") sit = '<span class="tag ok">eleito (QP)</span>';
    else if (k.eleito === "SOBRA") sit = '<span class="tag sobra">eleito nas sobras</span>';
    else if (k.eleito) sit = '<span class="tag ok">eleito</span>';
    else sit = '<span class="tag nao">não eleito</span>';
    return { k, ordem: -k.votos, cel: [fmt(k.votos), semVotos ? "–" : pct(k.votos / res.qe), sit] };
  }
  function linhaMaj(f, arq) {
    const { a, vagas } = arq;
    const i = a.ordem.findIndex((x) => x.numero === f.n);
    if (i < 0) return null;
    const k = a.ordem[i], v = a.validos;
    let sit;
    if (!v) sit = '<span class="tag nao">aguardando votos</span>';
    else if (f.c === 5) {
      if (a.garantidos.includes(k)) sit = '<span class="tag ok">eleito (garantido)</span>';
      else if (i < vagas) sit = '<span class="tag agora">eleito se terminasse agora</span>';
      else sit = '<span class="tag nao">não eleito agora</span>';
    } else {
      if (a.eleitoNoPrimeiro) sit = i === 0 ? '<span class="tag ok">eleito no 1º turno</span>' : '<span class="tag fora">derrotado</span>';
      else if (i === 0 && k.votos > v / 2) sit = '<span class="tag agora">venceria no 1º turno agora</span>';
      else if (i < 2) sit = `<span class="tag t2">${a.segundoTurnoCerto ? "2º turno" : "2º turno se terminasse agora"}</span>`;
      else sit = '<span class="tag nao">fora do 2º turno agora</span>';
    }
    return { k, ordem: i, cel: [fmt(k.votos), v ? pct(k.votos / v) : "–", v ? `${i + 1}º` : "–", sit] };
  }

  // ------------------------------------------------------------ tabelas
  const CAB = {
    prop: ["", "Candidato", "Nº", "Partido", "UF", "Apurado", "Votos", "% do QE", "Situação"],
    maj: ["", "Candidato", "Nº", "Partido", "UF", "Apurado", "Votos", "% válidos", "Posição", "Situação"],
  };
  function tabela(c, linhas) {
    const cab = CAB[PROP(c) ? "prop" : "maj"], esq = new Set([1, 3, cab.length - 1]);
    return `<table><thead><tr>${cab.map((h, i) => `<th${esq.has(i) ? ' class="l"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>` +
      linhas.map((r) => `<tr>${r.map((x, i) => `<td${esq.has(i) ? ' class="l"' : ""}>${x}</td>`).join("")}</tr>`).join("") + "</tbody></table>";
  }
  async function render(forcar) {
    const st = $("#status");
    for (const c of [6, 7, 5, 3, 1]) {
      const meus = lista.filter((f) => f.c === c);
      $("#n-" + c).textContent = meus.length ? `${meus.length} na lista` : "";
      if (!meus.length) $("#t-" + c).innerHTML = `<p class="vazio">Nenhum candidato a ${NOME_CARGO[c].toLowerCase()} na sua lista.</p>`;
    }
    if (!lista.length) { st.textContent = ""; compart(); return; }
    st.textContent = "atualizando…"; st.className = "st busy";
    const chaves = [...new Set(lista.map((f) => `${f.c}-${f.uf}`))];
    const arqs = {}, falhas = [];
    await Promise.all(chaves.map(async (k) => { const [c, uf] = k.split("-"); try { arqs[k] = await arquivo(Number(c), uf, forcar); } catch (e) { falhas.push(uf); } }));
    let hora = "";
    for (const c of [6, 7, 5, 3, 1]) {
      const meus = lista.filter((f) => f.c === c);
      if (!meus.length) continue;
      const linhas = [];
      for (const f of meus) {
        const arq = arqs[`${f.c}-${f.uf}`];
        const rem = `<button class="rem" type="button" data-rem="${idDe(f)}" title="Tirar da lista" aria-label="Tirar da lista">×</button>`;
        const uf = f.uf === "BR" ? "Brasil" : f.uf;
        if (!arq) { linhas.push({ uf: f.uf, ordem: 0, r: [rem, `nº ${f.n}`, f.n, "–", uf, "–", ...Array(PROP(c) ? 3 : 4).fill("sem resposta do TSE")] }); continue; }
        hora = hora || arq.hora;
        const l = PROP(c) ? linhaProp(f, arq) : linhaMaj(f, arq);
        if (!l) { linhas.push({ uf: f.uf, ordem: 0, r: [rem, `nº ${f.n} (não encontrado)`, f.n, "–", uf, "–", ...Array(PROP(c) ? 3 : 4).fill("–")] }); continue; }
        linhas.push({ uf: f.uf, ordem: l.ordem, r: [rem, `${dot(l.k.partido)}<b>${esc(l.k.urna || l.k.nome)}</b>`, l.k.numero, esc(sigla(l.k.partido)), uf, arq.pst ? arq.pst + "%" : "–", ...l.cel] });
      }
      linhas.sort((a, b) => a.uf.localeCompare(b.uf) || a.ordem - b.ordem);
      $("#t-" + c).innerHTML = tabela(c, linhas.map((x) => x.r));
    }
    st.textContent = (falhas.length ? `sem resposta do TSE agora: ${[...new Set(falhas)].join(", ")} · ` : "") + `TSE: ${String(hora).trim() || "–"} · atualizado ${new Date().toLocaleTimeString("pt-BR")}`;
    st.className = falhas.length ? "st erro" : "st";
    compart();
  }
  function compart() {
    const el = $("#compart");
    if (!lista.length) { el.innerHTML = ""; return; }
    const url = location.origin + location.pathname + "?f=" + lista.map(idDe).join(",");
    el.innerHTML = `<button class="btn" type="button" id="copiar">Copiar link da minha lista</button><span id="copiado"></span>`;
    $("#copiar").onclick = async () => {
      try { await navigator.clipboard.writeText(url); $("#copiado").textContent = "link copiado — é só colar no WhatsApp"; }
      catch (e) { $("#copiado").innerHTML = `copie: <input value="${esc(url)}" readonly size="40" onclick="this.select()">`; }
    };
  }

  // ------------------------------------------------------------ busca
  const selCargo = $("#f-cargo"), selUf = $("#f-uf"), q = $("#f-q"), out = $("#resultados");
  selUf.innerHTML = T.UFS.map((u) => `<option value="${u}">${u} · ${T.NOMES[u]}</option>`).join("");
  selUf.value = "SP";
  let buscaVez = 0;
  async function buscar() {
    const c = Number(selCargo.value), uf = c === 1 ? "BR" : selUf.value, termo = norm(q.value.trim());
    $("#lb-uf").style.display = c === 1 ? "none" : "";
    if (!termo && c !== 1 && c !== 3) { out.innerHTML = '<p class="vazio">Digite parte do nome ou o número do candidato.</p>'; return; }
    const vez = ++buscaVez;
    out.innerHTML = '<p class="vazio">buscando no TSE…</p>';
    let arq;
    try { arq = await arquivo(c, uf); } catch (e) { if (vez === buscaVez) out.innerHTML = `<p class="aviso">Não foi possível buscar no TSE agora (${esc(e.message)}). Tente de novo em instantes.</p>`; return; }
    if (vez !== buscaVez) return;
    const achados = arq.cands.filter((k) => !termo || norm(k.urna).includes(termo) || norm(k.nome).includes(termo) || k.numero.startsWith(termo))
      .sort((a, b) => b.votos - a.votos || a.urna.localeCompare(b.urna)).slice(0, 15);
    if (!achados.length) { out.innerHTML = `<p class="vazio">Nenhum candidato a ${NOME_CARGO[c].toLowerCase()} encontrado${c === 1 ? "" : " em " + T.NOMES[uf]} com “${esc(q.value)}”.</p>`; return; }
    out.innerHTML = achados.map((k) => {
      const ja = tem(c, uf, k.numero);
      return `<div class="lin">${dot(k.partido)}<span><b>${esc(k.urna || k.nome)}</b> <small>${esc(sigla(k.partido))} · ${k.numero}${c === 1 ? "" : " · " + uf}</small></span>` +
        `<button class="add mais" type="button" data-add="${c}-${uf}-${k.numero}"${ja ? " disabled" : ""}>${ja ? "★ na lista" : "☆ Adicionar"}</button></div>`;
    }).join("");
  }
  let espera = null;
  q.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(buscar, 250); });
  selCargo.addEventListener("change", buscar);
  selUf.addEventListener("change", buscar);

  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-add]"), r = ev.target.closest("[data-rem]");
    if (a) {
      const f = deId(a.dataset.add);
      if (f && !tem(f.c, f.uf, f.n)) { lista.push(f); salvar(); a.disabled = true; a.textContent = "★ na lista"; render(false); }
    } else if (r) {
      lista = lista.filter((f) => idDe(f) !== r.dataset.rem); salvar(); render(false); buscar();
    }
  });
  $("#atualizar").addEventListener("click", () => render(true));

  render(false);
  setInterval(() => render(true), INTERVALO * 1000);
})();

/* Eleições majoritárias 2026 — Presidente, Governadores e Senado (página definida em window.CFG.pagina) */
(function () {
  "use strict";
  const T = window.TSE, M = window.Motor, CFG = window.CFG || {};
  const PAG = CFG.pagina; // "presidente" | "governadores" | "senado"
  const ANO = 2026, INTERVALO = 60;
  const CARGO = { presidente: 1, governadores: 3, senado: 5 }[PAG];
  const params = new URLSearchParams(location.search);
  const ufDet = (params.get("uf") || "").toUpperCase();
  let eleicao = null, nomeEleicao = "", timer = null, modo = null, ultimo = null;

  const $ = (s) => document.querySelector(s);
  const fmt = M.fmt;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (x, d = 1) => (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
  const sigla = (p) => ({ PCDOB: "PCdoB", UNIAO: "União", MISSAO: "Missão", "S/PARTIDO": "sem partido" }[p] || p);
  const CORES = {
    "PL": "#12286B", "PT": "#D7263D", "FE BRASIL": "#D7263D", "MISSAO": "#F2C230", "PSOL": "#7B2CBF", "PSOL/REDE": "#7B2CBF", "NOVO": "#FF7A00", "PSB": "#2E8B57", "PDT": "#5DAE6B", "PCDOB": "#1B6E3A", "PV": "#8BC58F", "REDE": "#A8D5A2", "PCO": "#9CCC65", "PSTU": "#6E9F3F", "UP": "#4F9A5E", "UNIAO": "#3F8FD8", "PP": "#6FB4EA", "UNIAO/PP": "#3F8FD8", "REPUBLICANOS": "#8DCBF0", "DC": "#B3DCF5", "PRTB": "#5FA8D3", "DEMOCRATA": "#A3C9E8", "PSD": "#8B5E3C", "MDB": "#A47551", "PODE": "#7D8590", "PSDB": "#9AA3AE", "CIDADANIA": "#B8BFC7", "PSDB/CIDADANIA": "#9AA3AE", "AVANTE": "#6B5B4E", "SOLIDARIEDADE": "#C2A07E", "PRD": "#8C7B6B", "PRD/SOLIDARIEDADE": "#B08B66",
  };
  const EXTRAS = ["#9E9E9E", "#B7A99A", "#7F8C8D", "#A1887F", "#BDBDBD", "#8D7B6A", "#90A4AE", "#C2B8A3", "#757575", "#A69C90"];
  const cor = (p) => CORES[p] || EXTRAS[[...String(p)].reduce((s, c) => s + c.charCodeAt(0), 0) % EXTRAS.length];
  const dot = (p) => `<i class="dot" style="background:${cor(p)}"></i>`;
  const simQ = () => (window.Sim && Sim.ativo ? "&sim=" + Sim.pct : "");

  // Senado: quem continua até 2031 (eleitos em 2022) e bancada em exercício — Dados Abertos do Senado, 03/10/2026
  const SEN_CONTINUAM = { AC: ["Alan Rick", "REPUBLICANOS"], AL: ["Renan Filho", "MDB"], AM: ["Omar Aziz", "PSD"], AP: ["Davi Alcolumbre", "UNIAO"], BA: ["Otto Alencar", "PSD"],
    CE: ["Camilo Santana", "PT"], DF: ["Damares Alves", "REPUBLICANOS"], ES: ["Magno Malta", "PL"], GO: ["Wilder Morais", "PL"], MA: ["Lourdinha Pereira", "PSB"],
    MG: ["Cleitinho", "REPUBLICANOS"], MS: ["Tereza Cristina", "PP"], MT: ["Wellington Fagundes", "PL"], PA: ["Beto Faro", "PT"], PB: ["Efraim Filho", "PL"],
    PE: ["Teresa Leitão", "PT"], PI: ["Jussara Lima", "PSD"], PR: ["Sergio Moro", "PL"], RJ: ["Romário", "S/PARTIDO"], RN: ["Rogerio Marinho", "PL"],
    RO: ["Jaime Bagattoli", "PL"], RR: ["Dr. Hiran", "PP"], RS: ["Hamilton Mourão", "REPUBLICANOS"], SC: ["Jorge Seif", "PL"], SE: ["Laércio Oliveira", "PP"],
    SP: ["Astronauta Marcos Pontes", "PL"], TO: ["Professora Dorinha Seabra", "UNIAO"] };
  const SEN_ATUAL = { PL: 15, PSD: 14, MDB: 9, PT: 9, PP: 8, REPUBLICANOS: 6, PSB: 6, PSDB: 4, UNIAO: 3, PODE: 3, PDT: 2, AVANTE: 1, "S/PARTIDO": 1 };

  // ------------------------------------------------------------ coleta
  async function bruto(uf) {
    const d = await T.getJson(T.urlUf(ANO, eleicao, uf, CARGO));
    return T.parseMaj(window.Sim ? Sim.aplicar(d, uf) : d, CARGO);
  }
  async function carregar() {
    const st = $("#status");
    st.textContent = "atualizando…"; st.className = "st busy";
    try {
      if (!eleicao) { const e = await T.descobrirEleicao(ANO, CARGO); eleicao = e.cd; nomeEleicao = e.nm; }
      const ufs = await Promise.all(T.UFS.map(async (u) => { try { return { u, d: await bruto(u) }; } catch (e) { return { u, erro: e.message }; } }));
      let br = null;
      if (PAG === "presidente") {
        if (window.Sim && Sim.ativo) br = somaUfs(ufs);
        else { try { br = await bruto("BR"); } catch (e) { br = somaUfs(ufs); } }
      }
      ultimo = { ufs, br };
      render(ultimo);
      const falhas = ufs.filter((x) => x.erro).length, h = ufs.find((x) => !x.erro);
      st.textContent = (falhas ? `${falhas} estado(s) sem resposta do TSE agora · ` : "") + `TSE: ${h ? h.d.hora.trim() : "–"} · atualizado ${new Date().toLocaleTimeString("pt-BR")}` + (nomeEleicao ? ` · ${nomeEleicao}` : "");
      st.className = falhas ? "st erro" : "st";
    } catch (e) {
      st.textContent = "falha ao buscar no TSE: " + e.message + " — nova tentativa em " + INTERVALO + " s"; st.className = "st erro";
    }
    clearTimeout(timer); timer = setTimeout(carregar, INTERVALO * 1000);
  }
  function somaUfs(ufs) { // total nacional a partir dos estados (usado na simulação ou se o arquivo BR falhar)
    const ok = ufs.filter((x) => !x.erro), por = {};
    let vv = 0, te = 0, na = 0, pstPond = 0;
    for (const { d } of ok) {
      vv += d.vv; te += d.eleitorado; na += d.eleitoradoNaoApurado || 0; pstPond += d.pstNum * d.eleitorado;
      for (const c of d.cands) { const k = c.numero; if (!por[k]) por[k] = { ...c, votos: 0 }; por[k].votos += c.votos; }
    }
    const p = te ? pstPond / te : 0;
    return { cands: Object.values(por), vagas: 1, vv, vansj: 0, eleitorado: te, eleitoradoNaoApurado: na, pstNum: p, pst: p.toFixed(2).replace(".", ","), hora: ok[0] ? ok[0].d.hora : "" };
  }
  const analisar = (d, vagas, segundoTurno) => M.majoritaria(d.cands, d.vv, T.restantes(d), vagas, segundoTurno);

  // ------------------------------------------------------------ peças de interface
  function barras(d, a, vagas, linhaMaioria) {
    const v = a.validos || 1, max = Math.max(...a.ordem.map((c) => c.votos), 1);
    const escala = linhaMaioria ? Math.max(max / v, 0.55) : max / v;
    const gar = new Set(a.garantidos);
    const linhas = a.ordem.map((c, i) => {
      const dentro = i < vagas && c.votos > 0;
      const tag = gar.has(c) ? '<span class="tag ok">garantido</span>' : (dentro && PAG === "senado" ? '<span class="tag agora">eleito agora</span>' : "");
      return `<div class="cb ${dentro ? "in" : ""}"><div class="cn">${dot(c.partido)}<b>${esc(c.urna)}</b> <small>${esc(sigla(c.partido))} · ${c.numero}</small> ${tag}</div>
        <div class="ct"><div class="cf" style="width:${(c.votos / v / escala * 100).toFixed(2)}%;background:${cor(c.partido)}"></div></div>
        <div class="cv"><b>${pct(c.votos / v)}</b> <small>${fmt(c.votos)}</small></div></div>`;
    }).join("");
    const meio = linhaMaioria ? `<div class="maioria" style="left:calc(var(--cl) + (100% - var(--cl) - var(--cvw)) * ${(0.5 / escala).toFixed(4)})"><span>50% dos válidos</span></div>` : "";
    return `<div class="cbs">${meio}${linhas}</div>`;
  }
  const situTag = (a) => {
    const s = a.situacao;
    const cls = /eleito|definido|garantido/.test(s) ? "ok" : /2º turno/.test(s) ? "t2" : "agora";
    return `<span class="tag ${cls}">${s}</span>`;
  };
  const restanteTxt = (d) => d.eleitorado ? `${pct(1 - (d.eleitoradoNaoApurado || 0) / d.eleitorado)} do eleitorado apurado` : "";

  function hemiciclo(cadeiras, total, rotulo) { // cadeiras: [{p, t}] na ordem
    const filas = 5, r0 = 0.4, raios = Array.from({ length: filas }, (_, i) => r0 + (1 - r0) * i / (filas - 1));
    const sR = raios.reduce((s, r) => s + r, 0), por = raios.map((r) => Math.round(total * r / sR));
    por[filas - 1] += total - por.reduce((s, n) => s + n, 0);
    const pts = [];
    raios.forEach((r, i) => { for (let j = 0; j < por[i]; j++) { const a = Math.PI * (1 - j / (por[i] - 1)); pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a }); } });
    pts.sort((p, q) => q.a - p.a || Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
    const circ = pts.map((p, i) => { const k = cadeiras[i]; return `<circle cx="${(p.x * 100).toFixed(2)}" cy="${(-p.y * 100).toFixed(2)}" r="5.9" fill="${k ? cor(k.p) : "var(--line)"}"${k && k.cont ? ' stroke="#16243A" stroke-width="1.6"' : ""}><title>${k ? esc(k.t) : "vaga em disputa, ainda indefinida"}</title></circle>`; }).join("");
    return `<svg viewBox="-108 -108 216 114" role="img" aria-label="${esc(rotulo)}">${circ}<text x="0" y="-14" text-anchor="middle" class="h-num">${cadeiras.length}</text><text x="0" y="-3" text-anchor="middle" class="h-rot">de ${total} cadeiras</text></svg>`;
  }

  // ------------------------------------------------------------ páginas
  function render(R) { ({ presidente: renderPresidente, governadores: renderGovernadores, senado: renderSenado })[PAG](R); }

  function renderPresidente(R) {
    const d = R.br;
    if (!d) { $("#principal").innerHTML = '<p class="aviso">Sem dados nacionais do TSE agora.</p>'; return; }
    const a = analisar(d, 1, true);
    $("#k-secoes").textContent = d.pst ? d.pst + "%" : "–";
    $("#k-validos").textContent = fmt(d.vv);
    $("#k-situ").innerHTML = d.vv ? situTag(a) + (a.ordem[1] && /2º turno/.test(a.situacao) ? ` <small>${esc(a.ordem[0].urna)} × ${esc(a.ordem[1].urna)}</small>` : "") : "–";
    $("#principal").innerHTML = d.vv ? barras(d, a, 1, true) + `<p class="nota">${restanteTxt(d)}. Para vencer no 1º turno é preciso mais da metade dos votos válidos. "Garantido" significa que nem todos os votos ainda não apurados mudariam o resultado.</p>`
      : barras(d, { ...a, validos: 1 }, 0, false) + '<p class="nota">Sem votos apurados ainda. Os candidatos aparecem em ordem de votação quando a totalização começar.</p>';
    // por estado
    const linhas = R.ufs.map(({ u, d: x, erro }) => {
      if (erro) return `<tr class="fraca"><td class="l">${u}</td><td colspan="4" class="l">${esc(erro)}</td></tr>`;
      const ax = analisar(x, 1, true), [p1, p2] = ax.ordem;
      const c = (k) => k && x.vv ? `${dot(k.partido)}${esc(k.urna)} <small>${pct(k.votos / x.vv)}</small>` : "–";
      return `<tr><td class="l"><b>${u}</b> <small>${T.NOMES[u]}</small></td><td>${x.pst || "–"}%</td><td class="l">${c(p1)}</td><td class="l">${c(p2)}</td><td>${x.vv ? fmt(x.vv) : "–"}</td></tr>`;
    }).join("");
    $("#estados").innerHTML = `<table><thead><tr><th class="l">Estado</th><th>Seções</th><th class="l">1º colocado</th><th class="l">2º colocado</th><th>Válidos</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }

  function renderGovernadores(R) {
    const ok = R.ufs.filter((x) => !x.erro);
    const an = Object.fromEntries(ok.map(({ u, d }) => [u, analisar(d, 1, true)]));
    let eleitos = 0, t2 = 0, comVotos = 0;
    const porPartido = {};
    for (const { u, d } of ok) {
      const a = an[u];
      if (!d.vv) continue;
      comVotos++;
      if (a.eleitoNoPrimeiro) eleitos++; if (a.segundoTurnoCerto || (a.situacao === "2º turno")) t2++;
      const p = a.lider.partido; porPartido[p] = porPartido[p] || { lid: 0, el: 0 }; porPartido[p].lid++; if (a.eleitoNoPrimeiro) porPartido[p].el++;
    }
    $("#k-eleitos").textContent = comVotos ? eleitos : "–";
    $("#k-t2").textContent = comVotos ? t2 : "–";
    $("#k-aberto").textContent = comVotos ? comVotos - eleitos - t2 : "–";
    const linhas = R.ufs.map(({ u, d, erro }) => {
      if (erro) return `<tr class="fraca"><td class="l">${u}</td><td colspan="5" class="l">${esc(erro)}</td></tr>`;
      const a = an[u], [p1, p2] = a.ordem;
      const c = (k) => k && d.vv ? `${dot(k.partido)}${esc(k.urna)} <small>${esc(sigla(k.partido))} · ${pct(k.votos / d.vv)}</small>` : (k ? `${dot(k.partido)}${esc(k.urna)} <small>${esc(sigla(k.partido))}</small>` : "–");
      return `<tr class="${u === ufDet ? "sel" : ""}"><td class="l"><a href="?uf=${u}${simQ()}#detalhe"><b>${u}</b></a> <small>${T.NOMES[u]}</small></td><td>${d.pst || "–"}%</td><td class="l">${c(p1)}</td><td class="l">${c(p2)}</td><td class="l">${d.vv ? situTag(a) : "–"}</td><td><a href="?uf=${u}${simQ()}#detalhe">detalhar</a></td></tr>`;
    }).join("");
    $("#estados").innerHTML = `<table><thead><tr><th class="l">Estado</th><th>Seções</th><th class="l">1º colocado</th><th class="l">2º colocado</th><th class="l">Situação</th><th></th></tr></thead><tbody>${linhas}</tbody></table>`;
    const pp = Object.entries(porPartido).sort((a, b) => b[1].lid - a[1].lid || a[0].localeCompare(b[0]));
    $("#partidos").innerHTML = pp.length ? `<table><thead><tr><th class="l">Partido</th><th title="Estados em que o partido lidera agora">Lidera</th><th title="Eleito no 1º turno de forma garantida">Garantidos</th></tr></thead><tbody>` +
      pp.map(([p, x]) => `<tr><td class="l">${dot(p)}<b>${esc(sigla(p))}</b></td><td>${x.lid}</td><td>${x.el || "–"}</td></tr>`).join("") + `</tbody></table>` : '<p class="vazio">Sem votos apurados ainda.</p>';
    detalhe(R, an, 1, true);
  }

  function renderSenado(R) {
    const ok = R.ufs.filter((x) => !x.erro);
    const an = Object.fromEntries(ok.map(({ u, d }) => [u, analisar(d, d.vagas || 2, false)]));
    const tab = {};
    const L = (p) => (tab[p] = tab[p] || { p, atual: 0, cont: 0, agora: 0, gar: 0 });
    for (const [p, n] of Object.entries(SEN_ATUAL)) L(p).atual += n;
    for (const [, [, p]] of Object.entries(SEN_CONTINUAM)) L(p).cont++;
    let agora = 0, gar = 0, comVotos = false;
    const assentosAgora = [], assentosGar = [];
    for (const { u, d } of ok) {
      const a = an[u], vagas = d.vagas || 2;
      if (!d.vv) continue;
      comVotos = true;
      a.ordem.slice(0, vagas).forEach((c) => { L(c.partido).agora++; agora++; assentosAgora.push({ p: c.partido, t: `${u}: ${c.urna} (${sigla(c.partido)})` }); });
      a.garantidos.slice(0, vagas).forEach((c) => { L(c.partido).gar++; gar++; assentosGar.push({ p: c.partido, t: `${u}: ${c.urna} (${sigla(c.partido)}) — garantido` }); });
    }
    const cont = Object.entries(SEN_CONTINUAM).map(([u, [n, p]]) => ({ p, t: `${u}: ${n} (${sigla(p)}) — mandato até 2031`, cont: true }));
    const ordenar = (arr) => { const n = {}; for (const x of arr) n[x.p] = (n[x.p] || 0) + 1; return [...arr].sort((a, b) => n[b.p] - n[a.p] || a.p.localeCompare(b.p) || (b.cont ? 1 : 0) - (a.cont ? 1 : 0)); };
    if (!modo) modo = comVotos ? "agora" : "atual";
    document.querySelectorAll("#modos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === modo)));
    let cad;
    if (modo === "atual") { cad = []; for (const [p, n] of Object.entries(SEN_ATUAL)) for (let i = 0; i < n; i++) cad.push({ p, t: `${sigla(p)}: ${n}` }); cad = ordenar(cad); }
    else cad = ordenar(cont.concat(modo === "agora" ? assentosAgora : assentosGar));
    $("#camara").innerHTML = hemiciclo(cad, 81, "Senado");
    $("#k-agora").textContent = comVotos ? `${agora} de 54` : "–";
    $("#k-gar").textContent = comVotos ? `${gar} de 54` : "–";
    $("#nota-camara").textContent = !comVotos ? "A apuração ainda não começou: o hemiciclo mostra a bancada atual." : "Contorno escuro: senadores eleitos em 2022, com mandato até 2031.";
    const linhasP = Object.values(tab).sort((a, b) => (b.cont + b.agora) - (a.cont + a.agora) || b.atual - a.atual || a.p.localeCompare(b.p));
    const tot = (k) => linhasP.reduce((s, x) => s + x[k], 0);
    $("#partidos").innerHTML = `<table><thead><tr><th class="l">Partido</th><th title="Senadores em exercício hoje">Atual</th><th title="Eleitos em 2022, mandato até 2031">Continuam</th><th title="Lideram agora nas 54 vagas em disputa">Eleitos agora</th><th title="Continuam + eleitos agora">Total</th><th title="Continuam + vagas já garantidas">Garant.</th></tr></thead><tbody>` +
      linhasP.map((x) => `<tr><td class="l">${dot(x.p)}<b>${esc(sigla(x.p))}</b></td><td>${x.atual || "–"}</td><td>${x.cont || "–"}</td><td>${x.agora || "–"}</td><td><b>${x.cont + x.agora || "–"}</b></td><td>${x.cont + x.gar || "–"}</td></tr>`).join("") +
      `</tbody><tfoot><tr><td class="l">Total</td><td>${tot("atual")}</td><td>${tot("cont")}</td><td>${tot("agora")}</td><td>${tot("cont") + tot("agora")}</td><td>${tot("cont") + tot("gar")}</td></tr></tfoot></table>`;
    const linhas = R.ufs.map(({ u, d, erro }) => {
      if (erro) return `<tr class="fraca"><td class="l">${u}</td><td colspan="5" class="l">${esc(erro)}</td></tr>`;
      const a = an[u], vagas = d.vagas || 2, gs = new Set(a.garantidos);
      const c = (k) => k ? `${dot(k.partido)}${esc(k.urna)} <small>${esc(sigla(k.partido))}${d.vv ? " · " + pct(k.votos / d.vv) : ""}</small>${gs.has(k) ? ' <span class="okm" title="vaga garantida">✓</span>' : ""}` : "–";
      return `<tr class="${u === ufDet ? "sel" : ""}"><td class="l"><a href="?uf=${u}${simQ()}#detalhe"><b>${u}</b></a></td><td>${d.pst || "–"}%</td><td class="l">${c(a.ordem[0])}</td><td class="l">${vagas > 1 ? c(a.ordem[1]) : "–"}</td><td class="l">${c(a.ordem[vagas])}</td><td><a href="?uf=${u}${simQ()}#detalhe">detalhar</a></td></tr>`;
    }).join("");
    $("#estados").innerHTML = `<table><thead><tr><th class="l">Estado</th><th>Seções</th><th class="l">1ª vaga</th><th class="l">2ª vaga</th><th class="l">Próximo da fila</th><th></th></tr></thead><tbody>${linhas}</tbody></table><p class="nota"><span class="okm">✓</span> vaga garantida: no máximo um adversário ainda pode alcançá-lo com os votos que faltam. Percentuais sobre o total de votos válidos para Senador no estado.</p>`;
    detalhe(R, an, 2, false);
  }

  function detalhe(R, an, vagasPadrao, segundoTurno) {
    const box = $("#detalhe");
    if (!ufDet || !box) return;
    const x = R.ufs.find((y) => y.u === ufDet);
    if (!x || x.erro) { box.innerHTML = `<p class="aviso">${ufDet}: sem dados do TSE agora.</p>`; return; }
    const d = x.d, a = an[ufDet], vagas = d.vagas || vagasPadrao;
    const extra = PAG === "senado" && SEN_CONTINUAM[ufDet] ? `<p class="nota">Continua no mandato até 2031: ${dot(SEN_CONTINUAM[ufDet][1])}<b>${esc(SEN_CONTINUAM[ufDet][0])}</b> (${esc(sigla(SEN_CONTINUAM[ufDet][1]))}).</p>` : "";
    box.innerHTML = `<h2>${T.NOMES[ufDet]} <small>${d.pst || "0,00"}% das seções · ${restanteTxt(d)} · ${d.vv ? situTag(a) : "sem votos ainda"}</small> <a class="fechar" href="?${simQ().slice(1)}">fechar ×</a></h2>` +
      barras(d, d.vv ? a : { ...a, validos: 1 }, d.vv ? vagas : 0, segundoTurno && !!d.vv) + extra;
    if (location.hash === "#detalhe" && !box.dataset.rolou) { box.dataset.rolou = "1"; box.scrollIntoView({ block: "start" }); }
  }

  // ------------------------------------------------------------ início
  function init() {
    document.querySelectorAll("#modos button").forEach((b) => b.addEventListener("click", () => { modo = b.dataset.m; if (ultimo) render(ultimo); }));
    const at = $("#atualizar"); if (at) at.addEventListener("click", carregar);
    if (ufDet && $("#detalhe")) $("#detalhe").hidden = false;
    carregar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

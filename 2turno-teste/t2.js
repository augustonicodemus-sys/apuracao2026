/* Páginas do 2º turno 2026 (Presidente e Governadores). window.CFG = { pagina: "painel" | "presidente" | "governador", uf }
 * Lê os arquivos públicos do TSE: 1º turno (6257 Presidente, 6259 Governador) e 2º turno (6258 / 6260). */
(function () {
  "use strict";
  const T = window.TSE, D = window.Duelo, S = window.Sim, CFG = window.CFG || {};
  const ANO = 2026, INTERVALO = 60;
  const INICIO = new Date("2026-10-25T17:00:00-03:00"); // fechamento das urnas (horário de Brasília)
  const VIGIA = new Date("2026-10-25T16:30:00-03:00"); // a partir daqui as páginas se atualizam sozinhas

  // finalistas, na ordem do 1º turno: [número, nome, partido, cor]
  const CORRIDAS = {
    BR: { cargo: 1, e1: 6257, e2: 6258, nome: "Brasil", titulo: "Presidente", url: "presidente.html", fin: [["22", "Flávio Bolsonaro", "PL", "#12286B"], ["13", "Lula", "PT", "#D7263D"]] },
    AC: { cargo: 3, e1: 6259, e2: 6260, fin: [["11", "Mailza Assis", "PP", "#2F6FB8"], ["10", "Alan Rick", "Republicanos", "#62B6E2"]] },
    AM: { cargo: 3, e1: 6259, e2: 6260, fin: [["55", "Omar Aziz", "PSD", "#8B5E3C"], ["22", "Professora Maria do Carmo", "PL", "#12286B"]] },
    DF: { cargo: 3, e1: 6259, e2: 6260, fin: [["11", "Celina Leão", "PP", "#3F8FD8"], ["13", "Leandro Grass", "PT", "#D7263D"]] },
    ES: { cargo: 3, e1: 6259, e2: 6260, fin: [["10", "Lorenzo Pazolini", "Republicanos", "#3F8FD8"], ["15", "Ricardo Ferraço", "MDB", "#A47551"]] },
    RJ: { cargo: 3, e1: 6259, e2: 6260, fin: [["22", "Douglas Ruas", "PL", "#12286B"], ["55", "Eduardo Paes", "PSD", "#8B5E3C"]] },
    RN: { cargo: 3, e1: 6259, e2: 6260, fin: [["44", "Allyson", "União", "#3F8FD8"], ["13", "Cadu de Lula", "PT", "#D7263D"]] },
    TO: { cargo: 3, e1: 6259, e2: 6260, fin: [["44", "Professora Dorinha", "União", "#3F8FD8"], ["45", "Vicentinho Júnior", "PSDB", "#6E7C91"]] },
  };
  for (const c of Object.values(CORRIDAS)) { c.nums = c.fin.map((f) => f[0]); c.fin = Object.fromEntries(c.fin.map(([n, ...r]) => [n, r])); }
  for (const [uf, c] of Object.entries(CORRIDAS)) if (uf !== "BR") { c.nome = T.NOMES[uf]; c.titulo = "Governador · " + uf; c.url = "governador-" + uf.toLowerCase() + ".html"; }
  const GOV = Object.keys(CORRIDAS).filter((u) => u !== "BR");

  const SIGLA = { MISSAO: "Missão", UNIAO: "União", PCDOB: "PCdoB", REPUBLICANOS: "Republicanos", SOLIDARIEDADE: "Solidariedade", CIDADANIA: "Cidadania", AVANTE: "Avante", DEMOCRATA: "Democrata", AGIR: "Agir", "S/PARTIDO": "sem partido" };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => (Math.round(n) || 0).toLocaleString("pt-BR");
  const pct = (x, d = 1) => { if (Math.abs(x - 0.5) < 0.0005) d = 2; return (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%"; }; // perto de 50%: duas casas
  const num = (x) => T.num(x);
  const simAtivo = !!(S && S.ativo);
  const simQ = simAtivo ? "?sim=" + S.pct : "";

  // nome, partido e cor de um candidato (finalista conhecido, ou o que vier do TSE)
  function quem(corrida, c) {
    const f = corrida.fin[String(c.numero)];
    return f ? { nome: f[0], partido: f[1], cor: f[2] } : { nome: c.urna, partido: SIGLA[c.partido] || c.partido, cor: "#9AA3AE" };
  }

  // ------------------------------------------------------------ coleta
  const url = (corrida, uf, turno) => T.urlUf(ANO, turno === 1 ? corrida.e1 : corrida.e2, uf, corrida.cargo);
  function extras(d) { // comparecimento, abstenção, brancos e nulos
    const e = d.e || {}, v = d.v || {};
    return { comparecimento: num(e.c), abstencao: num(e.a), brancos: num(v.vb), nulos: num(v.tvn) };
  }
  async function turno1(corrida, uf) {
    const d = await T.getJson(url(corrida, uf, 1));
    return Object.assign(T.parseMaj(d, corrida.cargo), extras(d));
  }
  // 2º turno: arquivo do TSE; na simulação, se o arquivo ainda não existir, monta um a partir do 1º turno só com os finalistas
  async function turno2(corrida, uf) {
    let d = null;
    try { d = await T.getJson(url(corrida, uf, 2)); } catch (e) { if (!simAtivo) return null; }
    if (simAtivo) {
      if (!d) {
        d = await T.getJson(url(corrida, uf, 1));
        for (const a of d.carg[0].agr || []) for (const p of a.par || []) p.cand = (p.cand || []).filter((k) => corrida.fin[String(k.n)]);
      }
      d = S.aplicar(d, uf + "-2t");
    }
    const r = Object.assign(T.parseMaj(d, corrida.cargo), extras(d));
    r.cands = r.cands.filter((c) => corrida.fin[String(c.numero)] || r.cands.length <= 2);
    return r;
  }
  const seguro = (p) => p.then((x) => x, () => null);

  // ------------------------------------------------------------ peças
  const dot = (cor) => `<i class="dot" style="background:${cor}"></i>`;
  const nomeHtml = (q, peq) => `${dot(q.cor)}<b>${esc(q.nome)}</b>${peq ? "" : ` <small>${esc(q.partido)}</small>`}`;

  function contagem() {
    const el = $("#contagem");
    if (!el) return;
    const ms = INICIO - Date.now();
    if (ms <= 0) { el.innerHTML = "<b>Urnas fechadas:</b> a apuração do 2º turno está em andamento."; return; }
    const dias = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    el.innerHTML = `<b>2º turno: domingo, 25 de outubro.</b> As urnas fecham às 17h (horário de Brasília) e a apuração começa em seguida. Faltam <b>${dias ? dias + (dias > 1 ? " dias, " : " dia, ") : ""}${h} h ${String(m).padStart(2, "0")} min</b>.`;
  }

  // barra de duelo: dois lados, linha dos 50%
  function duelo(corrida, a) {
    const qa = quem(corrida, a.A), qb = quem(corrida, a.B), v = a.vv || 1;
    const pa = a.A.votos / v, pb = a.B.votos / v;
    return `<div class="duelo">
      <div class="d-nomes"><div class="d-a"><span class="d-n">${nomeHtml(qa)}</span><span class="d-p" style="color:${qa.cor}">${pct(pa)}</span><small>${fmt(a.A.votos)} votos</small></div>
      <div class="d-b"><span class="d-n">${nomeHtml(qb)}</span><span class="d-p" style="color:${qb.cor}">${pct(pb)}</span><small>${fmt(a.B.votos)} votos</small></div></div>
      <div class="d-barra" role="img" aria-label="${esc(qa.nome)} ${pct(pa)}, ${esc(qb.nome)} ${pct(pb)}"><div style="width:${(pa * 100).toFixed(3)}%;background:${qa.cor}"></div><div style="width:${(pb * 100).toFixed(3)}%;background:${qb.cor}"></div><i class="d-meio"></i></div>
    </div>`;
  }

  function situacao(corrida, a, d) {
    if (!a.iniciou) return '<span class="tag agora">aguardando votos</span>';
    const qa = quem(corrida, a.A);
    if (a.terminou) return a.empate ? '<span class="tag t2">empate</span>' : `<span class="tag ok">${esc(qa.nome)} eleito(a)</span>`;
    if (a.garantido) return `<span class="tag ok">vitória garantida: ${esc(qa.nome)}</span>`;
    return `<span class="tag agora">${esc(qa.nome)} à frente</span>`;
  }

  function faltaTxt(corrida, a, d) {
    if (!a.iniciou) return "";
    const qa = quem(corrida, a.A), qb = quem(corrida, a.B);
    const apur = d.eleitorado ? 1 - (d.eleitoradoNaoApurado || 0) / d.eleitorado : 0;
    let t = `<b>${pct(apur)}</b> do eleitorado apurado (${d.pst || "0,00"}% das seções). Diferença: <b>${fmt(a.dif)}</b> votos.`;
    if (a.terminou) return t + " Apuração encerrada.";
    if (a.garantido) return t + ` A diferença já é maior que todos os ${fmt(a.R)} eleitores das seções que faltam: nem que todos votassem em ${esc(qb.nome)}, o resultado mudaria.`;
    t += ` Faltam cerca de <b>${fmt(a.W)}</b> votos válidos (estimativa pelo comparecimento até agora).`;
    if (a.precisa != null) t += a.precisa > 1
      ? ` Pela estimativa, ${esc(qb.nome)} não alcança mais, mas a vitória só é matematicamente garantida quando a diferença passar de ${fmt(a.R)} votos.`
      : ` Para virar, <b>${esc(qb.nome)}</b> precisa de <b>${pct(a.precisa)}</b> dos votos válidos que faltam.`;
    return t;
  }

  // 1º turno: todos os candidatos, finalistas em destaque
  function barras1(corrida, d) {
    const p = D.preTurno(d, corrida.nums);
    const v = p.vv || 1, max = Math.max(...p.todos.map((c) => c.votos), 1) / v;
    return `<div class="cbs t1">` + p.todos.map((c) => {
      const fin = !!corrida.fin[String(c.numero)], q = quem(corrida, c);
      return `<div class="cb ${fin ? "in" : ""}"><div class="cn">${dot(fin ? q.cor : "#C3C9D2")}<b>${esc(q.nome)}</b> <small>${esc(q.partido)}</small>${fin ? ' <span class="tag t2">no 2º turno</span>' : ""}</div>
        <div class="ct"><div class="cf" style="width:${(c.votos / v / max * 100).toFixed(2)}%;background:${fin ? q.cor : "#C3C9D2"}"></div></div>
        <div class="cv"><b>${pct(c.votos / v)}</b> <small>${fmt(c.votos)}</small></div></div>`;
    }).join("") + `</div>`;
  }

  function emJogo(corrida, d) {
    const p = D.preTurno(d, corrida.nums);
    const qa = quem(corrida, p.A), qb = quem(corrida, p.B);
    const bn = d.brancos + d.nulos;
    let frase;
    if (p.precisaOutros == null) frase = "";
    else if (p.precisaOutros > 1) frase = `Mesmo que levasse <b>todos</b> os votos dos outros candidatos, ${esc(qb.nome)} ainda ficaria ${fmt(p.dif - p.outros)} votos atrás. Para virar, precisa também de votos de quem se absteve, votou branco ou nulo, ou de quem votou em ${esc(qa.nome)} no 1º turno.`;
    else frase = `Se todos repetirem o voto do 1º turno e quem votou nos outros candidatos escolher um dos dois, ${esc(qb.nome)} precisa de <b>${pct(p.precisaOutros)}</b> desses votos para empatar. ${esc(qa.nome)} vence com mais de ${pct(1 - p.precisaOutros)}.`;
    return `<div class="jogo">
      <div class="j"><span>Diferença no 1º turno</span><b>${fmt(p.dif)}</b><small>a favor de ${esc(qa.nome)} · ${pct(p.dif / (p.vv || 1))} dos válidos</small></div>
      <div class="j"><span>Votos dos outros candidatos</span><b>${fmt(p.outros)}</b><small>${pct(p.outros / (p.vv || 1))} dos válidos · eleitores sem candidato no 2º turno</small></div>
      <div class="j"><span>Brancos e nulos</span><b>${fmt(bn)}</b><small>${d.comparecimento ? pct(bn / d.comparecimento) + " de quem votou" : ""}</small></div>
      <div class="j"><span>Abstenção</span><b>${fmt(d.abstencao)}</b><small>${d.eleitorado ? pct(d.abstencao / d.eleitorado) + " do eleitorado" : ""}</small></div>
    </div>${frase ? `<p class="nota forte">${frase}</p>` : ""}`;
  }

  function comparaTurnos(corrida, d1, a) { // finalistas: 1º turno × 2º turno
    const p = D.preTurno(d1, corrida.nums);
    const linhas = [p.A, p.B].map((c1) => {
      const q = quem(corrida, c1), c2 = a.ordem.find((c) => String(c.numero) === String(c1.numero));
      const v2 = c2 ? c2.votos : 0;
      return `<tr><td class="l">${nomeHtml(q)}</td><td>${pct(c1.votos / (p.vv || 1))}</td><td>${fmt(c1.votos)}</td><td><b>${a.vv ? pct(v2 / a.vv) : "–"}</b></td><td>${fmt(v2)}</td></tr>`;
    }).join("");
    return `<table><thead><tr><th class="l">Candidato</th><th>1º turno</th><th>votos</th><th>2º turno agora</th><th>votos</th></tr></thead><tbody>${linhas}</tbody></table>
      <p class="nota">No 1º turno, ${fmt(p.outros)} votos válidos (${pct(p.outros / (p.vv || 1))}) foram para os demais candidatos. No 2º turno, os percentuais se referem só aos dois.</p>`;
  }

  // ------------------------------------------------------------ página de uma disputa (Presidente ou Governador)
  let ultimo = null, timer = null;
  async function carregarDisputa() {
    const uf = CFG.pagina === "presidente" ? "BR" : CFG.uf, corrida = CORRIDAS[uf], ab = uf;
    status("atualizando…", "busy");
    try {
      const [d1, d2] = await Promise.all([turno1(corrida, ab), seguro(turno2(corrida, ab))]);
      let ufs = null;
      if (uf === "BR") ufs = await Promise.all(T.UFS.map(async (u) => ({ u, d1: await seguro(turno1(corrida, u)), d2: await seguro(turno2(corrida, u)) })));
      ultimo = { corrida, d1, d2, ufs };
      renderDisputa(ultimo);
      status(d2 ? `TSE: ${d2.hora.trim()} · atualizado ${new Date().toLocaleTimeString("pt-BR")}` : `1º turno: dados finais do TSE · arquivo do 2º turno ainda não publicado pelo TSE para ${corrida.nome}`, "");
    } catch (e) { status("falha ao buscar no TSE: " + e.message + " — tente Atualizar", "erro"); }
    agendar(carregarDisputa);
  }

  function renderDisputa({ corrida, d1, d2, ufs }) {
    const a = d2 ? D.apuracao(d2) : { iniciou: false };
    const p = D.preTurno(d1, corrida.nums);
    const qa = quem(corrida, p.A), qb = quem(corrida, p.B);
    // cabeçalho
    $("#k-secoes").textContent = d2 && a.iniciou ? d2.pst + "%" : "–";
    $("#k-situ").innerHTML = d2 ? situacao(corrida, a, d2) : '<span class="tag agora">aguardando votos</span>';
    // bloco principal
    const ao = $("#ao-vivo");
    if (a.iniciou) {
      ao.hidden = false;
      $("#ao-vivo-corpo").innerHTML = duelo(corrida, a) + `<p class="nota">${faltaTxt(corrida, a, d2)}</p>`;
      $("#compara").innerHTML = comparaTurnos(corrida, d1, a);
      $("#painel-compara").hidden = false;
    } else {
      ao.hidden = true; $("#painel-compara").hidden = true;
    }
    $("#jogo").innerHTML = emJogo(corrida, d1);
    const sj = d1.vansj ? ` ${fmt(d1.vansj)} votos de candidatos com registro em julgamento ("anulados sub judice") não entram nos válidos.` : "";
    $("#turno1").innerHTML = barras1(corrida, d1) + `<p class="nota">Votos válidos no 1º turno: ${fmt(p.vv)}.${sj} Fonte: TSE, totalização final.</p>`;
    $("#titulo-jogo").textContent = a.iniciou ? "Como chegaram ao 2º turno" : "O que está em jogo";
    if (ufs) renderEstados(corrida, ufs, a.iniciou);
  }

  function renderEstados(corrida, ufs, aoVivo) {
    const [na, nb] = corrida.nums;
    const qa = { ...quem(corrida, { numero: na }) }, qb = { ...quem(corrida, { numero: nb }) };
    const v = (d, n) => { const c = d && d.cands.find((x) => String(x.numero) === String(n)); return c ? c.votos : 0; };
    let linhas;
    const cab = (t) => `<th>${dot(qa.cor)}${esc(qa.nome.split(" ")[0])} ${t}</th><th>${dot(qb.cor)}${esc(qb.nome.split(" ")[0])} ${t}</th>`;
    if (aoVivo) {
      linhas = ufs.map(({ u, d1, d2 }) => {
        if (!d2) return `<tr class="fraca"><td class="l"><b>${u}</b> <small>${T.NOMES[u]}</small></td><td colspan="6" class="l">sem dados do 2º turno agora</td></tr>`;
        const va = v(d2, na), vb = v(d2, nb), s = va + vb || 1, a1 = v(d1, na), b1 = v(d1, nb), vv1 = d1 ? d1.vv || 1 : 1;
        const lid = va === vb ? "" : (va > vb ? qa : qb);
        return `<tr><td class="l"><b>${u}</b> <small>${T.NOMES[u]}</small></td><td>${d2.pst || "–"}%</td><td><b>${va + vb ? pct(va / s) : "–"}</b></td><td><b>${va + vb ? pct(vb / s) : "–"}</b></td><td class="l">${lid ? dot(lid.cor) + fmt(Math.abs(va - vb)) : "–"}</td><td class="fr">${pct(a1 / vv1)}</td><td class="fr">${pct(b1 / vv1)}</td></tr>`;
      }).join("");
      $("#estados").innerHTML = `<table><thead><tr><th class="l">Estado</th><th>Seções</th>${cab("2º t.")}<th class="l">Vantagem</th>${cab("1º t.")}</tr></thead><tbody>${linhas}</tbody></table><p class="nota">2º turno: % dos votos válidos no estado. 1º turno: % dos válidos com todos os candidatos.</p>`;
    } else {
      const ord = ufs.filter((x) => x.d1).sort((x, y) => y.d1.eleitorado - x.d1.eleitorado);
      linhas = ord.map(({ u, d1 }) => {
        const a1 = v(d1, na), b1 = v(d1, nb), vv1 = d1.vv || 1, out = vv1 - a1 - b1, dif = a1 - b1;
        return `<tr><td class="l"><b>${u}</b> <small>${T.NOMES[u]}</small></td><td>${fmt(d1.eleitorado)}</td><td><b>${pct(a1 / vv1)}</b></td><td><b>${pct(b1 / vv1)}</b></td><td class="l">${dot(dif >= 0 ? qa.cor : qb.cor)}${fmt(Math.abs(dif))}</td><td>${pct(out / vv1)}</td><td>${fmt(out)}</td></tr>`;
      }).join("");
      $("#estados").innerHTML = `<table><thead><tr><th class="l">Estado</th><th>Eleitores</th>${cab("1º t.")}<th class="l">Vantagem</th><th title="Votos válidos dos candidatos eliminados">Outros</th><th>votos</th></tr></thead><tbody>${linhas}</tbody></table><p class="nota">Resultado final do 1º turno em cada estado, do maior para o menor eleitorado. "Outros": votos de quem ficou fora do 2º turno, ou seja, eleitores que vão escolher de novo.</p>`;
    }
  }

  // ------------------------------------------------------------ painel (todas as disputas)
  async function carregarPainel() {
    status("atualizando…", "busy");
    try {
      const res = await Promise.all(Object.entries(CORRIDAS).map(async ([uf, c]) => ({ uf, c, d1: await seguro(turno1(c, uf)), d2: await seguro(turno2(c, uf)) })));
      renderPainel(res);
      status(`atualizado ${new Date().toLocaleTimeString("pt-BR")}`, "");
    } catch (e) { status("falha ao buscar no TSE: " + e.message, "erro"); }
    agendar(carregarPainel);
  }
  function renderPainel(res) {
    $("#cartoes").innerHTML = res.map(({ uf, c, d1, d2 }) => {
      const a = d2 ? D.apuracao(d2) : { iniciou: false };
      let corpo, rodape;
      if (a.iniciou) {
        const v = a.vv || 1;
        corpo = [a.A, a.B].map((k) => { const q = quem(c, k); return `<div class="lin">${nomeHtml(q)}<b class="pc">${pct(k.votos / v)}</b></div>`; }).join("") +
          `<div class="d-barra mini"><div style="width:${(a.A.votos / v * 100).toFixed(2)}%;background:${quem(c, a.A).cor}"></div><div style="width:${(a.B.votos / v * 100).toFixed(2)}%;background:${quem(c, a.B).cor}"></div><i class="d-meio"></i></div>`;
        rodape = `${d2.pst}% das seções · ${situacao(c, a, d2)}`;
      } else if (d1) {
        const p = D.preTurno(d1, c.nums), v = p.vv || 1;
        corpo = [p.A, p.B].map((k) => { const q = quem(c, k); return `<div class="lin">${nomeHtml(q)}<b class="pc">${pct(k.votos / v)}</b></div>`; }).join("");
        rodape = `resultado do 1º turno · outros candidatos: ${pct(p.outros / v)}` + (d1.vansj > p.vv * 0.01 ? ` · ${fmt(d1.vansj)} votos sub judice fora dos válidos` : "");
      } else { corpo = '<p class="vazio">Sem dados do TSE agora.</p>'; rodape = ""; }
      return `<a class="cartao${uf === "BR" ? " grande" : ""}" href="${c.url}${simQ}"><h3>${uf === "BR" ? "Presidente da República" : "Governador · " + esc(c.nome)}</h3>${corpo}<p class="rod">${rodape}</p><span class="ver">ver a disputa →</span></a>`;
    }).join("");
  }

  // ------------------------------------------------------------ comum
  function status(t, cls) { const st = $("#status"); if (st) { st.textContent = t; st.className = "st" + (cls ? " " + cls : ""); } }
  function agendar(fn) { clearTimeout(timer); if (simAtivo || Date.now() >= VIGIA) timer = setTimeout(fn, INTERVALO * 1000); }

  function init() {
    contagem(); setInterval(contagem, 30000);
    const fn = CFG.pagina === "painel" ? carregarPainel : carregarDisputa;
    const at = $("#atualizar"); if (at) at.addEventListener("click", fn);
    fn();
  }
  window.T2 = { CORRIDAS, GOV };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

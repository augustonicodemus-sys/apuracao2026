/* Apuração ao vivo — eleições proporcionais 2026 (Deputado Federal; Deputado Estadual via window.CFG) */
(function () {
  "use strict";
  const M = window.Motor;
  const BASE = "https://resultados.tse.jus.br/oficial";
  const INDICE = BASE + "/comum/config/ele-c.json";
  const CFG = window.CFG || {};
  const ANO = 2026, CARGO = CFG.cargo || 6;
  const NOME_CARGO = CFG.nomeCargo || "Deputado Federal";
  const VAGAS = CFG.vagas || { AC: 8, AL: 9, AP: 8, AM: 8, BA: 39, CE: 22, DF: 8, ES: 10, GO: 17, MA: 18, MT: 8, MS: 8, MG: 53, PA: 17, PB: 12, PR: 30, PE: 25, PI: 10, RJ: 46, RN: 8, RS: 31, RO: 8, RR: 8, SC: 16, SP: 70, SE: 8, TO: 8 };
  const cargoUf = (u) => (CFG.cargoPorUf && CFG.cargoPorUf[u]) || CARGO; // DF elege deputados distritais (cargo 8)
  const NOMES = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
  const UFS = Object.keys(VAGAS).sort();
  const INTERVALO = 60; // s
  const params = new URLSearchParams(location.search);
  let eleicao = params.get("eleicao") ? Number(params.get("eleicao")) : null;
  let ano = params.get("ano") ? Number(params.get("ano")) : ANO;
  const fonteLocal = params.get("src"); // JSON local para teste
  let uf = (params.get("uf") || localStorage.getItem("uf") || "SP").toUpperCase();
  let destaque = params.get("partido") || localStorage.getItem("destaque") || "";
  let timer = null, ultimoRes = null, ultimoBruto = null, visaoGeral = false;

  const $ = (s) => document.querySelector(s);
  const fmt = M.fmt;
  const pct = (x, d = 1) => (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v) => { if (v == null) return 0; const s = String(v).replace(/[^\d-]/g, ""); return s && s !== "-" ? parseInt(s, 10) : 0; };
  const normSigla = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, "");
  const titulo = (s) => String(s).toLowerCase().replace(/(^|\s|-)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());

  // ------------------------------------------------------------ TSE
  async function getJson(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status + " em " + url.split("/").pop());
    return r.json();
  }
  async function descobrirEleicao() {
    const d = await getJson(INDICE);
    const achadas = [];
    for (const pl of d.pl || []) for (const e of pl.e || []) {
      const cargos = new Set();
      for (const abr of e.abr || []) for (const cp of abr.cp || []) cargos.add(String(cp.cd));
      achadas.push({ cd: num(e.cd), nm: String(e.nm).replace(/&#186;/g, "º"), dt: String(pl.dt || ""), t: String(e.t || ""), cargos });
    }
    const c = achadas.filter((a) => a.dt.includes(String(ano)) && a.cargos.has(String(CARGO)) && !/suplement/i.test(a.nm));
    const t1 = c.filter((a) => a.t === "1");
    const esc1 = (t1.length ? t1 : c)[0];
    if (!esc1) throw new Error("O índice do TSE ainda não lista a eleição de " + ano + " para " + NOME_CARGO + ".");
    return { cd: esc1.cd, nm: esc1.nm, gerado: d.dg + " " + d.hg };
  }
  const urlUf = (u) => fonteLocal ? fonteLocal : `${BASE}/ele${ano}/${eleicao}/dados/${u.toLowerCase()}/${u.toLowerCase()}-c${String(cargoUf(u)).padStart(4, "0")}-e${String(eleicao).padStart(6, "0")}-u.json`;

  function nomeFed(f) { const nm = String(f.nm || ""); if (nm.includes(" - ")) return nm.split(" - ").pop().trim().toUpperCase(); return normSigla(f.sg || nm); }

  function parseU(d, u) {
    const cargos = d.carg;
    if (!Array.isArray(cargos) || !cargos.length) throw new Error("JSON sem 'carg'");
    const cg = cargos.find((c) => String(c.cd) === String(cargoUf(u))) || cargos[0];
    const fedPorNum = {}, federacoes = {};
    for (const f of cg.fed || []) { const id = nomeFed(f); fedPorNum[String(f.n)] = id; federacoes[id] = []; }
    const candidatos = [], legenda = {}, partidos = {}, anulados = [];
    for (const a of cg.agr || []) for (const p of a.par || []) {
      const sg = normSigla(p.sg || "");
      const nfed = String(p.nfed || "");
      if (nfed && fedPorNum[nfed]) federacoes[fedPorNum[nfed]].push(sg);
      legenda[sg] = num(p.tvtl);
      partidos[sg] = { nome: p.nm || sg, numero: String(p.n || ""), nominais: num(p.tvtn), legenda: num(p.tvtl) };
      for (const k of p.cand || []) {
        // destinação do voto (dvt): "Anulado sub judice"/"Anulado" não conta para ninguém; "Válido (legenda)" vai para a legenda
        const dvt = String(k.dvt || "");
        if (/anulad/i.test(dvt)) { anulados.push({ nome: titulo(k.nmu || k.nm || ""), numero: String(k.n || ""), partido: sg, votos: num(k.vap), dvt }); continue; }
        if (/legenda/i.test(dvt)) { legenda[sg] += num(k.vap); continue; }
        candidatos.push({ nome: titulo(k.nm || k.nmu || ""), numero: String(k.n || ""), partido: sg, votos: num(k.vap), situacaoTse: String(k.st || "") });
      }
    }
    for (const k of Object.keys(federacoes)) if (!federacoes[k].length) delete federacoes[k];
    const s = d.s || {}, v = d.v || {}, e = d.e || {};
    return { eleitorado: num(e.te), eleitoradoApurado: e.esnt != null ? Math.max(0, num(e.te) - num(e.esnt)) : (e.est != null ? num(e.est) : null), candidatos, anulados, legenda, partidos, federacoes, qeTse: num(cg.qe), vagasTse: num(cg.nv), pst: s.pst || d.pst || "", vv: num(v.vv || d.vv), vnom: num(v.vnom || d.vnom), vl: num(v.vl || d.vl), hora: (d.dg && d.hg) ? `${d.dg} ${d.hg}` : `${d.dt || ""} ${d.ht || ""}`, nomeCargo: cg.nmn || "" };
  }

  // ------------------------------------------------------------ render helpers
  function tabela(cab, linhas, esq, classes) {
    const th = cab.map((c, i) => `<th class="${esq.includes(i) ? "l" : ""}">${c}</th>`).join("");
    const tr = linhas.map((ln, j) => `<tr class="${classes ? classes[j] : ""}">${ln.map((v, i) => `<td class="${esq.includes(i) ? "l" : ""}">${v}</td>`).join("")}</tr>`).join("");
    return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }
  const tag = (t) => ({ QP: '<span class="tag qp">quociente</span>', SOBRA: '<span class="tag sobra">sobra</span>', ART111: '<span class="tag art">art. 111</span>' }[t] || "");
  const ehDest = (p) => destaque && normSigla(p) === normSigla(destaque);

  function renderUf(dados, res) {
    const f = M.fila(res);
    const qe = res.qe;
    $("#uf-nome").textContent = NOMES[uf];
    $("#uf-vagas").textContent = `${res.vagas} cadeiras`;
    const pst = dados.pst ? dados.pst.replace(".", ",") + "%" : "–";
    // --- dois quadros: quociente agora e quociente estimado com 100% das urnas
    const kp = (k, v, t) => `<div class="kpi"${t ? ` title="${t}"` : ""}><span>${k}</span><b>${v}</b></div>`;
    let fator = 0; // válidos finais estimados = válidos agora × fator
    if (dados.eleitoradoApurado > 0 && dados.eleitorado > 0) fator = dados.eleitorado / dados.eleitoradoApurado;
    else { const p = parseFloat(String(dados.pst || "0").replace(",", ".")); if (p > 0) fator = 100 / p; }
    const vEst = res.validos && fator ? Math.round(res.validos * fator) : 0;
    const qeEst = vEst ? M.quocienteEleitoral(vEst, res.vagas) : 0;
    const pc = (q, f) => q ? fmt(Math.ceil(q * f - 1e-9)) : "–";
    const apur = dados.eleitorado && dados.eleitoradoApurado != null ? (dados.eleitoradoApurado / dados.eleitorado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "–";
    const tdq = (v) => `<td><b>${v}</b></td>`;
    $("#kpis").innerHTML = `<div class="qwrap"><table class="qtab"><thead><tr><th class="l"></th><th>Apurado</th><th>Votos válidos</th><th>Quociente eleitoral</th><th>10% do QE</th><th>20% do QE</th><th>80% do QE</th></tr></thead><tbody>` +
      `<tr><th title="Se a apuração terminasse agora (seções totalizadas)">Quociente apurado</th>` + [pst, fmt(res.validos), fmt(qe), fmt(res.piso10), fmt(res.piso20), fmt(res.piso80)].map(tdq).join("") + `</tr>` +
      `<tr class="est"><th title="Com 100% das urnas, supondo que as seções que faltam tenham o mesmo comparecimento e a mesma proporção de votos válidos das já apuradas">Quociente estimado</th>` + [`<span title="Eleitorado já apurado: ${apur}">100% (est.)</span>`, vEst ? fmt(vEst) : "–", qeEst ? fmt(qeEst) : "–", pc(qeEst, 0.1), pc(qeEst, 0.2), pc(qeEst, 0.8)].map(tdq).join("") + `</tr>` +
      `</tbody></table></div>`;

    // --- tabela: força de cada legenda (QEs, cadeiras, candidatos aptos)
    const forca = f.filter((d) => d.total > 0).map((d) => {
      const L = res.legendas[d.legenda];
      return { d, qes: qe ? d.total / qe : 0, a10: L.candidatos.filter((c) => c.votos >= res.piso10).length, a20: L.candidatos.filter((c) => c.votos >= res.piso20).length };
    }).sort((a, b) => b.qes - a.qes);
    const maxQes = Math.max(1, ...forca.map((x) => x.qes));
    $("#forca").innerHTML = forca.length ? `<div class="tw"><table class="ftab"><thead><tr><th class="l">Legenda</th><th class="l">Nº de quocientes (QE)</th><th>Cadeiras</th><th title="Candidatos com pelo menos 10% do QE (podem ocupar vaga do quociente partidário)">Aptos ≥10% QE</th><th title="Candidatos com pelo menos 20% do QE (dão à legenda o direito de disputar sobras)">Aptos ≥20% QE</th></tr></thead><tbody>` +
      forca.map((x) => `<tr class="${ehDest(x.d.partidos) || ehDest(x.d.legenda) ? "dest" : ""}"><td class="l"><b>${esc(x.d.legenda)}</b></td><td class="l"><span class="qb"><i style="width:${(x.qes / maxQes * 100).toFixed(1)}%"></i></span><b>${x.qes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td><td><b>${x.d.cadeiras}</b></td><td>${x.a10}</td><td>${x.a20}</td></tr>`).join("") +
      `</tbody></table></div>` : '<p class="vazio">Sem votos apurados ainda.</p>';

    // --- gráfico: médias para disputa da próxima cadeira
    const ultima = res.rodadas.length ? res.rodadas[res.rodadas.length - 1] : null;
    const corte = ultima ? ultima.media : null;
    const terceira = ultima && /3ª fase/.test(ultima.regra);
    const ordemCor = { ultima: 0, apta: 1, sem20: 2, fora: 3 };
    const lst = f.filter((d) => d.total > 0).map((d) => ({ d, cls: ultima && d.legenda === ultima.legenda ? "ultima" : (d.aptaSobras ? "apta" : (d.atinge80 ? "sem20" : "fora")) }))
      .sort((a, b) => ordemCor[a.cls] - ordemCor[b.cls] || b.d.mediaProx - a.d.mediaProx);
    const maxMedia = Math.max(1, ...lst.map((x) => x.d.mediaProx), corte || 0) * 1.08;
    const barras = lst.map(({ d, cls }) => {
      const w = Math.min(100, d.mediaProx / maxMedia * 100);
      const L = res.legendas[d.legenda];
      const q2 = (v) => (v / qe).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const p1 = (x) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
      const prox20 = L.candidatos.find((c) => !c.eleito && c.votos >= res.piso20);
      const melhor = L.candidatos.find((c) => !c.eleito);
      const precisa = corte != null ? q2(corte * (d.cadeiras + 1)) : "";
      let nota;
      if (corte == null) nota = d.cadeiras ? `${d.cadeiras} pelo quociente; nenhuma sobra distribuída ainda` : `tem ${q2(d.total)} QE; precisa de 1,00 QE para a primeira cadeira`;
      else if (cls === "ultima") nota = `levou a última cadeira com média ${fmt(ultima.media)} (${esc(ultima.candidato)})` + (prox20 ? ` · próximo apto com 20% do QE: ${esc(prox20.nome)}` : " · sem outro candidato com 20% do QE");
      else if (!melhor) nota = `fora da disputa: todos os candidatos da lista já estão eleitos`;
      else if (terceira) nota = `3ª fase (todas disputam): tem ${q2(d.total)} QE; precisa de ${precisa} QE para passar a linha`;
      else if (cls === "apta") nota = `tem ${q2(d.total)} QE; precisa de ${precisa} QE para tomar a última cadeira`;
      else if (cls === "sem20") nota = `fora da disputa: nenhum não eleito com 20% do QE (faltam ${p1(Math.max(0, 20 - melhor.votos / qe * 100))} do QE para ${esc(melhor.nome)})`;
      else nota = `fora da disputa: abaixo de 80% do QE (tem ${q2(d.total)} QE; precisa de 0,80)`;
      return `<div class="barra ${cls} ${ehDest(d.partidos) || ehDest(d.legenda) ? "dest" : ""}">
        <div class="bl"><b>${esc(d.legenda)}</b><em>${d.cadeiras} ${d.cadeiras === 1 ? "cadeira" : "cadeiras"}</em></div>
        <div class="bt"><div class="bf" style="width:${w.toFixed(2)}%"></div><span class="bv">${fmt(d.mediaProx)}</span></div>
        <div class="bn">${nota}</div></div>`;
    }).join("");
    const ratio = corte != null ? corte / maxMedia : 0;
    const linhaCorte = corte != null ? `<div class="corte ${ratio > 0.4 ? "dir" : ""}" style="left:calc(var(--lab) + var(--gap) + (100% - var(--lab) - var(--gap) - var(--val)) * ${ratio.toFixed(4)})"><span>média que levou a última cadeira: ${fmt(corte)}</span></div>` : "";
    $("#grafico").innerHTML = (terceira ? '<p class="aviso">Nenhuma legenda tem ao mesmo tempo 80% do QE e candidato com 20% do QE: a última cadeira saiu pela 3ª fase (STF), em que todas as legendas disputam pela maior média, sem esses requisitos.</p>' : "") +
      (barras ? `<div class="gwrap">${linhaCorte}${barras}</div>` : '<p class="vazio">Sem votos apurados ainda. Quando a totalização começar, as barras aparecem aqui.</p>');

    // --- legendas
    const linhas = [], classes = [];
    for (const d of f) {
      const situ = d.aptaSobras ? "apta" : (d.atinge80 ? "≥80%, sem candidato a 20%" : "abaixo de 80%");
      const prox = d.proxNome ? `${esc(d.proxNome)} <small>${d.proxNumero} · ${fmt(d.proxVotos)}</small>` : "–";
      linhas.push([esc(d.legenda), fmt(d.total), pct(d.pctQe), d.qp, d.sobras, `<b>${d.cadeiras}</b>`, fmt(d.mediaProx), situ, fmt(d.faltamProxQp), d.faltamTomarSobra != null ? fmt(d.faltamTomarSobra) : "–", fmt(d.faltamCand20), prox, fmt(d.legendaVotos)]);
      classes.push((ehDest(d.partidos) || ehDest(d.legenda)) ? "dest" : (d.aptaSobras ? "" : "fraca"));
    }
    $("#legendas").innerHTML = tabela(["Legenda", "Votos", "% do QE", "Quociente", "Sobras", "Cadeiras", "Média p/ próx. vaga", "Sobras", "Faltam p/ +1 QP", "Faltam p/ tomar vaga", "Faltam p/ cand. 20%", "Próximo da fila", "Votos de legenda"], linhas, [0, 7, 11], classes);

    // --- eleitos
    const el = [...res.eleitos].sort((a, b) => b.votos - a.votos);
    $("#eleitos-n").textContent = `${el.length} de ${res.vagas}`;
    $("#eleitos").innerHTML = el.length ? tabela(["#", "Candidato", "Nº", "Partido", "Legenda", "Votos", "% do QE", "Via"],
      el.map((c, i) => [i + 1, esc(c.nome), c.numero, esc(c.partido), esc(c.legendaId), fmt(c.votos), pct(c.votos / qe), tag(c.eleito)]), [1, 3, 4, 7], el.map((c) => ehDest(c.partido) ? "dest" : "")) : '<p class="vazio">Ninguém eleito ainda.</p>';

    // --- rodadas
    $("#rodadas").innerHTML = res.rodadas.length ? tabela(["Rodada", "Ganhou", "Média", "Candidato", "2ª colocada", "Média da 2ª", "Faltou à 2ª", "Regra"],
      res.rodadas.map((r) => [r.rodada, esc(r.legenda), fmt(r.media), `${esc(r.candidato)} <small>${r.numero} · ${fmt(r.votosCand)}</small>`, esc(r.segunda), fmt(r.mediaSegunda), fmt(r.faltou), r.regra]), [1, 3, 4, 7]) : '<p class="vazio">Nenhuma sobra distribuída ainda.</p>';

    // --- suplentes
    const sup = [], supCls = [];
    for (const L of Object.values(res.legendas).sort((a, b) => (b.votosNominais + b.votosLegenda) - (a.votosNominais + a.votosLegenda))) {
      let n = 0;
      for (const c of L.candidatos) {
        if (c.eleito) continue;
        if (++n > 3) break;
        const apto = c.votos >= res.piso20 ? "20%" : (c.votos >= res.piso10 ? "10%" : "não");
        sup.push([esc(L.id), n + "º", esc(c.nome), c.numero, esc(c.partido), fmt(c.votos), apto]);
        supCls.push(ehDest(c.partido) ? "dest" : "");
      }
    }
    $("#suplentes").innerHTML = sup.length ? tabela(["Legenda", "Suplente", "Candidato", "Nº", "Partido", "Votos", "Apto a"], sup, [0, 2, 4], supCls) : "";

    // --- destaque
    const dsec = $("#destaque-sec");
    if (destaque) {
      const cs = [];
      for (const L of Object.values(res.legendas)) for (const c of L.candidatos) if (ehDest(c.partido)) cs.push(c);
      cs.sort((a, b) => b.votos - a.votos);
      $("#destaque-nome").textContent = destaque;
      $("#destaque").innerHTML = cs.length ? tabela(["Candidato", "Nº", "Votos", "% do QE", "Apto a", "Situação"],
        cs.map((c) => [esc(c.nome), c.numero, fmt(c.votos), pct(c.votos / qe), c.votos >= res.piso20 ? "20%" : (c.votos >= res.piso10 ? "10%" : "não"), c.eleito ? tag(c.eleito) : '<span class="tag nao">não eleito</span>']), [0, 5]) : `<p class="vazio">${esc(destaque)} não tem candidatos em ${NOMES[uf]}.</p>`;
      dsec.hidden = false;
    } else dsec.hidden = true;

    $("#avisos").innerHTML = res.avisos.map((a) => `<p class="aviso">${esc(a)}</p>`).join("");
    const extra = [];
    if (dados.qeTse && qe && dados.qeTse !== qe) extra.push(`O TSE informa QE ${fmt(dados.qeTse)}; o cálculo aqui dá ${fmt(qe)}.`);
    if (dados.vagasTse && dados.vagasTse !== res.vagas) extra.push(`O TSE informa ${dados.vagasTse} vagas; a tabela interna tem ${res.vagas}.`);
    $("#avisos").innerHTML += extra.map((a) => `<p class="aviso">${a}</p>`).join("");
  }

  function preencherPartidos(partidos) {
    const sel = $("#partido");
    const atual = destaque;
    const opts = Object.keys(partidos).sort().map((p) => `<option value="${p}" ${normSigla(p) === normSigla(atual) ? "selected" : ""}>${p}</option>`).join("");
    sel.innerHTML = `<option value="">— nenhum —</option>${opts}`;
  }

  // ------------------------------------------------------------ carga
  async function carregar(manual) {
    const st = $("#status");
    try {
      st.textContent = "atualizando…"; st.className = "st busy";
      if (!eleicao && fonteLocal) { eleicao = -1; $("#eleicao-nome").textContent = "arquivo local de teste"; }
      if (!eleicao) { const e = await descobrirEleicao(); eleicao = e.cd; $("#eleicao-nome").textContent = e.nm; }
      else if (!$("#eleicao-nome").textContent.trim() || $("#eleicao-nome").textContent === "—") $("#eleicao-nome").textContent = "código " + eleicao;
      const bruto = window.Sim ? Sim.aplicar(await getJson(urlUf(uf)), uf) : await getJson(urlUf(uf));
      const dados = parseU(bruto, uf);
      ultimoBruto = bruto;
      const vagas = dados.vagasTse || VAGAS[uf];
      const validos = dados.vv > 0 ? dados.vv : null;
      const soma = dados.candidatos.reduce((s, c) => s + c.votos, 0) + Object.values(dados.legenda).reduce((s, v) => s + v, 0);
      const res = M.calcular(dados.candidatos, dados.legenda, vagas, dados.federacoes, validos && validos >= soma ? validos : null);
      ultimoRes = res;
      preencherPartidos(dados.partidos);
      renderUf(dados, res);
      const agora = new Date();
      st.textContent = `TSE: ${dados.hora.trim() || "–"} · atualiza sozinho a cada ${INTERVALO} s · última às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      st.className = "st";
      document.title = `${uf} · ${NOME_CARGO} 2026 · quem estaria eleito agora`;
    } catch (e) {
      st.textContent = "falha ao buscar no TSE: " + e.message + " — nova tentativa em " + INTERVALO + " s";
      st.className = "st erro";
    }
    if (visaoGeral && !manual) visaoGeralCarregar(true);
    clearTimeout(timer);
    timer = setTimeout(() => carregar(false), INTERVALO * 1000);
  }

  // ------------------------------------------------------------ Brasil: cadeiras por partido somando as 27 UFs
  function nacional(resultados) {
    const ok = resultados.filter((r) => !r.erro);
    const totalVagas = UFS.reduce((s, u) => s + VAGAS[u], 0);
    const porPartido = {};
    let distribuidas = 0, secoes = 0, nSec = 0;
    for (const r of ok) {
      const p = parseFloat(String(r.d.pst || "0").replace(",", "."));
      if (!isNaN(p)) { secoes += p; nSec++; }
      for (const c of r.res.eleitos) {
        const k = c.partido;
        if (!porPartido[k]) porPartido[k] = { partido: k, cadeiras: 0, ufs: {} };
        porPartido[k].cadeiras++; porPartido[k].ufs[r.u] = (porPartido[k].ufs[r.u] || 0) + 1;
        distribuidas++;
      }
    }
    const faltando = UFS.length - ok.length;
    const cab = `<div class="kpis"><div class="kpi"><span>Cadeiras distribuídas</span><b>${distribuidas} de ${totalVagas}</b></div>` +
      `<div class="kpi"><span>Média de seções totalizadas</span><b>${nSec ? (secoes / nSec).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%</b></div>` +
      `<div class="kpi"><span>Partidos com cadeira</span><b>${Object.keys(porPartido).length}</b></div></div>` +
      (faltando ? `<p class="aviso">${faltando} estado(s) não responderam agora; o total do Brasil está incompleto.</p>` : "");
    const lista = Object.values(porPartido).sort((a, b) => b.cadeiras - a.cadeiras || a.partido.localeCompare(b.partido));
    if (!lista.length) return `<h3 class="sub3">Brasil · cadeiras por partido</h3>${cab}<p class="vazio">Sem votos apurados ainda. Quando a totalização começar, o total por partido aparece aqui.</p>`;
    const max = lista[0].cadeiras;
    const barras = lista.map((x) => {
      const ufs = Object.entries(x.ufs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([u, n]) => n > 1 ? `${u} ${n}` : u).join(", ");
      return `<div class="barra nac ${ehDest(x.partido) ? "dest" : ""}">
        <div class="bl"><b>${esc(x.partido)}</b><em>${pct(x.cadeiras / totalVagas)}</em></div>
        <div class="bt"><div class="bf" style="width:${(x.cadeiras / max * 100).toFixed(2)}%"></div><span class="bv">${x.cadeiras}</span></div>
        <div class="bn">${ufs}</div></div>`;
    }).join("");
    return `<h3 class="sub3">Brasil · cadeiras por partido se terminasse agora</h3>${cab}<div class="grafico"><div class="gwrap nacw">${barras}</div></div>
      <p class="explica">Soma das cadeiras de cada estado, por partido do candidato eleito (partidos federados aparecem separados). Abaixo de cada barra, os estados onde o partido elege.</p>`;
  }

  // ------------------------------------------------------------ visão geral (todas as UFs)
  async function visaoGeralCarregar(silencioso) {
    const alvo = $("#geral");
    if (!silencioso) alvo.innerHTML = '<p class="vazio">Buscando os 27 estados no TSE…</p>';
    if (!eleicao) { try { eleicao = (await descobrirEleicao()).cd; } catch (e) { alvo.innerHTML = `<p class="aviso">${esc(e.message)}</p>`; return; } }
    const linhas = [], classes = [];
    const resultados = await Promise.all(UFS.map(async (u) => {
      try { const d = parseU(window.Sim ? Sim.aplicar(await getJson(urlUf(u)), u) : await getJson(urlUf(u)), u); const soma = d.candidatos.reduce((s, c) => s + c.votos, 0) + Object.values(d.legenda).reduce((s, v) => s + v, 0);
        return { u, d, res: M.calcular(d.candidatos, d.legenda, d.vagasTse || VAGAS[u], d.federacoes, d.vv >= soma && d.vv > 0 ? d.vv : null) }; }
      catch (e) { return { u, erro: e.message }; }
    }));
    const nac = nacional(resultados);
    for (const r of resultados) {
      if (r.erro) { linhas.push([r.u, "–", "–", "–", "–", esc(r.erro)]); classes.push("fraca"); continue; }
      const f = M.fila(r.res);
      const top = f.filter((d) => d.cadeiras > 0).map((d) => `${esc(d.legenda)} ${d.cadeiras}`).join(", ");
      let dl = "";
      if (destaque) { const d = f.find((x) => ehDest(x.partidos) || ehDest(x.legenda)); if (d) dl = `${d.cadeiras} cad. · ${pct(d.pctQe)} do QE · ${d.aptaSobras ? "apta" : "não apta"} às sobras${d.faltamTomarSobra != null ? " · faltam " + fmt(d.faltamTomarSobra) : ""}`; }
      linhas.push([`<a href="?uf=${r.u}${destaque ? "&partido=" + encodeURIComponent(destaque) : ""}${window.Sim && Sim.ativo ? "&sim=" + Sim.pct : ""}">${r.u}</a> <small>${NOMES[r.u]}</small>`, r.d.pst ? r.d.pst + "%" : "–", fmt(r.res.validos), fmt(r.res.qe), `${r.res.eleitos.length}/${r.res.vagas}`, top || "–", dl || "–"]);
      classes.push("");
    }
    alvo.innerHTML = nac + '<h3 class="sub3">Por estado</h3>' + tabela(["UF", "Seções", "Válidos", "QE", "Eleitos", "Cadeiras por legenda (agora)", destaque ? esc(destaque) : "Partido destacado"], linhas, [0, 5, 6], classes);
  }

  // ------------------------------------------------------------ eventos
  function init() {
    const selUf = $("#uf");
    selUf.innerHTML = UFS.map((u) => `<option value="${u}" ${u === uf ? "selected" : ""}>${u} – ${NOMES[u]}</option>`).join("");
    selUf.addEventListener("change", () => { uf = selUf.value; localStorage.setItem("uf", uf); history.replaceState(null, "", `?uf=${uf}${destaque ? "&partido=" + encodeURIComponent(destaque) : ""}${window.Sim && Sim.ativo ? "&sim=" + Sim.pct : ""}`); carregar(true); });
    $("#partido").addEventListener("change", (e) => { destaque = e.target.value; localStorage.setItem("destaque", destaque); history.replaceState(null, "", `?uf=${uf}${destaque ? "&partido=" + encodeURIComponent(destaque) : ""}${window.Sim && Sim.ativo ? "&sim=" + Sim.pct : ""}`); if (ultimoRes) carregar(true); });
    if ($("#atualizar")) $("#atualizar").addEventListener("click", () => carregar(true));
    $("#ver-geral").addEventListener("click", (e) => { e.preventDefault(); visaoGeral = !visaoGeral; $("#geral-sec").hidden = !visaoGeral; if (visaoGeral) visaoGeralCarregar(); });
    if ($("#baixar")) $("#baixar").addEventListener("click", () => {
      if (!ultimoRes) return;
      const f = M.fila(ultimoRes);
      let csv = "legenda;partidos;votos;pct_qe;qp;sobras;cadeiras;media_prox;apta_sobras;faltam_prox_qp;faltam_tomar_sobra;faltam_cand20;prox_nome;prox_numero;prox_votos\n";
      for (const d of f) csv += [d.legenda, d.partidos, d.total, (d.pctQe * 100).toFixed(2).replace(".", ","), d.qp, d.sobras, d.cadeiras, Math.round(d.mediaProx), d.aptaSobras, d.faltamProxQp, d.faltamTomarSobra ?? "", d.faltamCand20, d.proxNome, d.proxNumero, d.proxVotos].join(";") + "\n";
      csv += "\nnome;numero;partido;legenda;votos;eleito_via\n";
      for (const L of Object.values(ultimoRes.legendas)) for (const c of L.candidatos) csv += [c.nome, c.numero, c.partido, c.legendaId, c.votos, c.eleito].join(";") + "\n";
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); a.download = `apuracao_${uf}_${Date.now()}.csv`; a.click();
    });
    carregar(true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

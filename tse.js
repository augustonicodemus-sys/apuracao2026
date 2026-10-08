/* Acesso aos arquivos públicos do TSE (resultados.tse.jus.br) — usado pela página inicial.
 * Mesmo parse de app.js (página por estado), mais os campos de eleitorado não apurado. */
(function () {
  "use strict";
  const BASE = "https://resultados.tse.jus.br/oficial";
  const INDICE = BASE + "/comum/config/ele-c.json";
  const VAGAS = { AC: 8, AL: 9, AP: 8, AM: 8, BA: 39, CE: 22, DF: 8, ES: 10, GO: 17, MA: 18, MT: 8, MS: 8, MG: 53, PA: 17, PB: 12, PR: 30, PE: 25, PI: 10, RJ: 46, RN: 8, RS: 31, RO: 8, RR: 8, SC: 16, SP: 70, SE: 8, TO: 8 };
  const NOMES = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
  const UFS = Object.keys(VAGAS).sort();

  const num = (v) => { if (v == null) return 0; const s = String(v).replace(/[^\d-]/g, ""); return s && s !== "-" ? parseInt(s, 10) : 0; };
  const normSigla = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, "");
  const titulo = (s) => String(s).toLowerCase().replace(/(^|\s|-)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());

  async function getJson(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status + " em " + url.split("/").pop());
    return r.json();
  }

  async function descobrirEleicao(ano, cargo) {
    const d = await getJson(INDICE);
    const achadas = [];
    for (const pl of d.pl || []) for (const e of pl.e || []) {
      const cargos = new Set();
      for (const abr of e.abr || []) for (const cp of abr.cp || []) cargos.add(String(cp.cd));
      achadas.push({ cd: num(e.cd), nm: String(e.nm).replace(/&#186;/g, "º"), dt: String(pl.dt || ""), t: String(e.t || ""), cargos });
    }
    const c = achadas.filter((a) => a.dt.includes(String(ano)) && a.cargos.has(String(cargo)) && !/suplement/i.test(a.nm));
    const t1 = c.filter((a) => a.t === "1");
    const esc = (t1.length ? t1 : c)[0];
    if (!esc) throw new Error("O índice do TSE ainda não lista a eleição de " + ano + ".");
    return { cd: esc.cd, nm: esc.nm };
  }

  const urlUf = (ano, eleicao, uf, cargo) => `${BASE}/ele${ano}/${eleicao}/dados/${uf.toLowerCase()}/${uf.toLowerCase()}-c${String(cargo).padStart(4, "0")}-e${String(eleicao).padStart(6, "0")}-u.json`;

  function nomeFed(f) { const nm = String(f.nm || ""); if (nm.includes(" - ")) return nm.split(" - ").pop().trim().toUpperCase(); return normSigla(f.sg || nm); }

  function parseU(d, cargo) {
    const cargos = d.carg;
    if (!Array.isArray(cargos) || !cargos.length) throw new Error("JSON sem 'carg'");
    const cg = cargos.find((c) => String(c.cd) === String(cargo)) || cargos[0];
    const fedPorNum = {}, federacoes = {};
    for (const f of cg.fed || []) { const id = nomeFed(f); fedPorNum[String(f.n)] = id; federacoes[id] = []; }
    const candidatos = [], legenda = {}, partidos = {}, subJudice = [];
    for (const a of cg.agr || []) for (const p of a.par || []) {
      const sg = normSigla(p.sg || "");
      const nfed = String(p.nfed || "");
      if (nfed && fedPorNum[nfed]) federacoes[fedPorNum[nfed]].push(sg);
      legenda[sg] = num(p.tvtl);
      // partido inteiro sub judice (DRAP em julgamento): os votos de legenda também ficam anulados
      if (/anulad/i.test(String(p.dvt || "")) && /sub ?j/i.test(String(p.dvt || "")) && num(p.tval) > 0) subJudice.push({ nome: "Legenda " + sg, urna: "Legenda " + sg, numero: String(p.n || ""), partido: sg, votos: num(p.tval), legenda: true });
      partidos[sg] = { nome: p.nm || sg, numero: String(p.n || "") };
      for (const k of p.cand || []) {
        const dvt = String(k.dvt || ""); // "Anulado sub judice": votos não contam; "Válido (legenda)": vão para a legenda
        if (/anulad/i.test(dvt)) { if (/sub ?j/i.test(dvt) && num(k.vap) > 0) subJudice.push({ nome: titulo(k.nm || k.nmu || ""), urna: titulo(k.nmu || k.nm || ""), numero: String(k.n || ""), partido: sg, votos: num(k.vap), situacaoTse: String(k.st || "") }); continue; }
        if (/legenda/i.test(dvt)) { legenda[sg] += num(k.vap); continue; }
        candidatos.push({ nome: titulo(k.nm || k.nmu || ""), urna: titulo(k.nmu || k.nm || ""), numero: String(k.n || ""), partido: sg, votos: num(k.vap), situacaoTse: String(k.st || "") });
      }
    }
    for (const k of Object.keys(federacoes)) if (!federacoes[k].length) delete federacoes[k];
    const s = d.s || {}, v = d.v || {}, e = d.e || {};
    return {
      candidatos, legenda, partidos, federacoes, subJudice,
      vagasTse: num(cg.nv), qeTse: num(cg.qe),
      pst: s.pst || d.pst || "", secoesTotal: num(s.ts), secoesTot: num(s.st), vv: num(v.vv || d.vv), vansj: num(v.vansj),
      eleitorado: num(e.te), eleitoradoNaoApurado: e.esnt != null ? num(e.esnt) : null,
      hora: (d.dg && d.hg) ? `${d.dg} ${d.hg}` : `${d.dt || ""} ${d.ht || ""}`,
    };
  }

  // Arquivo de cargo majoritário (Presidente 1, Governador 3, Senador 5): lista de candidatos e totais
  function parseMaj(d, cargo) {
    const cargos = d.carg || [];
    const cg = cargos.find((c) => String(c.cd) === String(cargo)) || cargos[0] || {};
    const cands = [];
    for (const a of cg.agr || []) for (const p of a.par || []) for (const k of p.cand || []) {
      if (/anulad/i.test(String(k.dvt || ""))) continue; // candidato com votos anulados (sub judice) fica fora da disputa
      cands.push({ nome: titulo(k.nm || k.nmu || ""), urna: titulo(k.nmu || k.nm || ""), numero: String(k.n || ""), partido: normSigla(p.sg || ""), coligacao: a.tp === "c" || (a.par || []).length > 1 ? String(a.nm || "") : "", votos: num(k.vap), st: String(k.st || ""), eleitoTse: k.e === "s" });
    }
    const s = d.s || {}, v = d.v || {}, e = d.e || {};
    return {
      cands, vagas: num(cg.nv) || 1, pst: s.pst || "", pstNum: parseFloat(String(s.pst || "0").replace(",", ".")) || 0,
      vv: num(v.vv), vansj: num(v.vansj), eleitorado: num(e.te), eleitoradoNaoApurado: e.esnt != null ? num(e.esnt) : null,
      hora: (d.dg && d.hg) ? `${d.dg} ${d.hg}` : `${d.dt || ""} ${d.ht || ""}`,
    };
  }
  // teto de votos ainda possíveis (eleitores de seções não totalizadas + anulados sub judice)
  const restantes = (d) => d.eleitoradoNaoApurado != null ? d.eleitoradoNaoApurado + (d.vansj || 0) : (d.eleitorado || 1e12);

  window.TSE = { BASE, VAGAS, NOMES, UFS, num, normSigla, getJson, descobrirEleicao, urlUf, parseU, parseMaj, restantes, titulo };
})();

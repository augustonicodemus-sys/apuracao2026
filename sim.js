/* Simulação para testes: preenche os arquivos reais do TSE (nomes, números, partidos, federações)
 * com votos INVENTADOS, como se X% das seções estivessem apuradas.
 * Ativa só com ?sim=70 (ou outro %) e só fora do site público: arquivo local (file://),
 * localhost ou repositório com "-teste" no endereço. Mostra uma faixa vermelha em todas as páginas. */
(function () {
  "use strict";
  const p = new URLSearchParams(location.search);
  const local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /-teste\//.test(location.pathname);
  const pct = local && p.get("sim") ? Math.min(100, Math.max(1, Number(p.get("sim")) || 70)) : 0;
  const semente = Number(p.get("semente") || 1);

  // força relativa de cada partido (bancada atual + piso), com variação por estado
  const BASE = { PL: 98, PT: 65, UNIAO: 52, PSD: 48, PP: 46, REPUBLICANOS: 42, MDB: 38, PODE: 27, PSDB: 17, PSB: 17, PSOL: 13, PCDOB: 11, PDT: 9, PV: 6, NOVO: 5, AVANTE: 5, SOLIDARIEDADE: 4, REDE: 3, PRD: 3, CIDADANIA: 2, DC: 1, MISSAO: 1 };
  const norm = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, "");

  function rng(txt) { // gerador determinístico por texto
    let h = 2166136261 ^ semente;
    for (const c of txt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const normal = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

  function aplicar(d, uf) {
    if (!pct || !d || !Array.isArray(d.carg)) return d;
    const r = rng("uf" + uf);
    const te = Number(String((d.e || {}).te || "0").replace(/\D/g, "")) || 3000000;
    const validos = Math.round(te * 0.79 * 0.88 * pct / 100);
    const cg = d.carg[0];
    if (["1", "3", "5"].includes(String(cg.cd))) return majoritaria(d, cg, uf, te, r);
    const pars = [];
    for (const a of cg.agr || []) for (const pa of a.par || []) {
      const sg = norm(pa.sg || "");
      const forca = ((BASE[sg] || 0) + 2) * Math.exp(0.45 * normal(r));
      pars.push({ pa, forca });
    }
    const somaF = pars.reduce((s, x) => s + x.forca, 0) || 1;
    let vv = 0, vnom = 0, vl = 0;
    for (const { pa, forca } of pars) {
      const total = Math.round(validos * forca / somaF);
      const leg = Math.round(total * (0.04 + 0.06 * r()));
      const cands = pa.cand || [];
      const rc = rng(uf + pa.sg);
      const pesos = cands.map(() => Math.exp(1.5 * normal(rc)));
      const sp = pesos.reduce((s, x) => s + x, 0) || 1;
      let nom = 0;
      cands.forEach((k, i) => { const v = Math.round((total - leg) * pesos[i] / sp); k.vap = String(v); nom += v; });
      pa.tvtn = String(nom); pa.tvtl = String(cands.length ? leg : total);
      vv += nom + Number(pa.tvtl); vnom += nom; vl += Number(pa.tvtl);
    }
    d.v = Object.assign({}, d.v, { vv: String(vv), vnom: String(vnom), vl: String(vl), vansj: "0" });
    d.s = Object.assign({}, d.s, { pst: pct.toFixed(2).replace(".", ",") });
    d.e = Object.assign({}, d.e, { te: String(te), esnt: String(Math.round(te * (100 - pct) / 100)), est: String(te - Math.round(te * (100 - pct) / 100)) });
    return d;
  }

  // Presidente, Governador, Senador: votos por candidato conforme a força do partido, com sorteio
  function majoritaria(d, cg, uf, te, r) {
    const porEleitor = String(cg.cd) === "5" ? Number(cg.nv || 1) : 1; // no Senado cada eleitor vota em 2 quando há 2 vagas
    const validos = Math.round(te * 0.79 * 0.9 * pct / 100) * porEleitor;
    const cands = [];
    for (const a of cg.agr || []) for (const pa of a.par || []) for (const k of pa.cand || []) {
      const rc = rng("m" + cg.cd + uf + k.n);
      cands.push({ k, f: ((BASE[norm(pa.sg || "")] || 0) + 4) * Math.exp(0.9 * normal(rc)) });
    }
    const sf = cands.reduce((s, x) => s + x.f, 0) || 1;
    let vv = 0;
    for (const x of cands) { const v = Math.round(validos * x.f / sf); x.k.vap = String(v); vv += v; }
    d.v = Object.assign({}, d.v, { vv: String(vv), vansj: "0" });
    d.s = Object.assign({}, d.s, { pst: pct.toFixed(2).replace(".", ",") });
    d.e = Object.assign({}, d.e, { te: String(te), esnt: String(Math.round(te * (100 - pct) / 100)), est: String(te - Math.round(te * (100 - pct) / 100)) });
    return d;
  }

  if (pct) {
    const faixa = () => {
      const b = document.createElement("div");
      b.textContent = `SIMULAÇÃO PARA TESTE — votos inventados, ${pct}% das seções. Nomes e partidos são os reais do TSE; os números não são resultados.`;
      b.style.cssText = "position:relative;z-index:99;background:#A8403A;color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:7px 14px;text-align:center";
      document.body.prepend(b);
      for (const l of document.querySelectorAll("a[href$='.html'], a[href*='.html?']")) {
        const u = new URL(l.getAttribute("href"), location.href); u.searchParams.set("sim", pct); l.href = u.href;
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", faixa); else faixa();
  }
  window.Sim = { ativo: !!pct, pct, aplicar };
})();

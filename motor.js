/* Motor de distribuição de cadeiras proporcionais — porte fiel de motor.py.
 * Código Eleitoral arts. 106-111 (Leis 13.165/2015, 13.488/2017, 14.211/2021).
 * Funciona no navegador (window.Motor) e no Node (module.exports). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Motor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function quocienteEleitoral(validos, vagas) {
    if (!vagas) return 0;
    const q = validos / vagas, f = q - Math.floor(q);
    return Math.floor(q) + (f > 0.5 ? 1 : 0);
  }
  const piso = (qe, frac) => Math.ceil(qe * frac - 1e-9);

  function proxApto(L, p) {
    for (const c of L.candidatos) if (!c.eleito && c.votos >= p) return c;
    return null;
  }

  /**
   * candidatos: [{nome, numero, partido, votos, situacaoTse?}]
   * legendaVotos: {partido: votos de legenda}
   * vagas: cadeiras da UF
   * federacoes: {"FE BRASIL": ["PT","PCDOB","PV"], ...}
   * validos: total de válidos (opcional; senão soma nominais + legenda)
   */
  function calcular(candidatos, legendaVotos, vagas, federacoes, validos) {
    const avisos = [];
    const fed = {};
    for (const [fid, ps] of Object.entries(federacoes || {})) for (const p of ps) fed[p.toUpperCase()] = fid;
    const legendas = {};
    const get = (partido) => {
      const p = partido.toUpperCase().trim(), lid = fed[p] || p;
      if (!legendas[lid]) legendas[lid] = { id: lid, partidos: [], votosNominais: 0, votosLegenda: 0, candidatos: [], qp: 0, cadeiras: 0, sobras: 0 };
      const L = legendas[lid];
      if (!L.partidos.includes(p)) L.partidos.push(p);
      return L;
    };
    for (const c of candidatos) {
      c.eleito = "";
      const L = get(c.partido);
      c.legendaId = L.id;
      L.candidatos.push(c);
      L.votosNominais += c.votos;
    }
    for (const [p, v] of Object.entries(legendaVotos || {})) get(p).votosLegenda += Number(v) || 0;
    const total = (L) => L.votosNominais + L.votosLegenda;
    for (const L of Object.values(legendas)) L.candidatos.sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome));

    const soma = Object.values(legendas).reduce((s, L) => s + total(L), 0);
    if (validos == null) validos = soma;
    else if (validos !== soma) avisos.push(`Válidos informados (${fmt(validos)}) diferem da soma nominais+legenda (${fmt(soma)}). Usando o valor informado para o QE.`);

    const qe = quocienteEleitoral(validos, vagas);
    const piso10 = piso(qe, 0.10), piso20 = piso(qe, 0.20), piso80 = piso(qe, 0.80);
    const eleitos = [], rodadas = [];
    const res = { qe, piso10, piso20, piso80, legendas, eleitos, rodadas, avisos, validos, vagas, regime: "QP+SOBRAS" };
    if (!qe) { res.regime = "VAZIO"; avisos.push("Sem votos apurados."); return res; }

    for (const L of Object.values(legendas)) { L.qp = Math.floor(total(L) / qe); L.cadeiras = 0; L.sobras = 0; }

    if (Object.values(legendas).every((L) => L.qp === 0)) {
      res.regime = "ART111";
      const todos = [...candidatos].sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome));
      for (const c of todos.slice(0, vagas)) { c.eleito = "ART111"; eleitos.push(c); legendas[c.legendaId].cadeiras++; }
      avisos.push("Nenhuma legenda atingiu o quociente eleitoral: aplicado o art. 111 (eleitos os mais votados).");
      return res;
    }

    for (const L of Object.values(legendas)) {
      for (let i = 0; i < L.qp; i++) {
        const c = proxApto(L, piso10);
        if (!c) { avisos.push(`${L.id}: tem direito a ${L.qp} vaga(s) pelo QP, mas só ${L.cadeiras} candidato(s) com ≥ 10% do QE (${fmt(piso10)}). As vagas restantes vão para as sobras.`); break; }
        c.eleito = "QP"; eleitos.push(c); L.cadeiras++;
      }
    }

    let restantes = vagas - eleitos.length, rodada = 0;
    while (restantes > 0) {
      rodada++;
      let aptas = Object.values(legendas).filter((L) => total(L) >= piso80 && proxApto(L, piso20));
      let regra = "80%QE + cand. 20%QE", pisoCand = piso20;
      if (!aptas.length) { aptas = Object.values(legendas).filter((L) => total(L) >= qe && proxApto(L, piso10)); regra = "fallback: QE + cand. 10%QE"; pisoCand = piso10; }
      if (!aptas.length) { aptas = Object.values(legendas).filter((L) => proxApto(L, 1)); regra = "fallback: qualquer legenda com candidato"; pisoCand = 1; }
      if (!aptas.length) { avisos.push(`Restaram ${restantes} vaga(s) sem candidato disponível.`); break; }
      aptas.sort((A, B) => (total(B) / (B.cadeiras + 1)) - (total(A) / (A.cadeiras + 1)) || total(B) - total(A) || A.id.localeCompare(B.id));
      const venc = aptas[0], media = total(venc) / (venc.cadeiras + 1);
      const c = proxApto(venc, pisoCand);
      c.eleito = "SOBRA"; eleitos.push(c); venc.cadeiras++; venc.sobras++; restantes--;
      const seg = aptas[1] || null;
      const segMedia = seg ? total(seg) / (seg.cadeiras + 1) : 0;
      let faltou = 0;
      if (seg) faltou = Math.max(Math.floor(media * (seg.cadeiras + 1)) + 1 - total(seg), 0);
      rodadas.push({ rodada, regra, legenda: venc.id, candidato: c.nome, numero: c.numero, partido: c.partido, votosCand: c.votos, media, segunda: seg ? seg.id : "", mediaSegunda: segMedia, faltou });
    }
    return res;
  }

  function fila(res) {
    const { qe, piso10, piso20, piso80 } = res;
    if (!qe) return [];
    const ultima = res.rodadas[res.rodadas.length - 1];
    const mediaCorte = ultima ? ultima.media : null;
    const linhas = [];
    for (const L of Object.values(res.legendas)) {
      const tot = L.votosNominais + L.votosLegenda;
      const prox = proxApto(L, 1);
      const mediaProx = tot / (L.cadeiras + 1);
      const atinge80 = tot >= piso80;
      const apta = atinge80 && !!proxApto(L, piso20);
      const faltamQp = Math.max((L.qp + 1) * qe - tot, 0);
      let faltamSobra = null;
      if (mediaCorte != null) {
        faltamSobra = Math.max(Math.floor(mediaCorte * (L.cadeiras + 1)) + 1 - tot, 0);
        faltamSobra = Math.max(faltamSobra, atinge80 ? 0 : piso80 - tot);
      }
      const melhorNaoEleito = Math.max(0, ...L.candidatos.filter((c) => !c.eleito).map((c) => c.votos));
      linhas.push({
        legenda: L.id, partidos: L.partidos.join("/"), total: tot, nominais: L.votosNominais, legendaVotos: L.votosLegenda,
        pctQe: tot / qe, qp: L.qp, sobras: L.sobras, cadeiras: L.cadeiras, mediaProx, atinge80, aptaSobras: apta,
        faltamProxQp: faltamQp, faltamTomarSobra: faltamSobra, faltamCand20: Math.max(piso20 - melhorNaoEleito, 0),
        proxNome: prox ? prox.nome : "", proxNumero: prox ? prox.numero : "", proxPartido: prox ? prox.partido : "",
        proxVotos: prox ? prox.votos : 0, proxApto10: !!prox && prox.votos >= piso10, proxApto20: !!prox && prox.votos >= piso20,
        nCand: L.candidatos.length,
      });
    }
    linhas.sort((a, b) => b.cadeiras - a.cadeiras || b.mediaProx - a.mediaProx);
    return linhas;
  }

  function fmt(n) { if (n == null) return "-"; return Math.round(n).toLocaleString("pt-BR"); }

  return { calcular, fila, quocienteEleitoral, fmt };
});

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
      // 3ª fase (STF, ADIs 7228/7263/7325): ninguém cumpre 80% + 20% -> todas as legendas, sem pisos, maior média
      if (!aptas.length) { aptas = Object.values(legendas).filter((L) => proxApto(L, 0)); regra = "3ª fase (STF): todas as legendas"; pisoCand = 0; }
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

  /**
   * Cadeiras matematicamente garantidas de cada legenda, dado um teto de votos ainda por apurar.
   * Com mais R votos válidos o QE pode subir no máximo até QE(válidos + R); os votos da legenda e
   * dos candidatos só aumentam. Logo a legenda tem garantidas floor(total / QEmax) cadeiras pelo
   * quociente partidário, limitadas aos candidatos que já têm 10% de QEmax. Sem votos a apurar
   * (restantes = 0) o resultado é o próprio cálculo final.
   * Retorna { qeMax, porLegenda: {id: n}, total }.
   */
  function garantidas(res, restantes) {
    const out = { qeMax: 0, porLegenda: {}, total: 0 };
    if (!res.qe) return out;
    const R = Math.max(0, Number(restantes) || 0);
    if (R === 0) {
      for (const L of Object.values(res.legendas)) if (L.cadeiras) { out.porLegenda[L.id] = L.cadeiras; out.total += L.cadeiras; }
      out.qeMax = res.qe;
      return out;
    }
    const qeMax = quocienteEleitoral(res.validos + R, res.vagas);
    const p10 = piso(qeMax, 0.10);
    out.qeMax = qeMax;
    for (const L of Object.values(res.legendas)) {
      const tot = L.votosNominais + L.votosLegenda;
      const aptos = L.candidatos.filter((c) => c.votos >= p10).length;
      const k = Math.min(Math.floor(tot / qeMax), aptos);
      if (k > 0) { out.porLegenda[L.id] = k; out.total += k; }
    }
    return out;
  }

  /* ---------------- eleições majoritárias (Presidente, Governador, Senador) ----------------
   * cands: [{votos, ...}] em qualquer ordem; validos: votos válidos já apurados;
   * restantes: teto de votos ainda possíveis por candidato (eleitorado não apurado).
   * vagas: 1 (Presidente/Governador) ou 1-2 (Senador). Não há 2º turno para Senador. */
  function majoritaria(cands, validos, restantes, vagas, comSegundoTurno) {
    const R = Math.max(0, Number(restantes) || 0);
    const ord = [...cands].sort((a, b) => b.votos - a.votos || String(a.nome || "").localeCompare(String(b.nome || "")));
    const v = validos || ord.reduce((s, c) => s + c.votos, 0);
    const out = { ordem: ord, validos: v, lider: ord[0] || null, situacao: "sem votos", garantidos: [], segundoTurnoCerto: false, eleitoNoPrimeiro: false };
    if (!v) return out;
    if (!comSegundoTurno) {
      // Senador: um candidato garante vaga quando no máximo (vagas-1) adversários ainda podem alcançá-lo
      for (const c of ord) {
        const ameacas = ord.filter((o) => o !== c && o.votos + R >= c.votos).length;
        if (ameacas <= vagas - 1) out.garantidos.push(c);
      }
      out.situacao = out.garantidos.length >= vagas ? "definido" : "em aberto";
      return out;
    }
    const lider = ord[0];
    // eleito no 1º turno: mais da metade dos válidos finais, no pior caso (todo voto restante contra ele)
    if (lider && lider.votos > (v + R) / 2) { out.eleitoNoPrimeiro = true; out.garantidos.push(lider); out.situacao = "eleito no 1º turno"; return out; }
    // 2º turno certo: nenhum candidato chega a mais da metade nem recebendo todos os votos restantes
    out.segundoTurnoCerto = ord.every((c) => c.votos + R <= (v + R) / 2);
    if (R === 0) out.situacao = lider.votos > v / 2 ? "eleito no 1º turno" : "2º turno";
    else out.situacao = out.segundoTurnoCerto ? "2º turno garantido" : (lider.votos > v / 2 ? "venceria no 1º turno agora" : "2º turno se terminasse agora");
    if (R === 0 && lider.votos > v / 2) { out.eleitoNoPrimeiro = true; out.garantidos.push(lider); }
    return out;
  }

  /* Cláusula de barreira (EC 97/2017, art. 3º), regra da legislatura que começa em 2027:
   * (a) pelo menos 2,5% dos votos válidos para a Câmara no Brasil, distribuídos em pelo menos
   *     1/3 das UFs (9) com no mínimo 1,5% dos válidos em cada uma; OU
   * (b) pelo menos 13 deputados federais eleitos em pelo menos 9 UFs.
   * Federações são avaliadas como um partido só. */
  const CLAUSULA = { pctBrasil: 2.5, pctUf: 1.5, minUfs: 9, deputados: 13 };
  function clausula(x) {
    const pct = x.validos ? x.votos / x.validos * 100 : 0;
    const porVotos = pct >= CLAUSULA.pctBrasil && x.ufs15 >= CLAUSULA.minUfs;
    const porEleitos = x.deputados >= CLAUSULA.deputados && x.ufsDeputados >= CLAUSULA.minUfs;
    return { pct, ok: porVotos || porEleitos, porVotos, porEleitos };
  }

  function fmt(n) { if (n == null) return "-"; return (Math.round(n) || 0).toLocaleString("pt-BR"); }

  return { calcular, fila, garantidas, majoritaria, clausula, CLAUSULA, quocienteEleitoral, fmt };
});

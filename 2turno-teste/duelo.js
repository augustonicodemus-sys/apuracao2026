/* Cálculos do 2º turno (dois candidatos). Sem DOM: usado pelas páginas e por teste_duelo.js (node).
 * d = saída de TSE.parseMaj: {cands:[{numero, urna, partido, votos}], vv, eleitorado, eleitoradoNaoApurado, vansj} */
(function (root, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else root.Duelo = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ordenar = (cands) => [...cands].sort((a, b) => b.votos - a.votos || String(a.numero).localeCompare(String(b.numero)));

  /* Apuração do 2º turno em andamento.
   * garantido: a diferença já é maior que todos os eleitores das seções não apuradas (+ anulados sub judice),
   *            ou seja, nem que todos votassem no 2º colocado ele alcançaria.
   * W:  estimativa de votos válidos que ainda faltam = eleitores não apurados × (válidos / eleitores apurados).
   * precisa: fração desses W que o 2º colocado precisaria para empatar (>1 = não alcança pela estimativa). */
  function apuracao(d) {
    const ordem = ordenar(d.cands || []);
    const [A, B] = ordem;
    const vv = d.vv || ordem.reduce((s, c) => s + c.votos, 0);
    const out = { ordem, A, B, vv, iniciou: vv > 0, dif: A && B ? A.votos - B.votos : 0, R: 0, W: 0, taxa: 0, precisa: null, garantido: false, terminou: false, empate: false };
    if (!out.iniciou || !A || !B) return out;
    const naoAp = d.eleitoradoNaoApurado != null ? d.eleitoradoNaoApurado : 0;
    out.R = naoAp + (d.vansj || 0);
    const apurado = Math.max(1, (d.eleitorado || 0) - naoAp);
    out.taxa = Math.min(1, vv / apurado);
    out.W = Math.round(naoAp * out.taxa);
    if (out.R === 0) { out.terminou = true; out.empate = out.dif === 0; out.garantido = out.dif > 0; return out; }
    out.garantido = out.dif > out.R;
    out.precisa = out.W > 0 ? (out.dif + out.W) / (2 * out.W) : null;
    return out;
  }

  /* Antes do 2º turno: o que mudou de mãos no 1º turno.
   * outros: votos válidos de quem ficou de fora; precisaOutros: fração desses votos que o 2º colocado
   * precisaria levar para empatar, se todos os eleitores dos dois finalistas repetissem o voto
   * e os eleitores dos outros escolhessem um dos dois. */
  function preTurno(d, finalistas) {
    const todos = ordenar(d.cands || []);
    const fin = finalistas && finalistas.length === 2
      ? finalistas.map((n) => todos.find((c) => String(c.numero) === String(n))).filter(Boolean)
      : todos.slice(0, 2);
    const [A, B] = fin.length === 2 ? ordenar(fin) : [todos[0], todos[1]];
    const vv = d.vv || todos.reduce((s, c) => s + c.votos, 0);
    const outros = A && B ? vv - A.votos - B.votos : 0;
    const dif = A && B ? A.votos - B.votos : 0;
    const precisaOutros = outros > 0 ? (outros + dif) / (2 * outros) : null;
    return { todos, A, B, vv, outros, dif, precisaOutros };
  }

  return { apuracao, preTurno, ordenar };
});

// node teste_motor.js  — mesmos casos de teste_motor.py
const M = require("./motor.js");
let falhas = 0;
const check = (c, m) => { console.log((c ? "OK   " : "FALHA") + " - " + m); if (!c) falhas++; };

function chapa(partido, total, n = 16, legPct = 0.05, topPct = 0.30) {
  const leg = Math.floor(total * legPct), nom = total - leg;
  const pesos = [topPct]; for (let i = 0; i < n - 1; i++) pesos.push((1 - topPct) * Math.pow(0.75, i));
  const s = pesos.reduce((a, b) => a + b, 0);
  const votos = pesos.map((p) => Math.floor(nom * p / s));
  votos[0] += nom - votos.reduce((a, b) => a + b, 0);
  return [votos.map((v, i) => ({ nome: `${partido} cand ${i + 1}`, numero: `${partido.slice(0, 2)}${String(i + 1).padStart(2, "0")}`, partido, votos: v })), { [partido]: leg }];
}

console.log("=== RS 2022 ===");
const oficial = { PT: [1168128, 7], PL: [680192, 4], MDB: [586325, 3], REPUBLICANOS: [549530, 3], PP: [522295, 3], PSDB: [480995, 3], PDT: [321317, 2], PODE: [318850, 1], NOVO: [301966, 1], PSD: [295357, 1], PSOL: [303180, 1], UNIAO: [215367, 1], PSB: [193200, 1] };
const fed = { "FE BRASIL": ["PT", "PCDOB", "PV"], "PSOL-REDE": ["PSOL", "REDE"], "PSDB-CIDADANIA": ["PSDB", "CIDADANIA"] };
let cands = [], leg = {};
for (const [p, [v]] of Object.entries(oficial)) { const [c, l] = chapa(p, v); cands = cands.concat(c); Object.assign(leg, l); }
const resto = 6149822 - Object.values(oficial).reduce((s, [v]) => s + v, 0);
["AVANTE", "PTB", "PSC", "PMB", "PRTB", "DC", "AGIR", "PCO"].forEach((p, i) => { const [c, l] = chapa(p, Math.floor(resto / 8) + (i === 0 ? resto % 8 : 0), 5); cands = cands.concat(c); Object.assign(leg, l); });
const cands0 = cands.map((c) => ({ ...c })), leg0 = { ...leg };
let res = M.calcular(cands, leg, 31, fed);
check(res.qe === 198381, `QE = ${res.qe}`);
const mapa = { PT: "FE BRASIL", PSOL: "PSOL-REDE", PSDB: "PSDB-CIDADANIA" };
for (const [p, [, cad]] of Object.entries(oficial)) { const lid = mapa[p] || p; check(res.legendas[lid].cadeiras === cad, `${lid}: ${res.legendas[lid].cadeiras} (oficial ${cad})`); }
check(res.eleitos.length === 31, "31 eleitos");
const ordem = res.rodadas.map((r) => r.legenda);
check(JSON.stringify(ordem) === JSON.stringify(["MDB", "FE BRASIL", "PSB", "REPUBLICANOS", "PP", "PL", "FE BRASIL", "PDT", "PSDB-CIDADANIA"]), "ordem das sobras " + ordem.join(","));
const f = M.fila(res);
check(f.length === 21 && f[0].legenda === "FE BRASIL", "fila ok");

console.log("=== bordas ===");
check(M.quocienteEleitoral(1005, 10) === 100 && M.quocienteEleitoral(1006, 10) === 101, "arredondamento do QE");
const C = (nome, numero, partido, votos) => ({ nome, numero, partido, votos });
cands = [];
[200, 100, 90, 60, 50, 30, 20].forEach((v, i) => cands.push(C(`A${i}`, `110${i}`, "A", v)));
[120, 80, 60, 40].forEach((v, i) => cands.push(C(`B${i}`, `220${i}`, "B", v)));
[15, 15, 15, 15, 15, 10, 10].forEach((v, i) => cands.push(C(`C${i}`, `330${i}`, "C", v)));
[50, 5].forEach((v, i) => cands.push(C(`D${i}`, `440${i}`, "D", v)));
res = M.calcular(cands, {}, 10);
check(res.legendas.A.cadeiras === 7 && res.legendas.B.cadeiras === 3 && res.legendas.C.cadeiras === 0 && res.legendas.D.cadeiras === 0, "80%/20%: A7 B3 C0 D0");

cands = [];
[100, 60, 15, 15, 15, 15, 15, 15].forEach((v, i) => cands.push(C(`A${i}`, `110${i}`, "A", v)));
[19, 19, 19, 19, 19, 19, 19, 17].forEach((v, i) => cands.push(C(`B${i}`, `220${i}`, "B", v)));
for (let i = 0; i < 6; i++) cands.push(C(`C${i}`, `330${i}`, "C", 100));
res = M.calcular(cands, {}, 10);
check(res.eleitos.length === 10 && res.rodadas.some((r) => r.regra.includes("3ª fase")), "3ª fase acionada");
res = M.calcular([C("A0", "1100", "A", 100), C("A1", "1101", "A", 15), C("C0", "3300", "C", 79)].concat([0, 1, 2, 3, 4, 5, 6].map((i) => C(`D${i}`, `440${i}`, "D", 100))), { A: 35, D: 71 }, 10);
check(res.qe === 100 && res.rodadas[0].legenda === "C" && res.rodadas[0].regra.includes("3ª fase"), "3ª fase inclui legenda abaixo de 80% do QE (STF)");

cands = [];
for (let i = 0; i < 5; i++) cands.push(C(`A${i}`, `110${i}`, "A", 9));
[200, 100, 50, 40, 30, 20, 20, 15, 15, 15, 15, 15].forEach((v, i) => cands.push(C(`B${i}`, `220${i}`, "B", v)));
[80, 40, 40].forEach((v, i) => cands.push(C(`C${i}`, `330${i}`, "C", v)));
res = M.calcular(cands, { A: 260 }, 10);
check(res.legendas.A.qp === 3 && res.legendas.A.cadeiras === 0 && res.eleitos.length === 10, "QP sem candidato apto -> sobras");

cands = []; for (let i = 0; i < 20; i++) cands.push(C(`P${i}`, `1${String(i).padStart(3, "0")}`, `P${i}`, 10 + i));
res = M.calcular(cands, {}, 3);
check(res.regime === "ART111" && res.eleitos.map((c) => c.nome).join() === "P19,P18,P17", "art. 111");

res = M.calcular([C("X1", "1301", "PT", 60), C("Y1", "6501", "PCDOB", 45), C("Z1", "2201", "PL", 95)], {}, 2, { "FE BRASIL": ["PT", "PCDOB", "PV"] });
check(res.qe === 100 && res.legendas["FE BRASIL"].cadeiras === 1 && res.legendas.PL.cadeiras === 1, "federação");

console.log("=== garantidas ===");
{
  const r2 = M.calcular(cands0, leg0, 31, fed);
  const g0 = M.garantidas(r2, 0);
  check(g0.total === 31 && g0.porLegenda["FE BRASIL"] === 7, "sem votos a apurar: garantidas = resultado final");
  const g1 = M.garantidas(r2, 1000000);
  // QEmax = (6149822 + 1000000)/31 = 230639; FE BRASIL 1168128 -> 5; PL 680192 -> 2
  check(g1.qeMax === 230639, "QEmax = " + g1.qeMax);
  check(g1.porLegenda["FE BRASIL"] === 5 && g1.porLegenda.PL === 2, `FE BRASIL ${g1.porLegenda["FE BRASIL"]}, PL ${g1.porLegenda.PL}`);
  check(Object.entries(g1.porLegenda).every(([k, n]) => n <= r2.legendas[k].cadeiras), "garantidas <= cadeiras atuais");
  const g2 = M.garantidas(r2, 1e9);
  check(g2.total === 0, "teto enorme: nada garantido");
  const r3 = M.calcular([C("A1", "1", "A", 300), C("A2", "2", "A", 5), C("B1", "3", "B", 100)], {}, 2);
  check(M.garantidas(r3, 0).porLegenda.A === r3.legendas.A.cadeiras, "consistência com cálculo final");
  check(M.garantidas(r3, 10).porLegenda.A === 1, "limitado aos candidatos com 10% do QEmax");
}

console.log("=== majoritárias ===");
{
  const K = (nome, votos) => ({ nome, votos });
  let m = M.majoritaria([K("A", 600), K("B", 300), K("C", 100)], 1000, 100, 1, true);
  check(m.eleitoNoPrimeiro && m.situacao === "eleito no 1º turno", "600/1000 com 100 restantes: eleito (600 > 550)");
  m = M.majoritaria([K("A", 520), K("B", 380), K("C", 100)], 1000, 100, 1, true);
  check(!m.eleitoNoPrimeiro && !m.segundoTurnoCerto && m.situacao === "venceria no 1º turno agora", "520/1000 com 100 restantes: em aberto");
  m = M.majoritaria([K("A", 400), K("B", 350), K("C", 250)], 1000, 100, 1, true);
  check(m.segundoTurnoCerto && m.situacao === "2º turno garantido", "400/1000 com 100 restantes: 2º turno certo");
  m = M.majoritaria([K("A", 450), K("B", 450), K("C", 100)], 1000, 0, 1, true);
  check(m.situacao === "2º turno" && !m.eleitoNoPrimeiro, "apuração completa sem maioria: 2º turno");
  m = M.majoritaria([K("A", 500), K("B", 450), K("C", 200), K("D", 190)], 1340, 40, 2, false);
  check(m.garantidos.map((c) => c.nome).join() === "A,B", "Senado 2 vagas: A e B garantidos");
  m = M.majoritaria([K("A", 500), K("B", 450), K("C", 420)], 1370, 40, 2, false);
  check(m.garantidos.map((c) => c.nome).join() === "A" && m.situacao === "em aberto", "Senado: só A garantido quando C alcança B");
}

console.log("=== cláusula de barreira 2026 ===");
check(M.clausula({ votos: 26, validos: 1000, ufs15: 9, deputados: 0, ufsDeputados: 0 }).porVotos, "2,6% e 9 UFs com 1,5%: passa por votos");
check(!M.clausula({ votos: 26, validos: 1000, ufs15: 8, deputados: 0, ufsDeputados: 0 }).ok, "2,6% mas só 8 UFs: não passa");
check(!M.clausula({ votos: 24, validos: 1000, ufs15: 20, deputados: 12, ufsDeputados: 9 }).ok, "2,4% e 12 deputados: não passa");
check(M.clausula({ votos: 24, validos: 1000, ufs15: 3, deputados: 13, ufsDeputados: 9 }).porEleitos, "13 deputados em 9 UFs: passa por eleitos");
check(!M.clausula({ votos: 24, validos: 1000, ufs15: 3, deputados: 15, ufsDeputados: 8 }).ok, "15 deputados em 8 UFs: não passa");

console.log(falhas ? `${falhas} FALHA(S)` : "TODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);

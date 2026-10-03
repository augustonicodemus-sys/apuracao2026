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
check(res.eleitos.length === 10 && res.rodadas.some((r) => r.regra.includes("fallback")), "fallback acionado");

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

console.log(falhas ? `${falhas} FALHA(S)` : "TODOS OS TESTES PASSARAM");
process.exit(falhas ? 1 : 0);

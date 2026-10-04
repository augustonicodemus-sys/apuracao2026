# Site estático — Eleições 2026 (Radar Numérico)

Sem servidor: o navegador de cada visitante busca os JSONs públicos do TSE (CORS liberado,
confirmado em 03/10/2026) e faz o cálculo com `motor.js` (porte fiel de `../motor.py`).

## Páginas
* `index.html` + `inicio.js` + `tse.js` — **Brasil**: hemiciclo da Câmara (bancada atual / se
  terminasse agora / garantidas), tabela de partidos (Atual, Agora, Garantidas) e os 20 mais
  votados do país. Lê as 27 UFs a cada 90 s. Links antigos `index.html?uf=SP` redirecionam
  para `federal.html`.
* `federal.html` + `app.js` — **Deputados Federais por estado** (a página original).
* `estaduais.html` — Deputados Estaduais por estado: mesma página e mesmo `app.js`, configurados por
  `window.CFG` (cargo 7; no DF cargo 8, deputado distrital; 1.059 cadeiras).
* `presidente.html`, `governadores.html`, `senado.html` + `maj.js` — eleições majoritárias
  (Presidente na eleição 6257, cargo 1, arquivo nacional `br`; Governador cargo 3 e Senador cargo 5 na 6259).
  Senado: visão nacional (hemiciclo de 81, partidos Atual / Continuam / Eleitos agora / Total / Garantidos)
  e detalhe por estado em `senado.html?uf=SP`. Os 27 senadores com mandato até 2031 e a bancada atual
  estão fixos em `maj.js` (Dados Abertos do Senado, 03/10/2026). Governadores: detalhe em `?uf=`.
* Na página por estado, dois quadros: quociente "se terminasse agora" e "estimado com 100% das
  urnas" (válidos × eleitorado total ÷ eleitorado das seções totalizadas).
* `estilo.css` — cores, fonte e menu comuns.

## Regras e dados
* "Garantidas" = `Motor.garantidas(res, restantes)`: com R votos ainda possíveis
  (eleitorado de seções não totalizadas `e.esnt` + anulados sub judice `v.vansj`), o QE sobe
  no máximo até QE(válidos + R); a legenda tem garantidas floor(total / QEmax) cadeiras,
  limitadas aos candidatos que já têm 10% de QEmax. Com tudo apurado, igual ao resultado.
* Bancada atual: constante `BANCADA_ATUAL` em `inicio.js` (API de Dados Abertos da Câmara,
  513 deputados em exercício em 03/10/2026). Federações contam como uma legenda.

## Simulação (votos inventados)
`sim.js`: com `?sim=70` (ou outro %), pega os arquivos reais do TSE (nomes, números, partidos,
federações) e preenche votos inventados como se 70% das seções estivessem apuradas
(determinístico; `&semente=2` gera outro cenário). Só funciona aberto do disco (file://),
em localhost ou num repositório com "-teste" no endereço; no site público o parâmetro é ignorado.
Faixa vermelha "SIMULAÇÃO" em todas as páginas; os links do menu mantêm o `?sim=`.

* `Motor.majoritaria(cands, validos, restantes, vagas, segundoTurno)`: eleito no 1º turno garantido
  se votos > (válidos + R)/2; 2º turno certo se ninguém passa de (válidos + R)/2 nem com todo R;
  Senado: vaga garantida se no máximo (vagas − 1) adversários ainda podem alcançá-lo (votos + R).

## Testes
`node teste_motor.js` (motor + garantidas). Layout com dados de exemplo:
`federal.html?src=teste/rs-sintetico-u.json&uf=RS` e `index.html?src=teste/rs-sintetico-u.json`
(o arquivo de exemplo é usado para os 27 estados, então os totais passam de 513).
Parâmetros de URL de `federal.html`: `?uf=SP`, `&partido=NOVO`, `&eleicao=6259`, `&ano=2026`, `&src=`.

Publicar: subir os arquivos desta pasta na raiz do repositório `apuracao2026` (GitHub Pages).

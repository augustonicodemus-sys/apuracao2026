# Site estático — "Quem estaria eleito agora" (Deputado Federal 2026)

Versão web, apartidária, do aplicativo de apuração. Não tem servidor: o navegador de cada
visitante busca os JSONs públicos do TSE (CORS liberado, confirmado em 03/10/2026) e faz o
cálculo com `motor.js` (porte fiel de `../motor.py`, mesmos testes).

Arquivos: `index.html` (página + CSS), `app.js` (coleta do TSE, parse do `-u.json`, render),
`motor.js` (regras), `teste_motor.js` (`node teste_motor.js`), `teste/rs-sintetico-u.json`
(fixture para ver o layout: `index.html?src=teste/rs-sintetico-u.json&uf=RS`).

Parâmetros de URL: `?uf=SP` estado; `&partido=NOVO` destaca um partido; `&eleicao=6259`
fixa o código (senão descobre em ele-c.json); `&ano=2026`; `&src=arquivo.json` fonte local.

Publicar: qualquer hospedagem estática (Cloudflare Pages "Upload assets", Netlify Drop,
GitHub Pages). Suba a pasta `site/` inteira. Não precisa de build.

Verificado em 03/10/2026 no Chrome do Augusto, contra os arquivos reais de 2026 (zerados):
eleição 6259 descoberta pelo índice; SP 1.045 candidatos, RS 435, AC 87; 5 federações
(FE BRASIL, PSOL/REDE, PSDB/CIDADANIA, UNIAO/PP, PRD/SOLIDARIEDADE) lidas do próprio TSE.

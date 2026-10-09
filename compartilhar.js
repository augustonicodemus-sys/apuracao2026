/* Botões "Compartilhar" e "Story do Instagram" (todas as páginas que tiverem <div id="compartilhar">).
 * O Story usa window.StoryDados() → { selo, titulo, sub, linhas:[{nome, partido, cor, pct, votos}], svg, rodape }
 * e monta uma imagem 1080×1920 no próprio navegador. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const evento = (acao, metodo) => { try { window.gtag && gtag("event", acao, { method: metodo, content_type: "pagina", item_id: location.pathname }); } catch (e) {} };
  const texto = () => (window.StoryDados && StoryDados().textoCompartilhar) || document.title.replace(" · Radar Numérico", "");

  function montar() {
    const el = $("#compartilhar"); if (!el) return;
    el.innerHTML = `<button type="button" class="b-comp" id="b-comp"><span aria-hidden="true">↗</span> Compartilhar</button>` +
      (window.StoryDados ? `<button type="button" class="b-story" id="b-story"><span aria-hidden="true">◎</span> Story do Instagram</button>` : "") +
      `<div class="comp-menu" id="comp-menu" hidden></div>`;
    $("#b-comp").addEventListener("click", compartilhar);
    const bs = $("#b-story"); if (bs) bs.addEventListener("click", story);
    document.addEventListener("click", (ev) => { const m = $("#comp-menu"); if (m && !m.hidden && !ev.target.closest("#compartilhar")) m.hidden = true; });
  }

  async function compartilhar() {
    const url = location.href, t = texto();
    if (navigator.share && matchMedia("(hover: none)").matches) {
      try { await navigator.share({ title: t, text: t, url }); evento("share", "nativo"); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const m = $("#comp-menu");
    const wa = "https://wa.me/?text=" + encodeURIComponent(t + " " + url);
    const fb = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url);
    const x = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(t) + "&url=" + encodeURIComponent(url);
    m.innerHTML = `<a href="${wa}" target="_blank" rel="noopener" data-m="whatsapp">WhatsApp</a><a href="${fb}" target="_blank" rel="noopener" data-m="facebook">Facebook</a><a href="${x}" target="_blank" rel="noopener" data-m="x">X (Twitter)</a><button type="button" data-m="copiar">Copiar link</button>`;
    m.hidden = !m.hidden;
    m.querySelectorAll("[data-m]").forEach((a) => a.addEventListener("click", async () => {
      evento("share", a.dataset.m);
      if (a.dataset.m === "copiar") {
        try { await navigator.clipboard.writeText(url); a.textContent = "Link copiado ✓"; } catch (e) { prompt("Copie o link:", url); }
        setTimeout(() => { m.hidden = true; }, 900);
      } else m.hidden = true;
    }));
  }

  // ------------------------------------------------------------ Story 1080×1920
  const NAVY = "#16243A", AMAR = "#F2C230", CINZA = "#9AA7BA";
  const claro = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); if (!m) return "#C9D3E0"; const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return 0.299 * r + 0.587 * g + 0.114 * b > 90 ? c : "#6F93E8"; };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function caber(ctx, txt, max, peso, tam, min) { let t = tam; do { ctx.font = `${peso} ${t}px Archivo, system-ui, sans-serif`; if (ctx.measureText(txt).width <= max) break; t -= 4; } while (t > min); return t; }
  function svgImagem(svg) {
    return new Promise((ok, erro) => {
      const c = svg.cloneNode(true), vb = svg.viewBox.baseVal;
      c.setAttribute("width", vb.width); c.setAttribute("height", vb.height);
      c.querySelectorAll("path").forEach((p) => { p.setAttribute("stroke", p.classList.contains("sel") ? AMAR : "#FFFFFF"); p.setAttribute("stroke-width", p.classList.contains("sel") ? Math.max(vb.width, vb.height) / 110 : Math.max(vb.width, vb.height) / 900); p.setAttribute("stroke-linejoin", "round"); });
      const sel = c.querySelector("path.sel"); if (sel) c.appendChild(sel);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml" }));
      const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); ok(img); }; img.onerror = erro; img.src = url;
    });
  }
  async function desenhar(d) {
    try { await document.fonts.load("800 60px Archivo"); await document.fonts.load("500 40px Archivo"); } catch (e) {}
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
    // topo
    ctx.fillStyle = "#fff"; ctx.font = "800 46px Archivo, system-ui, sans-serif"; ctx.textBaseline = "middle"; ctx.fillText("Radar Numérico", 72, 110);
    ctx.font = "700 32px Archivo, system-ui, sans-serif"; const sw = ctx.measureText(d.selo).width + 52;
    ctx.fillStyle = AMAR; rr(ctx, W - 72 - sw, 80, sw, 60, 30); ctx.fill(); ctx.fillStyle = NAVY; ctx.fillText(d.selo, W - 72 - sw + 26, 111);
    // título
    ctx.fillStyle = "#fff"; caber(ctx, d.titulo, W - 144, 800, 96, 52); ctx.fillText(d.titulo, 72, 250);
    ctx.fillStyle = CINZA; caber(ctx, d.sub, W - 144, 500, 40, 26); ctx.fillText(d.sub, 72, 330);
    // mapa num cartão claro
    const mx = 72, my = 390, mw = W - 144, mh = 820;
    ctx.fillStyle = "#F2F4F7"; rr(ctx, mx, my, mw, mh, 28); ctx.fill();
    if (d.svg) {
      try {
        const img = await svgImagem(d.svg), pad = 40, esc2 = Math.min((mw - 2 * pad) / img.width, (mh - 2 * pad) / img.height);
        const iw = img.width * esc2, ih = img.height * esc2;
        ctx.drawImage(img, mx + (mw - iw) / 2, my + (mh - ih) / 2, iw, ih);
      } catch (e) {}
    }
    // números
    let y = my + mh + 80;
    const total = d.linhas.reduce((s, l) => s + (l.pct || 0), 0);
    for (const l of d.linhas.slice(0, 3)) {
      const cor = claro(l.cor);
      ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(88, y, 14, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; caber(ctx, l.nome, 560, 700, 50, 32); ctx.fillText(l.nome, 118, y - 8);
      ctx.fillStyle = CINZA; ctx.font = "500 30px Archivo, system-ui, sans-serif"; ctx.fillText(`${l.partido}${l.votos != null ? " · " + l.votos.toLocaleString("pt-BR") + " votos" : ""}`, 118, y + 38);
      ctx.fillStyle = cor; ctx.font = "800 92px Archivo, system-ui, sans-serif"; ctx.textAlign = "right";
      ctx.fillText((l.pct * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%", W - 72, y + 6);
      ctx.textAlign = "left"; y += 132;
    }
    // rodapé
    const fy = H - 230;
    ctx.fillStyle = AMAR; rr(ctx, 72, fy, W - 144, 160, 28); ctx.fill();
    ctx.fillStyle = NAVY; ctx.font = "500 34px Archivo, system-ui, sans-serif"; ctx.fillText(d.rodape || "Veja a sua cidade no mapa:", 112, fy + 50);
    caber(ctx, "radarnumerico.com.br", W - 224, 800, 72, 40); ctx.fillText("radarnumerico.com.br", 112, fy + 112);
    return new Promise((ok) => cv.toBlob(ok, "image/png"));
  }

  async function story() {
    const b = $("#b-story"); const rot = b.innerHTML; b.disabled = true; b.textContent = "gerando imagem…";
    try {
      const d = StoryDados();
      const blob = await desenhar(d);
      const nome = "radar-numerico-" + (d.arquivo || "story") + ".png";
      const file = new File([blob], nome, { type: "image/png" });
      mostrar(blob, file, d);
      evento("story", "gerou");
    } catch (e) { alert("Não foi possível gerar a imagem agora: " + e.message); }
    b.disabled = false; b.innerHTML = rot;
  }
  function mostrar(blob, file, d) {
    let m = $("#story-modal");
    if (!m) { m = document.createElement("div"); m.id = "story-modal"; m.className = "story-modal"; document.body.appendChild(m); }
    const url = URL.createObjectURL(blob);
    const podeArquivo = navigator.canShare && navigator.canShare({ files: [file] });
    m.innerHTML = `<div class="story-caixa" role="dialog" aria-label="Imagem para o Story"><img src="${url}" alt="Imagem para o Story: ${esc(d.titulo)}">
      <div class="story-acoes">${podeArquivo ? `<button type="button" class="b-story" id="st-comp">Postar / compartilhar</button>` : ""}<a class="b-comp" id="st-baixar" href="${url}" download="${esc(file.name)}">Baixar imagem</a><button type="button" class="b-fechar" id="st-fechar">Fechar</button></div>
      <p class="story-dica">No Instagram: poste a imagem no Story e adicione a figurinha <b>Link</b> com <b>${esc(location.href.split("#")[0])}</b>.</p></div>`;
    m.hidden = false;
    const fechar = () => { m.hidden = true; URL.revokeObjectURL(url); };
    $("#st-fechar").addEventListener("click", fechar);
    m.addEventListener("click", (ev) => { if (ev.target === m) fechar(); }, { once: true });
    $("#st-baixar").addEventListener("click", () => evento("story", "baixou"));
    const c = $("#st-comp");
    if (c) c.addEventListener("click", async () => {
      try { await navigator.share({ files: [file], title: d.titulo, text: location.href }); evento("story", "compartilhou"); } catch (e) {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
  window.Compartilhar = { montar };
})();

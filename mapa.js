/* Mapa em SVG (Brasil por estado ou um estado por município), a partir de geo/{br|uf}.json gerados por gerar_geo.py.
 * Mapa.desenhar(el, geo, { cor(cod), dica(cod) → html, clique(cod), sel }) */
(function () {
  "use strict";
  const cache = {};
  async function carregar(base, nome) {
    const k = base + nome;
    if (!cache[k]) cache[k] = fetch(`${base}geo/${nome}.json`).then((r) => { if (!r.ok) throw new Error("mapa " + nome + ": HTTP " + r.status); return r.json(); });
    return cache[k];
  }

  let dicaEl = null;
  function dica() {
    if (!dicaEl) { dicaEl = document.createElement("div"); dicaEl.className = "mapa-dica"; dicaEl.hidden = true; document.body.appendChild(dicaEl); }
    return dicaEl;
  }
  function mostrarDica(html, x, y) {
    const d = dica(); d.innerHTML = html; d.hidden = false;
    const w = d.offsetWidth, h = d.offsetHeight, W = window.innerWidth;
    let left = x + 14, top = y + 14;
    if (left + w > W - 8) left = Math.max(8, x - w - 14);
    if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 14);
    d.style.left = left + "px"; d.style.top = top + "px";
  }
  const esconderDica = () => { if (dicaEl) dicaEl.hidden = true; };

  function desenhar(el, geo, op) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${geo.w} ${geo.h}`);
    svg.setAttribute("class", "mapa-svg");
    svg.setAttribute("role", "img");
    if (op.rotulo) svg.setAttribute("aria-label", op.rotulo);
    const toque = matchMedia("(hover: none)").matches;
    for (const [cod, d] of Object.entries(geo.p)) {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", op.cor(cod) || "#E3E7ED");
      p.dataset.cod = cod;
      if (op.sel && String(op.sel) === cod) p.classList.add("sel");
      svg.appendChild(p);
    }
    svg.addEventListener("mousemove", (ev) => {
      const p = ev.target.closest("path"); if (!p) { esconderDica(); return; }
      if (!toque) mostrarDica(op.dica(p.dataset.cod), ev.clientX, ev.clientY);
    });
    svg.addEventListener("mouseleave", esconderDica);
    svg.addEventListener("click", (ev) => {
      const p = ev.target.closest("path"); if (!p) return;
      if (toque) mostrarDica(op.dica(p.dataset.cod), ev.clientX, ev.clientY);
      op.clique && op.clique(p.dataset.cod);
    });
    // destaque: o caminho selecionado vai para o fim (fica por cima, com a borda inteira)
    const s = svg.querySelector("path.sel"); if (s) svg.appendChild(s);
    el.replaceChildren(svg);
    return svg;
  }
  function selecionar(svg, cod) {
    if (!svg) return;
    svg.querySelectorAll("path.sel").forEach((p) => p.classList.remove("sel"));
    const p = svg.querySelector(`path[data-cod="${cod}"]`);
    if (p) { p.classList.add("sel"); svg.appendChild(p); }
  }
  document.addEventListener("scroll", esconderDica, { passive: true });

  // cor do vencedor com intensidade pela vantagem (pontos percentuais): perto de 0 fica clara
  function tom(hex, vantagem) {
    const t = vantagem >= 0.15 ? 1 : vantagem >= 0.05 ? 0.72 : 0.45;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const m = (c) => Math.round(255 - (255 - c) * t);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }

  window.Mapa = { carregar, desenhar, selecionar, tom, esconderDica };
})();

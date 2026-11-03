/* Custom "GRIFFITH" wordmark: heavy, extended geometric letters drawn on a 200-unit cap height.
   RLG.wordmark({ cls, title }) returns inline SVG that fills its container's width (fill = currentColor). */
(function () {
  'use strict';
  const GAP = 22;
  const LETTERS = {
    G: [230, 'M230 0H100A100 100 0 0 0 100 200H230V100H120V144H100A44 44 0 0 1 100 56H230Z'],
    R: [210, 'M0 0H140A60 60 0 0 1 140 120L210 200H148L78 120H56V200H0Z M56 48V72H136A12 12 0 0 0 136 48Z'],
    I: [56, 'M0 0H56V200H0Z'],
    F: [175, 'M0 0H175V48H56V80H150V128H56V200H0Z'],
    T: [190, 'M0 0H190V48H123V200H67V48H0Z'],
    H: [200, 'M0 0H56V76H144V0H200V200H144V124H56V200H0Z'],
  };

  function wordmark({ text = 'GRIFFITH', cls = 'wordmark', title = 'Griffith', stroke = 0 } = {}) {
    let x = 0;
    const parts = [];
    [...text].forEach((ch, i) => {
      const [w, d] = LETTERS[ch];
      parts.push(`<path class="wm-l wm-l${i}" transform="translate(${x} 0)" d="${d}"/>`);
      x += w + GAP;
    });
    const width = x - GAP;
    const pad = stroke ? stroke : 0;
    return `<svg class="${cls}" viewBox="${-pad} ${-pad} ${width + pad * 2} ${200 + pad * 2}" fill="currentColor" role="img" aria-label="${title}" preserveAspectRatio="xMidYMid meet"><title>${title}</title>${parts.join('')}</svg>`;
  }

  window.RLG = window.RLG || {};
  window.RLG.wordmark = wordmark;
})();

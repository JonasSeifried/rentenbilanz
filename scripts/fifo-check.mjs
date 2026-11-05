// Prüfrechnung zu docs/korrekturen.md („Umschichtung vor Rentenbeginn“, FIFO): Wie viel macht es aus,
// dass der Rechner Anschaffungskosten als Durchschnitt statt nach FIFO (§ 20 Abs. 4 S. 7 EStG) rechnet?
// Eigenständig, ohne die Engine: Standardwerte, ETF 150 €/Monat, Alter 22 → Rente 67, Auszahlplan bis 90, jeder
// Monatsbeitrag ein eigener Kaufposten, ein Sparer-Pauschbetrag je Jahr, ohne Vorabpauschale. Aufruf: node scripts/fifo-check.mjs
const n = 45, tEnd = 68, g = 0.06, gPay = 0.04, safe = 0.02, ter = 0.002, infl = 0.02;
const ann = (V, rr, rem) => rem <= 1 ? V : V * rr / ((1 + rr) * (1 - Math.pow(1 + rr, -rem)));
const share = t => (n - t <= 2 ? 0.3 : n - t <= 5 ? 0.5 : 1);
function run(fifo, shift) {
  const D = [{ tf: 0.7, lots: [] }, { tf: 1, lots: [] }]; // Aktien-ETF, sicherer ETF
  const val = d => d.lots.reduce((a, l) => a + l.v, 0);
  // Verkauf von x € aus Depot d: liefert Gewinn
  const sell = (d, x) => {
    const V = val(d); if (V <= 0 || x <= 0) return 0;
    if (!fifo) { let gain = 0; for (const l of d.lots) { const f = x / V; gain += f * (l.v - l.c); l.v -= f * l.v; l.c -= f * l.c; } return gain; }
    let left = x, gain = 0;
    for (const l of d.lots) { if (left <= 1e-9) break; const s = Math.min(left, l.v), f = s / l.v; gain += s - f * l.c; l.v -= s; l.c -= f * l.c; left -= s; }
    d.lots = d.lots.filter(l => l.v > 1e-9); return gain;
  };
  const tax = parts => { // parts: [{gain, tf}] mit einem Pauschbetrag
    let X = 0; for (const p of parts) X += Math.max(0, p.gain) * p.tf; return Math.max(0, X - 1000) * 0.26375;
  };
  let cum = 0;
  for (let t = 0; t < tEnd; t++) {
    const acc = t < n;
    if (acc && shift && share(t) < 1) { // Umschichtung zu Jahresbeginn
      const Va = val(D[0]), Vs = val(D[1]), target = share(t) * (Va + Vs);
      const from = Va > target ? D[0] : D[1], to = from === D[0] ? D[1] : D[0], x = Math.abs(Va - target);
      const gain = sell(from, x), tx = tax([{ gain, tf: from.tf }]);
      if (x - tx > 0) to.lots.push({ c: x - tx, v: x - tx });
    }
    if (!acc) { // Entnahme
      const parts = []; let W = 0;
      for (const d of D) { const V = val(d); if (V <= 0) continue; const w = ann(V, gPay - ter, tEnd - t); parts.push({ gain: sell(d, w), tf: d.tf }); W += w; }
      cum += (W - tax(parts)) / Math.pow(1 + infl, t);
    }
    for (let m = 0; m < 12; m++) {
      if (acc) { const w = shift ? share(t) : 1; D[0].lots.push({ c: 150 * w, v: 150 * w }); if (w < 1) D[1].lots.push({ c: 150 * (1 - w), v: 150 * (1 - w) }); }
      for (const [i, d] of D.entries()) { const r = Math.pow(1 + (acc ? (i ? safe : g) : gPay) - ter, 1 / 12) - 1; for (const l of d.lots) l.v *= 1 + r; }
    }
  }
  return Math.round(cum);
}
for (const shift of [false, true]) {
  const a = run(false, shift), f = run(true, shift);
  console.log(`Umschichtung ${shift ? 'an ' : 'aus'}: Durchschnitt ${a} €, FIFO ${f} €, Unterschied ${f - a} € (${((f - a) / a * 100).toFixed(2)} %)`);
}

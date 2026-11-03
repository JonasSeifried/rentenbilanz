// Gewähltes Farbschema vor dem ersten Zeichnen setzen (verhindert Aufblitzen). Externe Datei statt Inline-Skript wegen CSP.
try { var t = localStorage.getItem('vorsorge-rechner:theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* egal */ }

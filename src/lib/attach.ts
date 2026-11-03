// Scrollbare Tabellen-Container: nur wenn sie tatsächlich überlaufen, per Tastatur fokussierbar
// (damit man sie mit Pfeiltasten scrollen kann) und als Region beschriftet.
export function scrollRegion(label: string) {
  return (node: HTMLElement) => {
    const update = () => {
      if (node.scrollWidth > node.clientWidth + 1) {
        node.tabIndex = 0; node.setAttribute('role', 'region'); node.setAttribute('aria-label', label);
      } else {
        node.removeAttribute('tabindex'); node.removeAttribute('role'); node.removeAttribute('aria-label');
      }
    };
    const ro = new ResizeObserver(update); // ändert nur Attribute, keine Größen → keine Resize-Schleife
    ro.observe(node);
    if (node.firstElementChild) ro.observe(node.firstElementChild);
    update();
    return () => ro.disconnect();
  };
}

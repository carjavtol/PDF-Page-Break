export function analyzeElements(container) {
  const elements = Array.from(container.children);

  return elements.map(el => ({
    el,
    tag: el.tagName.toLowerCase(),
    height: el.getBoundingClientRect().height
  }));
}
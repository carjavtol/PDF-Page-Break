export function calculatePageBreaks(elements, pageHeight, config) {
  let currentHeight = 0;
  const breaks = [];

  for (const item of elements) {
    const { el, height, tag } = item;

    if (config.forceAfter?.includes(tag)) {
      breaks.push(el);
      currentHeight = 0;
      continue;
    }

    if (currentHeight + height > pageHeight) {
      breaks.push(el);
      currentHeight = height;
    } else {
      currentHeight += height;
    }
  }

  return breaks;
}
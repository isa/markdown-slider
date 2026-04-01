import type { Handler } from 'mdast-util-to-hast';

/**
 * Maps mdast `highlight` nodes (from `==text==`) to `<mark class="slide-mark">` for react-markdown.
 */
export const highlightMdastToHast: Handler = (state, node) => {
  const result = {
    type: 'element',
    tagName: 'mark',
    properties: { className: ['slide-mark'] },
    children: state.all(node),
  };
  state.patch(node, result);
  return state.applyData(node, result);
};

export const remarkRehypeHighlightHandlers = {
  highlight: highlightMdastToHast,
};

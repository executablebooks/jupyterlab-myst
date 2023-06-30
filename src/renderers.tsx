import React, { useRef } from 'react';
import { DEFAULT_RENDERERS } from 'myst-to-react';
import { MermaidNodeRenderer } from '@myst-theme/diagrams';
import { NodeRenderer } from '@myst-theme/providers';
import { InlineRenderer } from './inlineExpression';
import { listItem } from './taskItem';
import { mathRenderer } from './math';

export const renderers: Record<string, NodeRenderer> = {
  ...DEFAULT_RENDERERS,
  mermaid: MermaidNodeRenderer,
  inlineExpression: node => {
    return <InlineRenderer value={node.value} />;
  },
  listItem,
  math: mathRenderer,
  inlineMath: mathRenderer
};

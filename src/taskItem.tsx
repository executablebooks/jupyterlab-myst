import React from 'react';
import { NodeRenderer } from '@myst-theme/providers';
import type { ListItem } from 'myst-spec-ext';
import { useTaskItemController } from './TaskItemControllerProvider';
import { MyST } from 'myst-to-react';

function TaskItem({
  checked,
  line,
  children
}: {
  checked?: boolean;
  children: React.ReactNode;
  line?: number;
}) {
  // The rendering waiting on promises from Jupyter is slow
  // By keeping state here we can render fast & optimistically
  const [local, setLocal] = React.useState(checked ?? false);
  const { controller } = useTaskItemController();
  return (
    <li className="task-list-item">
      <input
        type="checkbox"
        disabled={!controller}
        className="task-list-item-checkbox"
        checked={local}
        onClick={() => {
          // Bail if no line number was found
          if (!controller || line == null) return;
          controller({ line, checked: !local });
          setLocal(!local);
        }}
      />
      {children}
    </li>
  );
}

export const listItem: NodeRenderer<ListItem & { checked?: boolean }> = ({
  node
}) => {
  if (node.checked == null) {
    return (
      <li key={node.key}>
        <MyST ast={node.children} />
      </li>
    );
  }
  return (
    <TaskItem
      key={node.key}
      checked={node.checked}
      line={node.position?.start.line}
    >
      <MyST ast={node.children} />
    </TaskItem>
  );
};

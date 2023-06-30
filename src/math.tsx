import React, { useRef } from 'react';
import ExclamationCircleIcon from '@heroicons/react/24/outline/ExclamationCircleIcon';
import type { InlineMath, Math } from 'myst-spec';
import { InlineError } from 'myst-to-react/dist/esm/inlineError';
import { HashLink } from 'myst-to-react/dist/esm/heading';
import { NodeRenderer } from '@myst-theme/providers';
import { useTypesetter } from './typesetterProvider';

type MathLike = (InlineMath | Math) & {
  error?: boolean;
  message?: string;
  html?: string;
};

function InlineTypesetterMath({ key, value }: { key: string; value: string }) {
  const { typesetter } = useTypesetter();
  const ref = useRef(null);

  React.useEffect(() => {
    if (!ref || !ref.current || !typesetter) return;
    typesetter.typeset(ref.current);
  }, [ref, typesetter]);
  return (
    <span
      key={key}
      dangerouslySetInnerHTML={{ __html: `$${value}$` }}
      ref={ref}
    />
  );
}

function DisplayTypesetterMath({
  key,
  id,
  value,
  enumerator
}: {
  key: string;
  id: string;
  value: string;
  enumerator?: string;
}) {
  const { typesetter } = useTypesetter();
  const ref = useRef(null);

  React.useEffect(() => {
    if (!ref || !ref.current || !typesetter) return;
    typesetter.typeset(ref.current);
  }, [ref, typesetter]);
  return (
    <div key={key} id={id} className="flex my-5 group">
      <div
        dangerouslySetInnerHTML={{ __html: `$$${value}$$` }}
        className="flex-grow overflow-x-auto overflow-y-hidden"
        ref={ref}
      />
      {enumerator && (
        <div className="relative self-center flex-none pl-2 m-0 text-right select-none">
          <HashLink
            id={id}
            kind="Equation"
            className="text-inherit hover:text-inherit"
          >
            ({enumerator})
          </HashLink>
        </div>
      )}
    </div>
  );
}
export const mathRenderer: NodeRenderer<MathLike> = node => {
  if (node.type === 'math') {
    // if (node.error) {
    //   return (
    //     <pre key={node.key} title={node.message}>
    //       <span className="text-red-500">
    //         <ExclamationCircleIcon className="inline h-[1em] mr-1" />
    //         {node.message}
    //         {'\n\n'}
    //       </span>
    //       {node.value}
    //     </pre>
    //   );
    // }
    const id = node.html_id || node.identifier || node.key;
    return (
      <DisplayTypesetterMath
        id={id}
        key={node.key}
        value={node.value}
        enumerator={node.enumerator}
      />
    );
  }
  // if (node.error || !node.html) {
  //   return (
  //     <InlineError key={node.key} value={node.value} message={node.message} />
  //   );
  // }

  const { value } = node;

  return <InlineTypesetterMath key={node.key} value={value} />;
};

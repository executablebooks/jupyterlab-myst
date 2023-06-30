import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { ISignal, Signal } from '@lumino/signaling';
import { FrontmatterBlock } from '@myst-theme/frontmatter';
import { VDomModel, VDomRenderer } from '@jupyterlab/apputils';
import { ILatexTypesetter, IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { References } from 'myst-common';
import { PageFrontmatter } from 'myst-frontmatter';
import {
  ReferencesProvider,
  TabStateProvider,
  Theme,
  ThemeProvider
} from '@myst-theme/providers';
import { useParse } from 'myst-to-react';
import React from 'react';
import { UserExpressionsProvider } from './UserExpressionsProvider';
import {
  ITaskItemChange,
  ITaskItemController,
  TaskItemControllerProvider
} from './TaskItemControllerProvider';
import { renderers } from './renderers';
import { IUserExpressionMetadata } from './metadata';
import { linkFactory } from './links';
import { TypesetterProvider } from './typesetterProvider';

/**
 * The MIME type for Markdown.
 */
export const MIME_TYPE = 'text/markdown';

// export interface IMySTFragmentContext extends ITaskItemController {
//   requestUpdate(renderer: RenderedMySTMarkdown): Promise<IMySTDocumentState>;
//   setTaskItem(line: number, checked: boolean): void;
// }

export interface IMySTModel extends VDomRenderer.IModel {
  references?: References;
  mdast?: any;
  expressions?: IUserExpressionMetadata[];
  frontmatter?: PageFrontmatter;
  readonly stateChanged: ISignal<this, void>;
}

export class MySTModel extends VDomModel implements IMySTModel {
  private _references?: References;
  private _mdast?: any;
  private _expressions?: IUserExpressionMetadata[];
  private _frontmatter?: PageFrontmatter;

  get references(): References | undefined {
    return this._references;
  }

  set references(value: References | undefined) {
    this._references = value;
    this.stateChanged.emit();
  }

  get mdast(): any | undefined {
    return this._mdast;
  }

  set mdast(value: any | undefined) {
    this._mdast = value;
    this.stateChanged.emit();
  }

  get expressions(): IUserExpressionMetadata[] | undefined {
    return this._expressions;
  }

  set expressions(value: IUserExpressionMetadata[] | undefined) {
    this._expressions = value;
    this.stateChanged.emit();
  }

  get frontmatter(): PageFrontmatter | undefined {
    return this._frontmatter;
  }

  set frontmatter(value: PageFrontmatter | undefined) {
    this._frontmatter = value;
    this.stateChanged.emit();
  }
}

export interface IMySTOptions {
  model?: IMySTModel;
  resolver?: IRenderMime.IResolver;
  linkHandler?: IRenderMime.ILinkHandler;
  latexTypesetter?: IRenderMime.ILatexTypesetter;
  rendermime?: IRenderMimeRegistry;
  trusted?: boolean;
}

/**
 * A mime renderer for displaying Markdown with embedded latex.
 */
export class MySTWidget extends VDomRenderer<IMySTModel> {
  /**
   * Construct a new MyST markdown widget.
   *
   * @param options - The options for initializing the widget.
   */
  constructor(options: IMySTOptions) {
    const { model, resolver, rendermime, trusted, latexTypesetter } = options;
    super(model);

    this._resolver = resolver;
    this._rendermime = rendermime;
    this._trusted = trusted;
    this._latexTypesetter = latexTypesetter;
    this.addClass('myst');

    this._taskItemController = change => this._taskItemChanged.emit(change);
  }

  private _trusted?: boolean = false;
  private readonly _typesetter?: ILatexTypesetter;
  private readonly _resolver?: IRenderMime.IResolver;
  private readonly _linkHandler?: IRenderMime.ILinkHandler;
  private readonly _latexTypesetter?: IRenderMime.ILatexTypesetter;
  private readonly _rendermime?: IRenderMimeRegistry;
  private readonly _taskItemChanged = new Signal<this, ITaskItemChange>(this);
  private readonly _taskItemController: ITaskItemController;

  get taskItemChanged(): ISignal<this, ITaskItemChange> {
    return this._taskItemChanged;
  }

  get trusted(): boolean | undefined {
    return this._trusted;
  }

  set trusted(value: boolean | undefined) {
    this._trusted = value;
    this.update();
  }

  protected render(): React.JSX.Element {
    console.debug(
      'Re-rendering VDOM for MySTWidget',
      this.model,
      this._trusted
    );
    if (!this.model) {
      return <span>MyST Renderer!</span>;
    }
    const { references, frontmatter, mdast, expressions } = this.model;

    const children = useParse(mdast || null, renderers);

    return (
      <TypesetterProvider typesetter={this._latexTypesetter}>
        <TaskItemControllerProvider controller={this._taskItemController}>
          <ThemeProvider
            theme={Theme.light}
            Link={linkFactory(this._resolver, this._linkHandler)}
            renderers={renderers}
          >
            <UserExpressionsProvider
              expressions={expressions}
              rendermime={this._rendermime}
              trusted={this._trusted}
            >
              <TabStateProvider>
                <ReferencesProvider
                  references={references}
                  frontmatter={frontmatter}
                >
                  {frontmatter && (
                    <FrontmatterBlock frontmatter={frontmatter} />
                  )}
                  {children}
                </ReferencesProvider>
              </TabStateProvider>
            </UserExpressionsProvider>
          </ThemeProvider>
        </TaskItemControllerProvider>
      </TypesetterProvider>
    );
  }
}

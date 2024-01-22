import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { markdownParse, processArticleMDAST } from './myst';
import { MySTModel, MySTWidget } from './widget';

/**
 * The MIME type for Markdown.
 */
export const MIME_TYPE = 'text/markdown';

export class RenderedMySTMarkdown
  extends MySTWidget
  implements IRenderMime.IRenderer
{
  readonly resolver: IRenderMime.IResolver | undefined;
  readonly linkHandler: IRenderMime.ILinkHandler | undefined;

  constructor(options: IRenderMime.IRendererOptions) {
    super({
      model: undefined,
      resolver: options.resolver ?? undefined,
      linkHandler: options.linkHandler ?? undefined,
      sanitizer: options.sanitizer ?? undefined
    });
    this.resolver = options.resolver ?? undefined;
    this.node.dataset['mimeType'] = MIME_TYPE;
    this.addClass('jp-RenderedMySTMarkdown');
  }

  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    if ((window as any).trigger) {
      throw Error('triggered!');
    }
    const mdast = markdownParse(model.data[MIME_TYPE] as string);
    const {
      references,
      mdast: mdastNext,
      frontmatter
    } = await processArticleMDAST(mdast, this.resolver);
    const mystModel = new MySTModel();
    mystModel.references = references;
    mystModel.mdast = mdastNext;
    mystModel.frontmatter = frontmatter;
    if (this.model) {
      // Re-use expressions even if AST changes
      mystModel.expressions = this.model.expressions;
    }
    this.model = mystModel;

    console.debug('State changed', this);
    return this.renderPromise || Promise.resolve();
  }
}

/**
 * A mime renderer factory for Markdown.
 */
export const mystMarkdownRendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: ['text/markdown'],
  defaultRank: 50,
  createRenderer: options => new RenderedMySTMarkdown(options)
};

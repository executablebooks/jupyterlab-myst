import { CellModel, MarkdownCell, MarkdownCellModel } from '@jupyterlab/cells';
import { StaticNotebook } from '@jupyterlab/notebook';
import { ActivityMonitor } from '@jupyterlab/coreutils';
import { AttachmentsResolver } from '@jupyterlab/attachments';
import { IMapChange } from '@jupyter/ydoc';
import { IMySTMarkdownCell } from './types';
import { getUserExpressions, metadataSection } from './metadata';
import { IMySTModel, MySTModel, MySTWidget } from './widget';
import { markdownParse, processCellMDAST, renderNotebook } from './myst';
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { ITaskItemChange } from './TaskItemControllerProvider';

class IMySTWidget {}

export class MySTMarkdownCell
  extends MarkdownCell
  implements IMySTMarkdownCell
{
  private readonly _notebookRendermime;
  private readonly _attachmentsResolver: IRenderMime.IResolver;
  private readonly _mystWidget: MySTWidget;
  private _metadataJustChanged = false;
  private _fragmentMDAST: any | undefined;
  private _mystModel: IMySTModel;

  constructor(options: MarkdownCell.IOptions) {
    super(options);

    // We need the notebook's rendermime registry for widgets
    this._notebookRendermime = options.rendermime;
    // But, we also want a per-cell rendermime for resolving attachments
    this._attachmentsResolver = new AttachmentsResolver({
      parent: options.rendermime.resolver ?? undefined,
      model: this.model.attachments
    });

    // Create MyST renderer
    this._mystModel = new MySTModel();
    this._mystWidget = new MySTWidget({
      model: this._mystModel,
      rendermime: this._notebookRendermime,
      linkHandler: this._notebookRendermime.linkHandler ?? undefined,
      resolver: this._attachmentsResolver,
      trusted: this.model.trusted,
      sanitizer: this._notebookRendermime.sanitizer ?? undefined
    });
    this._mystWidget.taskItemChanged.connect((caller, change) =>
      this.setTaskItem(caller, change)
    );

    // HACK: we don't use the rendermime system for output rendering.
    //       Let's instead create an unused text/plain renderer
    this['_renderer'].dispose();
    this['_renderer'] = this._notebookRendermime.createRenderer('text/plain');

    // HACK: catch changes to the cell model trust
    (this.model as MarkdownCellModel).onTrustedChanged = () =>
      this.onModelTrustedChanged();

    // HACK: re-order signal handlers by recreating activity monitor,
    //       and introduce veto for metadataonly changes
    (this as any)._monitor.dispose();
    this['_monitor'] = this.createActivityMonitor();

    // HACK: patch the callback for changes to `rendered`
    this['_handleRendered'] = this.onRenderedChanged;

    // We need to write the initial metadata values from the cell
    this.restoreExpressionsFromMetadata();
  }

  private setTaskItem(_: IMySTWidget, change: ITaskItemChange): void {
    const text = this.model.sharedModel.getSource();
    // This is a pretty cautious replacement for the identified line
    const lines = text.split('\n');
    lines[change.line] = lines[change.line].replace(
      /^(\s*(?:-|\*)\s*)(\[[\s|x]\])/,
      change.checked ? '$1[x]' : '$1[ ]'
    );
    // Update the Jupyter cell markdown value
    this.model.sharedModel.setSource(lines.join('\n'));
  }

  /**
   * Handle the rendered state.
   */
  private async onRenderedChanged(): Promise<void> {
    if (!this.rendered) {
      this.showEditor();
    } else {
      if (this.placeholder) {
        await this.updateFragmentMDAST();
        return;
      }

      if (this.rendered) {
        // The rendered flag may be updated in the mean time
        await this.render();
      }
    }
  }

  private createActivityMonitor() {
    // HACK: activity monitor also triggers for metadata changes
    // So, let's re-order the signal registration so that metadata changes can
    // veto the delayed render
    const activityMonitor = new ActivityMonitor({
      signal: this.model.contentChanged,
      // timeout: (this as any)._monitor.timeout
      // HACK: This generally makes the jupyter content update happen first
      // Which prevents a noticeable double render of the react component
      // This is really signalling the content change before the shift-enter
      timeout: 100
    });
    // Throttle the rendering rate of the widget.
    this.ready
      .then(() => {
        if (this.isDisposed) {
          // Bail early
          return;
        }
        console.debug('ready and connected activityStopped signal');
        activityMonitor.activityStopped.connect(() => {
          console.debug('Activity monitor expired');
          if (this.rendered && !this._metadataJustChanged) {
            console.debug('Updating cell!');
            this.update();
          }
          this._metadataJustChanged = false;
        }, this);
      })
      .catch(reason => {
        console.error('Failed to be ready', reason);
      });
    return activityMonitor;
  }

  private restoreExpressionsFromMetadata() {
    const expressions = getUserExpressions(this);
    if (expressions !== undefined) {
      console.debug('Restoring expressions from metadata', expressions);
      this._mystWidget.model.expressions = expressions;
    }
  }

  private onModelTrustedChanged() {
    console.debug('trust changed', this.model.trusted);
    this._mystWidget.trusted = this.model.trusted;
    this.restoreExpressionsFromMetadata();
  }

  /**
   * Handle changes in the metadata.
   */
  protected onMetadataChanged(model: CellModel, args: IMapChange): void {
    console.debug('metadata changed', args);
    this._metadataJustChanged = true;
    switch (args.key) {
      case metadataSection:
        console.debug('metadata changed', args);
        this.restoreExpressionsFromMetadata();
        break;
      default:
        super.onMetadataChanged(model, args);
    }
  }

  get attachmentsResolver(): IRenderMime.IResolver {
    return this._attachmentsResolver;
  }

  get mystModel(): IMySTModel {
    return this._mystModel;
  }

  set mystModel(model: IMySTModel) {
    if (model !== this._mystModel) {
      this._mystModel.dispose();
    }
    this._mystModel = model;
    this._mystWidget.model = model;
  }

  get fragmentMDAST(): any {
    return this._fragmentMDAST;
  }

  /**
   * Update fragment MDAST from raw source of cell model.
   * This ensures that notebook-wide updates take the latest version of a cell.
   * Even if it is not yet rendered.
   */
  async updateFragmentMDAST() {
    // Resolve per-cell MDAST
    let fragmentMDAST: any = markdownParse(this.model.sharedModel.getSource());
    if (this._attachmentsResolver) {
      fragmentMDAST = await processCellMDAST(
        this._attachmentsResolver,
        fragmentMDAST
      );
    }
    fragmentMDAST.type = 'block';
    this._fragmentMDAST = fragmentMDAST;
  }

  async render() {
    await this.updateFragmentMDAST();

    if (!this._mystWidget.node || !this.isAttached) {
      return;
    }

    // The notebook update is asynchronous
    await renderNotebook(this.parent as StaticNotebook);

    // Let's wait for this cell to be rendered
    await this._mystWidget.renderPromise;

    this.inputArea!.renderInput(this._mystWidget);
  }
}

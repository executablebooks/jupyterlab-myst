import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';

import { IEditorServices } from '@jupyterlab/codeeditor';

import {
  INotebookTracker,
  INotebookWidgetFactory,
  NotebookPanel,
  NotebookWidgetFactory,
  NotebookActions,
  Notebook
} from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { MySTContentFactory } from './MySTContentFactory';

import { ISessionContextDialogs } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { ITranslator } from '@jupyterlab/translation';

import { notebookCellExecuted } from './actions';
import { mystIcon } from './icon';
import { mystMarkdownRendererFactory } from './mime';

/**
 * The notebook content factory provider.
 */
const plugin: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: 'jupyterlab-myst:plugin',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    console.log('JupyterLab extension jupyterlab-myst is activated!');
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new MySTContentFactory({ editorFactory });
  }
};

/**
 * The legacy-mode content factory.
 */
const legacyPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-myst:legacyPlugin',
  optional: [ITranslator],
  requires: [
    IEditorServices,
    IRenderMimeRegistry,
    ISessionContextDialogs,
    INotebookWidgetFactory,
    INotebookTracker,
    NotebookPanel.IContentFactory
  ],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    editorServices: IEditorServices,
    rendermime: IRenderMimeRegistry,
    sessionContextDialogs: ISessionContextDialogs,
    notebookFactory: NotebookWidgetFactory.IFactory,
    notebookTracker: INotebookTracker,
    existingContentFactory: NotebookPanel.IContentFactory,
    translator: ITranslator | null
  ) => {
    if (existingContentFactory instanceof MySTContentFactory) {
      return;
    }
    console.log(
      'JupyterLab extension jupyterlab-myst (legacy mode) is activated!'
    );

    const contentFactory = new MySTContentFactory({
      editorFactory: options =>
        editorServices.factoryService.newInlineEditor(options)
    });

    const factory = new NotebookWidgetFactory({
      name: 'Jupyter MyST Notebook',
      // label: trans.__("Jupyter MyST Notebook"), // will be needed in JupyterLab 4
      fileTypes: ['notebook', 'markdown', 'myst'],
      defaultFor: ['notebook'],
      modelName: notebookFactory.modelName ?? 'notebook',
      preferKernel: notebookFactory.preferKernel ?? true,
      canStartKernel: notebookFactory.canStartKernel ?? true,
      rendermime,
      contentFactory,
      editorConfig: notebookFactory.editorConfig,
      notebookConfig: notebookFactory.notebookConfig,
      mimeTypeService: editorServices.mimeTypeService,
      toolbarFactory: notebookFactory.toolbarFactory,
      translator: translator ?? undefined
    });

    let id = 0;

    factory.widgetCreated.connect((sender, widget) => {
      // If the notebook panel does not have an ID, assign it one.
      widget.id = widget.id || `myst-notebook-${++id}`;

      // Set up the title icon
      widget.title.icon = mystIcon ?? '';
      widget.toolbar.title.icon = mystIcon;
      widget.title.iconClass = '';
      widget.title.iconLabel = 'MyST Notebook';

      // Notify the widget tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        void (notebookTracker as any).save(widget);
      });
      // Add the notebook panel to the tracker.
      void (notebookTracker as any).add(widget);
    });

    app.docRegistry.addWidgetFactory(factory);
  }
};

/**
 * The notebook cell executor.
 */
const executorPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-myst:executor',
  requires: [INotebookTracker],
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('Using jupyterlab-myst:executor');

    NotebookActions.executed.connect(
      async (sender: any, value: { notebook: Notebook; cell: Cell }) => {
        const { notebook, cell } = value;
        await notebookCellExecuted(notebook, cell, tracker);
      }
    );

    return;
  }
};

const mimeRendererPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-myst:mimeRenderer',
  requires: [IRenderMimeRegistry],
  autoStart: true,
  optional: [IMarkdownViewerTracker],
  activate: (
    app: JupyterFrontEnd,
    registry: IRenderMimeRegistry,
    tracker?: IMarkdownViewerTracker
  ) => {
    console.log('Using jupyterlab-myst:mimeRenderer');
    // Add the MyST markdown renderer factory.
    registry.addFactory(mystMarkdownRendererFactory);
  }
};

export default [plugin, legacyPlugin, executorPlugin, mimeRendererPlugin];

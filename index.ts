import { registry } from '@occam4/common';
import AnyView from './AnyView.vue';
import LogView from './LogView.vue';
import HtmlView from './HtmlView.vue';
import DataGridView from './DataGridView.vue';
import FormView from './FormView.vue';
import SectionView from './SectionView.vue';
import DesignView from './DesignView.vue';
import TabView from './TabView.vue';
import TreeView from './TreeView.vue';
import ListView from './ListView.vue';
import DataImporterView from './DataImporterView.vue';
import TimelineView from './TimelineView.vue';
import CommentView from './CommentView.vue';

const { uiService } = registry;

uiService.registerComponents('View', {
  AnyView,
  DataGridView,
  FormView,
  SectionView,
  DesignView,
  TabView,
  TreeView,
  ListView,
  LogView,
  HtmlView,
  DataImporterView,
  MarkdownView: () => import('./MarkdownView.vue'),
  NestedListView: () => import('./NestedListView.vue'),
  ChatView: () => import('./ChatView.vue'),
  VideoCallView: () => import('./VideoCallView.vue'),
  ChatbotView: () => import('./ChatbotView.vue'),
  SplitView: () => import('./SplitView.vue'),
  MarkdownEditorView: () => import('./MarkdownEditorView.vue'),
  ImageEditorView: () => import('./ImageEditorView.vue'),
  TimelineView,
  CommentView
});

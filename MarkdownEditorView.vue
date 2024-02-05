<template>
  <div class="fit" ref="el" />
</template>

<script setup lang="ts">
import { FileViewModel, registry, FileViewService } from '@occam4/common';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import chart from '@toast-ui/editor-plugin-chart';
import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight';
import colorSyntax from '@toast-ui/editor-plugin-color-syntax';
import tableMergedCell from '@toast-ui/editor-plugin-table-merged-cell';
import uml from '@toast-ui/editor-plugin-uml';
import { onMounted, ref } from 'vue';
import { ViewProps } from '../props';

const { createService } = registry;
const emits = defineEmits<{
  (event: 'update:modelValue', value: any): void;
  (event: 'submit', value: any): void;
}>();

const props = defineProps<ViewProps<FileViewModel>>();
let editor: Editor;
const el = ref<HTMLElement>();

const service = createService(
  class MarkdownEditorViewService extends FileViewService {
    constructor() {
      super(props);
    }

    isHtml = false;

    async saveFile() {
      const content = this.isHtml ? editor.getHTML() : editor.getMarkdown();
      const blob = new Blob([content]);
      emits('update:modelValue', blob);
      emits('submit', blob);
    }

    async loadFile(content: globalThis.File) {
      const text = await content.text();
      if (content.name.endsWith('md')) {
        editor.setMarkdown(text);
        this.isHtml = false;
      } else {
        editor.setHTML(text);
        this.isHtml = true;
      }
      editor.moveCursorToStart();
    }
  }
);

onMounted(() => {
  const plugins = [chart, codeSyntaxHighlight, colorSyntax, tableMergedCell, uml];
  editor = new Editor({ el: el.value!, plugins, previewStyle: 'vertical' });

  if (props.modelValue) service.loadFile(props.modelValue);

  // @ts-ignore
  window.$tuiEditor = editor;
});

defineExpose(service);
</script>

<template>
  <div class="fit" ref="container" />
</template>

<script setup lang="ts">
import { FileViewModel, FileViewService, registry, dataUrlToBlob, blobToBase64 } from '@occam4/common';
import { onMounted, ref } from 'vue';
import ImageEditor from 'tui-image-editor';
import 'tui-image-editor/dist/tui-image-editor.css';
import { ViewProps } from '../props';

const { createService } = registry;
const emits = defineEmits<{
  (event: 'update:modelValue', value: any): void;
  (event: 'submit', value: any): void;
}>();

const props = defineProps<ViewProps<FileViewModel>>();
const container = ref<HTMLElement>();

onMounted(() => {
  service.init();
});

const service = createService(
  class ImageEditorService extends FileViewService {
    constructor() {
      super(props);
    }

    imageEditor?: ImageEditor;

    init() {
      // @ts-ignore
      this.imageEditor = new ImageEditor(container.value, {
        includeUI: {
          uiSize: {
            width: '100%',
            height: '100%'
          }
        },
        usageStatistics: false
      });

      // @ts-ignore
      this.imageEditor.undo = () => {
        // @ts-ignore
        const invoker = this.imageEditor._invoker;
        if (invoker._undoStack.length > 1) invoker.undo();

        return new Promise((resolve) => {
          resolve(1);
        });
      };

      if (props.modelValue) {
        this.imageEditor.loadImageFromFile(props.modelValue);
        // @ts-ignore
        this.imageEditor.ui.activeMenuEvent();
      }
    }

    async saveFile() {
      try {
        // @ts-ignore
        const dataUrl = this.imageEditor._graphics._canvas.toDataURL();
        const blob = await dataUrlToBlob(dataUrl);

        emits('update:modelValue', blob);
        emits('submit', blob);
      } catch (error: any) {
        throw new Error(error);
      }
    }

    async loadFile(content: Blob) {
      const base64 = await blobToBase64(content);
      this.imageEditor?.loadImageFromURL(base64);
    }
  }
);

defineExpose(service);
</script>

<style>
.tui-image-editor-container .tui-image-editor-header-logo,
.tui-image-editor-header-buttons {
  display: none;
}
</style>

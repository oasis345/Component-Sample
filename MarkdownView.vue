<template>
  <MarkdownIt ref="component" :source="service.data" />
</template>

<script setup lang="ts">
// @ts-ignore
import MarkdownIt from 'vue3-markdown-it';
import { MarkdownViewModel, ViewService } from '@occam4/common';
import { createService } from 'services';
import { ref } from 'vue';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<MarkdownViewModel>>();
const component = ref();

const service = createService(
  class MarkdownViewService extends ViewService<MarkdownViewModel> {
    constructor() {
      super(props);
    }

    get data(): any {
      return props.modelValue ?? service.model.data;
    }
  }
);

defineExpose(service);
</script>

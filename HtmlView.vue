<template>
  <div ref="component" v-html="service.data"></div>
</template>

<script setup lang="ts">
import { HtmlViewModel, ViewService } from '@occam4/common';
import { createService } from 'services';
import { onMounted, ref } from 'vue';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<HtmlViewModel, File>>();
const component = ref();

onMounted(() => {
  service.component = component.value;
});

const service = createService(
  class HtmlViewService extends ViewService<HtmlViewModel> {
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

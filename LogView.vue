<template>
  <div v-if="isArray(service.data)" ref="component" class="q-pa-md q-pb-lg">
    <div v-for="(row, i) of service.data" :key="i">{{ row }}</div>
  </div>
  <div v-else ref="component">{{ service.data }}</div>
</template>

<script setup lang="ts">
import { LogViewModel, isArray, ViewService } from '@occam4/common';
import { createService } from 'services';
import { onMounted, ref, watch } from 'vue';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<LogViewModel>>();
const component = ref();

onMounted(() => {
  service.component = component.value;
});

const service = createService(
  class LogViewService extends ViewService<LogViewModel> {
    constructor() {
      super(props);
    }

    get data(): any {
      return props.modelValue ?? service.model.data;
    }
  }
);

watch(
  () => service.data,
  () => {
    const element = component.value;
    if (element && props.model.scrollToBottom) element.scrollTop = element.scrollHeight;
  },
  { deep: true }
);

defineExpose(service);
</script>

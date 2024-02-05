<template>
  <q-tree
    :nodes="modelValue"
    :node-key="model.keyField ?? '$id'"
    no-selection-unset
    default-expand-all
    selected-color="primary"
    v-model:selected="service.selectedData"
    v-bind="$attrs"
    @update:selected="onSelect"
  >
    <template v-slot:default-header="prop">
      {{ getLabel?.(prop.node) ?? prop.node[model.labelField ?? 'label'] }}
    </template>
  </q-tree>
</template>

<script setup lang="ts">
import { DataViewService, DataViewModel } from '@occam4/common';
import { createService } from 'services';

const props = defineProps<{
  model: DataViewModel;
  modelValue: any;
  parentView?: DataViewService;
  getLabel?: (data: any) => string;
  onSelect?: (event: any) => void;
}>();

const service = createService(
  class TreeViewService extends DataViewService<DataViewModel> {
    constructor() {
      super(props);
    }
  }
);

defineExpose(service);
</script>

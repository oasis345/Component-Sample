<template>
  <draggable
    class="full-height"
    :list="service.children"
    item-key="name"
    :group="{
      name: 'viewDesigner',
      pull: false,
      put: false
    }"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <template #item="{ element: childView }">
      <any-view
        class="full-height"
        :model="childView"
        :parentView="service"
        v-bind="childView.componentProps"
        :pageCtx="pageCtx"
        @close="$emit('close')"
        @submit="$emit('submit', $event)"
        ref="children"
      />
    </template>
  </draggable>
</template>

<script setup lang="ts">
import { ViewService, registry, SectionViewModel } from '@occam4/common';
import AnyView from 'views/AnyView.vue';
import { createService } from 'services';
import { ref } from 'vue';
import draggable from 'vuedraggable';
import { ContainerService } from './ContainerService';
import { ViewProps } from '../props';

const { uiService } = registry;

const props = defineProps<ViewProps<SectionViewModel>>();

const children = ref<ViewService[]>();
const service = createService(ContainerService, props, children);

function onDragOver(e: DragEvent) {
  if (e.dataTransfer!.items[0].type != 'text/plain') return;
  const parent = (e.target as any).__vueParentComponent?.parent;
  const targetModel = parent?.props.model ?? parent?.parent?.props.model;
  if (!!targetModel?.children) uiService.designerDroppableModel = targetModel;
  else uiService.designerDroppableModel = undefined;
}

function onDrop(e: DragEvent) {
  const droppedModel = JSON.parse(e.dataTransfer?.getData('text') as string);
  const droppableModel: any = uiService.designerDroppableModel;
  if (droppableModel?.children) droppableModel.children.push(droppedModel);
}

defineExpose(service);
</script>

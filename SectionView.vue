<template>
  <div class="full-height">
    <any-view
      v-for="(childView, i) in service.children"
      :key="i"
      :model="childView"
      :parentView="service"
      v-bind="childView.componentProps"
      :pageCtx="pageCtx"
      :isPage="isPage && model.hideToolbar && i == 0"
      @close="$emit('close')"
      @submit="$emit('submit', $event)"
      ref="children"
    />
  </div>
</template>

<script setup lang="ts">
import { ViewService, SectionViewModel } from '@occam4/common';
import AnyView from 'views/AnyView.vue';
import { createService } from 'services';
import { ref } from 'vue';
import { ContainerService } from './ContainerService';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<SectionViewModel>>();

const children = ref<ViewService[]>();
const service = createService(ContainerService, props, children);

defineExpose(service);
</script>

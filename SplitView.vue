<template>
  <div class="col relative-position">
    <Splitpanes :horizontal="model.vertical" class="default-theme col-shrink absolute fit">
      <pane
        v-for="(childView, i) in service.children"
        :key="i"
        v-bind="childView.containerProps"
        :style="childView.containerStyle"
        :size="model.sizes?.[i]"
        :min-size="model.minSizes?.[i]"
        :max-size="model.maxSizes?.[i]"
      >
        <any-view
          :model="(childView as ViewModel)"
          :parentView="service"
          v-bind="childView.componentProps"
          :pageCtx="pageCtx"
          :isPage="isPage && model.hideToolbar"
          @close="$emit('close')"
          @submit="$emit('submit', $event)"
          ref="children"
          class="fit"
        />
      </pane>
    </Splitpanes>
  </div>
</template>

<script setup lang="ts">
import { ViewService, SplitViewModel, ViewModel } from '@occam4/common';
import { Pane, Splitpanes } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import AnyView from 'views/AnyView.vue';
import { createService } from 'services';
import { ref } from 'vue';
import { ContainerService } from './ContainerService';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<SplitViewModel>>();

const children = ref<ViewService[]>();
const service = createService(ContainerService, props, children);

defineExpose(service);
</script>

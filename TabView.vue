<template>
  <div
    class="full-height column"
    :class="{ reverse: props.model.bottomTabs == null ? uiService.screen.xs : props.model.bottomTabs }"
  >
    <q-tabs
      v-model="service.tab"
      :vertical="model.vertical"
      narrow-indicator
      mobile-arrows
      :dense="uiService.screen.xs"
      active-color="primary"
      active-bg-color="white"
      class="bg-grey-2"
      align="left"
      style="max-width: 100%"
    >
      <q-tab
        v-for="(childView, i) in service.children"
        :key="i"
        :name="childView.name ?? i"
        :label="messageService.getLabel(childView)"
        :icon="modelService.callProp(childView, 'icon', props)"
        v-show="!modelService.callProp(childView, 'hidden', props)"
      />
    </q-tabs>
    <q-tab-panels class="col q-ma-none" v-model="service.tab" style="overflow-y: auto">
      <q-tab-panel
        class="q-pa-none"
        v-for="(childView, i) in service.children"
        :key="i"
        :name="childView.name ?? i"
        v-bind="childView.containerProps"
        :style="childView.containerStyle"
      >
        <any-view
          class="full-height"
          :model="(childView as ViewModel)"
          :parentView="service"
          v-bind="childView.componentProps"
          :pageCtx="pageCtx"
          :dataId="service.childDataId"
          :isPage="isPage && model.hideToolbar"
          @close="$emit('close')"
          @submit="$emit('submit', $event)"
          ref="children"
        />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang="ts">
import { ViewService, registry, TabViewModel, ViewModel } from '@occam4/common';
import AnyView from 'views/AnyView.vue';
import { createService } from 'services';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ContainerService } from './ContainerService';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<TabViewModel>>();
const { messageService, modelService, uiService } = registry;

const route = useRoute();
const router = useRouter();
const children = ref<ViewService[]>();
const service = createService(
  class TabViewService extends ContainerService<TabViewModel> {
    constructor() {
      super(props, children);
    }

    private _tab: any;

    get defaultTab() {
      return this.model.defaultTab;
    }

    get tab(): any {
      let tab = props.isPage ? route.params.childView : this._tab;
      return tab ?? this.defaultTab;
    }

    set tab(tab: string) {
      if (props.isPage) {
        const parentPath = route.path.split('/').slice(0, 3).join('/');
        router.push({ path: parentPath + '/' + tab });
      } else {
        this._tab = tab;
      }
    }

    get childDataId(): string | undefined {
      return props.isPage ? (route.params.childDataId as string) : this.dataId;
    }
  }
);

defineExpose(service);
</script>
<style>
.q-tabs__arrow {
  background-color: #f5f5f5;
}
</style>

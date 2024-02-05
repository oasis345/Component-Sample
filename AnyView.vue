<template>
  <wrapperComponent
    v-if="!service.hidden"
    class="q-pa-none column"
    :class="{
      ...service.model?.wrapperClass,
      col: isPage && !service.model?.width,
      fit: isPage && !service.model?.width && !service.model?.height,
      'designer-selected': service.designerSelected,
      'designer-droppable': service.designerDroppable || service.dragging
    }"
    :style="{
      flexWrap: 'initial',
      minHeight: 'inherit',
      width: toPx(service.model?.width),
      maxWidth: toPx(service.model?.width),
      height: toPx(service.model?.height)
    }"
    ref="wrapper"
    :viewService="service.mainView"
    :model="service.model"
    :model-value="service.data"
    :dataId="service.dataId"
    :pageCtx="service.pageCtx"
    :isPage="isPage"
    @contextmenu="service.onRightClick"
    @keydown="service.onKeyDown"
    @drop.prevent="service.onDrop($event)"
    @dragover.prevent="service.dragging = !!service.model.droppable"
    @dragenter="service.dragging = !!service.model.droppable"
    @dragleave="service.dragging = false"
  >
    <div
      v-if="service.model.pageFields?.length || isSortableView(service.model) || isSearchableView(service.model)"
      class="row full-width no-wrap"
    >
      <!-- Page Fields -->
      <div v-if="service.viewSize === 'xs' ? !service.searching : true" class="full-width">
        <form-view
          v-if="service.model.pageFields?.length"
          v-model="service.pageCtx"
          :pageCtx="service.pageCtx"
          :model="(service.model as FormViewModel)"
          :viewService="service.mainView"
          :parentView="parentView"
          :updateDirectly="true"
          :defaultCols="service.viewSize === 'xs' ? 4 : 2"
          fieldsType="pageFields"
        />
      </div>
      <div
        v-if="isSortableView(service.model) || isSearchableView(service.model)"
        class="no-wrap row justify-end items-end q-pb-xs"
        :class="{ 'full-width': service.searching && service.viewSize === 'xs' }"
      >
        <sort-bar
          v-if="isSortableView(service.model) && (service.viewSize === 'xs' ? !service.searching : true)"
          :view-model="service.model"
          :viewService="service.mainView"
          v-model="service.pageCtx.__sort"
        />
        <search-bar
          v-if="isSearchableView(service.model)"
          :view-model="service.model"
          :viewService="service.mainView"
          :viewSize="service.viewSize"
          v-model="service.pageCtx.__search"
          @show-input="service.searching = true"
          @hide-input="service.searching = false"
        />
      </div>
    </div>
    <!-- Main View -->
    <view-component v-if="service.model.ignoreProps" ref="mainView" />
    <view-component
      v-else
      ref="mainView"
      style="overflow-y: auto"
      v-bind="$attrs"
      :parentView="parentView"
      :model="service.model"
      :dataId="service.dataId"
      :model-value="service.data"
      :pageCtx="service.pageCtx"
      :isPage="isPage"
      :viewSize="service.viewSize"
      :class="callProp(service.model, 'viewClass')"
      @update:model-value="service.onDataChange"
    />
    <view-actions
      class="row justify-end full-width"
      v-if="service.model.viewActionsOn?.includes('bottom')"
      v-bind="{ model: service.model, viewService: service.mainView }"
      :pageCtx="service.pageCtx"
    />
  </wrapperComponent>
</template>

<script setup lang="ts">
import {
  DataViewModel,
  DataViewService,
  FormViewModel,
  isListableView,
  ViewService,
  registry,
  UndoService,
  ViewModel,
  toPx,
  Dict,
  isSearchableView,
  isSortableView,
  PageCtx,
  assignObjectNotExist,
  ScreenSize
} from '@occam4/common';
import { createService } from 'services';
import { computed, onUnmounted, ref, watch, WatchStopHandle } from 'vue';
import { useElementSize } from '@vueuse/core';
import ViewActions from '../common/ViewActions.vue';
import FormView from './FormView.vue';
import SearchBar from '../common/SearchBar.vue';
import SortBar from '../common/SortBar.vue';
import { Screen } from 'quasar';
import { ViewProps } from '../props';

const { modelService, uiService, callProp, _, $q } = registry;

const props = defineProps<ViewProps<ViewModel>>();

const wrapper = ref();
const viewSize = useElementSize(wrapper);

const service = createService(
  class extends DataViewService {
    constructor() {
      super(props);
    }

    dragging = false;
    searching = false;
    viewSize?: ScreenSize;

    get pageCtx(): PageCtx {
      const pageCtx = props.pageCtx ?? {};
      const defaultData: Dict = callProp(props.model, 'pageCtxDefaultData', props);
      if (defaultData) assignObjectNotExist(pageCtx, defaultData);
      return pageCtx;
    }

    get data(): any {
      return props.modelValue ?? callProp(props.model, 'data', props);
    }

    get dataId(): string | undefined {
      // route.params로 들어오는 dataId가 없으면 empty string임
      return callProp<string>(props.model, 'dataId', { ...props, viewService: this }) || props.dataId || undefined;
    }

    get model(): ViewModel {
      let preModel: any = props.model;
      const mobileView = props.model.mobileView;
      if (mobileView && isListableView(props.model) && uiService.screen.xs) {
        if (_.isString(mobileView)) return modelService.getView(mobileView);
        else preModel = { ...props.model, ...mobileView };
      }

      return modelService.configure(preModel, { viewService: this }, 'views');
    }

    get mainView(): DataViewService {
      return mainView.value ?? this;
    }

    get isPage() {
      return props.isPage;
    }

    get designerSelected() {
      return this.model.$configureProxy ? uiService.isDesignerSelected(this.model) : false;
    }

    get designerDroppable() {
      return this.model.$configureProxy ? uiService.isDesignerDroppable(this.model) : false;
    }

    refresh(): void {
      callProp(service.model, 'onRefresh', { viewService: this.mainView });
      if (!this.mainView) throw new Error('mainView not created');
      this.mainView.refresh?.();
    }

    get hidden() {
      // viewService에 mainView를 넘기면 viewDesigner에서 mainView의 초기화로 인해 무한 루프 (dataId도 동일 이슈)
      return callProp(this.model, 'hidden', { viewService: this });
    }

    onRightClick(event: MouseEvent) {
      if (this.model.onRightClick) callProp(this.model, 'onRightClick', { viewService: this, value: event });
    }

    async onKeyDown(event: KeyboardEvent) {
      const shortCutActions = this.model.webActions?.filter((webAction) => webAction.shortcutKey) ?? [];

      for (const action of shortCutActions) {
        const shortCutKeys = action.shortcutKey!.toLowerCase().split('+');
        const hasCtrlKey = shortCutKeys.includes('ctrl');
        const hasShiftKey = shortCutKeys.includes('shift');
        const hasAltKey = shortCutKeys.includes('alt');
        const key = shortCutKeys.filter((key) => !['ctrl', 'shift', 'alt'].includes(key))?.[0];

        if (
          event.ctrlKey === hasCtrlKey &&
          event.shiftKey === hasShiftKey &&
          event.altKey === hasAltKey &&
          event.key === key
        ) {
          event.stopPropagation();
          modelService.executeAction({
            viewModel: this.model,
            model: action,
            data: this.mainView!.data ?? null,
            viewService: this.mainView
          });
        }
      }
    }

    onDrop(event: DragEvent) {
      this.dragging = false;
      if (this.model.onDrop) callProp(this.model, 'onDrop', { viewService: this.mainView, value: event });
    }

    onDataChange(data: any) {
      if (this.model.onDataChange) callProp(this.model, 'onDataChange', { viewService: this.mainView, data });
    }
  }
);

const wrapperComponent = computed(() => uiService.getComponent('Wrapper', service.model?.wrapper));
const viewComponent = computed(() => {
  const component = service.model.component ?? service.model.type;
  const viewComponent = uiService.getComponent('View', component);
  if (!viewComponent) throw new Error(`View component ${component} is not found!`);
  return viewComponent;
});
const mainView = ref<DataViewService>();

for (const watchModel of service.model.watches ?? []) {
  watch(
    () => callProp(watchModel, 'watch', { viewService: service.mainView }),
    // nextTick에서 처리하면 route.params를 watch 하는 경우 페이지 로딩 후 execute됨
    () => callProp(watchModel, 'execute', { viewService: service.mainView }),
    { immediate: watchModel.immediate, deep: watchModel.deep }
  );
  // watchStopHandles.push(stopHandle);
}

const watchStopHandles: WatchStopHandle[] = [];
watch(mainView, () => {
  watchStopHandles.forEach((stop) => stop());
  if (!service.mainView) return;

  callProp(service.model, 'onMounted', { viewService: service.mainView });

  const viewService: ViewService = service.mainView;
  const viewModel: DataViewModel = service.model;

  if (viewService instanceof DataViewService && viewModel.enableUndo) {
    viewService.undoService = new UndoService(viewService);
    const stopHandle = watch(
      () => viewService.data,
      (data) => viewService.undoService!.onDataChange(data),
      { deep: true, immediate: true }
    );
    watchStopHandles.push(stopHandle);
  }
  if (viewModel.onDataIdChange) {
    const stopHandle = watch(
      () => service.dataId,
      () => callProp(service.model, 'onDataIdChange', { viewService: service.mainView, dataId: service.dataId }),
      { immediate: true }
    );
    watchStopHandles.push(stopHandle);
  }

  if (viewModel.refreshOnFilterChange) {
    const stopHandle = watch(
      () => modelService.callProp(viewModel, 'filter', { viewService: service.mainView, dataId: service.dataId }),
      (newVal, oldVal) => {
        if (JSON.stringify(newVal) == JSON.stringify(oldVal)) return;
        service.refresh();
      },
      { deep: true }
    );
    watchStopHandles.push(stopHandle);
  }

  if (viewModel.lazyLoading) {
    const stopHandle = watch(
      () => viewModel.type,
      () => service.refresh()
    );
    watchStopHandles.push(stopHandle);
  }
});

watch(
  () => service.dataId,
  async () => {
    // openDetail로 openRoute가 되어 route.params.dataId로 변경된 경우 다시 openDetail해서 openPanel되게함
    if (service.model.openDetailByDataId && service.dataId && isListableView(service.model)) {
      await uiService.openDetail({
        view: service.model,
        parentView: service.mainView,
        dataId: service.dataId,
        pageCtx: service.pageCtx
      });
      uiService.openParent();
      if (!service.model.live) service.refresh();
    }
  },
  { immediate: true }
);

watch(
  () => viewSize,
  () => {
    const { sm, md, lg, xl } = $q.screen.sizes;
    const { value } = viewSize.width;
    let size: Screen['name'] = $q.screen.name;

    if (value <= sm) {
      size = 'xs';
    } else if (value <= md) {
      size = 'sm';
    } else if (value <= lg) {
      size = 'md';
    } else if (value <= xl) {
      size = 'lg';
    } else if (value >= xl) {
      size = 'xl';
    }

    service.viewSize = size;
  },
  { deep: true }
);

onUnmounted(() => {
  watchStopHandles.forEach((stop) => stop());
  callProp(service.model, 'onUnmounted', { viewService: service.mainView });
});

uiService.lastAnyView = service;

callProp(service.model, 'onCreated', { viewService: service.mainView });

defineExpose(mainView);
</script>

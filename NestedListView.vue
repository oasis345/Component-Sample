<template>
  <div class="col">
    <div v-if="model.showFilter && level === 0">
      <search-bar v-model="service.filterValue" :view-model="service.model" :viewService="service" />
    </div>
    <q-list>
      <draggable
        ghost-class="ghost"
        :list="modelValue"
        :item-key="service.keyField"
        :group="{
          name: model.dragGroup,
          pull: service.onPull,
          put: service.onPut
        }"
        :component-data="{ service, ...$props }"
        :sort="model.moveable"
        :clone="model.cloneItem"
        :set-data="service.setData"
        :swapThreshold="0.75"
        :animation="150"
        :disabled="model.readonly"
        :delay="100"
        :delayOnTouchOnly="true"
        :fallbackOnBody="true"
        @dragstart="service.onDragStart"
        @dragend="service.onDragEnd"
      >
        <template #item="{ element: item }">
          <q-expansion-item
            v-if="item[service.childrenField]"
            v-show="service.visible(item)"
            header-style="padding: 0px !important"
            :model-value="item.$opened"
            :label="service.getLabel(item)"
            :default-opened="service.opened(item)"
            :expand-icon-class="model.hideNoChildrenExpand && !service.getChildren(item).length ? 'hidden' : undefined"
            :expand-icon-toggle="model.expandOnlyIcon"
            @vnode-before-mount="if (service.opened(item)) service.loadChildren(item);"
            @before-show="service.loadChildren(item)"
            @click="service.onSelect(item)"
          >
            <template v-slot:header>
              <q-item
                v-show="service.visible(item)"
                class="full-width"
                :active-class="ITEM_ACTIVE_CLASS"
                :active="model.expandOnlyIcon && service.isActive(item)"
                :clickable="model.expandOnlyIcon"
                @click="service.onSelect(item)"
              >
                <q-item-section v-if="item.icon" class="icon" avatar>
                  <q-icon :name="item.icon" />
                </q-item-section>
                <q-item-section>{{ service.getLabel(item) }}</q-item-section>
                <q-item-section v-if="service.showDeleteBtn(level)" side>
                  <q-btn v-bind="REMOVE_BUTTON_PROPS" @click="service.remove(modelValue, item[service.keyField])" />
                </q-item-section>
              </q-item>
            </template>
            <nested-list-view
              v-bind="$props"
              :model-value="service.getChildren(item)"
              @update:modelValue="service.updateChildren(item, $event)"
              style="margin: 0 0 0 1rem"
              :service="service"
              :level="level + 1"
            />
          </q-expansion-item>
          <q-item
            v-else
            v-show="service.visible(item)"
            class="item q-pr-none"
            clickable
            :active-class="ITEM_ACTIVE_CLASS"
            :active="service.isActive(item)"
            @click="service.onSelect(item)"
          >
            <q-item-section v-if="item.icon" class="icon" avatar>
              <q-icon :name="item.icon" />
            </q-item-section>
            <q-item-section>{{ service.getLabel(item) }}</q-item-section>
            <q-item-section side>
              <div
                class="row"
                :class="service.activatedAction?.[service.keyField] === item[service.keyField] ? '' : 'actions'"
              >
                <q-btn
                  v-if="service.showDeleteBtn(level)"
                  v-bind="REMOVE_BUTTON_PROPS"
                  @click.stop="service.remove(modelValue, item[service.keyField])"
                />
                <view-actions
                  :model="model"
                  :view-service="parentView"
                  :field-model="item"
                  :field-value="item"
                  hide-label
                  dense
                  noEllipsis
                  @hide="service.activatedAction = null"
                  @click.stop="service.onActionClick(item)"
                />
              </div>
            </q-item-section>
          </q-item>
        </template>
      </draggable>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { DataViewService, registry, NestedListViewModel, isPromise } from '@occam4/common';
import { getCurrentInstance, watch } from 'vue';
import draggable from 'vuedraggable';
import SearchBar from 'common/SearchBar.vue';
import ViewActions from '../common/ViewActions.vue';

const REMOVE_BUTTON_PROPS = {
  class: 'gt-xs',
  icon: 'close',
  size: '12px',
  flat: true,
  dense: true,
  round: true
};
const ITEM_ACTIVE_CLASS = 'bg-secondary';
const emit = defineEmits<{
  (event: 'onSelect', value: any): void;
  (event: 'onChange', value: any): void;
}>();
const { createService, callProp, messageService, modelService, t } = registry;

const props = withDefaults(
  defineProps<{
    model: NestedListViewModel;
    modelValue: any[];
    selectedData?: any;
    level?: number;
    parentView?: any;
    service?: any;
    filterValue?: string;
  }>(),
  { level: 0 }
);

const service =
  props.service ??
  createService(
    class NestedListViewService extends DataViewService<NestedListViewModel> {
      constructor() {
        super(props);
      }

      _filterValue = '';
      activatedAction?: any = null;

      get filterValue() {
        return props.filterValue ?? this._filterValue;
      }

      set filterValue(value: string) {
        this._filterValue = value;
      }

      get selectedKey() {
        return callProp(props.model, 'selectedKey');
      }

      get keyField() {
        return props.model.keyField ?? '$id';
      }

      get labelField() {
        return props.model.labelField ?? 'label';
      }

      get childrenField() {
        return props.model.childrenField ?? 'children';
      }

      showDeleteBtn(level: number) {
        return props.model.showDelete && !(props.model.singleRootNode && level === 0);
      }

      getLabel(item: any) {
        return t(props.model.getLabel?.(item) ?? item[service.labelField]) ?? messageService.getLabel(item);
      }

      onSelect(item: any) {
        this.selectedData = item;
        callProp(props.model, 'onSelect', { value: item });
      }

      onChange(change: any) {
        emit('onChange', { data: props.modelValue, change, selectedData: this.selectedData });
        callProp(props.model, 'onChange', { data: props.modelValue });
      }

      onPull(target: any, source: any, element: any) {
        const dragData = element.__draggable_context.element;

        const sourceData = source.el.__draggable_component__.componentData;
        const targetData = target.el.__draggable_component__.componentData;
        const model: NestedListViewModel = sourceData.model;

        if (targetData?.modelValue[0]?.[model.childrenField ?? 'children'] && targetData.model.moveable) {
          targetData.modelValue[0].$opened = true;
        }

        let draggable;
        if (typeof model.draggable == 'function') draggable = model.draggable?.(dragData);
        else draggable = model.draggable;

        return draggable ? (model.moveable ? true : 'clone') : false;
      }

      onPut(target: any) {
        const componentData = target.el.__draggable_component__.componentData;
        const model: NestedListViewModel = componentData.model;
        if (model.singleRootNode && componentData.level == 0) return false;

        return callProp(model, 'droppable', { viewService: this, value: componentData.modelValue });
      }

      onDragStart(event: DragEvent) {
        this.model.onDragStart?.(event);
      }

      onDragEnd(event: DragEvent) {
        this.model.onDragEnd?.(event);
      }

      onActionClick(item: any) {
        this.activatedAction = item;
      }

      setData(dataTransfer: DataTransfer, el: any) {
        const element = el.__draggable_context.element;
        dataTransfer.setData('text', JSON.stringify(this.model.cloneItem?.(element) ?? element));
      }

      visible(item: any) {
        if (this.filterValue) {
          if (item[this.childrenField])
            for (const child of service.getChildren(item)) if (this.visible(child)) return true;

          const matchedItem = this.getLabel(item)?.toLowerCase().includes(this.filterValue.toLowerCase());
          return !!matchedItem;
        } else {
          return true;
        }
      }

      opened(item: any) {
        if (item[this.childrenField] && this.filterValue)
          for (const child of service.getChildren(item)) if (this.visible(child)) return true;

        return props.model.opened?.(item) ?? false;
      }

      isActive(item: any) {
        return this.selectedData === item;
      }

      remove(array: any, value: any) {
        array.forEach((entry: any, index: number) => {
          if (entry[service.keyField] === value) {
            array.splice(index, 1);
            return;
          }

          const childArray = entry[this.childrenField];
          if (childArray) {
            const found = this.find(childArray, value);

            if (found) this.remove(childArray, value);
          }
        });
      }

      find(array: any, value: any) {
        for (const entry of array) {
          const childArray = entry[this.childrenField];
          if (entry[service.keyField] === value) return entry;
          if (childArray) {
            const found: any = this.find(childArray, value);

            if (found) return found;
          }
        }
      }

      childrenMap = new WeakMap<any, any[]>();

      async loadChildren(item: any) {
        const result = modelService.callProp(item, this.childrenField, { viewService: service });
        if (isPromise(result)) {
          const children: any[] = await result;
          this.childrenMap.set(item, children);
        }
      }

      getChildren(item: any) {
        const children = this.childrenMap.get(item) ?? modelService.callProp(item, this.childrenField);

        return typeof children == 'function' ? [{}] : children;
      }

      updateChildren(item: any, children: any) {
        if (typeof item[this.childrenField] != 'function') {
          item[this.childrenField] = children;
        } else {
          throw new Error('Cant update function children');
        }
      }
    }
  );

// @ts-ignore
const isRoot = getCurrentInstance()?.ctx?.level === 0;

if (isRoot) {
  watch(
    () => service.selectedKey,
    () => {
      if (service.selectedKey) {
        const found = service.find(props.modelValue, service.selectedKey);

        service.selectedData = found;
        service.isActive(found);
      }
    }
  );
}

defineExpose(service);
</script>

<style scoped lang="scss">
.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

.icon {
  min-width: unset;
}

.item {
  .actions {
    opacity: 0;
  }
}

.item:hover {
  .actions {
    opacity: 100;
  }
}
</style>

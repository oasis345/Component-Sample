<template>
  <q-list class="scroll" :bordered="model.bordered" :padding="model.padding" :dense="model.dense">
    <q-infinite-scroll
      @load="service.onLoad"
      :key="service.loadedKey"
      :scroll-target="scrollTarget"
      :reverse="model.infiniteScrollReverse"
      :style="model.infiniteScrollStyle"
      :offset="model.infiniteScrollOffSet"
    >
      <template v-for="data in service.data" :key="data[service.keyField]">
        <q-item
          v-for="(listSection, key) of service.listSections"
          :key="key"
          :id="data[service.keyField]"
          :clickable="service.clickable"
          :active-class="model.selectedClass ?? 'bg-grey-4'"
          :active="service.isSelected(data)"
          @click.stop="service.onClick($event as PointerEvent, data)"
          @contextmenu.prevent
          @vnode-mounted="service.itemMounted"
        >
          <q-item-section
            v-for="(section, key) of listSection"
            :key="key"
            v-bind="{ ...section }"
            :class="section.sectionClass"
            :style="section.sectionStyle"
          >
            <template v-for="sectionField in section.sectionFields" :key="sectionField">
              <any-field
                v-if="sectionField"
                :modelValue="_.get(data, sectionField)"
                :data="data"
                :model="service.getFieldModel(sectionField)"
                :viewModel="model"
                :viewService="service"
                noLabel
              />
            </template>
          </q-item-section>
        </q-item>
        <q-separator v-if="service.separator" />
      </template>
      <template v-if="service.serverView && !model.lazyLoading && !model.hideLoadingSpinner" v-slot:loading>
        <div class="row justify-center q-my-md">
          <q-spinner color="primary" name="dots" size="40px" />
        </div>
      </template>
    </q-infinite-scroll>
  </q-list>
</template>

<script setup lang="ts">
import {
  DataViewService,
  Dict,
  FieldModel,
  isImageField,
  ListSectionModel,
  ListViewModel,
  ViewService,
  registry,
  CommentViewModel
} from '@occam4/common';
import { onUnmounted } from 'vue';
import { onLongPress } from '@vueuse/core';

const { modelService, dataService, createService, uiService, _ } = registry;

const props = withDefaults(
  defineProps<{
    model: ListViewModel | CommentViewModel;
    modelValue?: any;
    dataIds?: string[];
    dataId?: string;
    pageCtx?: any;
    parentView?: ViewService;
    scrollTarget?: any;
  }>(),
  { modelValue: [] }
);
const anyField = uiService.getComponent('Field', 'AnyField');

const service = createService(
  class ListViewService extends DataViewService<ListViewModel | CommentViewModel> {
    constructor() {
      super(props);
    }

    loadedKey = 0;

    get fieldModels(): FieldModel[] {
      return modelService.getFields(this.model, undefined, { viewService: this }, true);
    }

    get keyField() {
      if (!this.model.keyField) throw new Error('keyField is not defined');

      return this.model.keyField;
    }

    get separator() {
      return this.model.separator;
    }

    get clickable() {
      return this.model.clickable ?? true;
    }

    get listSections(): ListSectionModel[][] {
      if (this.model.listSections) {
        let listSections = modelService.callProp<ListSectionModel[][]>(this.model, 'listSections', {
          viewService: this
        });
        if (!Array.isArray(listSections[0])) {
          listSections = [listSections as any];
        }
        return listSections.filter((section) => section);
      } else if (this.model.labelField) {
        return [[{ sectionFields: [this.model.labelField] }]];
      } else {
        return [[]];
      }
    }

    async onLoad(index: number, done: (stop?: boolean) => void) {
      if (index == 1) this.unsubscribe();
      if (this.serverView && this.model.pageSize) {
        const findOptions = modelService.getFindOptions(this.model, this);

        findOptions.select = this.listSections
          .flat()
          .filter((section) => section?.sectionFields)
          .flatMap((section) => section.sectionFields!);

        let select: any = modelService.callProp(this.model, 'select');
        if (select) findOptions.select = findOptions.select.concat(select);
        findOptions.skip = this.data?.length;
        findOptions.top = this.model.pageSize;
        findOptions.live = this.model.live;
        findOptions.dataId = props.dataIds;
        findOptions.livePrepend = this.model.livePrepend;
        findOptions.filter = modelService.callProp(this.model, 'filter', props);

        if (this.model.lazyLoading && this.loadedKey == 0) return;
        const result = await dataService.find(findOptions);

        if (this.model.live) this.subscriptions?.push(result.subscription!);
        if (this.data.length) {
          for (const value of result.value) {
            const findItem = this.data.find((item: any) => item[this.keyField] === value[this.keyField]);
            if (!findItem) this.data.push(value);
          }
        } else {
          this.data = result.value;
        }

        if (result?.value.length >= this.model.pageSize) {
          done(false);
          return;
        }
      }
      done(true);
    }

    onLongPress(e: any) {
      const key = e.target?.offsetParent?.id;
      if (!key) return;

      const data = this.data.find((item: any) => item[this.keyField] == key)!;
      this.selectedData?.push(data);
    }

    onClick(e: PointerEvent, selectedData: any) {
      if (this.model.itemClickAction && !e.ctrlKey)
        modelService.executeWebAction(this.model.itemClickAction, {
          viewModel: this.model,
          viewService: this,
          selectedData
        });

      if (this.model.allowSelection) {
        if (this.model.allowMultipleSelection && e.ctrlKey) this.selectedData?.push(selectedData);
        else this.selectedData = [selectedData];
      }
    }

    itemMounted(e: any) {
      onLongPress(e.el, service.onLongPress, { modifiers: { stop: true } });
    }

    isSelected(rowData: Dict) {
      return this.selectedData?.find((data: Dict) => rowData[this.keyField] === data[this.keyField]) ? true : false;
    }

    getFieldModel(fieldName: string) {
      let fieldModel = modelService.getField(this.model, fieldName);

      if (fieldModel) {
        if (fieldModel.type == 'ActionField' || fieldModel.type == 'ViewField') return fieldModel;
        else if (fieldModel.type == 'RichTextField') return { ...fieldModel, editable: false, editorBorder: 'none' };
        else if (isImageField(fieldModel))
          return { ...fieldModel, width: undefined, height: undefined, type: 'ImageField' };

        return { ...fieldModel, type: 'LabelField' };
      } else {
        throw new Error(`Field: ${fieldName} is not defined`);
      }
    }

    refresh(): void {
      this.data = [];
      this.loadedKey++;
    }
  }
);

onUnmounted(() => {
  service.unsubscribe();
});

defineExpose(service);
</script>

<style scoped>
/* iPhone에서 long press시에 click이벤트가 오는 것을 막기 위해. PC에 적용시에 text drag가 안됨 */
.list-item {
  -webkit-touch-callout: none !important;
  user-select: none !important;
}
</style>

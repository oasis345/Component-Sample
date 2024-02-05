<template>
  <div class="q-pa-md q-pb-lg scroll">
    <q-timeline :color="model.color" :side="model.side" :layout="model.timelineLayout">
      <q-timeline-entry v-if="model.headline" heading> {{ model.headline }} </q-timeline-entry>
      <div class="q-px-sm col">
        <q-infinite-scroll @load="service.load" :offset="250" :key="service.loadedKey">
          <div v-for="item in service.data" :key="item[service.keyField]">
            <q-timeline-entry :title="service.title(item)" :subtitle="service.subtitle(item)">
              <q-card flat>
                <q-card-section v-for="row in item.diff" :key="row.index" v-html="service.diffNotes(row)" />
              </q-card>
            </q-timeline-entry>
          </div>
          <template v-slot:loading>
            <div class="row justify-center q-my-md">
              <q-spinner-dots color="primary" size="40px" />
            </div>
          </template>
        </q-infinite-scroll>
      </div>
    </q-timeline>
  </div>
</template>

<script setup lang="ts">
import { TimelineViewModel, DataViewService, registry, Dict, asSingle } from '@occam4/common';
import { diff } from 'json-diff-ts';
import { ViewProps } from '../props';

const { modelService, createService, dataService } = registry;
const props = withDefaults(defineProps<ViewProps<TimelineViewModel>>(), { modelValue: [] });

const service = createService(
  class TimelineViewService extends DataViewService<TimelineViewModel> {
    constructor() {
      super(props);
    }

    loadedKey = 0;

    get keyField() {
      if (!this.model.keyField) throw new Error('keyField is not defined');
      return this.model.keyField;
    }

    async load(index: number, done: (stop?: boolean) => void) {
      if (this.model.serverView && this.model.pageSize) {
        const findOptions = this.findOptions();
        findOptions.skip = this.data?.length;
        findOptions.top = this.model.pageSize;

        const result = await dataService.find(findOptions);

        for (let i = 0; i < result.value.length - 1; i++) {
          try {
            const oldData = asSingle(JSON.parse(result.value[i + 1].data));
            const newData = asSingle(JSON.parse(result.value[i].data));
            result.value[i]['diff'] = diff(oldData, newData);
          } catch (e) {
            continue;
          }
        }

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
        done(true);
      }
    }

    private findOptions() {
      const findOptions = modelService.getFindOptions(this.model, this);

      let filter: Dict[] = [];

      if (findOptions.filter) {
        Object.keys(findOptions.filter).forEach((key) => {
          const value = modelService.callProp(findOptions.filter, key);
          filter = { ...filter, ...{ [key]: value } };
        });
        findOptions.filter = { ...findOptions.filter, ...filter };
      }
      return findOptions;
    }

    refresh(): void {
      this.data = [];
      this.loadedKey++;
    }

    diffNotes(item: any): string {
      let typeSuffix = item.type == 'ADD' ? 'ed' : 'd';

      return ''.concat(item.key, ' ', item.type.toLowerCase(), typeSuffix, ' ', item.oldValue, ' ▷ ', item.value);
    }

    subtitle(item: any): string | undefined {
      if (this.model.subtitleField) return modelService.getFormattedValue(this.model, this.model.subtitleField, item);
    }
    title(item: any): string | undefined {
      if (this.model.titleField) return modelService.getFormattedValue(this.model, this.model.titleField, item);
    }
  }
);

defineExpose(service);
</script>

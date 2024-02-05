<template>
  <div class="column no-wrap">
    <div class="q-pl-sm scroll fit" ref="scroll" @scroll="service.onScroll">
      <div v-if="model.lazyLoading">
        <a @click="service.refresh" class="cursor-pointer underline-on-hover">show comments</a>
      </div>

      <ListView
        ref="listView"
        :model="model"
        :dataId="dataId"
        :pageCtx="pageCtx"
        :separator="false"
        :scrollTarget="scroll"
      >
      </ListView>
    </div>
    <div class="q-pa-sm">
      <q-input ref="input" outlined rounded dense v-model="service.inputMessage" @keydown.enter="service.onSend">
        <template v-slot:prepend>
          <view-actions
            :model="{
              viewActions: model.inputActions
            }"
            :viewService="service"
            hideLabel
          />
        </template>
        <template v-slot:append>
          <div>
            <q-btn icon="mdi-emoticon" flat>
              <q-popup-proxy>
                <EmojiPicker :native="true" @select="service.onSelectEmoji" />
              </q-popup-proxy>
            </q-btn>
          </div>
        </template>
        <template v-slot:after>
          <q-btn icon="send" flat @click="service.onSend" />
        </template>
      </q-input>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CommentViewModel, DataViewService, registry, scrollBottom } from '@occam4/common';
import { createService } from 'services';
import ListView from './ListView.vue';
// @ts-ignore
import EmojiPicker from 'vue3-emoji-picker';
import 'vue3-emoji-picker/css';
import { ref, watch } from 'vue';
import { ViewProps } from '../props';
import ViewActions from '../common/ViewActions.vue';

const { dataService } = registry;
const props = defineProps<ViewProps<CommentViewModel>>();

const listView = ref<DataViewService>();
const scroll = ref();

class CommentViewService extends DataViewService<CommentViewModel> {
  constructor() {
    super(props);
  }

  inputMessage = '';
  keepScrollBottom = false;

  async onSend() {
    this.keepScrollBottom = true;
    const data = { view: this.model.targetView, dataId: props.dataId, message: this.inputMessage };
    dataService.create({ view: 'comments', data });
    this.inputMessage = '';
  }

  onSelectEmoji(emoji: any) {
    this.inputMessage += emoji.i;
  }

  refresh(): void {
    listView.value?.refresh!();
  }

  onScroll(event: any) {
    const {
      target: { scrollTop, clientHeight, scrollHeight }
    } = event;
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      this.keepScrollBottom = true;
    } else {
      this.keepScrollBottom = false;
    }
  }
}

const service = createService(CommentViewService);

watch(
  () => [listView.value?.data.length],
  () => {
    if (service.keepScrollBottom) scrollBottom(scroll.value);
  }
);

defineExpose(service);
</script>

<style scoped>
.underline-on-hover:hover {
  text-decoration: underline;
}
</style>

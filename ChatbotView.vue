<template>
  <div class="column fit">
    <div ref="scroll" class="q-px-sm col" style="overflow-y: auto">
      <template v-for="item in service.items" :key="item.id">
        <q-chat-message
          v-if="item.message"
          :name="item.senderName"
          :avatar="item.senderImageUrl"
          :text-html="true"
          :text="[`<span>${item.message.trim()} ${item.continuable ? ' (Enter to continue)' : ''}</span>`]"
          :sent="item.senderId == service.user.id"
          :stamp="dayjs(item.created).tz().fromNow()"
          @dblclick="service.modify(item)"
        />
        <q-chat-message
          v-if="item.messageTl && item.messageTl != item.message"
          :name="item.senderName"
          :avatar="item.senderImageUrl"
          :text="[item.messageTl]"
          :sent="item.senderId == service.user.id"
          :stamp="dayjs(item.created).tz().fromNow()"
        />
      </template>
      <q-circular-progress
        v-if="chatBotService.thinking"
        indeterminate
        size="30px"
        :thickness="0.6"
        color="lime"
        center-color="grey-8"
        class="q-ma-md"
      />
    </div>
    <div>
      <q-input
        ref="input"
        borderless
        square
        filled
        autogrow
        autofocus
        v-model="service.message"
        @keydown.enter="service.send"
      >
        <template v-slot:append>
          <div>
            <q-chip
              v-for="file in service.files"
              :key="file.name"
              :label="file.name"
              removable
              @remove="service.removeFile()"
            />
            <q-btn icon="mdi-close-circle" flat dense @click="service.clear()" />
            <q-btn icon="attach_file" flat dense @click="service.openUpload" />
            <q-btn
              icon="mdi-microphone"
              flat
              :color="chatBotService.listening ? 'red' : 'black'"
              @click="chatBotService.toggleListen()"
            />
            <q-btn icon="send" flat @click="service.send" />
          </div>
        </template>
      </q-input>
      <input id="fileUpload" type="file" hidden @change="service.uploadChanged" multiple />
    </div>
  </div>
</template>

<script setup lang="ts">
import { registry, DataViewService } from '@occam4/common';
import { useWakeLock } from '@vueuse/core';
import { useQuasar } from 'quasar';
import { ChatItem, createService } from 'services';
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ViewProps } from '../props';

const { dayjs, chatBotService, uiService } = registry;
const props = defineProps<ViewProps>();

const emojiProxy = ref();
const input = ref();
const scroll = ref();

const service = createService(
  class ChatBotViewService extends DataViewService {
    constructor() {
      super(props);
    }

    message = '';
    items: any[] = [];
    files: any[] = [];
    user = {
      id: 'user',
      name: '사용자',
      imageUrl: 'https://cdn.quasar.dev/img/avatar2.jpg'
    };

    send(e?: any) {
      if (e) {
        if (e.shiftKey || e.which == 229) return;
        e.preventDefault();
      }
      let user = this.user;
      const item: ChatItem = reactive({
        message: this.message,
        senderId: user.id,
        senderName: user.id,
        senderImageUrl: user.imageUrl,
        created: new Date()
      });
      this.items.push(item);

      chatBotService.send(item);

      this.message = '';
    }

    async modify(item: ChatItem) {
      const data = await uiService.openModal({
        view: {
          type: 'FormView',
          noServer: true,
          viewActionsOn: ['toolbar'],
          label: 'Modify Message',
          fields: [
            {
              name: 'message',
              label: 'Message',
              type: 'RichTextField',
              cols: 12
            }
          ]
        },
        parentView: this,
        data: item
      });
      item.message = data.message.replace(/<[^>]*>?/gm, '');
    }

    listen(message: string) {
      this.message = message;
      this.send();
    }

    openUpload() {
      document.getElementById('fileUpload')?.click();
    }

    removeFile() {
      //
    }

    uploadChanged(e: any) {
      this.files = e.target.files;
    }

    selectEmoji(e: any) {
      emojiProxy.value.hide();
      this.message += e.data;
      input.value.focus();
    }

    clear() {
      this.items.length = 0;
    }
  }
);

function scrollToBottom() {
  nextTick(() => {
    if (scroll.value) {
      const target = scroll.value;
      target.scrollTop = target.scrollHeight;
    }
  });
}
const wakeLock = useWakeLock();

onMounted(async () => {
  // chatBotService.startListen();
  chatBotService.onListen = service.listen;
  chatBotService.onRespond = (item: any) => {
    service.items.push(item);
  };
  chatBotService.items = service.items;
  try {
    if (wakeLock.isSupported.value) await wakeLock.request('screen');
  } catch (e) {}
});

onUnmounted(() => {
  wakeLock?.release();
});

const q = useQuasar();
watch(
  () => [q.screen.height, service.items.length],
  () => {
    scrollToBottom();
  }
);
watch(
  () => uiService.rightViewOpened,
  () => {
    if (uiService.rightViewOpened)
      nextTick(() => {
        input.value.focus();
      });
  }
);

onUnmounted(() => {
  chatBotService.stopListen(true);
});

defineExpose(service);
</script>
<style scoped>
.chat-message-pre {
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  margin: 0px;
  padding: 0px;
}
</style>

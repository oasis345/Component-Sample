<template>
  <Splitpanes
    ref="container"
    v-if="service.members?.length"
    :horizontal="width < 600"
    class="default-theme col-shrink fit"
  >
    <pane :size="service.showChat ? 70 : 100" v-if="service.showVideoCall">
      <VideoCallView ref="videoCall" :members="service.members" reverse @close="service.showVideoCall = false" />
    </pane>
    <pane :size="service.showChat ? 30 : 0" class="column no-wrap">
      <div class="scroll q-space q-pl-sm" ref="scroll" @scroll="service.onScroll">
        <q-infinite-scroll
          @load="service.loadMessages"
          reverse
          style="display: flex; flex-direction: column-reverse"
          :offset="0"
        >
          <template v-for="message in service.messages" :key="message.id">
            <q-chat-message
              :name="service.getMember(message.from)?.displayName"
              :sent="message.from == authService.user?.id"
              :stamp="dayjs(message.sentDate).tz().fromNow()"
              :bg-color="service.isSingleEmoji(message.message) ? 'white' : ''"
              @click="service.onMessageClick(message)"
            >
              <template v-slot:default>
                <div class="q-pb-xs">
                  <AnyView
                    v-if="message.dataView"
                    :model="service.getDataViewModel(message)"
                    :dataIds="message.dataIds"
                    :pageCtx="reactive({ embedded: true })"
                  />
                  <span :class="{ 'text-h1': service.isSingleEmoji(message.message) }">{{ message.message }}</span>
                </div>
              </template>
              <template v-slot:avatar>
                <img
                  v-if="service.getMember(message.from)?.picture"
                  class="q-message-avatar q-mx-xs"
                  referrerpolicy="no-referrer"
                  :src="service.getMember(message.from)?.picture"
                />
                <q-avatar v-else icon="mdi-account" color="primary" text-color="white" size="xl" class="q-mx-xs" />
              </template>
            </q-chat-message>
          </template>
        </q-infinite-scroll>
      </div>
      <div>
        <q-input
          ref="input"
          borderless
          square
          filled
          autogrow
          autofocus
          v-model="service.inputMessage"
          @keydown.enter="service.onSend($event)"
        >
          <template v-slot:prepend>
            <view-actions
              :model="{
                webActions: model.webActions,
                viewActions: model.inputActions
              }"
              :viewService="service"
              icon="mdi-plus"
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
              <q-btn icon="send" flat @click="service.onSend($event)" />
            </div>
          </template>
        </q-input>
      </div>
    </pane>
  </Splitpanes>
</template>

<script setup lang="ts">
import {
  DataViewService,
  ListViewModel,
  registry,
  ChatMessage,
  ChatMember,
  GroupMember,
  ChatViewModel,
  FindResult,
  scrollBottom
} from '@occam4/common';
import { useQuasar } from 'quasar';
import { Pane, Splitpanes } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import { createService } from 'services';
import { onUnmounted, ref, watch, reactive } from 'vue';
import VideoCallView from './VideoCallView.vue';
import { useElementSize } from '@vueuse/core';
import { SubscriptionLike } from 'rxjs';
// @ts-ignore
import EmojiPicker from 'vue3-emoji-picker';
import ViewActions from '../common/ViewActions.vue';
import 'vue3-emoji-picker/css';
import AnyView from './AnyView.vue';
import { ViewProps } from '../props';

const { dayjs, authService, modelService } = registry;
const props = defineProps<ViewProps<ChatViewModel>>();

const input = ref();
const scroll = ref();
const videoCall = ref();
const container = ref();

const { width } = useElementSize(container);

class ChatViewService extends DataViewService<ChatViewModel> {
  constructor() {
    super(props);
  }

  inputMessage = '';
  messageResult?: FindResult<ChatMessage>;
  memberResult?: FindResult<GroupMember>;
  subscriptions: SubscriptionLike[] = [];
  private pageSize = 20;
  keepScrollBottom = true;

  async init() {
    this.memberResult = await modelService.callProp(this.model, 'getGroupMembers', { viewService: this });
    this.subscriptions.push(this.memberResult.subscription!);
  }

  get members(): ChatMember[] | undefined {
    return this.memberResult?.value.map((groupMember) => groupMember.member);
  }

  messages: ChatMessage[] = [];

  async loadMessages(index: number, done: (stop?: boolean) => void) {
    const result = await modelService.callProp<FindResult<ChatMessage>>(this.model, 'getMessages', {
      viewService: this,
      value: { skip: this.messages.length, top: this.pageSize }
    });
    this.subscriptions.push(result.subscription!);

    if (this.messages.length) {
      this.keepScrollBottom = false;
      for (const row of result.value) if (!this.messages.some((item) => item.id === row.id)) this.messages.push(row);
    } else {
      this.messages = result.value;
    }
    if (result.value.length >= this.pageSize) done(false);
    else done(true);
  }

  getMember(id: string) {
    return this.members?.find((member) => member.id == id);
  }

  async onSend(event: Event) {
    if (event instanceof KeyboardEvent) {
      if (event.shiftKey && event.code == 'Enter') return;
      event.preventDefault();
    }
    const message = this.inputMessage;
    this.inputMessage = '';
    await this.send({ message });
  }

  async send(chatMessage: Partial<ChatMessage>) {
    await modelService.callProp(this.model, 'send', { viewService: this, value: chatMessage });
  }

  onSelectEmoji(emoji: any) {
    this.inputMessage += emoji.i;
  }

  isSingleEmoji(str: string) {
    return str?.length == 2 && /\p{Emoji_Presentation}/gu.test(str);
  }

  get videoCall() {
    return videoCall.value;
  }

  showVideoCall = false;

  showChat = true;

  toggleVideoCall() {
    this.showVideoCall = !this.showVideoCall;
  }

  toggleChat() {
    this.showChat = !this.showChat;
  }

  unsubscribe() {
    for (const subscription of this.subscriptions) subscription.unsubscribe();
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

  onMessageClick(message: ChatMessage) {
    console.debug('onMessageClick', message);
  }

  getDataViewModel(message: ChatMessage): ListViewModel {
    return {
      ...modelService.getView(message.dataView),
      wrapper: 'FullWrapper',
      mobileView: undefined,
      lazyLoading: false,
      live: false,
      allowSelection: false,
      pageFields: [],
      searchFields: [],
      sortFields: []
    };
  }
}

const service = createService(ChatViewService);
service.init();
onUnmounted(() => service.unsubscribe());

const q = useQuasar();
watch(
  () => [q.screen.height, service.showChat, service.messages.length],
  () => {
    if (service.keepScrollBottom) scrollBottom(scroll.value);
  }
);

defineExpose(service);
</script>

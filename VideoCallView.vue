<template>
  <div v-if="service.opened" ref="container" class="flex fit items-center justify-around" style="overflow: hidden">
    <div
      v-for="member of service.members"
      :key="member?.name"
      class="q-pa-xs"
      :style="`width: ${service.width}px; height: ${service.height}px`"
    >
      <div class="absolute z-top chat-member-title">{{ member.displayName }}</div>
      <video
        v-if="member.streamActive"
        controls
        autoplay
        :muted="member == service.me"
        :srcObject="member.userMedia"
        class="fit"
      ></video>
      <img v-else-if="member.picture" :src="member.picture" class="fit" />
      <q-avatar v-else class="fit" font-size="100px" color="primary" text-color="white" icon="mdi-account"></q-avatar>
    </div>
  </div>
  <div v-else class="flex fit items-center justify-around">
    <q-spinner size="lg" />
  </div>
</template>

<script setup lang="ts">
import { registry, ChatMember, User, OccamError } from '@occam4/common';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import Peer, { MediaConnection } from 'peerjs';
import { useElementSize } from '@vueuse/core';

const { createService, authService, uiService } = registry;
const props = defineProps<{
  members: ChatMember[];
}>();

const emits = defineEmits<{
  (event: 'close'): void;
}>();

class VideoChat {
  peer?: Peer;

  opened = false;

  screenShare = false;

  allMedias: MediaStream[] = [];

  getPeerId(user?: User) {
    return 'occam4-' + user?.id;
  }

  get members() {
    return props.members;
  }

  get me(): ChatMember {
    const me = this.members.find((member) => member.id == authService.user?.id);
    if (me) {
      return me;
    } else {
      if (authService.isAdmin()) return authService.user!;
      throw new Error('You are not member');
    }
  }

  async init() {
    const myPeerId = this.getPeerId(authService.user);
    console.debug('myPeerId is ' + myPeerId);

    this.peer = new Peer(myPeerId);

    this.peer.on('open', async (id) => {
      console.debug('opened', id);
      this.opened = true;
      this.call();
    });

    this.peer.on('call', (call) => {
      call.answer(this.me.userMedia);
      const member = this.members.find((member) => this.getPeerId(member) == call.peer);
      if (!member) return;
      member.call = call;
      call.on('stream', (stream) => {
        console.debug('response stream', stream);
        if (member.userMedia != stream) {
          member.userMedia = stream;
          this.monitorStream(member);
          uiService.notify({ message: `${member?.displayName} entered` });
        }
      });
      call.on('error', (error) => {
        console.debug('response error', error);
      });
      call.on('close', () => {
        console.debug('response close');
        member.streamActive = false;
      });
    });

    this.peer.on('connection', (conn) => console.debug('connection', conn));
    this.peer.on('disconnected', (str) => console.debug('disconnected', str));
    this.peer.on('error', (error: any) => {
      if (error.type == 'unavailable-id') {
        this.opened = false;
        this.close();
        throw new OccamError('The same user is connecting to video call');
      }
      console.debug('error', error);
    });
  }

  async call() {
    if (!this.peer) return;

    this.me.userMedia = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    this.allMedias.push(this.me.userMedia);
    this.monitorStream(this.me);

    for (const member of this.members) {
      if (member == this.me) continue;
      const peerId = this.getPeerId(member);
      const call = this.peer.call(peerId, this.me.userMedia!);
      member.call = call;
      console.debug('member called', peerId);
      call?.on('stream', (stream) => {
        console.debug('member called stream', stream);
        member.userMedia = stream;
        this.monitorStream(member);
      });
      call?.on('error', (error) => {
        console.debug('called error', error);
      });
      call?.on('close', () => {
        console.debug('called close');
        member.streamActive = false;
      });
    }
  }

  monitorStream(member: ChatMember) {
    if (member.userMedia) {
      if (member.intervalId) clearInterval(member.intervalId);
      member.streamActive = member.userMedia.active;
      member.intervalId = setInterval(() => {
        member.streamActive = member.userMedia!.active;
      }, 100);
    } else {
      member.streamActive = false;
    }
  }

  isCameraOn = true;

  isMicOn = true;

  toggleCamera() {
    if (!this.me.userMedia) return;
    const videoTrack = this.me.userMedia.getVideoTracks()[0];
    this.isCameraOn = !this.isCameraOn;
    videoTrack.enabled = this.isCameraOn;
  }

  toggleMic() {
    if (!this.me.userMedia) return;
    const audioTrack = this.me.userMedia.getAudioTracks()[0];
    this.isMicOn = !this.isMicOn;
    audioTrack.enabled = this.isMicOn;
  }

  async toggleScreenShare() {
    this.screenShare = !this.screenShare;

    if (this.screenShare) {
      try {
        this.me.userMedia = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true
        });
        this.allMedias.push(this.me.userMedia);
        this.me.userMedia.addEventListener('inactive', () => {
          if (this.opened) {
            this.screenShare = true;
            this.toggleScreenShare();
          }
        });
      } catch (error) {
        console.error(error);
        this.screenShare = false;
        return;
      }
    } else {
      this.me.userMedia = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      this.allMedias.push(this.me.userMedia);
    }

    const stream = this.me.userMedia;

    for (const member of this.members) {
      const call: MediaConnection = member.call;
      if (!call) continue;

      for (const sender of call.peerConnection?.getSenders()) {
        if (sender.track?.kind === 'audio' && stream.getAudioTracks().length > 0)
          sender.replaceTrack(stream.getAudioTracks()[0]);

        if (sender.track?.kind === 'video' && stream.getVideoTracks().length > 0)
          sender.replaceTrack(stream.getVideoTracks()[0]);
      }
    }
  }

  close() {
    this.opened = false;
    for (const member of this.members) {
      const call: MediaConnection = member.call;
      if (!call) continue;
      call.peerConnection?.close();
      call.close();
      console.debug('closed ' + member.id);
    }
    this.peer?.disconnect();
    this.stopMedias();
    emits('close');
  }

  stopMedias() {
    this.allMedias.forEach((media) => media.getTracks().forEach((track) => track.stop()));
  }

  width = 0;

  height = 0;
}

const service = createService(VideoChat);

const container = ref();
const { width, height } = useElementSize(container);
watch(
  [width, height],
  () => {
    const count = service.members.length;
    const area = width.value * height.value;
    const videoArea = area / count;
    let length = Math.sqrt(videoArea);
    let cols = Math.ceil(width.value / length);
    let rows = Math.ceil(height.value / length);
    if (cols >= rows && (cols - 1) * rows <= count) cols--;
    if (cols < rows && cols * (rows - 1) <= count) rows--;
    if ((cols - 1) * rows >= count) cols--;
    else if (cols * (rows - 1) >= count) rows--;
    const widthLength = width.value / cols;
    const heightLength = height.value / rows;
    service.width = service.height = widthLength < heightLength ? widthLength : heightLength;
  },
  { immediate: true }
);

onMounted(() => service.init());

onUnmounted(() => service.close());

defineExpose(service);
</script>
<style>
.chat-member-title {
  padding: 7px;
  font-size: medium;
  color: white;
  text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;
}
</style>

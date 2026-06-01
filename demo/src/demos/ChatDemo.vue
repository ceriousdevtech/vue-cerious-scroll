<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import { CHAT_BASE, ME, generateMessage, nowTime, type ChatMessage } from './chat.data';
import './chat.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const sent = ref<ChatMessage[]>([]);
const draft = ref('');

const total = computed(() => CHAT_BASE + sent.value.length);
const getMessage = (index: number): ChatMessage =>
  index < CHAT_BASE ? generateMessage(index) : sent.value[index - CHAT_BASE];

function scrollToLatest(): void {
  requestAnimationFrame(() => scroll.value?.scrollToPercentage(100));
}

onMounted(scrollToLatest);
watch(() => sent.value.length, scrollToLatest);

function send(): void {
  const text = draft.value.trim();
  if (!text) return;
  sent.value = [
    ...sent.value,
    { id: CHAT_BASE + sent.value.length, user: ME, text, time: nowTime(), reactions: [], isSent: true },
  ];
  draft.value = '';
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>💬 Team Chat</h1>
      <p>{{ total.toLocaleString() }} variable-height messages — send one and it auto-scrolls to the bottom.</p>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll chat-scroll"
      :total-elements="total"
      :get-item="getMessage"
    >
      <template #item="{ item: msg }">
        <div class="msg" :class="{ sent: msg.isSent }">
          <div class="msg__avatar" :style="{ background: msg.user.color }">{{ msg.user.emoji }}</div>
          <div class="msg__body">
            <div class="msg__meta">
              <span class="msg__name">{{ msg.user.name }}</span>
              <span>{{ msg.time }}</span>
            </div>
            <div class="msg__bubble">{{ msg.text }}</div>
            <div v-if="msg.reactions.length" class="msg__reactions">
              <span v-for="(r, i) in msg.reactions" :key="i" class="msg__reaction">{{ r.emoji }} {{ r.count }}</span>
            </div>
          </div>
        </div>
      </template>
    </CeriousScroll>

    <div class="chat-composer">
      <textarea
        :rows="1"
        placeholder="Type a message…  (Enter to send, Shift+Enter for newline)"
        v-model="draft"
        @keydown="onKey"
      />
      <button type="button" @click="send" :disabled="!draft.trim()">Send</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import { buildLogOrder, LOG_LEVELS, makeLog, type LogLevel } from './log.data';
import './log.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const active = ref<Set<LogLevel>>(new Set(LOG_LEVELS));
const query = ref('');
const debounced = ref('');

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, (q) => {
  clearTimeout(timer);
  timer = setTimeout(() => (debounced.value = q), 250);
});

const order = computed(() => buildLogOrder(active.value, debounced.value));
watch(order, () => requestAnimationFrame(() => scroll.value?.jumpToElement(0)));

function toggle(level: LogLevel): void {
  const next = new Set(active.value);
  if (next.has(level)) next.delete(level);
  else next.add(level);
  active.value = next;
}

const log = (src: number) => makeLog(src);
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>📜 Log Viewer</h1>
      <p>{{ order.length.toLocaleString() }} of 200,000 lines — filter by level, search the stream.</p>
    </div>

    <div class="demo-toolbar">
      <span
        v-for="l in LOG_LEVELS"
        :key="l"
        class="chip"
        :class="[l, { active: active.has(l) }]"
        @click="toggle(l)"
        >{{ l }}</span
      >
      <input type="search" placeholder="Search messages…" v-model="query" style="flex: 1; min-width: 200px" />
      <span class="stat"><strong>{{ order.length.toLocaleString() }}</strong> lines</span>
    </div>

    <CeriousScroll ref="scroll" class="demo-scroll log-scroll" :items="order">
      <template #item="{ item: src }">
        <div class="log-row" v-if="src != null">
          <span class="log-time">{{ log(src).time }}</span>
          <span class="log-level" :class="log(src).level">{{ log(src).level }}</span>
          <span class="log-service">{{ log(src).service }}</span>
          <span class="log-msg">{{ log(src).message }}</span>
        </div>
      </template>
    </CeriousScroll>
  </div>
</template>

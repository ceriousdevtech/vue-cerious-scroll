<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  FIN_TOTAL,
  initialPrices,
  makeStock,
  sparkPoints,
  sparkSeries,
  tickPrices,
} from './finance.data';
import './finance.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const prices = ref<number[]>(initialPrices());
const live = ref(true);

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    if (!live.value) return;
    // Each visible row reads `prices[i]` in its reactive effect, so updating the
    // prices ref re-renders the rows on its own.
    prices.value = tickPrices(prices.value);
  }, 1200);
});
onBeforeUnmount(() => clearInterval(timer));

const stock = (i: number) => makeStock(i);
const spark = (i: number) => sparkPoints(sparkSeries(i), 110, 28);
const pct = (i: number) => ((prices.value[i] - makeStock(i).base) / makeStock(i).base) * 100;
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>📈 Live Market Ticker</h1>
      <p>{{ FIN_TOTAL.toLocaleString() }} symbols with streaming prices and sparklines.</p>
    </div>

    <div class="demo-toolbar">
      <button type="button" :class="{ 'is-active': live }" @click="live = !live">
        {{ live ? '⏸ Pause stream' : '▶ Resume stream' }}
      </button>
      <span class="stat">updates every 1.2s</span>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll fin-scroll"
      :total-elements="FIN_TOTAL"
      :get-item="(i: number) => i"
    >
      <template #item="{ item: i }">
        <div class="fin-row">
          <span class="fin-sym">{{ stock(i).symbol }}</span>
          <span class="fin-name">{{ stock(i).name }}<small>{{ stock(i).sector }}</small></span>
          <svg class="fin-spark" :width="110" :height="28">
            <polyline
              :points="spark(i)"
              fill="none"
              :stroke="pct(i) >= 0 ? '#3fb950' : '#f85149'"
              :stroke-width="1.5"
            />
          </svg>
          <span class="fin-price">${{ prices[i].toFixed(2) }}</span>
          <span class="fin-change" :class="pct(i) >= 0 ? 'fin-up' : 'fin-down'">
            {{ pct(i) >= 0 ? '▲' : '▼' }} {{ Math.abs(pct(i)).toFixed(2) }}%
          </span>
        </div>
      </template>
    </CeriousScroll>
  </div>
</template>

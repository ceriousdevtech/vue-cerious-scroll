<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll, type CeriousScrollOptions } from '@ceriousdevtech/vue-cerious-scroll';
import { rand } from '../lib/random';
import './masonry.css';

const ITEM_COUNTS = [1_000, 50_000, 200_000, 1_000_000] as const;
const RATIOS = [3 / 4, 4 / 3, 1, 9 / 16, 16 / 9, 2 / 3] as const;
const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const total = ref(200_000);
const jump = ref('123456');
const stat = ref('scroll to see live stats');
const options: CeriousScrollOptions = {
  layout: 'masonry',
  wheel: { smooth: true, notchThresholdPx: Infinity },
  masonry: {
    getItemHeight: (index, width) => Math.round(width / RATIOS[Math.floor(rand(index, 1) * RATIOS.length)]) + 44,
    gap: 14,
    targetColumnWidth: 260,
    segmentSize: 500,
  },
};
const color = (index: number) => {
  const hue = Math.floor(rand(index, 2) * 360);
  return `linear-gradient(160deg,hsl(${hue} 62% 58%),hsl(${(hue + 38) % 360} 62% 44%))`;
};
function refresh(): void {
  const engine = scroll.value?.scroller;
  if (engine) stat.value = `${engine.scrollPercentage.toFixed(1)}% through the card dataset`;
}
function go(): void {
  const index = Number.parseInt(jump.value, 10);
  if (Number.isFinite(index)) scroll.value?.jumpToItem(Math.max(0, Math.min(total.value - 1, index)));
  refresh();
}
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header"><h1>🧱 Masonry · canonical heights</h1><p>Vue cards flow into responsive columns from a pure height oracle, giving every card a reproducible position.</p></div>
    <div class="demo-toolbar">
      <label for="masonry-items">Items</label>
      <select id="masonry-items" v-model.number="total">
        <option v-for="count in ITEM_COUNTS" :key="count" :value="count">{{ count.toLocaleString() }}</option>
      </select>
      <input v-model="jump" type="number" /><button type="button" @click="go">Go</button>
      <button type="button" @click="scroll?.scrollToPercentage(0); refresh()">Top</button>
      <button type="button" @click="scroll?.scrollToPercentage(100); refresh()">End</button>
      <span class="spacer" /><span class="stat">{{ stat }}</span>
    </div>
    <CeriousScroll ref="scroll" class="demo-scroll masonry-scroll" :total-elements="total" :get-item="(index: number) => index" :options="options" @measured-viewport="refresh">
      <template #item="{ item: index }">
        <div class="masonry-card masonry-card--media">
          <span class="masonry-card__fill" :style="{ background: color(index) }" />
          <span class="masonry-card__label">Vue · {{ index.toLocaleString() }}</span>
        </div>
      </template>
    </CeriousScroll>
    <div class="demo-footer"><span>Total: <strong>{{ total.toLocaleString() }}</strong></span><span>Determinism: <strong>canonical</strong></span></div>
  </div>
</template>

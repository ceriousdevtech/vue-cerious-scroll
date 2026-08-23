<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll, type CeriousScrollOptions } from '@ceriousdevtech/vue-cerious-scroll';
import { rand, randInt } from '../lib/random';
import './masonry.css';

const ITEM_COUNTS = [1_000, 50_000, 200_000, 1_000_000] as const;
const WORDS = 'virtual scroll masonry column height measure viewport segment frontier anchor gutter card render engine layout dataset pixel budget cache'.split(' ');
const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const total = ref(50_000);
const jump = ref('25000');
const options: CeriousScrollOptions = {
  layout: 'masonry',
  wheel: { smooth: true, notchThresholdPx: Infinity },
  masonry: { estimatedItemHeight: 260, gap: 14, targetColumnWidth: 300 },
};
const wordsFor = (index: number) => [5, 14, 32, 58][index % 4];
const text = (index: number) => Array.from({ length: wordsFor(index) }, (_, offset) => WORDS[Math.floor(rand(index * 31 + offset, 11) * WORDS.length)]).join(' ');
const bandHeight = (index: number) => index % 7 === 0 ? randInt(index, 50, 230, 8) : 0;
const bandColor = (index: number) => {
  const hue = Math.floor(rand(index, 9) * 360);
  return `linear-gradient(160deg,hsl(${hue} 60% 55%),hsl(${(hue + 40) % 360} 60% 42%))`;
};
function go(): void {
  const index = Number.parseInt(jump.value, 10);
  if (Number.isFinite(index)) scroll.value?.jumpToItem(Math.max(0, Math.min(total.value - 1, index)));
}
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header"><h1>🪜 Masonry · dynamic heights</h1><p>No height oracle: Vue renders uncached cards into the measurement probe before the core places them.</p></div>
    <div class="demo-toolbar">
      <label for="masonry-dynamic-items">Items</label>
      <select id="masonry-dynamic-items" v-model.number="total">
        <option v-for="count in ITEM_COUNTS" :key="count" :value="count">{{ count.toLocaleString() }}</option>
      </select>
      <input v-model="jump" type="number" /><button type="button" @click="go">Go</button>
      <button type="button" @click="scroll?.scrollToPercentage(0)">Top</button>
      <button type="button" @click="scroll?.scrollToPercentage(100)">End</button>
    </div>
    <CeriousScroll ref="scroll" class="demo-scroll masonry-scroll" :total-elements="total" :get-item="(index: number) => index" :options="options">
      <template #item="{ item: index }">
        <article class="masonry-card masonry-card--dynamic">
          <div class="masonry-card__kind"><span class="masonry-card__id">{{ index.toLocaleString() }}</span>Vue card</div>
          <p>{{ text(index) }}</p>
          <div v-if="bandHeight(index)" class="masonry-card__band" :style="{ height: `${bandHeight(index)}px`, background: bandColor(index) }" />
        </article>
      </template>
    </CeriousScroll>
    <div class="demo-footer"><span>Total: <strong>{{ total.toLocaleString() }}</strong></span><span>Determinism: <strong>local</strong></span></div>
  </div>
</template>

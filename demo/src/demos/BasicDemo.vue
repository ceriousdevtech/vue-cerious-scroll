<script setup lang="ts">
import { ref } from 'vue';
import {
  CeriousScroll,
  type CeriousViewportChangeDetail,
} from '@ceriousdevtech/vue-cerious-scroll';

import { rand } from '../lib/random';
import './basic-demo.css';

type Variation = 'uniform' | 'mixed' | 'variable';

const SIZES = [100, 1_000, 10_000, 100_000, 1_000_000];
const PALETTE = ['#1f6feb', '#238636', '#a371f7', '#db6d28', '#cf222e', '#0969da'];

function heightFor(index: number, variation: Variation): number {
  if (variation === 'uniform') return 44;
  if (variation === 'mixed') return [44, 64, 104][index % 3];
  return 32 + Math.floor(rand(index, 7) * 120); // variable: 32–152px
}

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);

const total = ref(100_000);
const variation = ref<Variation>('mixed');
const jumpTo = ref('');
const viewport = ref<CeriousViewportChangeDetail | null>(null);

// Changing the height variation restyles every row; each row's reactive effect
// re-renders with the new height and the engine's content observer reflows. No
// recalculate needed.

function handleJump(): void {
  const i = Number.parseInt(jumpTo.value, 10);
  if (Number.isFinite(i)) scroll.value?.jumpToElement(Math.max(0, Math.min(total.value - 1, i)));
}

const color = (index: number) => PALETTE[index % PALETTE.length];
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>🧱 Basic virtual scroll</h1>
      <p>Lazy <code>get-item</code> data source — no array is allocated, so a million rows costs nothing.</p>
    </div>

    <div class="demo-toolbar">
      <label for="size">Rows</label>
      <select id="size" v-model.number="total">
        <option v-for="s in SIZES" :key="s" :value="s">{{ s.toLocaleString() }}</option>
      </select>

      <label for="var">Heights</label>
      <select id="var" v-model="variation">
        <option value="uniform">Uniform (44px)</option>
        <option value="mixed">Mixed (44/64/104px)</option>
        <option value="variable">Variable (32–152px)</option>
      </select>

      <span style="display: inline-flex; gap: 6px">
        <input
          type="number"
          :min="0"
          :max="total - 1"
          placeholder="row #"
          v-model="jumpTo"
          style="width: 110px"
          @keydown.enter="handleJump"
        />
        <button type="button" @click="handleJump">Go</button>
        <button type="button" @click="scroll?.reset()">Top</button>
        <button type="button" @click="scroll?.scrollToPercentage(100)">End</button>
      </span>

      <span class="spacer" />
      <span class="stat">
        {{
          viewport
            ? `top row ${viewport.currentElement.toLocaleString()} · ${viewport.percentage.toFixed(1)}%`
            : 'scroll to see live stats'
        }}
      </span>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll"
      :total-elements="total"
      :get-item="(index: number) => index"
      @viewport-change="viewport = $event"
    >
      <template #item="{ item: index }">
        <div
          class="basic-row"
          :style="{ height: `${heightFor(index, variation)}px`, borderLeftColor: color(index) }"
        >
          <span class="basic-row__index">#{{ index.toLocaleString() }}</span>
          <span
            class="basic-row__bar"
            :style="{ background: color(index), width: `${30 + (index % 60)}%` }"
          />
          <span class="basic-row__meta">{{ heightFor(index, variation) }}px</span>
        </div>
      </template>
    </CeriousScroll>

    <div class="demo-footer">
      <span>Total: <strong>{{ total.toLocaleString() }}</strong></span>
      <span>Mode: <strong>{{ variation }}</strong></span>
    </div>
  </div>
</template>

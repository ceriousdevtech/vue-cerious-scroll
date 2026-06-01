<script setup lang="ts">
import { computed, ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import { CODE_TOTAL, firstMatch, makeLine, tokenize } from './code.data';
import './code.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const find = ref('');
const q = computed(() => find.value.trim().toLowerCase());

// Rows re-render reactively when `q` changes, so match-highlighting tracks the
// query on its own — no recalculate.

function runFind(): void {
  const i = firstMatch(find.value);
  if (i >= 0) scroll.value?.jumpToElement(i);
}

const line = (i: number) => makeLine(i);
const toks = (i: number) => tokenize(makeLine(i).raw);
const isMatch = (i: number) => q.value.length > 0 && line(i).raw.toLowerCase().includes(q.value);
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>👨‍💻 Code Viewer</h1>
      <p>{{ CODE_TOTAL.toLocaleString() }} syntax-highlighted lines with line numbers and find.</p>
    </div>

    <div class="demo-toolbar">
      <input
        type="search"
        placeholder="Find in file…"
        v-model="find"
        style="flex: 1; min-width: 220px"
        @keydown.enter="runFind"
      />
      <button type="button" @click="runFind">Find next ↵</button>
      <button type="button" @click="scroll?.reset()">Top</button>
      <span class="stat">{{ CODE_TOTAL.toLocaleString() }} lines</span>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll code-scroll"
      :total-elements="CODE_TOTAL"
      :get-item="(i: number) => i"
    >
      <template #item="{ item: i }">
        <div class="code-row" :class="{ match: isMatch(i) }">
          <span class="code-gutter">{{ i + 1 }}</span>
          <span class="code-text"><span
              v-for="(t, k) in toks(i)"
              :key="k"
              :class="`tok-${t.type}`"
            >{{ t.text }}</span></span>
        </div>
      </template>
    </CeriousScroll>
  </div>
</template>

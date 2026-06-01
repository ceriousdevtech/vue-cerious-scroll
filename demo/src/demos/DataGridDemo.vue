<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  buildOrder,
  GRID_COLUMNS,
  makeRow,
  statusClass,
  type GridColumn,
  type SortDir,
} from './data-grid.data';
import './data-grid.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);

const query = ref('');
const debounced = ref('');
const sortCol = ref<GridColumn | null>(null);
const sortDir = ref<SortDir>('asc');
const selected = ref<Set<number>>(new Set());

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, (q) => {
  clearTimeout(timer);
  timer = setTimeout(() => (debounced.value = q), 250);
});

const order = computed(() => buildOrder(debounced.value, sortCol.value, sortDir.value));

// Reset to the top whenever the visible set changes (sort / filter).
watch(order, () => requestAnimationFrame(() => scroll.value?.jumpToElement(0)));

function toggleSort(col: GridColumn): void {
  if (sortCol.value === col) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else {
    sortCol.value = col;
    sortDir.value = 'asc';
  }
}

function clickRow(src: number, additive: boolean): void {
  const next = new Set(additive ? selected.value : []);
  if (selected.value.has(src) && (additive || selected.value.size === 1)) next.delete(src);
  else next.add(src);
  selected.value = next;
  // Rows re-render reactively, so the selection highlight updates on its own.
}

function exportRows(): void {
  alert(`Exporting ${selected.value.size || order.value.length} rows…`);
}

function reset(): void {
  query.value = '';
  debounced.value = '';
  sortCol.value = null;
  selected.value = new Set();
}

const row = (src: number) => makeRow(src);
</script>

<template>
  <div class="demo-page grid-page">
    <div class="demo-page__header">
      <h1>📊 Enterprise Data Grid</h1>
      <p>Sort, search, and multi-select across {{ order.length.toLocaleString() }} of 100,000 records.</p>
    </div>

    <div class="demo-toolbar">
      <input
        type="search"
        placeholder="Search id, name, email, department…"
        v-model="query"
        style="flex: 1; min-width: 220px"
      />
      <button type="button" @click="exportRows">📥 Export</button>
      <button type="button" @click="reset">🔄 Reset</button>
      <span class="stat"><strong>{{ order.length.toLocaleString() }}</strong> rows</span>
    </div>

    <div class="grid-head">
      <div
        v-for="c in GRID_COLUMNS"
        :key="c.key"
        class="grid-head__cell"
        :class="{ sortable: c.sortable }"
        @click="c.sortable && toggleSort(c.key)"
      >
        {{ c.label }}
        <span v-if="c.sortable" class="grid-head__sort" :class="{ active: sortCol === c.key }">
          {{ sortCol === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅' }}
        </span>
      </div>
    </div>

    <CeriousScroll ref="scroll" class="demo-scroll" :items="order">
      <template #item="{ item: src }">
        <div
          class="grid-row"
          :class="{ selected: selected.has(src) }"
          @click="clickRow(src, $event.ctrlKey || $event.metaKey)"
        >
          <div class="grid-cell rownum">{{ row(src).index + 1 }}</div>
          <div class="grid-cell id">{{ row(src).id }}</div>
          <div class="grid-cell">{{ row(src).name }}</div>
          <div class="grid-cell email">{{ row(src).email }}</div>
          <div class="grid-cell">{{ row(src).department }}</div>
          <div class="grid-cell">
            <span class="badge" :class="statusClass(row(src).status)">{{ row(src).status }}</span>
          </div>
          <div class="grid-cell">{{ row(src).region }}</div>
          <div class="grid-cell num" :class="row(src).revenue >= 0 ? 'cell-positive' : 'cell-negative'">
            {{ row(src).revenue >= 0 ? '+' : '−' }}${{ Math.abs(row(src).revenue).toLocaleString() }}
          </div>
          <div class="grid-cell num">{{ row(src).score.toFixed(1) }}</div>
          <div class="grid-cell">{{ row(src).date }}</div>
        </div>
      </template>
    </CeriousScroll>

    <div class="demo-footer">
      <span>Selected: <strong>{{ selected.size }}</strong></span>
      <span>Ctrl/Cmd-click to multi-select · click a header to sort</span>
    </div>
  </div>
</template>

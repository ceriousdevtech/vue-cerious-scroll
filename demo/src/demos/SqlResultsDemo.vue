<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import { makeResult, SQL_COLUMNS, SQL_TOTAL, sqlStatusClass } from './sql.data';
import './sql.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const hScroll = ref<HTMLDivElement | null>(null);
const selected = ref<number | null>(null);
const sqlOptions = { touch: { enabled: true, getHorizontalScrollTarget: () => hScroll.value } };

function select(i: number): void {
  selected.value = i;
  // Rows re-render reactively, so the highlight moves on its own.
}

const r = (i: number) => makeResult(i);
</script>

<template>
  <div class="demo-page sql-page">
    <div class="demo-page__header">
      <h1>🗄️ SQL Results</h1>
      <p>{{ SQL_TOTAL.toLocaleString() }} rows returned — click a row to select it.</p>
    </div>

    <pre class="sql-editor"><span class="kw">SELECT</span> id, customer, product, amount, status, created_at
<span class="kw">FROM</span>   orders
<span class="kw">WHERE</span>  amount &gt; 0
<span class="kw">ORDER BY</span> created_at <span class="kw">DESC</span>;</pre>

    <div class="demo-toolbar">
      <span class="stat">✓ <strong>{{ SQL_TOTAL.toLocaleString() }}</strong> rows · 0.024s</span>
      <span class="spacer" />
      <span class="stat">Selected row: <strong>{{ selected === null ? '—' : r(selected).id }}</strong></span>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll sql-scroll"
      :total-elements="SQL_TOTAL"
      :get-item="(i: number) => i"
      :options="sqlOptions"
    >
      <div class="sql-h-scroll" ref="hScroll">
        <div class="sql-head">
          <div v-for="c in SQL_COLUMNS" :key="c" class="sql-head__cell">{{ c }}</div>
        </div>
        <div data-cerious-scroll-content class="sql-scroll-content"></div>
      </div>

      <template #item="{ item: i }">
            <div class="sql-row" :class="{ selected: selected === i }" @click="select(i)">
              <div class="sql-cell id">{{ r(i).id }}</div>
              <div class="sql-cell">{{ r(i).customer }}</div>
              <div class="sql-cell">{{ r(i).product }}</div>
              <div class="sql-cell num">${{ r(i).amount.toLocaleString() }}</div>
              <div class="sql-cell"><span class="sql-badge" :class="sqlStatusClass(r(i).status)">{{ r(i).status }}</span></div>
              <div class="sql-cell">{{ r(i).date }}</div>
            </div>
          </template>
    </CeriousScroll>
  </div>
</template>

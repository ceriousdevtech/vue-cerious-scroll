<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  TABLE_COLUMNS,
  TABLE_TOTAL,
  makeRow,
  statusLabel,
} from './table.data';
import './table.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const total = ref(TABLE_TOTAL);

// Header in the engine's <thead> (declarative #header slot, same table as the
// rows). autoSizeColumns measures widths once then pins them — auto-sized but
// stable, no manual widths.
const tableOptions = {
  layout: 'table' as const,
  table: { tableClassName: 'cs-table', autoSizeColumns: true },
};

const row = (i: number) => makeRow(i);
</script>

<template>
  <div class="demo-page cs-table-page">
    <div class="demo-page__header">
      <h1>🧮 Native &lt;table&gt; mode</h1>
      <p>
        Real <code>&lt;tr&gt;</code>/<code>&lt;td&gt;</code> rows via
        <code>layout: 'table'</code> — frozen header, aligned columns, single
        tbody transform. Virtualizes {{ total.toLocaleString() }} rows with ~25 in the DOM.
      </p>
    </div>

    <div class="demo-toolbar">
      <label>
        Rows:
        <select :value="total" @change="total = parseInt(($event.target as HTMLSelectElement).value, 10)">
          <option :value="1000">1,000</option>
          <option :value="100000">100,000</option>
          <option :value="1000000">1,000,000</option>
        </select>
      </label>
      <button type="button" @click="scroll?.scrollToPercentage(0)">Top</button>
      <button type="button" @click="scroll?.scrollToPercentage(100)">End</button>
      <span class="stat"><strong>{{ total.toLocaleString() }}</strong> rows</span>
    </div>

    <CeriousScroll
      ref="scroll"
      :key="total"
      class="demo-scroll cs-table-scroll"
      :total-elements="total"
      :get-item="(i: number) => i"
      :options="tableOptions"
    >
      <!-- Declarative header rendered into the engine's <thead> (same table as
           the rows → native column alignment, frozen via tbody-only transform). -->
      <template #header>
        <tr>
          <th v-for="c in TABLE_COLUMNS" :key="c.key" :class="c.cls">{{ c.label }}</th>
        </tr>
      </template>

      <template #item="{ item: index }">
        <td class="cell-id">{{ row(index).id }}</td>
        <td class="cell-name">{{ row(index).name }}</td>
        <td><span class="badge" :class="`badge--${row(index).status}`">{{ statusLabel(row(index).status) }}</span></td>
        <td>{{ row(index).email }}</td>
        <td class="num">{{ row(index).score.toLocaleString() }}</td>
      </template>
    </CeriousScroll>

    <div class="demo-footer">
      <span>Total: <strong>{{ total.toLocaleString() }}</strong></span>
      <span>Mode: <strong>layout: 'table'</strong></span>
    </div>
  </div>
</template>

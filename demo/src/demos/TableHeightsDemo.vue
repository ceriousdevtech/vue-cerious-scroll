<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  HEIGHTS_COLUMNS,
  HEIGHTS_COLUMN_WIDTHS,
  HEIGHTS_TOTAL,
  makeHeightsRow,
} from './table-heights.data';
import './table-heights.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const total = ref(HEIGHTS_TOTAL);
const jump = ref(5000);

// fixed columns (colgroup) so the CONTENT column wraps freely without jitter.
const tableOptions = {
  layout: 'table' as const,
  table: { tableClassName: 'cs-table', columnWidths: [...HEIGHTS_COLUMN_WIDTHS] },
};

const go = () => scroll.value?.jumpToElement(jump.value);
</script>

<template>
  <div class="demo-page cs-heights-page">
    <div class="demo-page__header">
      <h1>🪜 Native &lt;table&gt; · wild dynamic heights</h1>
      <p>
        Real <code>&lt;tr&gt;</code>/<code>&lt;td&gt;</code> rows via <code>layout: 'table'</code>, but every
        row has a <strong>different, unpredictable height</strong> — one-liners next to walls of text, long
        lists, code blocks, tall banners and wrapping tag clouds. Each row is <em>measured</em>, so the single
        &lt;tbody&gt; transform stays pixel-correct.
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
      <span>
        Jump to
        <input type="number" min="0" v-model.number="jump" style="width: 90px" />
        <button type="button" @click="go">Go</button>
      </span>
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
      <template #header>
        <tr>
          <th v-for="c in HEIGHTS_COLUMNS" :key="c.key" :class="c.cls">{{ c.label }}</th>
        </tr>
      </template>

      <!-- v-for over a 1-element array computes makeHeightsRow once per row. -->
      <template #item="{ item: index }">
        <template v-for="row in [makeHeightsRow(index)]" :key="row.index">
          <td class="col-id"><span class="cell-id">{{ row.id }}</span></td>
          <td class="col-kind"><span class="kind-badge" :class="row.kindCls">{{ row.kindLabel }}</span></td>
          <td class="col-body">
            <template v-if="row.kind === 'line'">
              <p class="body-text">{{ row.paragraphs[0] }}</p>
            </template>
            <template v-else-if="row.kind === 'para' || row.kind === 'wall'">
              <p class="body-title">{{ row.title }}</p>
              <p v-for="(p, i) in row.paragraphs" :key="i" class="body-text">{{ p }}</p>
            </template>
            <template v-else-if="row.kind === 'list'">
              <p class="body-title">{{ row.title }}</p>
              <ul class="body-list"><li v-for="(it, i) in row.listItems" :key="i">{{ it }}</li></ul>
            </template>
            <template v-else-if="row.kind === 'code'">
              <p class="body-title">{{ row.title }}</p>
              <pre class="body-code">{{ row.codeLines.join('\n') }}</pre>
            </template>
            <template v-else-if="row.kind === 'banner'">
              <div
                class="body-banner"
                :style="{ height: row.bannerPx + 'px', background: row.bannerColor.bg, borderColor: row.bannerColor.bd, color: row.bannerColor.fg }"
              >{{ row.bannerText }}</div>
            </template>
            <template v-else-if="row.kind === 'tags'">
              <p class="body-title">{{ row.title }}</p>
              <div class="body-tags"><span v-for="(t, i) in row.tags" :key="i" class="body-tag">#{{ t }}</span></div>
            </template>
          </td>
          <td class="col-meta">
            <span class="meta-row"><span class="meta-k">@</span><span class="meta-v">{{ row.owner }}</span></span>
            <span class="meta-row"><span class="meta-k">v</span><span class="meta-v">{{ row.version }}</span></span>
          </td>
        </template>
      </template>
    </CeriousScroll>

    <div class="demo-footer">
      <span>Total: <strong>{{ total.toLocaleString() }}</strong></span>
      <span>Mode: <strong>layout: 'table'</strong></span>
      <span>Heights: <strong>measured per row</strong></span>
    </div>
  </div>
</template>

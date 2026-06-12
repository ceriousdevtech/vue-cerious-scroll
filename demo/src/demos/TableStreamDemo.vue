<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  STREAM_COLUMNS,
  STREAM_COLUMN_WIDTHS,
  makeEvent,
} from './table-stream.data';
import './table-stream.css';

// FIXED element count so the engine is never recreated on a prepend (growing
// totalElements would tear down + rebuild the whole scroller every inject — that
// read as scrollbar thrash). Content slides under a fixed window instead:
// index i shows seq = baseSeq - i, and "prepending k" grows baseSeq by k while
// we shift the scroll position by k to hold the anchor.
const TOTAL = 2000;

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const engine = shallowRef<any>(null); // current engine instance (from @ready)

const baseSeq = ref(TOTAL - 1);
const freshMinSeq = ref(-1);
const follow = ref(false);
const newAbove = ref(0);
const seen = ref(TOTAL);
const stat = ref('scroll down, then inject to test anchoring');
const live = ref(false);

const tableOptions = {
  layout: 'table' as const,
  table: { tableClassName: 'cs-table', columnWidths: [...STREAM_COLUMN_WIDTHS] },
};

let didInitialJump = false;
function onReady(sc: any) {
  engine.value = sc;
  if (!didInitialJump) {
    didInitialJump = true;
    requestAnimationFrame(() => { scroll.value?.jumpToElement(40); refreshStat(); });
  }
}

function refreshStat() {
  const eng = engine.value;
  if (!eng) return;
  const topSeqVisible = baseSeq.value - eng.currentElement;
  stat.value = `top event #${topSeqVisible.toLocaleString()} · idx ${eng.currentElement.toLocaleString()} · ${eng.scrollPercentage.toFixed(1)}%`;
  if (eng.currentElement === 0 && eng.scrollOffset <= 0) newAbove.value = 0;
}

function prepend(k: number) {
  const eng = engine.value;
  if (!eng) return;
  const anchorEl = eng.currentElement;
  const anchorOff = eng.scrollOffset;
  const wasAtTop = eng.currentElement === 0 && eng.scrollOffset <= 0;

  baseSeq.value += k;
  freshMinSeq.value = baseSeq.value - k + 1;

  if (follow.value) {
    scroll.value?.jumpToElement(0); // ride the newest
  } else {
    // Hold the same logical row (now at index anchorEl + k). jumpToElement syncs
    // the scrollbar thumb; restore scrollOffset for a crisp sub-row hold;
    // recalculate re-renders visible rows with the new baseSeq content + heights.
    const target = Math.min(anchorEl + k, TOTAL - 1);
    scroll.value?.jumpToElement(target);
    if (anchorOff > 0) eng.scrollOffset = anchorOff;
    if (!wasAtTop) newAbove.value += k;
  }
  scroll.value?.recalculate();
  seen.value = baseSeq.value + 1;
  refreshStat();
}

function goTop() {
  scroll.value?.jumpToElement(0);
  newAbove.value = 0;
  refreshStat();
}

watch(follow, (on) => { if (on) goTop(); });

let liveTimer: ReturnType<typeof setInterval> | null = null;
watch(live, (on) => {
  if (on) liveTimer = setInterval(() => prepend(1 + Math.floor(Math.random() * 3)), 1300);
  else if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
});
onBeforeUnmount(() => { if (liveTimer) clearInterval(liveTimer); });
</script>

<template>
  <div class="demo-page cs-stream-page">
    <div class="demo-page__header">
      <h1>📡 Native &lt;table&gt; · prepend &amp; scroll anchoring</h1>
      <p>
        New, <strong>variable-height</strong> rows are injected at the <strong>top</strong> of the stream —
        like a live telemetry feed or a chat-history backfill. Scroll down a bit, then inject: with anchoring
        on, the row you're reading stays put while new rows pile up above; with <em>Follow newest</em> on, the
        view rides the top instead.
      </p>
    </div>

    <div class="demo-toolbar">
      <button type="button" @click="prepend(1)">Inject 1 ↑</button>
      <button type="button" @click="prepend(25)">Backfill 25 ↑</button>
      <button type="button" @click="live = !live">
        <span class="live-dot" :class="{ on: live }"></span>Live feed
      </button>
      <label title="Jump to newest on every inject instead of holding position">
        <input type="checkbox" v-model="follow" /> Follow newest
      </label>
      <button type="button" @click="goTop">Top</button>
      <span class="stat">{{ stat }}</span>
    </div>

    <div class="scroll-wrap">
      <button v-if="newAbove > 0" type="button" class="new-above" @click="goTop">▲ {{ newAbove }} new above</button>
      <CeriousScroll
        ref="scroll"
        class="demo-scroll cs-table-scroll"
        :total-elements="TOTAL"
        :get-item="(i: number) => i"
        :options="tableOptions"
        @ready="onReady"
        @viewport-change="refreshStat"
      >
        <template #header>
          <tr>
            <th v-for="c in STREAM_COLUMNS" :key="c.key" :class="c.cls">{{ c.label }}</th>
          </tr>
        </template>

        <template #item="{ item: index }">
          <template v-for="ev in [makeEvent(baseSeq - index)]" :key="ev.seq">
            <td class="col-time" :class="{ 'is-new': freshMinSeq >= 0 && ev.seq >= freshMinSeq }">
              <span class="cell-time">{{ ev.clock }}</span>
              <span class="cell-ago">{{ baseSeq - ev.seq === 0 ? 'now' : (baseSeq - ev.seq) + 's ago' }}</span>
            </td>
            <td class="col-level"><span class="lvl" :class="`lvl-${ev.level}`">{{ ev.level }}</span></td>
            <td class="col-event">
              <template v-if="ev.kind === 'metric'">
                <p class="ev-text"><strong>{{ ev.service }}</strong> · {{ ev.metricLine }}</p>
              </template>
              <template v-else-if="ev.kind === 'event'">
                <p class="ev-title">{{ ev.title }}</p><p class="ev-text">{{ ev.text }}</p>
              </template>
              <template v-else-if="ev.kind === 'list'">
                <p class="ev-title">{{ ev.title }}</p>
                <ul class="ev-list"><li v-for="(it, i) in ev.listItems" :key="i">{{ it }}</li></ul>
              </template>
              <template v-else-if="ev.kind === 'trace'">
                <p class="ev-title">{{ ev.title }}</p><pre class="ev-trace">{{ ev.traceLines.join('\n') }}</pre>
              </template>
              <template v-else-if="ev.kind === 'json'">
                <p class="ev-title">{{ ev.title }}</p><pre class="ev-json">{{ ev.jsonLines.join('\n') }}</pre>
              </template>
              <span v-if="freshMinSeq >= 0 && ev.seq >= freshMinSeq" class="new-flag">NEW</span>
            </td>
            <td class="col-seq"><span class="cell-seq">#{{ ev.seq.toLocaleString() }}</span></td>
          </template>
        </template>
      </CeriousScroll>
    </div>

    <div class="demo-footer">
      <span>Stream length: <strong>{{ seen.toLocaleString() }}</strong></span>
      <span>Mode: <strong>layout: 'table'</strong></span>
      <span>Anchoring: <strong>{{ follow ? 'follow newest' : 'hold position' }}</strong></span>
    </div>
  </div>
</template>

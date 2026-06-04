<!--
  Side-by-side stress-test: @tanstack/vue-virtual (left) vs Cerious (right).
  Same dataset, same mutations — watch which scrollbar stays honest.
-->
<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  makeRowDatasource,
  pickIndices,
  SCENARIOS,
  type RowDatasource,
  type Scenario,
} from './comparison.data';
import './comparison.css';

const SIZE_BY_SCENARIO: Record<Scenario, number> = {
  'dynamic-height': 10_000,
  expanding: 10_000,
  'async-images': 5_000,
  millions: 5_000_000,
  'continuous-updates': 10_000,
  spreadsheet: 50_000,
};

const scenario = ref<Scenario>('dynamic-height');
const total = computed(() => SIZE_BY_SCENARIO[scenario.value]);
const scenarioMeta = computed(() => SCENARIOS.find((s) => s.id === scenario.value)!);

// We rebuild the datasource whenever the scenario changes so both sides start
// clean. shallowRef keeps the object identity stable for cheap diffs.
const ds = shallowRef<RowDatasource>(makeRowDatasource(total.value, scenario.value));
const dsTick = ref(0); // bumped on every mutation so computed props re-evaluate
let unsubscribe: (() => void) | null = null;

function wireDs(): void {
  unsubscribe?.();
  unsubscribe = ds.value.subscribe(() => {
    dsTick.value++;
  });
}
wireDs();

watch(scenario, () => {
  ds.value = makeRowDatasource(total.value, scenario.value);
  dsTick.value++;
  wireDs();
});

const cerious = ref<InstanceType<typeof CeriousScroll> | null>(null);
const tvScrollEl = useTemplateRef<HTMLDivElement>('tvScroll');

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: total.value,
    getScrollElement: () => tvScrollEl.value,
    // Intentionally do NOT pass measureElement — we want the cached-size
    // breakage to be visible. The "Force remeasure" button calls .measure().
    estimateSize: (i: number) => {
      // include dsTick so changing it busts the closure memo
      void dsTick.value;
      return ds.value.rowHeight(i);
    },
    overscan: 6,
  })),
);

const tvVirtualRows = computed(() => rowVirtualizer.value.getVirtualItems());
const tvTotalSize = computed(() => rowVirtualizer.value.getTotalSize());

function toggleExpand(id: number): void {
  const r = ds.value.getRow(id);
  ds.value.setOverride(id, { expanded: !r.expanded });
  dsTick.value++;
  // do NOT call measure() — show breakage
}

function forceRemeasure(): void {
  rowVirtualizer.value.measure();
}

let liveId: number | null = null;
watch(scenario, (s) => {
  if (liveId !== null) {
    window.clearInterval(liveId);
    liveId = null;
  }
  if (s !== 'continuous-updates') return;
  liveId = window.setInterval(() => {
    const seed = (performance.now() | 0) & 0xffff;
    pickIndices(total.value, 50, seed).forEach((i, k) => {
      const grow = (k & 1) === 0;
      ds.value.setOverride(i, {
        scale: grow ? 1.6 : 1,
        hot: (ds.value.getRow(i).hot + 1) & 7,
      });
    });
    dsTick.value++;
  }, 120);
}, { immediate: true });

onUnmounted(() => {
  if (liveId !== null) window.clearInterval(liveId);
  unsubscribe?.();
});

// Helper for the template (depends on dsTick implicitly)
function row(i: number) {
  void dsTick.value;
  return ds.value.getRow(i);
}

function heightOf(r: { isSheet?: boolean; baseHeight: number; scale: number; expanded: boolean; hasImage: boolean; imageLoaded: boolean }): number {
  if (r.isSheet) return r.expanded ? 36 + 240 : 36;
  const base = Math.round(r.baseHeight * r.scale);
  if (r.expanded) return base + 200;
  return r.hasImage ? base + (r.imageLoaded ? 160 : 0) : base;
}
</script>

<template>
  <div class="cmp-page">
    <div class="cmp-header">
      <h1>⚔️ Cerious Scroll vs Traditional Virtualization</h1>
      <p>Same dataset, same mutation, two engines. Watch which one stays stable.</p>
    </div>

    <div class="cmp-toolbar">
      <label for="scn">Scenario</label>
      <select id="scn" v-model="scenario">
        <option v-for="s in SCENARIOS" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>

      <span v-if="scenario === 'dynamic-height'" style="font-size: 0.85rem; color: var(--muted)">
        Scroll to find rows up to 1800px tall (taller than the viewport).
      </span>
      <span v-else-if="scenario === 'async-images'" style="font-size: 0.85rem; color: var(--muted)">
        Every row loads an image asynchronously — height grows on arrival.
      </span>
      <span v-else-if="scenario === 'continuous-updates'" style="font-size: 0.85rem; color: var(--muted)">
        Streaming 50 mutations every 120ms…
      </span>
      <span v-else-if="scenario === 'expanding'" style="font-size: 0.85rem; color: var(--muted)">
        Click any row to toggle expand.
      </span>
      <span v-else-if="scenario === 'spreadsheet'" style="font-size: 0.85rem; color: var(--muted)">
        Scroll horizontally inside each row; click to expand a detail panel.
      </span>

      <span class="spacer" />
      <button type="button" @click="forceRemeasure" title="Force TanStack to re-measure">
        Force TanStack remeasure
      </button>
      <span class="scenario-desc">{{ scenarioMeta.desc }}</span>
    </div>

    <div class="cmp-stage">
      <section class="cmp-side cmp-side--competitor">
        <header class="cmp-side__head">
          <span class="title">@tanstack/vue-virtual</span>
          <span class="badge">useVirtualizer</span>
          <span class="cmp-side__stats">
            <span>rows <span class="stat-num">{{ total.toLocaleString() }}</span></span>
            <span v-if="scenario === 'millions'" style="color: #cf222e; font-weight: 600">
              ⚠ capped ≈ 411k by browser scrollHeight
            </span>
          </span>
        </header>
        <div class="cmp-side__body">
          <div ref="tvScroll" :class="['tv-scroll', { 'is-spreadsheet': scenario === 'spreadsheet' }]">
            <div class="tv-inner" :style="{ height: tvTotalSize + 'px' }">
              <div
                v-for="vi in tvVirtualRows"
                :key="vi.key"
                :style="{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: 'translateY(' + vi.start + 'px)',
                  height: vi.size + 'px',
                }"
              >
                <div
                  :class="['cmp-row', { alt: vi.index % 2 }]"
                  :style="{
                    height: heightOf(row(vi.index)) + 'px',
                    background: row(vi.index).hot > 0 ? '#fff8c5' : undefined,
                  }"
                  @click="toggleExpand(vi.index)"
                >
                  <template v-if="row(vi.index).isSheet">
                    <div class="sheet-row">
                      <div class="sheet-scroll">
                        <div
                          v-for="(cell, ci) in row(vi.index).cells"
                          :key="ci"
                          :class="['sheet-cell', { 'sheet-cell--head': ci === 0 }]"
                        >{{ cell }}</div>
                      </div>
                    </div>
                    <div v-if="row(vi.index).expanded" class="sheet-expand">
                      Detail panel for R{{ vi.index }} — 240px tall. TanStack's estimateSize cache never sees this height change.
                    </div>
                  </template>
                  <template v-else>
                    <div class="cmp-row__idx">#{{ vi.index.toLocaleString() }}</div>
                    <div class="cmp-row__body">
                      <div class="cmp-row__title">{{ row(vi.index).title }}</div>
                      <div class="cmp-row__text">{{ row(vi.index).text }}</div>
                      <div v-if="row(vi.index).hasImage" :class="['cmp-row__media', row(vi.index).imageLoaded ? 'loaded' : 'pending']">
                        <template v-if="row(vi.index).imageLoaded">🖼  asset-{{ vi.index % 1000 }}.jpg</template>
                        <template v-else>⏳ loading…</template>
                      </div>
                      <div v-if="row(vi.index).expanded" class="cmp-row__expand">
                        Expanded detail panel — adds 200px of content. Click row again to collapse.
                        <br />Generated lazily on demand.
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
          <div class="cmp-warn">
            <template v-if="scenario === 'millions'">
              Browser caps element scrollHeight at ≈33.5M px. 5M × 80px = 400M px → list tops out near row 411,000 of 5,000,000.
            </template>
            <template v-else>
              Cached estimateSize map — mutations require manual <code>.measure()</code>.
            </template>
          </div>
        </div>
      </section>

      <section class="cmp-side cmp-side--cerious">
        <header class="cmp-side__head">
          <span class="title">Cerious Scroll</span>
          <span class="badge">Vue 3</span>
          <span class="cmp-side__stats">
            <span>rows <span class="stat-num">{{ total.toLocaleString() }}</span></span>
          </span>
        </header>
        <div class="cmp-side__body">
          <CeriousScroll
            ref="cerious"
            :class="['demo-scroll', { 'is-spreadsheet': scenario === 'spreadsheet' }]"
            :total-elements="total"
            :get-item="(i: number) => row(i)"
          >
            <template #item="{ item }">
              <div
                :class="['cmp-row', { alt: item.id % 2 }]"
                :style="{
                  height: heightOf(item) + 'px',
                  background: item.hot > 0 ? '#fff8c5' : undefined,
                }"
                @click="toggleExpand(item.id)"
              >
                <template v-if="item.isSheet">
                  <div class="sheet-row">
                    <div class="sheet-scroll">
                      <div
                        v-for="(cell, ci) in item.cells"
                        :key="ci"
                        :class="['sheet-cell', { 'sheet-cell--head': ci === 0 }]"
                      >{{ cell }}</div>
                    </div>
                  </div>
                  <div v-if="item.expanded" class="sheet-expand">
                    Detail panel for R{{ item.id }} — 240px tall. Cerious sees the new height the moment it appears.
                  </div>
                </template>
                <template v-else>
                  <div class="cmp-row__idx">#{{ item.id.toLocaleString() }}</div>
                  <div class="cmp-row__body">
                    <div class="cmp-row__title">{{ item.title }}</div>
                    <div class="cmp-row__text">{{ item.text }}</div>
                    <div v-if="item.hasImage" :class="['cmp-row__media', item.imageLoaded ? 'loaded' : 'pending']">
                      <template v-if="item.imageLoaded">🖼  asset-{{ item.id % 1000 }}.jpg</template>
                      <template v-else>⏳ loading…</template>
                    </div>
                    <div v-if="item.expanded" class="cmp-row__expand">
                      Expanded detail panel — adds 200px of content. Click row again to collapse.
                      <br />Generated lazily on demand.
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </CeriousScroll>
          <div class="cmp-warn">
            <template v-if="scenario === 'millions'">
              Sibling-driver scrollbar decouples virtual position from native scrollHeight — row 4,999,999 is reachable.
            </template>
            <template v-else>
              No size cache — ResizeObserver tracks each row's real height live.
            </template>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

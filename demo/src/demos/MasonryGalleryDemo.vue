<script setup lang="ts">
/**
 * Masonry with real content: network images, a composed card component, and an
 * interactive carousel.
 *
 * Three constraints follow from cards being mounted only while near the
 * viewport, and from the engine sizing a card before the browser lays it out:
 *
 *   1. Media space is reserved from intrinsic dimensions — a card that grows
 *      after mount is never re-measured, and overlaps its neighbour.
 *   2. Card height is enforced rather than estimated: the chrome below the
 *      image has a fixed height, so getItemHeight cannot disagree with the DOM.
 *   3. Per-card UI state lives outside the component, keyed by index, because a
 *      card unmounts as soon as it leaves the overscan window.
 */
import { reactive, ref } from 'vue';
import { CeriousScroll, type CeriousScrollOptions } from '@ceriousdevtech/vue-cerious-scroll';
import { rand } from '../lib/random';
import './masonry.css';

const ITEM_COUNTS = [1_000, 50_000, 200_000] as const;
const RATIOS = [3 / 4, 4 / 3, 1, 9 / 16, 16 / 9, 2 / 3] as const;
const AUTHORS = ['A. Lovelace', 'L. Torvalds', 'G. Hopper', 'A. Turing', 'M. Hamilton', 'R. Perlman'] as const;
const TAGS = ['landscape', 'portrait', 'street', 'studio', 'archive', 'macro'] as const;

/** Height of everything below the image. Enforced in CSS as well as declared here. */
const CHROME_H = 132;

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const total = ref(50_000);
const jump = ref('25000');
const stat = ref('scroll to see live stats');

/**
 * Carousel frame and likes per card. Deliberately NOT component state: a card
 * unmounts when it leaves the window, so component state would reset every time
 * the viewer scrolled past. `reactive` so template updates still track them.
 */
const frameByCard = reactive(new Map<number, number>());
const likedCards = reactive(new Set<number>());

/** Live column width, captured from getItemHeight — the one callback that reports it. */
const columnWidth = ref(260);

function cardModel(index: number) {
  const frames = rand(index, 5) < 0.35 ? 2 + Math.floor(rand(index, 6) * 4) : 1;
  return {
    ratio: RATIOS[Math.floor(rand(index, 1) * RATIOS.length)],
    author: AUTHORS[Math.floor(rand(index, 2) * AUTHORS.length)],
    tag: TAGS[Math.floor(rand(index, 3) * TAGS.length)],
    likes: Math.floor(rand(index, 4) * 900),
    frames,
  };
}

/** Bucket the request width so a resizing CDN can cache it. */
const bucket = (width: number) => Math.ceil(width / 100) * 100;

function imageUrl(index: number, frame: number): string {
  const w = bucket(columnWidth.value);
  return `https://picsum.photos/seed/vcs${index}-${frame}/${w}/${Math.round(w * cardModel(index).ratio)}`;
}

const warmed = new Set<number>();
function warm(index: number): void {
  if (index < 0 || index >= total.value || warmed.has(index)) return;
  warmed.add(index);
  const image = new Image();
  image.decoding = 'async';
  // Low priority: visible cards request at high priority and must preempt these.
  image.fetchPriority = 'low';
  image.src = imageUrl(index, 0);
  if (warmed.size > 600) warmed.clear();
}

const options: CeriousScrollOptions = {
  layout: 'masonry',
  wheel: { smooth: true, notchThresholdPx: Infinity },
  masonry: {
    getItemHeight: (index, width) => {
      columnWidth.value = width;
      return Math.round(width * cardModel(index).ratio) + CHROME_H;
    },
    gap: 14,
    targetColumnWidth: 260,
    segmentSize: 500,
  },
};

const frameOf = (index: number) => frameByCard.get(index) ?? 0;
const isLiked = (index: number) => likedCards.has(index);
const placeholder = (index: number) => `hsl(${Math.floor(rand(index, 9) * 360)} 28% 22%)`;

function step(index: number, delta: number): void {
  const frames = cardModel(index).frames;
  frameByCard.set(index, (frameOf(index) + delta + frames) % frames);
}

function toggleLike(index: number): void {
  if (likedCards.has(index)) likedCards.delete(index); else likedCards.add(index);
}

function refresh(): void {
  const engine = scroll.value?.scroller;
  if (!engine) return;
  stat.value = `${engine.scrollPercentage.toFixed(1)}% · ${warmed.size} images warmed`;
  // Small window only: a browser allows ~6 connections per host, so a large
  // speculative window queues ahead of the images actually on screen.
  const from = engine.startElement * 500;
  for (let i = from; i < from + 40; i++) warm(i);
}

function go(): void {
  const index = Number.parseInt(jump.value, 10);
  if (Number.isFinite(index)) scroll.value?.jumpToItem(Math.max(0, Math.min(total.value - 1, index)));
  refresh();
}
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>🖼️ Masonry · real content</h1>
      <p>
        Network images, a composed Vue card, and a carousel inside every multi-shot card —
        virtualized. Media space is reserved, chrome height is enforced, and per-card state
        lives outside the component so it survives unmounting.
      </p>
    </div>

    <div class="demo-toolbar">
      <label for="gallery-items">Items</label>
      <select id="gallery-items" v-model.number="total">
        <option v-for="count in ITEM_COUNTS" :key="count" :value="count">{{ count.toLocaleString() }}</option>
      </select>
      <input v-model="jump" type="number" /><button type="button" @click="go">Go</button>
      <button type="button" @click="scroll?.scrollToPercentage(0); refresh()">Top</button>
      <button type="button" @click="scroll?.scrollToPercentage(100); refresh()">End</button>
      <span class="spacer" /><span class="stat">{{ stat }}</span>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll masonry-scroll"
      :total-elements="total"
      :get-item="(index: number) => index"
      :options="options"
      @measured-viewport="refresh"
    >
      <template #item="{ item: index }">
        <div class="gallery-card">
          <div
            class="gallery-card__media"
            :style="{ aspectRatio: `1 / ${cardModel(index).ratio}`, background: placeholder(index) }"
          >
            <!-- `key` on the frame forces a fresh <img> so the fade-in replays. -->
            <img
              :key="frameOf(index)"
              :src="imageUrl(index, frameOf(index))"
              :width="bucket(columnWidth)"
              :height="Math.round(bucket(columnWidth) * cardModel(index).ratio)"
              decoding="async"
              fetchpriority="high"
              alt=""
              @load="(event) => (event.target as HTMLElement).classList.add('is-loaded')"
            />
            <template v-if="cardModel(index).frames > 1">
              <button type="button" class="gallery-card__nav gallery-card__nav--prev"
                aria-label="Previous image" @click="step(index, -1)">‹</button>
              <button type="button" class="gallery-card__nav gallery-card__nav--next"
                aria-label="Next image" @click="step(index, 1)">›</button>
              <span class="gallery-card__dots">
                <i v-for="k in cardModel(index).frames" :key="k"
                   :class="{ 'is-on': k - 1 === frameOf(index) }" />
              </span>
            </template>
          </div>

          <div class="gallery-card__chrome" :style="{ height: `${CHROME_H}px` }">
            <div class="gallery-card__byline">
              <span class="gallery-card__avatar">{{ cardModel(index).author.split(' ')[1][0] }}</span>
              <span class="gallery-card__author">{{ cardModel(index).author }}</span>
              <span class="gallery-card__badge">{{ cardModel(index).tag }}</span>
            </div>
            <p class="gallery-card__title">
              Frame {{ index.toLocaleString() }} — {{ cardModel(index).tag }} study,
              {{ cardModel(index).frames > 1 ? `${cardModel(index).frames} shots` : 'single shot' }}
            </p>
            <div class="gallery-card__actions">
              <button type="button" :class="{ 'is-liked': isLiked(index) }" @click="toggleLike(index)">
                {{ isLiked(index) ? '♥' : '♡' }} {{ cardModel(index).likes + (isLiked(index) ? 1 : 0) }}
              </button>
              <span>#{{ index.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </template>
    </CeriousScroll>

    <div class="demo-footer">
      <span>Total: <strong>{{ total.toLocaleString() }}</strong></span>
      <span>Determinism: <strong>canonical</strong></span>
      <span>Images: <strong>reserved + prefetched</strong></span>
    </div>
  </div>
</template>

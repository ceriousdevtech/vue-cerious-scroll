<script setup lang="ts">
import { DEMOS } from './registry';
</script>

<template>
  <div class="gallery">
    <router-link class="feature" to="/benchmark">
      <div class="feature__main">
        <span class="feature__tag">Live benchmark</span>
        <h1 class="feature__title">Measure it yourself</h1>
        <p class="feature__blurb">
          Not a demo. A reproducible harness that runs in your browser and measures the
          <code>&lt;CeriousScroll&gt;</code> component itself, so the numbers include Vue&apos;s own
          render work. Compared against the same rows rendered with a plain <code>v-for</code> and no
          virtualiser. Export the numbers as CSV, JSON or Markdown.
        </p>
        <span class="feature__cta">Open the benchmark →</span>
      </div>
      <div class="feature__facts">
        <div><b>1K → 10M</b><span>dataset sweep</span></div>
        <div><b>4 → 61</b><span>DOM nodes per row</span></div>
        <div><b>Control group</b><span>unvirtualized v-for</span></div>
      </div>
    </router-link>
    <p class="gallery__lead">
      High-performance virtual scrolling across real-world UIs — every row is measured (never
      estimated), with O(1) memory. Pick a demo:
    </p>
    <div class="gallery__grid">
      <router-link
        v-for="d in DEMOS"
        :key="d.slug"
        :to="`/${d.slug}`"
        class="demo-card"
      >
        <div class="demo-card__emoji">{{ d.emoji }}</div>
        <div class="demo-card__title">{{ d.title }}</div>
        <p class="demo-card__blurb">{{ d.blurb }}</p>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEMOS } from './registry';
</script>

<template>
  <div class="gallery">
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

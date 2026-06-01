<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import FpsMeter from './FpsMeter.vue';

const route = useRoute();
const onGallery = computed(() => route.path === '/' || route.path === '');
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <router-link class="topbar__brand" to="/">
        CeriousScroll <small>Vue demos</small>
      </router-link>
      <div class="topbar__spacer" />
      <FpsMeter />
      <router-link v-if="!onGallery" class="topbar__link" to="/">← All demos</router-link>
      <a
        class="topbar__link"
        href="https://www.npmjs.com/package/@ceriousdevtech/vue-cerious-scroll"
        target="_blank"
        rel="noreferrer"
        >npm ↗</a
      >
    </header>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

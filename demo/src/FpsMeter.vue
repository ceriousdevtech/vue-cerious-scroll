<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Live frame-rate meter. Measures the *true* paint cadence with a
 * `requestAnimationFrame` loop: when the main thread is busy (e.g. a heavy
 * scroll render) frame callbacks are delayed and the number drops, so this
 * reflects how smoothly the scroller is actually running.
 */
const fps = ref(0);
let raf = 0;
let frames = 0;
let last = 0;

const loop = (now: number): void => {
  frames++;
  const elapsed = now - last;
  if (elapsed >= 500) {
    fps.value = Math.round((frames * 1000) / elapsed);
    frames = 0;
    last = now;
  }
  raf = requestAnimationFrame(loop);
};

onMounted(() => {
  last = performance.now();
  raf = requestAnimationFrame(loop);
});
onBeforeUnmount(() => cancelAnimationFrame(raf));

const tier = computed(() => (fps.value >= 55 ? 'good' : fps.value >= 30 ? 'ok' : 'bad'));
</script>

<template>
  <span class="fps-meter" :class="`fps-meter--${tier}`" title="Live frames per second">
    <span class="fps-meter__value">{{ fps }}</span>
    <span class="fps-meter__unit">FPS</span>
  </span>
</template>

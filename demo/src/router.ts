import { createRouter, createWebHashHistory } from 'vue-router';

import Layout from './Layout.vue';
import Gallery from './Gallery.vue';
import { DEMOS } from './registry';
import BenchmarkDemo from './demos/BenchmarkDemo.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      children: [
        { path: '', component: Gallery },
        // Standalone: the benchmark is not one of the demos, so it is routed
        // directly rather than coming from the DEMOS registry.
        { path: 'benchmark', component: BenchmarkDemo },
        ...DEMOS.map((d) => ({ path: d.slug, component: d.component })),
        { path: ':pathMatch(.*)*', redirect: '/' },
      ],
    },
  ],
});

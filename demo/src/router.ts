import { createRouter, createWebHashHistory } from 'vue-router';

import Layout from './Layout.vue';
import Gallery from './Gallery.vue';
import { DEMOS } from './registry';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      children: [
        { path: '', component: Gallery },
        ...DEMOS.map((d) => ({ path: d.slug, component: d.component })),
        { path: ':pathMatch(.*)*', redirect: '/' },
      ],
    },
  ],
});

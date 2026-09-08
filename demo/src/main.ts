import { createApp } from 'vue';

// Import base/global styles FIRST so per-demo CSS (pulled in transitively via the
// router/registry below) is injected after it and can override shared rules of
// equal specificity — e.g. a demo's dark `.code-scroll` background over
// `.demo-scroll`.
import './app.css';

import App from './App.vue';
import { initAnalytics, trackPageView } from './analytics';
import { router } from './router';

createApp(App).use(router).mount('#app');

initAnalytics();
// Hash routing means GA4's automatic page_view only ever sees the landing page,
// so every route change is reported explicitly.
router.afterEach((to) => trackPageView(to.path));

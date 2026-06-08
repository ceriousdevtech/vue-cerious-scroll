/**
 * Single source of truth for the demo gallery: each entry drives both a gallery
 * card and a route. Add a demo here and it shows up everywhere.
 */
import type { Component } from 'vue';

import BasicDemo from './demos/BasicDemo.vue';
import ComparisonDemo from './demos/ComparisonDemo.vue';
import DataGridDemo from './demos/DataGridDemo.vue';
import TableDemo from './demos/TableDemo.vue';
import ChatDemo from './demos/ChatDemo.vue';
import LogViewerDemo from './demos/LogViewerDemo.vue';
import CodeViewerDemo from './demos/CodeViewerDemo.vue';
import EcommerceDemo from './demos/EcommerceDemo.vue';
import FinanceDemo from './demos/FinanceDemo.vue';
import GitHistoryDemo from './demos/GitHistoryDemo.vue';
import SqlResultsDemo from './demos/SqlResultsDemo.vue';

export interface DemoMeta {
  slug: string;
  title: string;
  emoji: string;
  blurb: string;
  component: Component;
}

export const DEMOS: DemoMeta[] = [
  {
    slug: 'comparison',
    title: 'vs TanStack Virtual',
    emoji: '⚔️',
    blurb:
      'Side-by-side stress test against @tanstack/vue-virtual across 5 scenarios: dynamic heights, expanding rows, async images, millions of rows, and continuous updates.',
    component: ComparisonDemo,
  },
  {
    slug: 'basic',
    title: 'Basic / Vanilla',
    emoji: '🧱',
    blurb:
      'Configurable dataset size (up to 1,000,000), fixed/variable heights, jump-to-row and live stats.',
    component: BasicDemo,
  },
  {
    slug: 'data-grid',
    title: 'Data Grid',
    emoji: '📊',
    blurb: 'Multi-column grid with sortable headers, live search, and Ctrl/Cmd multi-select.',
    component: DataGridDemo,
  },
  {
    slug: 'table',
    title: 'Native Table',
    emoji: '🧮',
    blurb: "Real <table>/<tr>/<td> rows via layout:'table' — frozen header, aligned columns, single tbody transform. Virtualizes millions of rows with ~25 DOM rows.",
    component: TableDemo,
  },
  {
    slug: 'chat',
    title: 'Chat Messages',
    emoji: '💬',
    blurb: 'Variable-height message bubbles, sent/received styling, and auto-scroll on send.',
    component: ChatDemo,
  },
  {
    slug: 'log-viewer',
    title: 'Log Viewer',
    emoji: '📜',
    blurb: 'System logs with level filtering, live search, and color-coded severities.',
    component: LogViewerDemo,
  },
  {
    slug: 'code-viewer',
    title: 'Code Viewer',
    emoji: '👨‍💻',
    blurb: 'Syntax-highlighted source with line numbers and find-in-file jump.',
    component: CodeViewerDemo,
  },
  {
    slug: 'ecommerce',
    title: 'E-commerce',
    emoji: '🛍️',
    blurb: 'Product catalog with ratings, prices, stock state, and an add-to-cart counter.',
    component: EcommerceDemo,
  },
  {
    slug: 'finance',
    title: 'Financial Trading',
    emoji: '📈',
    blurb: 'Real-time stock ticker with streaming prices, % change, and sparklines.',
    component: FinanceDemo,
  },
  {
    slug: 'git-history',
    title: 'Git History',
    emoji: '🌿',
    blurb: 'Commit log with authors, branches, and click-to-expand changed files (variable height).',
    component: GitHistoryDemo,
  },
  {
    slug: 'sql-results',
    title: 'SQL Results',
    emoji: '🗄️',
    blurb: 'Query result viewer with column headers, status badges, and row selection.',
    component: SqlResultsDemo,
  },
];

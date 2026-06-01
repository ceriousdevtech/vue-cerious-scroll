/**
 * Deterministic git-history data. Shared across React, Vue, and Angular demos.
 */
import { pick, rand, randInt } from '../lib/random';

export const GIT_TOTAL = 100_000;

const AUTHORS = [
  { name: 'Alice Chen', color: '#667eea' },
  { name: 'Bob Smith', color: '#d6336c' },
  { name: 'Carol Davis', color: '#1c7ed6' },
  { name: 'David Kim', color: '#2f9e44' },
  { name: 'Emma Wilson', color: '#e8590c' },
  { name: 'Frank Brown', color: '#0ca678' },
];
const BRANCHES = ['main', 'develop', 'feature/auth', 'feature/ui', 'hotfix/cache', 'release/2.0'];
const VERBS = ['Add', 'Fix', 'Refactor', 'Update', 'Remove', 'Optimize', 'Document', 'Test'];
const SUBJECTS = [
  'viewport renderer', 'height cache', 'scroll engine', 'native scrollbar', 'keyboard nav',
  'touch handling', 'resize observer', 'demo gallery', 'README', 'CI pipeline', 'type defs',
];
const FILES = [
  'src/cerious-scroll.ts', 'src/viewport-renderer.ts', 'src/performance-cache.ts',
  'src/native-scrollbar.ts', 'demo/App.tsx', 'README.md', 'package.json', 'tests/scroll.test.ts',
];

export interface GitFile {
  name: string;
  add: number;
  del: number;
}

export interface Commit {
  index: number;
  hash: string;
  author: { name: string; color: string; initials: string };
  message: string;
  branch: string;
  time: string;
  add: number;
  del: number;
  files: GitFile[];
}

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('');
}

export function makeCommit(index: number): Commit {
  const a = pick(AUTHORS, index, 1);
  const hash = (rand(index, 2).toString(16) + rand(index, 3).toString(16)).replace('0.', '').slice(0, 7).padEnd(7, '0');
  const message = `${pick(VERBS, index, 4)} ${pick(SUBJECTS, index, 5)}`;
  const fileCount = randInt(index, 1, 4, 6);
  const files: GitFile[] = [];
  let add = 0;
  let del = 0;
  for (let f = 0; f < fileCount; f++) {
    const fa = randInt(index, 0, 90, 10 + f);
    const fd = randInt(index, 0, 40, 30 + f);
    add += fa;
    del += fd;
    files.push({ name: pick(FILES, index + f * 7, 8), add: fa, del: fd });
  }
  const minsAgo = (GIT_TOTAL - index) * 17;
  return {
    index,
    hash,
    author: { name: a.name, color: a.color, initials: initials(a.name) },
    message,
    branch: pick(BRANCHES, index, 9),
    time: relativeTime(minsAgo),
    add,
    del,
    files,
  };
}

function relativeTime(minsAgo: number): string {
  if (minsAgo < 60) return `${minsAgo}m ago`;
  const hours = Math.floor(minsAgo / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

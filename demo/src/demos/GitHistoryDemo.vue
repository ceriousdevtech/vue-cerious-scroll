<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import { GIT_TOTAL, makeCommit, type GitFile } from './git.data';
import './git.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const expanded = ref<Set<number>>(new Set());

function toggle(i: number): void {
  const next = new Set(expanded.value);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  expanded.value = next;
  // The row's reactive effect re-renders it (show/hide files); the engine's
  // content observer detects the height change and reflows. No recalculate.
}

const commit = (i: number) => makeCommit(i);
const aCount = (f: GitFile) => Math.min(5, Math.ceil(f.add / 18));
const dCount = (f: GitFile) => Math.min(5, Math.ceil(f.del / 12));
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>🌿 Commit History</h1>
      <p>{{ GIT_TOTAL.toLocaleString() }} commits — click any commit to expand its changed files.</p>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll git-scroll"
      :total-elements="GIT_TOTAL"
      :get-item="(i: number) => i"
    >
      <template #item="{ item: i }">
        <div class="commit" @click="toggle(i)">
          <div class="commit__row">
            <span class="commit__avatar" :style="{ background: commit(i).author.color }">{{ commit(i).author.initials }}</span>
            <span class="commit__main">
              <div class="commit__msg">{{ commit(i).message }}</div>
              <div class="commit__sub">
                <span class="commit__branch">{{ commit(i).branch }}</span>
                <span>{{ commit(i).author.name }}</span>
                <span class="commit__hash">{{ commit(i).hash }}</span>
                <span>· {{ commit(i).time }}</span>
              </div>
            </span>
            <span class="commit__stat">
              <span class="git-add">+{{ commit(i).add }}</span> <span class="git-del">−{{ commit(i).del }}</span>
            </span>
          </div>
          <div v-if="expanded.has(i)" class="commit__files">
            <div v-for="(f, k) in commit(i).files" :key="k" class="commit__file">
              <span class="commit__file-name">{{ f.name }}</span>
              <span class="git-add">+{{ f.add }}</span>
              <span class="git-del">−{{ f.del }}</span>
              <span class="commit__bar">
                <i v-for="a in aCount(f)" :key="`a${a}`" class="a" />
                <i v-for="d in dCount(f)" :key="`d${d}`" class="d" />
              </span>
            </div>
          </div>
        </div>
      </template>
    </CeriousScroll>
  </div>
</template>

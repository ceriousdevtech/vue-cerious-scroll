import { defineComponent, h, inject, nextTick, provide } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CeriousScroll } from '../src';

/** Flush the requestAnimationFrame-deferred render(s). */
async function flushFrames(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, label: `Item ${i}` }));

interface Row {
  id: number;
  label: string;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<CeriousScroll>', () => {
  it('renders a bounded subset of rows from `items`', async () => {
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: { items, style: { height: '300px' } },
      slots: {
        item: ({ item }: { item: Row }) => h('div', { class: 'row' }, item.label),
      },
    });

    await flushFrames();

    const rows = wrapper.element.querySelectorAll('.row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(items.length);
    expect(wrapper.element.textContent).toContain('Item 0');

    wrapper.unmount();
  });

  it('emits `ready` once with the engine instance', async () => {
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: { items, style: { height: '300px' } },
      slots: {
        item: ({ item }: { item: Row }) => h('span', item.label),
      },
    });

    await flushFrames();

    const ready = wrapper.emitted('ready');
    expect(ready).toBeTruthy();
    expect(ready!.length).toBe(1);
    expect(ready![0]![0]).toBeTruthy();

    wrapper.unmount();
  });

  it('exposes imperative methods that jump to an element', async () => {
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: {
        items,
        // Disable the native scrollbar so its bidirectional sync doesn't nudge
        // the position after the jump (the engine's jumpToElement is exact).
        options: { attachScrollbar: false },
        style: { height: '300px' },
      },
      slots: {
        item: ({ item }: { item: Row }) => h('div', { class: 'row' }, item.label),
      },
    });

    await flushFrames();

    const vm = wrapper.vm as unknown as {
      jumpToElement: (i: number) => void;
      scroller: { currentElement: number } | null;
    };
    vm.jumpToElement(50);
    await flushFrames();

    expect(vm.scroller?.currentElement).toBe(50);
    expect(wrapper.element.textContent).toContain('Item 50');

    wrapper.unmount();
  });

  it('supports `totalElements` + `getItem` without an items array', async () => {
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: {
        totalElements: 1000,
        getItem: (index: number) => ({ id: index, label: `Row ${index}` }),
        style: { height: '300px' },
      },
      slots: {
        item: ({ item }: { item: Row }) => h('div', { class: 'row' }, item.label),
      },
    });

    await flushFrames();

    expect(wrapper.element.querySelectorAll('.row').length).toBeGreaterThan(0);
    expect(wrapper.element.textContent).toContain('Row 0');

    wrapper.unmount();
  });

  it('re-renders row content when the items reference changes', async () => {
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: { items, style: { height: '300px' } },
      slots: {
        item: ({ item }: { item: Row }) => h('div', { class: 'row' }, item.label),
      },
    });

    await flushFrames();
    expect(wrapper.element.textContent).toContain('Item 0');

    const renamed = items.map((it) => ({ ...it, label: `Renamed ${it.id}` }));
    await wrapper.setProps({ items: renamed });
    await flushFrames();

    expect(wrapper.element.textContent).toContain('Renamed 0');
    expect(wrapper.element.textContent).not.toContain('Item 0');

    wrapper.unmount();
  });

  it('unmounts cleanly without throwing', async () => {
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: { items, style: { height: '300px' } },
      slots: {
        item: ({ item }: { item: Row }) => h('div', item.label),
      },
    });

    await flushFrames();
    expect(() => wrapper.unmount()).not.toThrow();
  });

  it('invokes the `render-item` prop when no slot is provided', async () => {
    const renderItem = vi.fn((item: unknown) => h('div', { class: 'row' }, (item as Row).label));
    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      props: { items, renderItem, style: { height: '300px' } },
    });

    await flushFrames();

    expect(renderItem).toHaveBeenCalled();
    expect(wrapper.element.querySelectorAll('.row').length).toBeGreaterThan(0);

    wrapper.unmount();
  });

  // Regression: component-level `provide()` from the component that owns the
  // <CeriousScroll> slot must reach `inject()` inside virtualized rows. Rows are
  // rendered as detached vnode trees, so they previously saw only app-level
  // provides (issue #1).
  it('exposes the owner component\'s provide() values to inject() inside rows', async () => {
    const Child = defineComponent({
      name: 'Child',
      setup() {
        const value = inject<number>('number', -1);
        return () => h('div', { class: 'row' }, `value:${value}`);
      },
    });

    const Parent = defineComponent({
      name: 'Parent',
      setup() {
        provide('number', 5);
        return () =>
          h(
            CeriousScroll,
            { totalElements: 1, getItem: () => 1, style: { height: '300px' } },
            { item: () => h(Child) },
          );
      },
    });

    const wrapper = mount(Parent, { attachTo: document.body });
    await flushFrames();

    expect(wrapper.element.textContent).toContain('value:5');

    wrapper.unmount();
  });

  // App-level provides (app.provide / global plugins) must keep working too.
  it('exposes app-level provides to inject() inside rows', async () => {
    const Child = defineComponent({
      name: 'AppChild',
      setup() {
        const value = inject<string>('app-token', 'missing');
        return () => h('div', { class: 'row' }, `token:${value}`);
      },
    });

    const wrapper = mount(CeriousScroll, {
      attachTo: document.body,
      global: { provide: { 'app-token': 'ok' } },
      props: { totalElements: 1, getItem: () => 1, style: { height: '300px' } },
      slots: { item: () => h(Child) },
    });

    await flushFrames();

    expect(wrapper.element.textContent).toContain('token:ok');

    wrapper.unmount();
  });
});

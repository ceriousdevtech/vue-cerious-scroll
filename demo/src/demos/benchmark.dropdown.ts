/**
 * The benchmark's dropdown, lifted verbatim from the vanilla page.
 *
 * A native <select> renders its popup through the operating system, so its list
 * cannot be styled reliably and looks different on Windows, macOS and Linux.
 * This replaces it with an ordinary DOM listbox: every pixel comes from the
 * benchmark stylesheet, so all four builds — vanilla, React, Vue and Angular —
 * get an identical control.
 *
 * The native <select> stays in the document and remains the single source of
 * truth, so each framework's own value binding keeps working untouched.
 */
/* eslint-disable */
// ----------------------------------------------------------- dropdown
/**
 * Replace a native <select> with a DOM listbox.
 *
 * The reason is presentational, not stylistic: a <select>'s popup is drawn
 * by the operating system, which means its list cannot be styled reliably
 * and differs between Windows, macOS and Linux. Everything below is ordinary
 * markup, so every platform gets the same control.
 *
 * The native element stays in the document and remains the single source of
 * truth. Reading `select.value`, assigning to it, or dispatching `change`
 * all behave exactly as before, so nothing else on the page had to change.
 */
export function enhanceSelect(select: HTMLSelectElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'dd';
  select.parentNode?.insertBefore(wrap, select);
  wrap.appendChild(select);
  select.classList.add('dd__native');
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-hidden', 'true');

  const caption = wrap.parentElement?.querySelector('span');
  const listId = 'ddlist-' + (select.id || Math.random().toString(36).slice(2));

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dd__button';
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', listId);
  if (caption) button.setAttribute('aria-label', caption.textContent.trim());

  const label = document.createElement('span');
  label.className = 'dd__label';
  const chev = document.createElement('span');
  chev.className = 'dd__chev';
  button.append(label, chev);

  const panel = document.createElement('div');
  panel.className = 'dd__panel';
  panel.id = listId;
  panel.setAttribute('role', 'listbox');
  panel.hidden = true;

  wrap.append(button, panel);

  // Mirror the native option tree, groups included.
  const options: HTMLDivElement[] = [];
  Array.from(select.children).forEach((node) => {
    const el = node as HTMLOptGroupElement & HTMLOptionElement;
    if (node.tagName === 'OPTGROUP') {
      const g = document.createElement('div');
      g.className = 'dd__group';
      g.textContent = el.label;
      panel.appendChild(g);
      Array.from(node.children).forEach((o) => panel.appendChild(makeOption(o as HTMLOptionElement)));
    } else if (node.tagName === 'OPTION') {
      panel.appendChild(makeOption(el));
    }
  });

  function makeOption(optionEl: HTMLOptionElement): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'dd__opt';
    el.setAttribute('role', 'option');
    el.dataset.value = optionEl.value;
    el.textContent = optionEl.textContent;
    options.push(el);
    el.addEventListener('click', () => {
      choose(optionEl.value);
      close(true);
    });
    return el;
  }

  let activeIndex = 0;

  function syncFromNative(): void {
    const current = select.value;
    options.forEach((el, i) => {
      const on = el.dataset.value === current;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) activeIndex = i;
    });
    const selected = select.options[select.selectedIndex];
    label.textContent = selected ? selected.textContent : '';
  }

  function setActive(i: number): void {
    activeIndex = Math.max(0, Math.min(options.length - 1, i));
    options.forEach((el, k) => el.classList.toggle('is-active', k === activeIndex));
    const el = options[activeIndex];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function choose(value: string): void {
    if (select.value === value) return;
    select.value = value;
    syncFromNative();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function open(): void {
    if (select.disabled) return;
    // Open toward whichever side has more room, and never ask for more
    // height than that side actually has. Flipping up unconditionally just
    // moves the clipping from the bottom of the window to the top of it.
    const rect = button.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom - 14;
    const roomAbove = rect.top - 14;
    const up = roomBelow < 220 && roomAbove > roomBelow;
    wrap.classList.toggle('is-up', up);
    panel.style.maxHeight = Math.max(140, Math.min(288, up ? roomAbove : roomBelow)) + 'px';
    panel.hidden = false;
    wrap.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    setActive(activeIndex);
  }

  function close(focusButton: boolean): void {
    panel.hidden = true;
    wrap.classList.remove('is-open', 'is-up');
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  }

  const isOpen = () => !panel.hidden;

  button.addEventListener('click', () => { isOpen() ? close(false) : open(); });

  button.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen()) { open(); return; }
      if (e.key === 'ArrowDown') setActive(activeIndex + 1);
      else if (e.key === 'ArrowUp') setActive(activeIndex - 1);
      else { choose(options[activeIndex].dataset.value ?? ''); close(true); }
    } else if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Home' && isOpen()) {
      e.preventDefault(); setActive(0);
    } else if (e.key === 'End' && isOpen()) {
      e.preventDefault(); setActive(options.length - 1);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead, the one affordance people miss most when a native
      // select is replaced.
      const needle = e.key.toLowerCase();
      const from = isOpen() ? activeIndex + 1 : 0;
      for (let k = 0; k < options.length; k++) {
        const idx = (from + k) % options.length;
        if ((options[idx].textContent ?? '').trim().toLowerCase().startsWith(needle)) {
          if (!isOpen()) choose(options[idx].dataset.value ?? '');
          setActive(idx);
          break;
        }
      }
    }
  });

  document.addEventListener('pointerdown', (e: Event) => {
    if (isOpen() && !wrap.contains(e.target as Node)) close(false);
  });
  // Keep the button in step when the value is set from code.
  select.addEventListener('change', syncFromNative);
  // Mirror the disabled state the run lock puts on the native element.
  new MutationObserver(() => { button.disabled = select.disabled; })
    .observe(select, { attributes: true, attributeFilter: ['disabled'] });

  syncFromNative();
}

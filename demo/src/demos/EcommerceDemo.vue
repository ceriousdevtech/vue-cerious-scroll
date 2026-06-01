<script setup lang="ts">
import { ref } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import { makeProduct, SHOP_TOTAL, stars } from './shop.data';
import './shop.css';

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const cart = ref<Set<number>>(new Set());

function toggle(index: number): void {
  const next = new Set(cart.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  cart.value = next;
  // Rows re-render reactively (button state updates on their own).
}

function clearCart(): void {
  cart.value = new Set();
}

const p = (i: number) => makeProduct(i);
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__header">
      <h1>🛍️ Product Catalog</h1>
      <p>{{ SHOP_TOTAL.toLocaleString() }} products with ratings and add-to-cart.</p>
    </div>

    <div class="demo-toolbar">
      <span class="stat">🛒 Cart: <strong>{{ cart.size }}</strong> item{{ cart.size === 1 ? '' : 's' }}</span>
      <span class="spacer" />
      <button type="button" @click="clearCart" :disabled="cart.size === 0">Clear cart</button>
    </div>

    <CeriousScroll
      ref="scroll"
      class="demo-scroll shop-scroll"
      :total-elements="SHOP_TOTAL"
      :get-item="(i: number) => i"
    >
      <template #item="{ item: i }">
        <div class="product">
          <div class="product__img" :style="{ background: p(i).gradient }">{{ p(i).emoji }}</div>
          <div class="product__body">
            <div class="product__name">{{ p(i).name }}</div>
            <div class="product__cat">{{ p(i).category }}</div>
            <div class="product__rating">
              {{ stars(p(i).rating) }} <small>{{ p(i).rating.toFixed(1) }} · {{ p(i).reviews.toLocaleString() }} reviews</small>
            </div>
          </div>
          <div class="product__aside">
            <div class="product__price">${{ p(i).price.toFixed(2) }}</div>
            <div v-if="p(i).prime" class="product__prime">✓ Prime</div>
            <div v-if="!p(i).inStock" class="product__stock">Out of stock</div>
            <button
              v-else
              type="button"
              class="product__add"
              :class="{ 'in-cart': cart.has(i) }"
              @click="toggle(i)"
            >
              {{ cart.has(i) ? 'In cart ✓' : 'Add to cart' }}
            </button>
          </div>
        </div>
      </template>
    </CeriousScroll>

    <div class="demo-footer">
      <span>In cart: <strong>{{ cart.size }}</strong></span>
      <span>Click “Add to cart” on any product</span>
    </div>
  </div>
</template>

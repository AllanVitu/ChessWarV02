<script setup lang="ts">
import { RouterLink } from 'vue-router'

type NavItem = {
  label: string
  to: string
}

const props = withDefaults(
  defineProps<{
    items: NavItem[]
    brandLabel: string
    brandTo?: string
    brandLogo?: string
  }>(),
  {
    brandTo: '/intro',
    brandLogo: '',
  },
)
</script>

<template>
  <header class="app-navbar">
    <RouterLink class="app-navbar__brand" :to="props.brandTo">
      <span v-if="props.brandLogo" class="app-navbar__logo">
        <img
          :src="props.brandLogo"
          :alt="props.brandLabel"
          width="24"
          height="24"
          loading="lazy"
          decoding="async"
        />
      </span>
      <span class="app-navbar__title">{{ props.brandLabel }}</span>
    </RouterLink>

    <nav class="app-navbar__links" aria-label="Navigation principale">
      <RouterLink
        v-for="item in props.items"
        :key="item.label"
        class="app-navbar__link"
        active-class="app-navbar__link--active"
        :to="item.to"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="app-navbar__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script lang="ts">
  import { onMount } from 'svelte';

  let visible = $state(false);

  onMount(() => {
    const onScroll = (): void => {
      visible = window.scrollY > 300;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });

  function scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<button
  type="button"
  aria-label="Scroll to top"
  onclick={scrollTop}
  class="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300"
  class:opacity-0={!visible}
  class:pointer-events-none={!visible}
  class:opacity-100={visible}
  style="background-color: var(--color-secondary);"
>
  <span
    class="material-symbols-outlined font-bold"
    style="color: var(--color-primary);"
    translate="no"
  >
    arrow_upward
  </span>
</button>

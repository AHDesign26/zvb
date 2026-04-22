<script lang="ts">
  interface NavItem {
    label: string;
    href: string;
  }

  interface Props {
    items: NavItem[];
    phone: string;
    phoneHref: string;
    ctaLabel: string;
    ctaHref: string;
  }

  let { items, phone, phoneHref, ctaLabel, ctaHref }: Props = $props();

  let open = $state(false);

  function toggle(): void {
    open = !open;
  }

  function close(): void {
    open = false;
  }
</script>

<button
  type="button"
  class="md:hidden text-primary p-2"
  aria-label="Toggle menu"
  aria-expanded={open}
  onclick={toggle}
>
  <span class="material-symbols-outlined text-3xl leading-none" translate="no">
    {open ? 'close' : 'menu'}
  </span>
</button>

{#if open}
  <div
    class="flex flex-col absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl border-b border-indigo-200/30 shadow-xl shadow-indigo-900/5"
  >
    {#each items as item (item.href)}
      <a
        class="text-indigo-900 font-['Inter'] font-medium px-6 py-4 border-b border-indigo-100 block"
        href={item.href}
        onclick={close}
      >
        {item.label}
      </a>
    {/each}
    <a
      href={phoneHref}
      class="flex items-center gap-2 text-indigo-900 font-['Inter'] font-medium px-6 py-4 border-b border-indigo-100"
      onclick={close}
    >
      <span class="material-symbols-outlined text-xl" translate="no">call</span>
      {phone}
    </a>
    <div class="px-6 py-4">
      <a
        href={ctaHref}
        class="block w-full bg-primary text-white px-6 py-4 rounded-lg font-label font-bold text-sm hover:bg-primary/90 transition-all text-center"
        onclick={close}
      >
        {ctaLabel}
      </a>
    </div>
  </div>
{/if}

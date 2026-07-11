<script lang="ts">
  let { on = false, onchange }: { on?: boolean; onchange?: () => void } = $props();
</script>

<button
  class="tg"
  class:on
  onclick={onchange}
  role="switch"
  aria-checked={on}
>
  <span class="knob"></span>
</button>

<style>
  .tg {
    position: relative;
    width: 46px;
    height: 27px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
    transition: background 0.18s;
  }
  .tg.on {
    background: var(--grad);
  }
  .knob {
    position: absolute;
    top: 2.5px;
    left: 2.5px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.18s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .tg.on .knob {
    left: 22px;
  }
</style>

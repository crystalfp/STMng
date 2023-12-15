<script setup lang="ts">
/**
 * @component
 * Button that shows running indicator as a barber pole, changing when the process finish.
 */

// > Properties & events
// If not assigned to props, makes all the props accessible (as below)
defineProps<{

    /** Label for the process running */
    runningLabel: string;

    /** Label for process end */
    finishLabel: string;

    /** Change indicator to show the process has finished */
    finish: boolean;

    /** Tooltip for the button in running state */
    runningTooltip: string;

    /** Tooltip for the button when process finished */
    finishTooltip: string;
}>();

const emit = defineEmits<{
    /** The indicator button has been pressed */
    "close": [];
}>();

</script>


<template>
<button v-tooltip="{content: finish ? finishTooltip : runningTooltip, placement: 'top-end'}"
        class="barber-common" :class="finish ? 'barber-finish' : 'barber-pole'" @click="emit('close')">
  {{ finish ? finishLabel : runningLabel }}
</button>
</template>


<style scoped lang="scss">

.barber-common {
  color: black;
  font-size: .9rem;
  font-weight: bold;
  width: 170px;
  text-shadow: none;
}

.barber-pole {
  background-image: repeating-linear-gradient(120deg, #7579fd, #7579fd 20px, #eeeeee 20px, #eeeeee 40px);
  // Expanded the size of the image to prevent visual blips when animation loop repeats
  background-size: 5000%;
  animation: animated-background 200s linear infinite;

  @keyframes animated-background {
    from { background-position: 0 0; }
    to { background-position: -100% 0; }
  }
}

.barber-finish {
  animation: none;
  background-image: none;
  background-color: green;
}
</style>

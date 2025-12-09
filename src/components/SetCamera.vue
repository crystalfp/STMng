<script setup lang="ts">
/**
 * @component
 * Control to reset the camera and change view direction
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-09
 */
import {ref, watch, computed} from "vue";
import {mdiAlphaXBoxOutline, mdiAlphaABoxOutline, mdiAlphaHBoxOutline,
        mdiPlusMinusVariant} from "@mdi/js";
import {useControlStore} from "@/stores/controlStore";

const controlStore = useControlStore();

const showPanel = ref(0);
const setCd = (direction: string): void => {

    const vd = controlStore.viewDirection;
    let sign = vd[0] ?? "-";
    let axis = vd[1] ?? "z";
    if(direction === "s") {
        sign = sign === "+" ? "-" : "+";
    }
    else {
        axis = direction;
    }
    controlStore.viewDirection = sign + axis;
};

const lookAxis = ref("z");
watch(lookAxis, (after) => {

    switch(after) {
        case "r":
            controlStore.reset = true;
            controlStore.viewDirection = "";
            break;
        case "0":
            showPanel.value = 1;
            break;
        case "1":
            showPanel.value = hasCell.value ? 2 : 0;
            break;
        case "2":
            showPanel.value = 0;
            break;
        case "":
            return;
        default:
            setCd(after);
            break;
    }
    lookAxis.value = "";
});

const hasCell = computed(() => controlStore.basis.some((b) => b !== 0));

</script>


<template>
<v-row class="justify-center w-100">
  <v-spacer />
  <v-col v-if="showPanel===0">
    <v-btn-toggle v-model="lookAxis" mandatory variant="text" :divided="false"
                  rounded="0" class="muted" density="compact">
      <v-btn value="0" :icon="mdiAlphaXBoxOutline"/>
      <v-btn value="r">Reset camera</v-btn>
    </v-btn-toggle>
  </v-col>
  <v-col v-if="showPanel===1">
    <v-btn-toggle v-model="lookAxis" mandatory variant="text" :divided="false"
                  rounded="0" class="muted" density="compact">
      <v-btn value="1" :icon="hasCell ? mdiAlphaABoxOutline : mdiAlphaHBoxOutline"/>
      <v-btn value="x">X</v-btn>
      <v-btn value="y">Y</v-btn>
      <v-btn value="z">Z</v-btn>
      <v-btn value="s" :icon="mdiPlusMinusVariant"/>
    </v-btn-toggle>
  </v-col>
  <v-col v-if="showPanel===2">
    <v-btn-toggle v-model="lookAxis" mandatory variant="text" :divided="false"
                  rounded="0" class="muted" density="compact">
      <v-btn value="2" :icon="mdiAlphaHBoxOutline"/>
      <v-btn value="a">a</v-btn>
      <v-btn value="b">b</v-btn>
      <v-btn value="c">c</v-btn>
      <v-btn value="s" :icon="mdiPlusMinusVariant"/>
    </v-btn-toggle>
  </v-col>
  <v-spacer />
</v-row>
</template>


<style scoped>
.muted {
  color: rgb(var(--v-theme-primary), var(--v-medium-emphasis-opacity)) !important
}
</style>

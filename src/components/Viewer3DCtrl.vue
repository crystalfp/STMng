<script setup lang="ts">

// import {ref} from "vue";
import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

const changeSceneColor = (): void => {

    configStore.scene.background = configStore.scene.background === "skyblue" ? "maroon" : "skyblue";
};

</script>


<template>
<div class="viewer-ctrl-container">
    <button @click="changeSceneColor">Change scene color</button><br>
    <input id="show-axis" v-model="configStore.scene.showAxis" type="checkbox">
    <label for="show-axis"> Show axis</label><br>
    <input id="show-grid" v-model="configStore.scene.showGrid" type="checkbox">
    <label for="show-grid"> Show grid</label><br>
</div>
</template>


<style scoped lang="scss">

@use "@/styles/colors";
@use "@/styles/fonts";

.viewer-ctrl-container {
    width: 100%;
    height: 100%;
    background-color: aquamarine;
}

label {
    color: black;
}
</style>

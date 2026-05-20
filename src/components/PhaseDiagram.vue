<script setup lang="ts">
/**
 * @component
 * Phase transition diagram for variable composition analysis
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-20
 */
import {ref} from "vue";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {Timeline} from "@unovis/ts";
import {VisXYContainer, VisAxis, VisTimeline, VisTooltip} from "@unovis/vue";
import type {CtrlParams} from "@/types";
import type {VariableTransitionTable} from "@/electron/analysis/EnthalpyTransitionsVariable";

/**
 * Chart data
 * @notExported
 */
interface DataRecord {
    /** X value */
    pl: number;
    /** Y value */
    ph: number;
    /** Formula without subscripts */
    specie: string;
    /** Corresponding step in the loaded sequence */
    step: number;
    /** Chemical formula */
    formula: string;
}

const range = ref<DataRecord[]>([]);
const lineHeight = ref(30);

const windowPath = "/phase-diagram";

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    const tableRaw = params.transitions as string;
    if(!tableRaw) return;
    const table = JSON.parse(tableRaw) as VariableTransitionTable;

    const species = new Set<string>();
    range.value.length = 0;
    const len = table.pressures.length;
    for(let i=0; i < len; ++i) {
        const [pl, ph] = table.pressures[i];
        for(let j=0; j < table.formulas[i].length; ++j) {
            const formula = table.formulas[i][j];
            const step = table.steps[i][j];
            const specie = formula.replaceAll(/<\/?sub>/gu, "");
            range.value.push({
                pl,
                ph,
                specie,
                step,
                formula
            });
            species.add(specie);
        }
    }
    lineHeight.value = Math.floor(742/species.size);
});

const xp = (d: DataRecord): number => d.pl;
const lp = (d: DataRecord): number => d.ph-d.pl;
const sp = (d: DataRecord): string => d.specie;


const triggerFunction = (d: DataRecord): string => {

    return `
        <b>${d.formula}</b> (step: ${d.step})<br>
        Pressure range: ${d.pl.toFixed(1)} ... ${d.ph.toFixed(1)}
    `;
};

const triggers = {
    [Timeline.selectors.line]: triggerFunction
};
</script>


<template>
<v-app :theme>
  <div class="phase-portal">
    <VisXYContainer :margin="{right: 20, top: 20, left: 20, bottom: 20}"
                    :duration="0" :data="range" class="phase-viewer">
      <VisTimeline :x="xp" :length="lp" :type="sp" :showLabels="true" :alternatingRowColors="true"
      :rowHeight="lineHeight" :showEmptySegments="true" :lineWidth="20" />
      <VisAxis type="x" :gridLine="false" label="Pressure (GPa)"
               labelColor="black" :labelFontSize="24" tickTextColor="black"
               :domainLine="false" :numTicks="21"/>
        <VisTooltip :triggers :followCursor="false" />
    </VisXYContainer>
    <v-container class="phase-buttons">
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

:deep(.rd) {
  text-align: right;
}

.phase-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 800px;
  padding: 0;
}

.phase-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
  background-color: #90CEEC;

  --vis-axis-tick-color: black;
  --vis-timeline-label-color: black;
}

.phase-buttons {
  display: flex;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  justify-content: end;
}
</style>

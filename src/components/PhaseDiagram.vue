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

/** Reordered data by formula */
interface CoalescingLine {
    /** Corresponding step */
    step: number;
    /** Lower pressure of the range */
    pl: number;
    /** Upper pressure of the range */
    ph: number;
    /** The formula (HTML) */
    formula: string;
}

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    const tableRaw = params.transitions as string;
    if(!tableRaw) return;
    const table = JSON.parse(tableRaw) as VariableTransitionTable;

    // Reorder data by formula
    const lines = new Map<string, CoalescingLine[]>();
    const len = table.pressures.length;
    for(let i=0; i < len; ++i) {
        const [pl, ph] = table.pressures[i];
        for(let j=0; j < table.formulas[i].length; ++j) {
            const formula = table.formulas[i][j];
            const name = formula.replaceAll(/<\/?sub>/gu, "");
            const step = table.steps[i][j];

            if(lines.has(name)) {
                const a = lines.get(name)!;
                a.push({step, pl, ph, formula});
            }
            else {
              lines.set(name, [{step, pl, ph, formula}]);
            }
        }
    }

    // Coalesce equal intervals
    range.value.length = 0;
    for(const [key, value] of lines) {

        const sv = value.toSorted((a, b) => a.pl - b.pl);
        let lastStep = -1;
        let lastPl = -200;
        let lastPh = 200;
        let lastFormula = "";
        for(const {step, pl, ph, formula} of sv) {

            if(lastStep < 0) {
                lastStep = step;
                lastPl = pl;
                lastPh = ph;
                lastFormula = formula;
            }
            else if(step === lastStep && pl === lastPh) {
                lastPh = ph;
            }
            else {
                range.value.push({
                    pl: lastPl,
                    ph: lastPh,
                    specie: key,
                    step: lastStep,
                    formula: lastFormula
                });
                lastStep = step;
                lastPl = pl;
                lastPh = ph;
                lastFormula = formula;
            }
        }
        range.value.push({
            pl: lastPl,
            ph: lastPh,
            specie: key,
            step: lastStep,
            formula: lastFormula
        });
    }

    // Compute line height to fill the chart
    lineHeight.value = Math.max(Math.floor(742/lines.size), 25);
});

// Chart accessors
const xp = (d: DataRecord): number => d.pl;
const lp = (d: DataRecord): number => d.ph-d.pl;
const sp = (d: DataRecord): string => d.specie;

const triggerFunction = (d: DataRecord): string => {

    return `
        <b>${d.formula}</b> (step: ${d.step})<br>
        Pressure range: ${d.pl.toFixed(1)}\u2002\u22EF\u2002${d.ph.toFixed(1)}
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
      <VisTimeline :lineRow="sp" :x="xp" :lineDuration="lp" :showLabels="true"
                   :alternatingRowColors="true"
                   :rowHeight="lineHeight" :showEmptySegments="true"
                   :lineWidth="20" lineCursor="pointer" />
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
  --vis-timeline-line-stroke-width: 2;
}

.phase-buttons {
  display: flex;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  justify-content: end;
}
</style>

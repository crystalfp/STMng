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
import type {VariableTransitionTable,
             SummaryTableEntry} from "@/electron/analysis/EnthalpyTransitionsVariable";

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
    /** Indices */
    indices?: number[][];
}

const range = ref<DataRecord[]>([]);
const lineHeight = ref(30);
const summary = ref<SummaryTableEntry[]>([]);
const summaryLineHeight = ref(30);
const showSummary = ref(true);
const forceUpdate = ref(true);

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

let table: VariableTransitionTable;

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    const tableRaw = params.transitions as string;
    if(!tableRaw) return;
    table = JSON.parse(tableRaw) as VariableTransitionTable;

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

    // Prepare summary
    summary.value.length = 0;
    const summaryRaw = params.summary as string;
    if(!summaryRaw) {
        showSummary.value = false;
        return;
    }
    const summaryTable = JSON.parse(summaryRaw) as SummaryTableEntry[];

    for(const entry of summaryTable) {
        summary.value.push({
            xs: entry.xs,
            xe: entry.xe,
            label: entry.label,
            formula: entry.formula,
            key: entry.key,
            indices: entry.indices
        });
    }

    // Compute line height to fill the chart
    summaryLineHeight.value = Math.min(Math.max(Math.floor(742/summaryTable.length), 25), 50);

    forceUpdate.value = !forceUpdate.value;
});

// TBD
const selectedTitle = ref("");
const selectedEntries = ref<{id: number; formula: string; step: string}[]>([]);
const explainSummaryLine = (d: SummaryTableEntry): void => {

    selectedTitle.value = "Pressure range (GPa): " +
                          `${d.xs.toFixed(1)}\u2002\u27F7\u2002${d.xe.toFixed(1)}`;

    const key = d.key;

    const unique = new Map<string, Set<number>>();
    for(const idx of d.indices) {

        const formulas = table.formulas[idx[1]];
        const steps = table.steps[idx[1]];
        const keys = table.keys[idx[1]];
        const len = formulas.length;
        for(let i=0; i < len; ++i) {

            if(keys[i] !== key) continue;

            const formula = formulas[i];
            const step = steps[i];
            if(unique.has(formula)) {
                unique.get(formula)!.add(step);
            }
            else {
                unique.set(formula, new Set([step]));
            }
        }
    }

    selectedEntries.value.length = 0;
    let id = 0;
    for(const [formula, steps] of unique) {
        const s = [...steps].map((v) => v.toString()).join(", ");
        selectedEntries.value.push({id: id++, formula, step: s});
    }
};

// Chart accessors
const xp = (d: DataRecord): number => d.pl;
const lp = (d: DataRecord): number => d.ph-d.pl;
const sp = (d: DataRecord): string => d.specie;

/** Hover on a chart line */
const triggerFunction = (d: DataRecord): string => {

    return `
        <b>${d.formula}</b> (step: ${d.step})<br>
        Pressure range: ${d.pl.toFixed(1)}\u2002\u27F7\u2002${d.ph.toFixed(1)}
    `;
};

const triggers = {
    [Timeline.selectors.line]: triggerFunction
};

// Summary chart accessors
const xs = (d: SummaryTableEntry): number => d.xs;
const ls = (d: SummaryTableEntry): number => d.xe-d.xs;
const ss = (d: SummaryTableEntry): string => d.label;

/** Hover on a summary chart line */
const summaryTriggerFunction = (d: SummaryTableEntry): string => {

    return `
        <b>${d.formula}</b><br>
        Pressure range: ${d.xs.toFixed(1)}\u2002\u27F7\u2002${d.xe.toFixed(1)}
    `;
};

const summaryTriggers = {
    [Timeline.selectors.line]: summaryTriggerFunction
};

/** Click on a chart line */
const summaryEvents = {
    [Timeline.selectors.line]: {
        click: explainSummaryLine
    }
};

/** Unify chart margins */
const chartMargins = ref({right: 10, top: 70, left: 10, bottom: 10});

const body = document.querySelector("body")!;

</script>


<template>
<v-app :theme>
  <div class="phase-portal">
    <VisXYContainer v-if="showSummary" :margin="chartMargins"
                    :xDomainMinConstraint="[undefined, -200]"
                    :xDomainMaxConstraint="[200, undefined]"
                    :duration="0" :data="summary" class="phase-viewer">
      <VisTimeline :key="forceUpdate" :lineRow="ss" :x="xs" :lineDuration="ls"
                   :showLabels="true" :alternatingRowColors="true"
                   :rowHeight="summaryLineHeight" :showEmptySegments="true"
                   :lineWidth="20" lineCursor="pointer" :events="summaryEvents" />
      <VisAxis type="x" :gridLine="false" label="Pressure (GPa)"
               :labelFontSize="24" :domainLine="false" :numTicks="21"/>
      <VisTooltip :triggers="summaryTriggers" :followCursor="true" :container="body" />
    </VisXYContainer>
    <VisXYContainer v-else :margin="chartMargins"
                    :xDomainMinConstraint="[undefined, -200]"
                    :xDomainMaxConstraint="[200, undefined]"
                    :duration="0" :data="range" class="phase-viewer">
      <VisTimeline :key="forceUpdate" :lineRow="sp" :x="xp" :lineDuration="lp"
                   :showLabels="true" :alternatingRowColors="true"
                   :rowHeight="lineHeight" :showEmptySegments="true"
                   :lineWidth="20" lineCursor="pointer" />
      <VisAxis type="x" :gridLine="false" label="Pressure (GPa)"
               :labelFontSize="24" :domainLine="false" :numTicks="21"/>
      <VisTooltip :triggers :followCursor="true" :container="body" />
    </VisXYContainer>
    <v-container class="phase-table">
      <v-label class="mb-4 text-title-medium no-select" :text="selectedTitle" />
      <div class="phase-table-container">
        <v-table v-if="selectedEntries.length > 0" class="pa-2">
          <tr v-for="e of selectedEntries" :key="e.id">
            <td class="c1" v-html="e.formula"></td>
            <td>{{ e.step }}</td>
          </tr>
        </v-table>
      </div>
    </v-container>
    <v-container class="phase-buttons">
      <v-switch v-model="showSummary" label="Show Summary"/>
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

:deep(sub) {
  position: relative;
  bottom: -0.2rem;
}

.phase-portal {
  display: grid;
  gap: 0;
  /* grid-auto-flow: row; */
  grid-template:
    "bb aa" 1fr
    "cc cc" 65px / 1fr 400px;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
}

.phase-viewer {
  grid-area: bb;
  /* background-color: #90CEEC; */
  height: 100vh;

  --vis-axis-tick-color: light-dark(black, white);
  --vis-axis-label-color: light-dark(black, white);
  --vis-axis-tick-label-color: light-dark(black, white);
  --vis-timeline-label-color: light-dark(black, white);
  --vis-timeline-line-stroke-width: 2;
}

.phase-table {
  grid-area: aa;
  padding: 80px 0 0 10px;
}

.phase-table-container {
  overflow-y: auto;
  margin-top: 10px;
  height: 90%;
}

.c1 {
    width: 110px
}

.phase-buttons {
  grid-area: cc;
  display: flex;
  max-width: 3000px !important;
  column-gap: 30px;
  justify-content: end;
  padding: 0 10px;
  align-items: center;
  background-color: rgb(var(--v-theme-background));
  width:100vw
}

</style>

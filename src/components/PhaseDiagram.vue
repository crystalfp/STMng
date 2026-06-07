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

/** Title and content of the lateral table */
const selectedTitle = ref("");
const selectedEntries = ref<{id: number; formula: string; step: string}[]>([]);

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

/**
 * Fill the table with the values of the clicked summary line
 *
 * @param d - Data of the clicked line
 */
const explainSummaryLine = (d: SummaryTableEntry): void => {

    selectedTitle.value = "Pressure range (GPa): " +
                          `${d.xs.toFixed(1)}\u2002\u27F7\u2002${d.xe.toFixed(1)}`;

    // Group the elements with the same key
    const grouping = new Map<string, Set<number>>();
    for(const [i, j] of d.indices) {
        const f = table.formulas[i][j];
        const s = table.steps[i][j];
        if(grouping.has(f)) {
            grouping.get(f)!.add(s);
        }
        else {
            grouping.set(f, new Set<number>([s]));
        }
    }

    selectedEntries.value.length = 0;
    let id = 0;
    for(const [formula, steps] of grouping) {
        const s = [...steps].map((v) => v.toString()).join(", ");
        selectedEntries.value.push({id: id++, formula, step: s});
    }
};

/**
 * Reset table to empty when changing type of diagram
 */
const resetTable = (): void => {
    selectedTitle.value = "";
    selectedEntries.value.length = 0;
};

/**
 * Fill the table with the values of the clicked details line
 *
 * @param d - Data of the clicked line
 */
const explainDetailsLine = (d: DataRecord): void => {

    selectedTitle.value = "Pressure range (GPa): " +
                          `${d.pl.toFixed(1)}\u2002\u27F7\u2002${d.ph.toFixed(1)}`;

    // TBD
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

/** Click on a summary chart line */
const summaryEvents = {
    [Timeline.selectors.line]: {
        click: explainSummaryLine
    }
};

/** Click on a detail chart line */
const detailsEvents = {
    [Timeline.selectors.line]: {
        click: explainDetailsLine
    }
};

/** Unify chart margins */
const chartMargins = ref({right: 0, top: 15, left: 10, bottom: 5});

</script>


<template>
<v-app :theme class="phase-layout">
  <div class="phase-row">
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
      <VisTooltip :triggers="summaryTriggers" :followCursor="true" horizontalPlacement="right" />
    </VisXYContainer>
    <VisXYContainer v-else :margin="chartMargins"
                    :xDomainMinConstraint="[undefined, -200]"
                    :xDomainMaxConstraint="[200, undefined]"
                    :duration="0" :data="range" class="phase-viewer">
      <VisTimeline :key="forceUpdate" :lineRow="sp" :x="xp" :lineDuration="lp"
                   :showLabels="true" :alternatingRowColors="true"
                   :rowHeight="lineHeight" :showEmptySegments="true"
                   :lineWidth="20" lineCursor="pointer" :events="detailsEvents" />
      <VisAxis type="x" :gridLine="false" label="Pressure (GPa)"
               :labelFontSize="24" :domainLine="false" :numTicks="21"/>
      <VisTooltip :triggers :followCursor="true" horizontalPlacement="right" />
    </VisXYContainer>
    <v-container class="phase-table">
      <v-label class="mb-4 text-title-medium no-select result-label" :text="selectedTitle" />
      <div class="phase-table-container">
        <v-table v-if="selectedEntries.length > 0 && showSummary" class="pa-2">
          <thead>
            <tr><th class="c1 th">Formula</th><th class="th">Steps</th></tr>
          </thead>
          <tr v-for="e of selectedEntries" :key="e.id">
            <td class="c1" v-html="e.formula"></td>
            <td>{{ e.step }}</td>
          </tr>
        </v-table>
      </div>
    </v-container>
  </div>
    <v-container class="phase-buttons">
      <v-switch v-model="showSummary" label="Show Summary" @update:modelValue="resetTable"/>
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
</v-app>
</template>


<style scoped>

:deep(sub) {
  position: relative;
  bottom: -0.2rem;
}

.phase-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.phase-row {
  display: flex;
  flex-direction: row;
  flex: 1;
  width: 100vw;
  gap: 0 5px;
}

.phase-viewer {
  flex: 2;
  height: 100%;

  --vis-axis-tick-color: light-dark(black, white);
  --vis-axis-label-color: light-dark(black, white);
  --vis-axis-tick-label-color: light-dark(black, white);
  --vis-timeline-label-color: light-dark(black, white);
  --vis-timeline-line-stroke-width: 2;
}

.phase-table {
  width: 400px;
}

.phase-table-container {
  overflow-y: auto;
  margin-top: 10px;
  height: 90%;
}

.c1 {
    width: 110px;
    padding-top: 6px;
}

.th {
  text-align: left;
  padding: 0;
  font-weight: bold;
}

.phase-buttons {
  display: flex;
  max-width: 3000px !important;
  column-gap: 30px;
  justify-content: end;
  padding: 0 10px;
  align-items: center;
  width: 100vw;
  height: 65px;
}

</style>

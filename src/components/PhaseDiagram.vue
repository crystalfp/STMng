<script setup lang="ts">
/**
 * @component
 * Phase transition diagram for variable composition analysis
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-20
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {computed, ref} from "vue";
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
    /** Enthalpy of formation */
    enthalpy: number;
}

/** Selected line by click on the summary diagram */
interface SelectedSummary {
    /** Unique id */
    id: number;
    /** Formula */
    formula: string;
    /** Corresponding step */
    step: number;
    /** Lower pressure for the stability range */
    pl: number;
    /** Higher pressure for the stability range */
    ph: number;
}

interface SelectedDetails {
    /** Unique id */
    id: number;
    /** Lower pressure for the stability range */
    pl: string;
    /** Higher pressure for the stability range */
    ph: string;
    /** Enthalpy of formation */
    enthalpy: string;
    /** Corresponding step */
    step: string;
}

const range = ref<DataRecord[]>([]);
const lineHeight = ref(30);
const summary = ref<SummaryTableEntry[]>([]);
const summaryLineHeight = ref(30);
const showSummary = ref(true);
const forceUpdate = ref(true);

/** Title and content of the lateral table */
const selectedTitle = ref("");
const selectedSummaries = ref<SelectedSummary[]>([]);
const selectedDetails = ref<SelectedDetails[]>([]);

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
    /** Enthalpy of formation */
    enthalpy: number;
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
            const enthalpy = table.enthalpies[i][j];

            if(lines.has(name)) {
                const a = lines.get(name)!;
                a.push({step, pl, ph, formula, enthalpy});
            }
            else {
              lines.set(name, [{step, pl, ph, formula, enthalpy}]);
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
        let lastEnthalpy = 0;
        for(const {step, pl, ph, formula, enthalpy} of sv) {

            if(lastStep < 0) {
                lastStep = step;
                lastPl = pl;
                lastPh = ph;
                lastFormula = formula;
                lastEnthalpy = enthalpy;
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
                    formula: lastFormula,
                    enthalpy: lastEnthalpy
                });
                lastStep = step;
                lastPl = pl;
                lastPh = ph;
                lastFormula = formula;
                lastEnthalpy = enthalpy;
            }
        }
        range.value.push({
            pl: lastPl,
            ph: lastPh,
            specie: key,
            step: lastStep,
            formula: lastFormula,
            enthalpy: lastEnthalpy
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

    selectedTitle.value = `Composition: ${d.formula}`;

    const ranges = new Map<number, number[][]>();
    const grouping = new Map<string, Set<number>>();
    const countPressures = table.pressures.length;
    for(let i=0; i < countPressures; ++i) {
        const countPoints = table.keys[i].length;
        const pressures = table.pressures[i];
        for(let j=0; j < countPoints; ++j) {
            if(table.keys[i][j] === d.key) {
                const s = table.steps[i][j];
                const f = table.formulas[i][j];

                if(ranges.has(s)) {
                    ranges.get(s)!.push(pressures);
                }
                else {
                    ranges.set(s, [pressures]);
                }
                if(grouping.has(f)) {
                    grouping.get(f)!.add(s);
                }
                else {
                    grouping.set(f, new Set<number>([s]));
                }
            }
        }
    }

    /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

    selectedSummaries.value.length = 0;
    let id = 0;

    for(const [formula, steps] of grouping) {

        for(const step of steps) {

            let rangeStart;
            let rangeEnd;
            for(const r of ranges.get(step)!.values()) {

                if(rangeStart === undefined) {
                    rangeStart = r[0];
                    rangeEnd = r[1];
                }
                else if(r[0] <= rangeEnd!) rangeEnd = r[1];
                else {
                    selectedSummaries.value.push({
                        id,
                        formula,
                        step,
                        pl: rangeStart,
                        ph: rangeEnd!
                    });
                    rangeStart = r[0];
                    rangeEnd = r[1];
                    ++id;
                }
            }
            selectedSummaries.value.push({
                id,
                formula,
                step,
                pl: rangeStart!,
                ph: rangeEnd!
            });
        }
    }

    /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
};

/**
 * Reset table to empty when changing type of diagram
 */
const resetTable = (): void => {
    selectedTitle.value = "";
    selectedSummaries.value.length = 0;
    selectedDetails.value.length = 0;
};

/**
 * Fill the table with the values of the clicked details line
 *
 * @param d - Data of the clicked line
 */
const explainDetailsLine = (d: DataRecord): void => {

    selectedTitle.value = d.formula;

    selectedDetails.value.length = 0;
    let id = 0;
    for(const entry of range.value) {

        if(entry.formula === d.formula) {
            console.log(entry.pl, entry.ph, entry.step);
            selectedDetails.value.push({
                id,
                pl: entry.pl.toFixed(1),
                ph: entry.ph.toFixed(1),
                enthalpy: entry.enthalpy.toFixed(4),
                step: entry.step.toFixed(0)
            });
            ++id;
        }
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

/** Click on a summary chart line */
const summaryEvents = {
    [Timeline.selectors.line]: {
        click: explainSummaryLine
    },
    [Timeline.selectors.background]: {
        click: resetTable
    },
    [Timeline.selectors.row]: {
        click: (x: {data: SummaryTableEntry[]}) => {
          if(x) explainSummaryLine(x.data[0]);
          else resetTable();
        }
    }
};

/** Click on a detail chart line */
const detailsEvents = {
    [Timeline.selectors.line]: {
        click: explainDetailsLine
    },
    [Timeline.selectors.background]: {
        click: resetTable
    },
    [Timeline.selectors.row]: {
        click: (x: {data: DataRecord[]}) => {
          if(x) explainDetailsLine(x.data[0]);
          else resetTable();
        }
    }
};

/** Unify chart margins */
const chartMargins = ref({right: 0, top: 15, left: 10, bottom: 5});

// Workaround to non-working CSS light-dark() in production
const contrast = computed(() => {
    return theme.value === "light" ? "#000" : "#FFF";
});

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
      <v-label class="ml-1 mb-2 text-title-medium no-select result-label" v-html="selectedTitle" />
      <div class="phase-table-container">
        <v-table v-if="selectedSummaries.length > 0 && showSummary" class="pa-2">
          <thead>
            <tr>
              <th class="pa-0">Formula</th>
              <th class="c2">Steps</th>
              <th class="pa-0" colspan="2">Pressure range (GPa)</th>
            </tr>
          </thead>
          <tr v-for="e of selectedSummaries" :key="e.id">
            <td class="c1" v-html="e.formula"></td>
            <td class="c2">{{ e.step }}</td>
            <td class="c3">{{ `${e.pl.toFixed(1)}\u2002\u27F7` }}</td>
            <td class="c4">{{ e.ph.toFixed(1) }}</td>
          </tr>
        </v-table>
        <v-table v-if="selectedDetails.length > 0 && !showSummary" class="pa-2 pr-3">
          <thead>
            <tr>
              <th class="pa-0 text-right" colspan="2">Pressure range (GPa)</th>
              <th class="pa-0 text-right">Enthalpy</th>
              <th class="pa-0 text-right">Step</th>
            </tr>
          </thead>
          <tr v-for="e of selectedDetails" :key="e.id">
            <td class="d1 text-right">{{ `${e.pl}\u2002\u27F7` }}</td>
            <td class="d2 text-right">{{ e.ph }}</td>
            <td class="text-right">{{ e.enthalpy }}</td>
            <td class="text-right">{{ e.step }}</td>
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

.result-label :deep(sub) {
  position: relative;
  bottom: -0.5rem;

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

  --vis-axis-tick-color: v-bind(contrast);
  --vis-axis-label-color: v-bind(contrast);
  --vis-axis-tick-label-color: v-bind(contrast);
  --vis-timeline-label-color: v-bind(contrast);
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

.c2 {
  width: 80px;
  text-align: right;
  padding-right: 25px;
}

.c3 {
  text-align: right;
}

.c4 {
  width: 70px;
  text-align: right;
  padding-right: 20px;
}

.d1 {
  width: 130px;
}

.d2 {
  width: 30px;
  padding-right: 20px;
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

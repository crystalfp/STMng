/**
 * Format a chemical formula for where subscripts are not allowed
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-16
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

const subscripts: string[] = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const repl = (_match: string, p1: string): string => {

    const chars = p1.split("");
    let out = "";
    for(const ch of chars) out += subscripts[Number.parseInt(ch, 10)];
    return out;
};

/**
 * Render subscripts with unicode subscripts
 *
 * @param formula - Formula in html format
 * @returns Formula with all subscript changed into Unicode subscript characters
 */
export const formatFormula = (formula="unknown"): string => {

    const s = formula.replaceAll(/<\/?sup>/gu, "");

    // eslint-disable-next-line unicorn/no-unsafe-string-replacement
    return s.replaceAll(/<sub>(\d+)<\/sub>/gu, repl).replaceAll(/<\/?sub>/gu, "");
};

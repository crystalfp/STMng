/**
 * Format in an human readable way a numerical value.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-21
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */

const formatPrecision = 4;
const tenToN = 10**formatPrecision;
const tenToMinusN = 1/tenToN;
const formatZero = `0.${"0".repeat(formatPrecision)}`;

/**
 * Format a number in an human readable way
 *
 * @param x - The numeric value to format
 * @returns The numeric value as string
 */
export const humanFormat = (x: number): string => {

    if(x === 0) return formatZero;
    if(x >= tenToN || x <= -tenToN) return x.toExponential(formatPrecision);
    if(x < tenToMinusN && x > -tenToMinusN) return x.toExponential(formatPrecision);
    return x.toPrecision(formatPrecision);
};

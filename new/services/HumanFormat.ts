/**
 * Format in an human readable way a numerical value.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-21
 */

const formatPrecision = 4;
const tenToN = Math.pow(10, formatPrecision);
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

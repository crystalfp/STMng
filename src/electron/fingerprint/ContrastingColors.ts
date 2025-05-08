/**
 * Generates a palette of contrasting colors.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-30
 */
import log from "electron-log";

/**
 * RGB color space triple [r, g, b] with values between 0 and 1
 * @notExported
 */
type RGB = [r: number, g: number, b: number];

/**
 * CIELAB color space triple [l, a, b]
 * @notExported
 */
type LAB = [l: number, a: number, b: number];

// The following functions are based on the pseudocode
// found on www.easyrgb.com
// From https://github.com/antimatter15/rgb-lab/tree/master
// The MIT License (MIT)
/**
 * Convert LAB color to RGB color
 *
 * @param lab - Color in CIELAB color space as triple
 * @returns RGB color as triple with values between 0 and 1
 * @notExported
 */
const lab2rgb = (lab: LAB): RGB => {

    let y = (lab[0] + 16) / 116,
        x = lab[1] / 500 + y,
        z = y - lab[2] / 200;

    x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16/116) / 7.787);
    y =           ((y * y * y > 0.008856) ? y * y * y : (y - 16/116) / 7.787);
    z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16/116) / 7.787);

    let r = x *  3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y *  1.8758 + z *  0.0415;
    let b = x *  0.0557 + y * -0.2040 + z *  1.0570;

    r = (r > 0.0031308) ? (1.055 * r**(1/2.4) - 0.055) : 12.92 * r;
    g = (g > 0.0031308) ? (1.055 * g**(1/2.4) - 0.055) : 12.92 * g;
    b = (b > 0.0031308) ? (1.055 * b**(1/2.4) - 0.055) : 12.92 * b;

    return [Math.max(0, Math.min(1, r)),
            Math.max(0, Math.min(1, g)),
            Math.max(0, Math.min(1, b))];
};

/**
 * Convert RGB color to LAB color
 *
 * @param rgb - RGB color as triple with values between 0 and 1
 * @returns LAB color as triple
 * @notExported
 */
const rgb2lab = (rgb: RGB): LAB => {

    let [r, g, b] = rgb;

    r = (r > 0.04045) ? ((r + 0.055) / 1.055)**2.4 : r / 12.92;
    g = (g > 0.04045) ? ((g + 0.055) / 1.055)**2.4 : g / 12.92;
    b = (b > 0.04045) ? ((b + 0.055) / 1.055)**2.4 : b / 12.92;

    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    x = (x > 0.008856) ? Math.cbrt(x) : (7.787 * x) + 16/116;
    y = (y > 0.008856) ? Math.cbrt(y) : (7.787 * y) + 16/116;
    z = (z > 0.008856) ? Math.cbrt(z) : (7.787 * z) + 16/116;

    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
};

/**
 * Compute the perceptual difference between two colors in CIELAB color space
 *
 * Code from:
 * https://github.com/PoshCode/Pansies/blob/main/Source/Assembly/ColorSpaces/Comparisons/Cie94Comparison.cs
 *
 * @param labA - First color to compare in CIELAB color space
 * @param labB - Second color to compare in CIELAB color space
 * @returns Perceptual difference between the two colors
 * @notExported
 */
const deltaE = (labA: LAB, labB: LAB): number => {

    const deltaL = labA[0] - labB[0];
    const deltaA = labA[1] - labB[1];
    const deltaB = labA[2] - labB[2];
    const c1 = Math.hypot(labA[1], labA[2]);
    const c2 = Math.hypot(labB[1], labB[2]);
    const deltaC = c1 - c2;
    let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
    deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
    const sc = 1.0 + 0.045 * c1;
    const sh = 1.0 + 0.015 * c1;
    const deltaLKlsl = deltaL;
    const deltaCkcsc = deltaC / (sc);
    const deltaHkhsh = deltaH / (sh);
    const perceptualDelta = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
    return perceptualDelta < 0 ? 0 : Math.sqrt(perceptualDelta);
};

/**
 * Pick colors that are maximally perceptually distinct
 *
 * When plotting a set of lines, one would want to be able to
 * pick a larger set of distinct colors, where the number of colors
 * equals or exceeds the number of lines you want to plot. Because our
 * ability to distinguish among colors has limits, one should choose these
 * colors to be "maximally perceptually distinguishable."
 *
 * This function generates a set of colors which are distinguishable
 * by reference to the "Lab" color space, which more closely matches
 * human color perception than RGB. Given an initial large list of possible
 * colors, it iteratively chooses the entry in the list that is farthest (in
 * Lab space) from all previously-chosen entries. While this "greedy"
 * algorithm does not yield a global maximum, it is simple and efficient.
 * Moreover, the sequence of colors is consistent no matter how many you
 * request, which facilitates the users' ability to learn the color order
 * and avoids major changes in the appearance of plots when adding or
 * removing lines.
 *
 * Copyright 2010-2011 by Timothy E. Holy
 *
 * Tim Holy (2024). Generate maximally perceptually-distinct colors (https://www.mathworks.com/matlabcentral/fileexchange/29702-generate-maximally-perceptually-distinct-colors), MATLAB Central File Exchange. Retrieved December 29, 2024.
 *
 * @param countColors - Number of colors to generate
 * @param backgroundColor - Background color as RGB triple with values between 0 and 1, to make sure that
 * your colors are also distinguishable from the background
 * @returns - Array of RGB colors as countColors-by-3-tuple matrix. The color values are between 0 and 1
 */
export const contrastingColors = (countColors: number, backgroundColor: RGB): RGB[] => {

    // Generate a sizable number of RGB triples. This represents our space of
    // possible choices. By starting in RGB space, we ensure that all of the
    // colors can be generated by the monitor. Then convert them to CIELAB space
    const nGrid = 30;  // number of grid divisions along each axis in RGB space
    const lab: LAB[] = [];

    const delta = 1/(nGrid-1);
    for(let nr=0, r=0; nr < nGrid; nr++, r+=delta) {
        for(let ng=0, g=0; ng < nGrid; ng++, g+=delta) {
            for(let nb=0, b=0; nb < nGrid; nb++, b+=delta) {
                lab.push(rgb2lab([r, g, b]));
            }
        }
    }

    if(countColors > lab.length / 3) {
        log.error(`You can't readily distinguish that many colors ${countColors}. Changed to ${lab.length / 3}.`);
        countColors = lab.length / 3;
    }

    // Distances from the candidate colors to the background colors
    let mindist2 = Array<number>(lab.length).fill(Number.POSITIVE_INFINITY);

    // Prepare output array
    const colors = Array<RGB>(countColors);

    // Initialize by making the "previous" color equal to background
    let lastlab = rgb2lab(backgroundColor);

    // Iteratively pick the color that maximizes the distance to the nearest
    // already-picked color
    for(let i = 0; i < countColors; i++) {

        // Displacement of last from all colors on list
        // eslint-disable-next-line no-loop-func
        const dX = lab.map((color) => deltaE(color, lastlab));

        // Distances to closest previously-chosen color
        mindist2 = mindist2.map((value, index) => Math.min(value, dX[index]));

        // Find the entry farthest from all previously-chosen colors
        let max = mindist2[0];
        let maxIndex = 0;

        for(let j = 1; j < mindist2.length; j++) {
            if(mindist2[j] > max) {
                maxIndex = j;
                max = mindist2[j];
            }
        }

        // Prepare for next iteration
        lastlab = lab[maxIndex];

        // Save for output
        colors[i] = lab2rgb(lastlab);
    }

    return colors;
};

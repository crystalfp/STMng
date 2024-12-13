/**
 * Smooth the histograms peaks using a Gaussian.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-12
 */

/** Size of the erf lookup table */
const ERF_TABLE_SIZE = 215;
/** X step between entries in the table */
const LOOKUP_STEP = 0.02;

/** 0.5*(1.+erf(x)) function lookup table with x: [-LOOKUP_STEP..(ERF_TABLE_SIZE-1)*LOOKUP_STEP]*/
const erfTable = [
    0.4887177127,
    0.5000000000, 0.5112822873, 0.5225555531, 0.5338107972, 0.5450390629, 0.5562314580, 0.5673791759,
    0.5784735165, 0.5895059066, 0.6004679195, 0.6113512946, 0.6221479558, 0.6328500295, 0.6434498616,
    0.6539400340, 0.6643133797, 0.6745629974, 0.6846822647, 0.6946648506, 0.7045047267, 0.7141961775,
    0.7237338092, 0.7331125576, 0.7423276950, 0.7513748353, 0.7602499389, 0.7689493152, 0.7774696252,
    0.7858078819, 0.7939614502, 0.8019280454, 0.8097057309, 0.8172929146, 0.8246883440, 0.8318911014,
    0.8389005969, 0.8457165616, 0.8523390389, 0.8587683764, 0.8650052156, 0.8710504824, 0.8769053754,
    0.8825713557, 0.8880501342, 0.8933436596, 0.8984541062, 0.9033838608, 0.9081355095, 0.9127118248,
    0.9171157522, 0.9213503965, 0.9254190089, 0.9293249733, 0.9330717933, 0.9366630792, 0.9401025348,
    0.9433939451, 0.9465411638, 0.9495481014, 0.9524187135, 0.9551569891, 0.9577669405, 0.9602525921,
    0.9626179709, 0.9648670965, 0.9670039725, 0.9690325775, 0.9709568576, 0.9727807183, 0.9745080176,
    0.9761425599, 0.9776880893, 0.9791482848, 0.9805267548, 0.9818270327, 0.9830525732, 0.9842067485,
    0.9852928449, 0.9863140610, 0.9872735047, 0.9881741917, 0.9890190442, 0.9898108898, 0.9905524607,
    0.9912463935, 0.9918952293, 0.9925014137, 0.9930672975, 0.9935951376, 0.9940870980, 0.9945452508,
    0.9949715782, 0.9953679738, 0.9957362442, 0.9960781114, 0.9963952146, 0.9966891125, 0.9969612854,
    0.9972131377, 0.9974460002, 0.9976611325, 0.9978597257, 0.9980429048, 0.9982117309, 0.9983672043,
    0.9985102667, 0.9986418034, 0.9987626463, 0.9988735761, 0.9989753245, 0.9990685769, 0.9991539742,
    0.9992321156, 0.9993035606, 0.9993688306, 0.9994284117, 0.9994827563, 0.9995322849, 0.9995773883,
    0.9996184290, 0.9996557431, 0.9996896417, 0.9997204131, 0.9997483232, 0.9997736179, 0.9997965240,
    0.9998172504, 0.9998359896, 0.9998529185, 0.9998681998, 0.9998819828, 0.9998944045, 0.9999055903,
    0.9999156553, 0.9999247044, 0.9999328336, 0.9999401307, 0.9999466756, 0.9999525412, 0.9999577937,
    0.9999624934, 0.9999666952, 0.9999704488, 0.9999737994, 0.9999767878, 0.9999794511, 0.9999818226,
    0.9999839328, 0.9999858088, 0.9999874754, 0.9999889548, 0.9999902668, 0.9999914296, 0.9999924592,
    0.9999933702, 0.9999941757, 0.9999948872, 0.9999955152, 0.9999960691, 0.9999965573, 0.9999969871,
    0.9999973653, 0.9999976978, 0.9999979899, 0.9999982463, 0.9999984711, 0.9999986682, 0.9999988407,
    0.9999989917, 0.9999991237, 0.9999992390, 0.9999993396, 0.9999994274, 0.9999995039, 0.9999995705,
    0.9999996285, 0.9999996788, 0.9999997226, 0.9999997606, 0.9999997935, 0.9999998221, 0.9999998468,
    0.9999998682, 0.9999998867, 0.9999999026, 0.9999999164, 0.9999999283, 0.9999999386, 0.9999999474,
    0.9999999550, 0.9999999615, 0.9999999671, 0.9999999719, 0.9999999760, 0.9999999796, 0.9999999826,
    0.9999999852, 0.9999999874, 0.9999999893, 0.9999999909, 0.9999999923, 0.9999999935, 0.9999999945,
    0.9999999953, 0.9999999960, 0.9999999966, 0.9999999972, 0.9999999976, 0.9999999980, 0.9999999983,
    0.9999999986, 0.9999999988, 0.9999999990, 0.9999999992
];

/**
 * Compute 0.5*(1.+erf(x))
 *
 * @param x - The x value where to calculate the area
 * @returns The area under the gaussian distribution from -infinite to x
 */
const gaussianIntegral = (x: number): number => {

	// Use symmetry to compute negative values
	if(x < 0) return 1 - gaussianIntegral(-x);

	// If outside the table or no room for at least one point more after the interval for the interpolation
	if(x >= (ERF_TABLE_SIZE-3)*LOOKUP_STEP) return 1;

	// Compute the index of the interpolating interval - 1
	const idx = Math.floor(x/LOOKUP_STEP);

	// Compute the reduced x: it is between 0 and 1
	const t = x/LOOKUP_STEP - idx;

	// Compute the value by cubic interpolation between the previous point,
    // the point at the start of the interval and two points after
	const aa = -1/6*erfTable[idx] + 1/2*erfTable[idx+1] - 1/2*erfTable[idx+2] + 1/6*erfTable[idx+3];
	const bb =  1/2*erfTable[idx] -     erfTable[idx+1] + 1/2*erfTable[idx+2];
	const cc = -1/3*erfTable[idx] - 1/2*erfTable[idx+1] +     erfTable[idx+2] - 1/6*erfTable[idx+3];
	const dd =                          erfTable[idx+1];

	return ((aa*t + bb)*t + cc)*t + dd;
};

/**
 * Smooth one peak
 *
 * @param peakValue - Peak value to be smoothed
 * @param radius - X value of the peak
 * @param delta - Width of the bin
 * @param binCount - Number of bins
 * @param histogram - Array to be filled starting from start
 * @param start - Starting index in the histogram where to deposit the smoothed histogram
 * @param peakWidth - Width of the smoothing Gaussian
 */
export const smoothPeak = (peakValue: number, radius: number, delta: number,
                           binCount: number, histogram: number[],
                           // eslint-disable-next-line max-params
                           start: number, peakWidth: number): void => {

	// Compute the central bin index and the values bracketing the bin
	const idx = Math.floor(radius/delta);
	const x0 = idx*delta;
	const MIN_AREA = 1e-6;

	// No smoothing if Gaussian width is zero
	if(peakWidth <= 0) {

		histogram[idx+start] += peakValue;
		return;
	}

	// Compute the distribution value at the x0 point
	const oneOverSigmaTimesSqrt2 = 1./(peakWidth*1.414213562373095);
	const dx0 = gaussianIntegral((x0-radius)*oneOverSigmaTimesSqrt2);

	// Fill the bin where the peak falls and for bins on the right
	let dPrevious = dx0;
	let xPrevious = x0;
	for(let i=idx; i < binCount; ++i) {

        const x1 = xPrevious + delta;
		const dx1 = gaussianIntegral((x1-radius)*oneOverSigmaTimesSqrt2);

		const area = peakValue*(dx1-dPrevious);
		if(area < MIN_AREA) break;
		histogram[i+start] += area;

		dPrevious = dx1;
		xPrevious = x1;
	}

	// Fill the other tail of the distribution
	dPrevious = dx0;
	xPrevious = x0;
	for(let i=idx-1; i >= 0; --i) {

		const x1 = xPrevious - delta;
		const dx1 = gaussianIntegral((x1-radius)*oneOverSigmaTimesSqrt2);

		const area = peakValue*(dPrevious-dx1);
		if(area < MIN_AREA) break;
		if(i < binCount) histogram[i+start] += area;

		dPrevious = dx1;
		xPrevious = x1;
	}
};

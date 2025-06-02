/**
 * Find intersection points between a plane and the unit cell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-04-15
 */
import {cross, dot} from "mathjs";
import {computeCellVertices} from "../modules/ComputeCellVertices";
import {normalize} from "./LinearAlgebra";
import type {BasisType, PositionType} from "@/types";

/**
 * Compute distance of a point from a plane
 *
 * @param point - Point for which the distance should be computed
 * @param normal - Normal to the plane
 * @param planePoint - One point on the plane
 * @returns Distance of the point from the plane
 */
const distanceFromPlane = (point: number[], normal: number[], planePoint: number[]): number => {

	const vec = [
		point[0] - planePoint[0],
		point[1] - planePoint[1],
		point[2] - planePoint[2]
	];
	return dot(vec, normal);
};

/**
 * Compute the intersection of a segment with a plane
 *
 * @param p1 - Starting point of the segment
 * @param p2 - End point of the segment
 * @param normal - Normal to the plane
 * @param planePoint - Point on the plane
 * @returns Coordinates of the intersection or undefined if no intersection
 */
const lineIntersectsPlane = (p1: number[], p2: number[],
							 normal: number[], planePoint: number[]): number[] | undefined => {

	const d1 = distanceFromPlane(p1, normal, planePoint);
	const d2 = distanceFromPlane(p2, normal, planePoint);

	// If both points are on the same side of the plane, there is no intersection
	if(d1 * d2 > 0) return undefined;

	// If one of the points is on the plane, it is the intersection point
  	if(Math.abs(d1) < 1e-10) return p1;
  	if(Math.abs(d2) < 1e-10) return p2;

  	// Compute the intersection point
  	const t = d1 / (d1 - d2);
	return [
		p1[0] + t * (p2[0] - p1[0]),
		p1[1] + t * (p2[1] - p1[1]),
		p1[2] + t * (p2[2] - p1[2])
	];
};

/**
 * Order intersection points around the plane
 *
 * @param points - Computed intersection points
 * @param normal - Plane normal
 * @returns Ordered intersection points
 */
const orderIntersectionPoints = (points: number[][], normal: number[]): number[][] => {

	if(points.length <= 2) return points;

	// Find the centroid of the points
	const centroid = [0, 0, 0];
	for(const point of points) {
		centroid[0] += point[0];
		centroid[1] += point[1];
		centroid[2] += point[2];
	}
	const npoints = points.length;
	centroid[0] /= npoints;
	centroid[1] /= npoints;
	centroid[2] /= npoints;

	// Find two vectors perpendicular to the plane normal and to each other
	const v1 = normal[0] !== 0 || normal[1] !== 0
					? normalize([-normal[1], normal[0], 0])
					: normalize([0, -normal[2], normal[1]]);
	const v2 = cross(normal, v1);

	return points.toSorted((a: number[], b: number[]) => {

		const vecA = [a[0]-centroid[0], a[1]-centroid[1], a[2]-centroid[2]];
		const vecB = [b[0]-centroid[0], b[1]-centroid[1], b[2]-centroid[2]];

		const angleA = Math.atan2(dot(vecA, v2), dot(vecA, v1));
		const angleB = Math.atan2(dot(vecB, v2), dot(vecB, v1));

		return angleA - angleB;
	});
};

/**
 * Find intersection points between a plane and the unit cell
 *
 * @param basis - Structure basis vectors
 * @param origin - Cell origin
 * @param normal - Plane normal
 * @param point - A point on the plane
 * @returns Vector of ordered intersection points
 */
export const findIntersections = (basis: BasisType, origin: PositionType,
								  normal: number[], point: number[]): number[][] => {

	const ucVertices = computeCellVertices(origin, basis);
	const edges = [
		0, 1,
		1, 2,
		2, 3,
		3, 0,
		4, 5,
		5, 6,
		6, 7,
		7, 4,
		0, 4,
		1, 5,
		2, 6,
		3, 7
	];

	// For each edge compute intersection with the plane
	const intersections: number[][] = [];
	for(let i=0; i < edges.length; i += 2) {

		const edge1 = edges[i]*3;
		const edge2 = edges[i+1]*3;
		const intersection = lineIntersectsPlane(
										[ucVertices[edge1], ucVertices[edge1+1], ucVertices[edge1+2]],
										[ucVertices[edge2], ucVertices[edge2+1], ucVertices[edge2+2]],
										normal, point);
		if(intersection) intersections.push(intersection);
	}

	return orderIntersectionPoints(intersections, normal);
};

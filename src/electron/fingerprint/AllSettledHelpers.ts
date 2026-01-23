/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-22
 */

/**
 * Type guard for rejected promise
 *
 * @param input - Value to check
 * @returns True if input is a rejected promise
 */
export const isRejected = (input: PromiseSettledResult<unknown>): input is PromiseRejectedResult =>
  input.status === "rejected";

/**
 * Type guard for fulfilled promise
 *
 * @param input - Value to check
 * @returns True if input is a fulfilled promise
 */
export const isFulfilled = <T>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T> =>
  input.status === "fulfilled";

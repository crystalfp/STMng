/**
 * Helpers to classify the results of Promise.allSettled()
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-22
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
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

import { Temporal } from "@js-temporal/polyfill";

declare global {
  // eslint-disable-next-line no-var
  var Temporal: typeof import("@js-temporal/polyfill").Temporal | undefined;
}

if (!globalThis.Temporal) {
  globalThis.Temporal = Temporal;
}

export { Temporal };

export type PlainDate = Temporal.PlainDate;
export type PlainTime = Temporal.PlainTime;
export type PlainDateTime = Temporal.PlainDateTime;
export type ZonedDateTime = Temporal.ZonedDateTime;
export type Instant = Temporal.Instant;

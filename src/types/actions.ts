/** Standard result envelope returned by every feature's server actions. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

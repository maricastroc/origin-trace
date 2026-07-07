export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

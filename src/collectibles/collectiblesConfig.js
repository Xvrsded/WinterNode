export const COLLECTIBLES_CUTOFF_DATE = "2026-08-01T00:00:00Z";

export function getSnowflakeDate(snowflake) {
    if (!snowflake) return null;
    try {
        const id = BigInt(snowflake);
        const timestamp = Number(id >> 22n) + 1420070400000;
        return new Date(timestamp);
    } catch (error) {
        return null;
    }
}

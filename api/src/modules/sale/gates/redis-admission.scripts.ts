import { RejectionReason } from '../enums/rejection-reason.enum';
import { ResultStatus } from '../enums/result-status.enum';
import { GATE_UNSEEDED } from '../interfaces/admission-gate.interface';

/**
 * Atomically grants a user a short-lived lease on one unit of a sale item.
 * Expired leases are purged first, so a lease that was never confirmed stops
 * counting on its own without any background job.
 *
 * KEYS:
 *   KEYS[1] - Units available (not yet confirmed sold)
 *   KEYS[2] - Sorted set of live leases (user id -> expiry time in ms)
 *   KEYS[3] - Hash of confirmed units per user (user id -> count)
 *
 * ARGV:
 *   ARGV[1] - User id
 *   ARGV[2] - Current time in ms; leases scored at or below it are expired
 *   ARGV[3] - Expiry time in ms for the new lease
 *   ARGV[4] - Maximum units one user may buy
 *
 * Returns:
 *   "success"       - Lease granted
 *   "limit_reached" - User already holds a live lease, or has confirmed the maximum units
 *   "sold_out"      - No units left once live leases are counted
 *   "unseeded"      - The item has no available count in Redis (never seeded, or Redis lost its data)
 */
export const ADMIT_SCRIPT = `
local available = redis.call('GET', KEYS[1])
if not available then
  return '${GATE_UNSEEDED}'
end

redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[2])

if redis.call('ZSCORE', KEYS[2], ARGV[1]) then
  return '${RejectionReason.LimitReached}'
end

if tonumber(redis.call('HGET', KEYS[3], ARGV[1]) or '0') >= tonumber(ARGV[4]) then
  return '${RejectionReason.LimitReached}'
end

if tonumber(available) - redis.call('ZCARD', KEYS[2]) <= 0 then
  return '${RejectionReason.SoldOut}'
end

redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])

return '${ResultStatus.Success}'
`;

/**
 * Atomically confirms a sale: the lease is consumed, one available unit is
 * taken, and the user's confirmed count grows. Runs after the database
 * transaction committed, so it counts the unit even if the lease had expired.
 *
 * KEYS:
 *   KEYS[1] - Units available
 *   KEYS[2] - Sorted set of live leases
 *   KEYS[3] - Hash of confirmed units per user
 *
 * ARGV:
 *   ARGV[1] - User id
 */
export const CONFIRM_SCRIPT = `
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('DECR', KEYS[1])
redis.call('HINCRBY', KEYS[3], ARGV[1], 1)
return 1
`;

/**
 * Reports units still available after purging expired leases.
 *
 * KEYS:
 *   KEYS[1] - Units available
 *   KEYS[2] - Sorted set of live leases
 *
 * ARGV:
 *   ARGV[1] - Current time in ms
 *
 * Returns:
 *   nil if the item was never seeded, otherwise available minus live leases, floored at 0
 */
export const REMAINING_SCRIPT = `
local available = redis.call('GET', KEYS[1])

if not available then
  return nil
end

redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])

local remaining = tonumber(available) - redis.call('ZCARD', KEYS[2])
if remaining < 0 then
  remaining = 0
end

return remaining
`;

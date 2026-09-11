import { RejectionReason } from '../enums/rejection-reason.enum';
import { ResultStatus } from '../enums/result-status.enum';

/**
 * Atomically admits a user to buy one unit of a sale item.
 * Runs as a single Redis script so concurrent requests cannot both claim the
 * last ticket or push a user past the per-user limit.
 *
 * KEYS:
 *   KEYS[1] - Remaining ticket count for the item
 *   KEYS[2] - Hash of units held per user (user id -> count)
 *   KEYS[3] - Sorted set of holders (user id -> last admission time in ms)
 *
 * ARGV:
 *   ARGV[1] - User id
 *   ARGV[2] - Admission timestamp in milliseconds, used as the sorted-set score
 *   ARGV[3] - Maximum units one user may hold
 *
 * Returns:
 *   "success"       - Ticket claimed; the user's unit count and holder entry are updated
 *   "limit_reached" - User already holds the maximum units
 *   "sold_out"      - No tickets remain
 */
export const ADMIT_SCRIPT = `
if tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0') >= tonumber(ARGV[3]) then
  return '${RejectionReason.LimitReached}'
end

if tonumber(redis.call('GET', KEYS[1]) or '0') <= 0 then
  return '${RejectionReason.SoldOut}'
end

redis.call('DECR', KEYS[1])
redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
redis.call('ZADD', KEYS[3], ARGV[2], ARGV[1])

return '${ResultStatus.Success}'
`;

/**
 * Atomically releases one unit held by a user and restores one ticket.
 * The ticket count is incremented only when the user actually held a unit,
 * so a duplicate release cannot inflate inventory.
 *
 * KEYS:
 *   KEYS[1] - Remaining ticket count for the item
 *   KEYS[2] - Hash of units held per user (user id -> count)
 *   KEYS[3] - Sorted set of holders (user id -> last admission time in ms)
 *
 * ARGV:
 *   ARGV[1] - User id
 *
 * Returns:
 *   1 - One unit released and the ticket restored; the holder entry is removed
 *       when the user's last unit is released
 *   0 - User held no units; nothing changed
 */
export const RELEASE_SCRIPT = `
local held = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
if held <= 0 then
  return 0
end

if held == 1 then
  redis.call('HDEL', KEYS[2], ARGV[1])
  redis.call('ZREM', KEYS[3], ARGV[1])
else
  redis.call('HINCRBY', KEYS[2], ARGV[1], -1)
end
redis.call('INCR', KEYS[1])

return 1
`;

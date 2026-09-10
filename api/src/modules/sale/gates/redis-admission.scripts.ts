export const ADMIT_SCRIPT = `
if redis.call('ZSCORE', KEYS[2], ARGV[1]) then
  return 'already_admitted'
end

if tonumber(redis.call('GET', KEYS[1]) or '0') <= 0 then
  return 'sold_out'
end

redis.call('DECR', KEYS[1])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])

return 'admitted'
`;

export const RELEASE_SCRIPT = `
if redis.call('ZREM', KEYS[2], ARGV[1]) == 1 then
  redis.call('INCR', KEYS[1])
  return 1
end

return 0
`;

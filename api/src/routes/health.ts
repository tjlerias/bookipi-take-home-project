import { FastifyPluginAsync } from 'fastify'

const health: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/health', async function (request, reply) {
    return { ok: true }
  })
}

export default health

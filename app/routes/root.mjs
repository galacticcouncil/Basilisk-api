export default async (fastify, opts) => {
  fastify.route({
    url: "/",
    method: ["GET"],
    schema: {
      description: "Basilisk API root",
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            about: { type: "string" },
            docs: { type: "string" },
          },
        },
      },
    },
    handler: async (request, reply) => ({
      about: "Welcome to the Basilisk API",
      docs: "Visit /docs",
    }),
  });
};

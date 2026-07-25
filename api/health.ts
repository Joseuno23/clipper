import { createApiHandler } from "../src/server/api/handler";

export default createApiHandler({
  methods: ["GET"],
  handle: () => ({
    status: "ok",
    service: "clipper-api",
  }),
});

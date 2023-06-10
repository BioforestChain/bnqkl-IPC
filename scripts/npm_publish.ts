import { fileURLToPath } from "node:url";

const pub = new Deno.Command("npm", {
  args: ["publish", "--access=public"],
  cwd: fileURLToPath(import.meta.resolve("../npm")),
});

pub.spawn();

import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: [{ name: ".", path: "./src/index.ts" }],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  typeCheck: false,
  test: false,
  compilerOptions: {},
  package: {
    name: "@bnqkl/ipc",
    version: "1.0.0",
    description: "bnqkl ipc",
    repository: {
      type: "git",
      url: "git@github.com:BioforestChain/bnqkl-IPC.git",
    },
    author: "BFMeta Team",
    license: "cc-by-4.0",
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});

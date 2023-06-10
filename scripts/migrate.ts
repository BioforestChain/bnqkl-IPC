//@ts-check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WalkFiles } from "./WalkDir.ts";

const resolveTo = (to: string) => fileURLToPath(import.meta.resolve(to));
const easyWriteFile = (filepath: string, content: string | Uint8Array) => {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, content);
};
const easyReadFile = (filepath: string) => fs.readFileSync(filepath, "utf-8");
const emptyDir = (dir: string) =>
  fs.rmSync(dir, { recursive: true, force: true });

emptyDir(resolveTo("./npm"));

for (const entry of WalkFiles(resolveTo("../src"))) {
  console.log(entry.entrypath);
  ///  资源文件夹的东西直接迁移
  if (/\.(cts|mts|ts)$/.test(entry.entryname)) {
    const toFile = fileURLToPath(
      import.meta.resolve(
        "../src/" + entry.relativepath.replace(/\.(cts|mts|ts)$/, ".ts")
      )
    );
    const scriptContent = entry.readText();

    easyWriteFile(
      toFile,
      scriptContent
        /// nodejs
        .replace(/from\s+['"](http|fs|net|stream)['"]/g, 'from "node:$1"')
        /// deno
        .replace(
          /(from|import) ['"]([\w@][^"']+)['"]/g,
          (code, _, from_path) => {
            if (from_path.includes(":")) {
              return code;
            }
            if (fs.existsSync(path.resolve(entry.dirpath, from_path))) {
              /// 文件夹
              return code.replace(/(['"])/, "$1npm:");
            }
            return code.replace(/(['"])/, "$1npm:");
          }
        )
        .replace(/import\(['"]([\w@][^"']+)['"]\)/g, (code, from_path) => {
          if (from_path.includes(":")) {
            return code;
          }
          if (fs.existsSync(path.resolve(entry.dirpath, from_path))) {
            /// 文件夹
            return code.replace(/(['"])/, "$1npm:");
          }
          return code.replace(/(['"])/, "$1npm:");
        })
        .replace(/(from|import) ['"](\.[^"']+)['"]/g, (code, _, from_path) => {
          if (fs.existsSync(path.resolve(entry.dirpath, from_path))) {
            /// 文件夹
            return code.replace(/(['"])$/, "/index.ts$1");
          }
          return code.replace(/(['"])$/, ".ts$1");
        })
        .replace(/import\(['"](\.[^"']+)['"]\)/g, (code, from_path) => {
          console.log(entry.relativepath, from_path);
          if (fs.existsSync(path.resolve(entry.dirpath, from_path))) {
            /// 文件夹
            return code.replace(/(['"]\))$/, "/index.ts$1");
          }
          return code.replace(/(['"]\))$/, ".ts$1");
        })
        .replace(/(from|import) ['"]([^"']+)\.js['"]/g, '$1 "$2.ts"')
        .replace(/(from|import) ['"]([^"']+)\.cjs['"]/g, '$1 "$2.ts"')
        .replace(/(from|import) ['"]([^"']+)\.mjs['"]/g, '$1 "$2.ts"')
        .replace(/import\(['"]([^"']+)\.js['"]\)/g, 'import("$1.ts")')
        .replace(/import\(['"]([^"']+)\.cjs['"]\)/g, 'import("$1.ts")')
        .replace(/import\(['"]([^"']+)\.mjs['"]\)/g, 'import("$1.ts")')
    );
  } else {
    const toFile = fileURLToPath(
      import.meta.resolve("./src/" + entry.relativepath)
    );
    console.log("copy", entry.relativepath);
    easyWriteFile(toFile, entry.read());
  }
}

// easyWriteFile(
//   resolveTo("./assets-projects/electron-vite.config.ts"),
//   easyReadFile(resolveTo("../../desktop/electron-vite.config.ts"))
// );

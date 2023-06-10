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

for (const entry of WalkFiles(resolveTo("../src"))) {
  console.log(entry.entryname,/@types\.ts$/.test(entry.entryname));
  ///  资源文件夹的东西直接迁移
  if (/@types\.ts$/.test(entry.entryname)) {
    const scriptContent = entry.readText();

    const importMap = new Map<string, Map<string, string>>();
    let newScriptContent = scriptContent.replace(
      /import\(['"]([^"']+)['"]\)\.(\w+)/g,
      (code, from_path, import_name) => {
        let imports = importMap.get(from_path);
        if (imports === undefined) {
          imports = new Map();
          importMap.set(from_path, imports);
        }

        imports.set(import_name, `_${import_name}`);

        return `_${import_name}`;
      }
    );
    if (importMap.size === 0) {
      continue;
    }
    newScriptContent =
      [...importMap]
        .map(([from_path, imports]) => {
          return `import {${[...imports].map(
            ([name, alias]) => ` ${name} as ${alias}`
          )}} from "${from_path}";`;
        })
        .join("\n") +
      "\n" +
      newScriptContent;
    entry.write(newScriptContent);
  }
}

// easyWriteFile(
//   resolveTo("./assets-projects/electron-vite.config.ts"),
//   easyReadFile(resolveTo("../../desktop/electron-vite.config.ts"))
// );

import {
  getBaseRollupPlugins,
  getPackageJSON,
  resolvePkgPath,
} from "./utils.js";

import generatePackageJson from "rollup-plugin-generate-package-json";
import alias from "@rollup/plugin-alias";

// 获取package.json下面的name字段
const { name, module, peerDependencies } = getPackageJSON(
  "react-noop-renderer"
); // react
//react-noop-renderer包的路径
const pkgPath = resolvePkgPath(name);
//react-noop-renderer 产物路劲
const pkgDistPath = resolvePkgPath(name, true);
export default [
  // 对应react-noop-renderer包
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: "reactNoopRenderer",
        format: "umd",
      },
    ],
    // 标记外部依赖代码，不进行打包
    external: [...Object.keys(peerDependencies), "scheduler"],
    plugins: [
      // webpack resolve alias
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`,
        },
      }),
      ...getBaseRollupPlugins({
        typescript: {
          tsconfigOverride: {
            compilerOptions: {
              paths: {
                hostConfig: [`./${name}/src/hostConfig.ts`],
              },
            },
          },
        },
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          peerDependencies: {
            react: version,
          },
          version,
          main: "index.js",
        }),
      }),
    ],
  },
];

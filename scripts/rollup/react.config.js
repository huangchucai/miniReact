import {
  getBaseRollupPlugins,
  getPackageJSON,
  resolvePkgPath,
} from "./utils.js";

import generatePackageJson from "rollup-plugin-generate-package-json";

// 获取package.json下面的name字段
const { name, module } = getPackageJSON("react"); // react
// react包的路径
const pkgPath = resolvePkgPath(name);
//react 产物路劲
const pkgDistPath = resolvePkgPath(name, true);
export default [
  // 对应react包
  {
    input: `${pkgPath}/${module}`,
    output: {
      file: `${pkgDistPath}/index.js`,
      name: "react",
      format: "umd",
    },
    plugins: [
      ...getBaseRollupPlugins(),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: "index.js",
        }),
      }),
    ],
  },
  // jsx-runtime包
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jsx-runtime
      {
        file: `${pkgDistPath}/jsx-runtime.js`,
        name: "jsx-runtime.js",
        format: "umd",
      },
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`,
        name: "jsx-dev-runtime.js",
        format: "umd",
      },
    ],
    plugins: getBaseRollupPlugins(),
  },
];

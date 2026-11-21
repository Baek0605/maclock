import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 코드 검사(ESLint) 설정
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next의 기본 검사 제외 목록을 다시 지정
  globalIgnores([
    // 빌드 결과물과 자동 생성 파일은 검사하지 않는다
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

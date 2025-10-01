// .eslintrc.cjs
module.exports = {
  root: true,
  ignorePatterns: ['.eslintrc.cjs', 'dist/**', 'node_modules/**'],

  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],

  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],

  overrides: [
    {
      files: ['src/**/*.ts'],
      excludedFiles: ['src/**/*.spec.ts'],
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      extends: [
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
      ],
      rules: {
        // 필요시 타입기반 규칙 튜닝
      },
    },

    // 2) 테스트/스펙: 타입프로그램 OFF (여기가 오류 원인 해결 포인트)
    {
      files: ['src/**/*.spec.ts', 'test/**/*.ts'],
      parserOptions: { project: null },
      rules: {
        // 테스트는 느슨하게
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
  ],
};

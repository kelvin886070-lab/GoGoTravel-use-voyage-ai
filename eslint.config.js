import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // lint 欠債清理批（2026-08-01）的三個政策調整：
      // 1) fast-refresh 規則降為 warn：指令式 API（toast()/confirmDialog()/StageSpine helpers）與元件同檔
      //    是刻意架構；此規則只影響 dev 熱更新體驗，不影響正確性。
      'react-refresh/only-export-components': 'warn',
      // 2) unused-vars 現代化：底線前綴＝刻意忽略；catch 綁定不強制使用（本庫大量 catch(e) 靜默模式）；
      //    rest 解構剝欄位（{ a: _a, ...keep }）為合法慣用。
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      }],
    },
  },
])

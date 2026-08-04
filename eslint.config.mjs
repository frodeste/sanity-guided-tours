// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'examples', 'docs', '.superpowers'],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  }
)

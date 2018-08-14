module.exports = {
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'script'
  },
  env: {
    node: true,
    es6: true
  },
  extends: 'eslint:recommended',
  rules: {
    indent: [2, 2],
    quotes: [2, 'single'],
    semi: [2, 'always'],
    strict: [2, 'global'],
    noConsole: 0,
    noUnderscoreDangle: 0,
    noConstantCondition: 0
  }
};
/**
 * Commitlint configuration.
 * Enforces Conventional Commits which Changesets and our changelog automation rely on.
 *
 * Allowed types: feat, fix, docs, chore, refactor, test, perf, build, ci, style, revert
 * Examples:
 *   feat(core): add HRV ratio metric
 *   fix(polar): handle malformed PMD frame
 *   chore: bump dependencies
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', 100],
    'footer-max-line-length': [0],
  },
};

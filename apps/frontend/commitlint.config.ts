import type { UserConfig } from '@commitlint/types'
import { RuleConfigSeverity } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'chore',
        'docs',
        'style',
        'test',
        'revert',
        'perf',
        'build',
        'ci',
      ],
    ],
  },
}

export default config

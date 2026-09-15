import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores(['.next/**', 'data/**', 'next-env.d.ts']),
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'next',
                'next/**',
                'react',
                'react-dom',
                'node:*',
                '@/infrastructure/**',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message:
                'El dominio y los casos de uso dependen solo de puertos y reglas de negocio.',
            },
          ],
        },
      ],
    },
  },
]);

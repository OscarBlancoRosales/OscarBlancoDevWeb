import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';

const TS_STRICT = [
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
];

/** Lo que el conjunto estricto deja apagado y aquí sí se exige. */
const TS_EXTRA = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  // El fallo que esta regla persigue es sacar un método de su objeto y perder
  // el `this`. Un método ESTÁTICO no tiene ese problema: no hay instancia de la
  // que separarlo. Sin esta excepción, cada `Validators.required` de cada
  // formulario de Angular era un aviso, y once avisos que nunca son un fallo
  // esconden a los que sí lo son.
  '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
  // Interpolar un número en una plantilla es normal y no esconde ningún
  // `[object Object]`. Prohibirlo solo produce `String(...)` por todas partes.
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  // Quitar una clave con desestructuración deja una variable que nadie usa a
  // propósito. Prefijarla con `_` es la forma estándar de decirlo.
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.angular/**',
      '**/out-tsc/**',
      '**/.claude/**',
      // Cachés y borradores locales: no son del proyecto, no están en ningún
      // tsconfig y git ya los ignora. Sin esto el lint falla en la máquina de
      // quien tenga ahí un experimento a medias, y en el CI no.
      '**/.cache/**',
      'tools/**/*.mjs',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: TS_STRICT,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: TS_EXTRA,
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    languageOptions: { parser: angular.templateParser },
  },
  /**
   * En una prueba, estas reglas no señalan un fallo: describen su oficio.
   *
   * Un test manipula estructuras que el compilador no conoce —el estado interno
   * de un componente, la carga de un mensaje, un doble de `vi.fn()`—, y `!` es
   * la forma corta de decir «esto tiene que existir, y si no existe quiero que
   * el test reviente aquí». Eso es exactamente lo que se le pide a una prueba.
   * En producción es lo contrario, y ahí siguen siendo error.
   *
   * `require-await` cae por lo mismo: `it('...', async () => ...)` sin nada que
   * esperar dentro es la forma normal de escribir un caso, no un descuido.
   */
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    ignores: ['packages/shared/src/platform.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator'].map((name) => ({
          name,
          message: 'En el servidor no existe. Usa packages/shared/src/platform.ts.',
        })),
      ],
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*'],
              message: 'shared no puede depender del framework: lo consume también el servidor.',
            },
            {
              group: ['rxjs', 'rxjs/*'],
              message: 'shared es dominio puro; los observables viven en la web.',
            },
            {
              group: ['node:*'],
              message: 'shared no puede depender de Node: lo consume también el navegador.',
            },
            {
              group: ['firebase', 'firebase/*'],
              message: 'shared no habla con ningún backend.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/apps/server/**',
                '**/server/src/**',
                '@devweb/server',
                '@devweb/server/*',
              ],
              message:
                'La web no importa nada del servidor. Ahí viven las respuestas del Trivial, y en el bundle dejarían de ser respuestas.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);

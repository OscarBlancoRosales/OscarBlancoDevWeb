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

/**
 * Código heredado: todo lo que ya existía antes del backend propio, esté donde
 * esté después de la mudanza al monorepo. El motor de RISK cambia de carpeta,
 * no de edad.
 */
const LEGACY_TS = [
  'apps/web/**/*.ts',
  'src/**/*.ts',
  'tools/**/*.ts',
  'packages/shared/src/engine/**/*.ts',
];
const LEGACY_HTML = ['apps/web/**/*.html', 'src/**/*.html'];

/**
 * Las mismas reglas, bajadas a aviso.
 *
 * Se derivan del conjunto en lugar de enumerarse porque una lista escrita a mano
 * se queda corta en cuanto el conjunto crece, y quedarse corta aquí significa un
 * error bloqueante inesperado en código heredado que nadie iba a tocar.
 */
function asWarnings(configs) {
  const merged = Object.assign({}, ...configs.map((config) => config.rules ?? {}));
  const entries = Object.entries(merged)
    .filter(([, level]) => level !== 'off' && level !== 0)
    .map(([rule, level]) => [rule, Array.isArray(level) ? ['warn', ...level.slice(1)] : 'warn']);
  return Object.fromEntries(entries);
}

/**
 * El código nuevo cumple las reglas o no entra. El heredado avisa y no bloquea.
 *
 * Aplicar `strictTypeChecked` de golpe sobre la web actual son más de mil
 * errores, la mayoría aserciones `!` e interpolaciones sin tipo. Ponerlos como
 * error deja el repositorio en rojo permanente, y un rojo permanente no lo mira
 * nadie: lo primero que se aprende es a ignorar el lint. Como aviso siguen a la
 * vista, y `--max-warnings` en CI impide que la cuenta suba.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.angular/**',
      '**/out-tsc/**',
      '**/.claude/**',
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
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    languageOptions: { parser: angular.templateParser },
  },
  {
    files: LEGACY_TS,
    rules: { ...asWarnings(TS_STRICT), ...asWarnings([{ rules: TS_EXTRA }]) },
  },
  {
    files: LEGACY_HTML,
    extends: [...angular.configs.templateRecommended],
    languageOptions: { parser: angular.templateParser },
    rules: asWarnings(angular.configs.templateRecommended),
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
  prettier,
);

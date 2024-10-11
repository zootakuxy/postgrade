
// Funções utilitárias
import {EnvOptions} from "../../env";


type Split<S extends string, D extends string> =
    S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

// Função para capitalizar a primeira letra
type Capitalize<S extends string> =
    S extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : S;

// Função para transformar uma string em camelCase
type CamelCase<S extends string> =
    S extends `${infer First}_${infer Rest}`
        ? `${Lowercase<First>}${Capitalize<CamelCase<Rest>>}`
        : Lowercase<S>;

// Tipo principal que une as partes em uma string com "."
type JoinWithDot<T extends string[]> =
    T extends [infer F, ...infer R]
        // @ts-ignore
        ? `${F & string}${R extends [] ? '' : `.${JoinWithDot<R>}`}`
        : '';

// Tipo que combina todas as operações
type Transform<S extends string> =
// @ts-ignore
    JoinWithDot<Split<S, "_"> extends infer U ? (U extends string[] ? { [K in keyof U]: CamelCase<U[K]> } : never) : never>;

// Extraindo as chaves da classe EnvOptions
type EnvOptionsKeys = keyof EnvOptions;

// Transformando as chaves em um tipo que segue a lógica desejada
export type EnvArgsOptions<EV extends {[K in keyof EV]:EV[K]}> = {
// @ts-ignore
    [K in EnvOptionsKeys as K extends string ? Transform<K> : never]: (keyof EV)[K];
};
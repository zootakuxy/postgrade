import {install} from "source-map-support";

install();

import Ajv from "ajv";
import ts from "typescript";
import * as TJS from "typescript-json-schema";
import Path from "path";


const ajv = new Ajv();

// Função para gerar o JSON Schema a partir de uma string TypeScript
function generateSchemaFromTypeScriptDynamic(definition: string, typeName: string) {
    // Cria um host de memória e um compilador TypeScript para processar o código
    const compilerOptions = { strictNullChecks: true };
    TJS.get
    const program = TJS.getProgramFromFiles(
        [Path.join(__dirname, /*language=file-reference*/  "sample.ts")],
        { strictNullChecks: true },

        // ts.createCompilerHost({
        //     readFile: () => definition,
        //     fileExists: () => true,
        //     writeFile: () => {},
        //     directoryExists: () => true,
        //     getDirectories: () => [],
        //     getCanonicalFileName: (fileName) => fileName,
        //     getCurrentDirectory: () => "",
        //     useCaseSensitiveFileNames: () => true,
        //     getNewLine: () => "\n",
        // })
    );

    // Gera o schema para o tipo especificado
    return TJS.generateSchema(program, typeName, { required: true });
}

// Definição do tipo TypeScript
const definition = `
    interface User {
        name: string;
        age?: number;
        contacts: {
            country: string;
            number?: string;
        }[];
    }
`;

// Gera o schema para o tipo "User"
const schema = generateSchemaFromTypeScriptDynamic(definition, "User");

// Dados para teste
const data = { name: "Alice", contacts: [{ country: "USA", number: "123456" }] };

// Validação dos dados usando `ajv`
if (schema) {
    const valid = ajv.validate(schema, data);
    if (!valid) {
        console.log("Erros de validação:", ajv.errors);
    } else {
        console.log("Os dados estão válidos!");
    }
} else {
    console.log("Falha ao gerar o schema.");
}

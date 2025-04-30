import OpenAI from "openai";
import { verifyJWT } from "@/lib/util";
import { PrismaClient, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const JINA_URL = process.env.JINA_URL;
const JINA_API_KEY = process.env.JINA_API_KEY;
const SECRET = process.env.SECRET;

interface ExerciseParameters {
  tema: string;
  quantidade: string;
  nivel: string;
  tipos: string[];
  webContent?: any[];
}

// This type ensures that ExerciseParameters can be safely assigned to Prisma.InputJsonValue
type SerializableExerciseParameters = {
  [K in keyof ExerciseParameters]: ExerciseParameters[K] extends (infer U)[]
    ? U extends object
      ? string // Serialize arrays of objects to string
      : ExerciseParameters[K]
    : ExerciseParameters[K];
};

function serializeParameters(params: ExerciseParameters): SerializableExerciseParameters {
  return {
    ...params,
    tipos: params.tipos,
    webContent: params.webContent ? params.webContent : [],
  };
}

async function handleAuthentication(request: Request): Promise<string | Response> {
  const token = request.headers.get("Token");
  if (!token) {
    return new Response("Token não encontrado", { status: 401 });
  }
  if (!SECRET) {
    return new Response("Erro interno do servidor", { status: 500 });
  }
  const decoded = await verifyJWT(token, SECRET);
  if (typeof decoded === "object") {
    return decoded.id;
  }
  return new Response("Token inválido", { status: 401 });
}

// Zod Schema for Exercises
const OptionSchema = z.object({
  a: z.string(),
  b: z.string(),
  c: z.string(),
  d: z.string(),
});

const AlternativeQuestionSchema = z.object({
  question: z.string(),
  type: z.literal("alternativa"),
  options: OptionSchema,
  correct_answer: z.enum(["a", "b", "c", "d"]),
  explanation: z.string(),
  source: z.union([z.string(), z.null()]),
});

const EssayQuestionSchema = z.object({
  question: z.string(),
  type: z.literal("dissertativa"),
  answer: z.string(),
  source: z.union([z.string(), z.null()]),
});

const QuestionSchema = z.union([AlternativeQuestionSchema, EssayQuestionSchema]);

const ExerciseSchema = z.object({
  questions: z.array(QuestionSchema),
});

async function generateOptimizedQueries(parameters: ExerciseParameters): Promise<string[]> {
  const query = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content: "Você é um otimizador de querys. Dado parâmetros, crie 3 querys otimizadas para pesquisas em um mecanismo de busca como Google a respeito do tema. Faça cada query buscar um assunto diferente dentro do mesmo tema. Faça-as serem curtas com no máximo 10 palavras. Responda em português brasileiro. Elas devem estar em um JSON com a propriedade querys que deve conter um array com apenas o texto das querys. Comece sempre com 'Exercícios sobre...' ou 'Questões sobre...' e coloque também o nível de escolaridade, por exemplo: 'Exercícios sobre matemática para ensino fundamental'."
      },
      {
        role: "user",
        content: JSON.stringify(parameters),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 1,
    max_tokens: 1024,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  const querys = JSON.parse(query.choices[0].message.content ?? "");
  return querys.querys.map((query: string) => query.replace(/ /g, "%20"));
}

async function fetchWebContent(query: string): Promise<any[]> {
  try {
    const formattedQuery = query.replace(/ /g, "%20");
    const busca = `${JINA_URL}${formattedQuery}`;
    console.log(busca);

    const webContent = await fetch(busca, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        Accept: "application/json",
        "X-Locale": "pt-BR",
        "X-With-Generated-Alt": "true",
        "X-Engine": "direct"
      },
    });

    const data = await webContent.json();
    return [data.data[0], data.data[1], data.data[2]];
  } catch (error) {
    console.error(`Erro ao buscar conteúdo web para a query "${query}":`, error);
    return [];
  }
}

async function generateExercises(parameters: ExerciseParameters): Promise<any> {
  const response = await openai.chat.completions.create({
    model: "o4-mini",
    reasoning_effort: "medium",
    tools: [
      {
        type: "function",
        function: {
          name: "webSearch",
          description: "Buscar conteúdo na web, utilize essa ferramenta para buscar conteúdo na web para complementar suas respostas. Utilize sempre que precisar de mais informações sobre um tópico ou para enriquecer os exercícios com exemplos e contextos atualizados.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Query para busca na web"
              }
            },
            required: ["query"],
            additionalProperties: false
          }
        }
      }
    ],
    tool_choice: "auto",
    response_format: zodResponseFormat(ExerciseSchema, "exercises"),
    messages: [
      {
        role: "system",
        content: "Você é um assistente de IA educacional projetado para gerar exercícios com base na entrada do usuário. Responda seguindo o schema definido para exercícios. O parâmetro WebContent irá conter links de sites e seus respectivos conteúdos que devem conter exercícios sobre o tema. Utilize esse conteúdo para gerar os exercícios. Dê preferência para exercícios que estejam dentro do WebContent, e coloque juntamente do enunciado deles o seu link original. Se precisar de mais informações sobre o tema ou exemplos adicionais, você pode utilizar a ferramenta de busca na web para encontrar conteúdo relevante. Tome cuidado para não criar alternativas muito grandes que possam exceder 120 caracteres."
      },
      {
        role: "user",
        content: JSON.stringify(parameters),
      },
    ],
    max_completion_tokens: 100000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  // Processar tool_calls se houver
  const toolCalls = response.choices[0].message.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const webSearchCalls = toolCalls.filter(
      (call) => call.function.name === "webSearch"
    );
    
    const results = await Promise.all(
      webSearchCalls.map(async (call) => {
        const args = JSON.parse(call.function.arguments);
        return await fetchWebContent(args.query);
      })
    );
    
    // Adicionar resultados aos parâmetros
    parameters.webContent = [
      ...(parameters.webContent || []),
      ...results.flat()
    ];
    
    // Segunda chamada para incorporar os resultados
    return await generateExercisesWithResults(parameters);
  }

  return JSON.parse(response.choices[0].message?.content ?? "");
}

// Função adicional para gerar os exercícios finais com os resultados da busca
async function generateExercisesWithResults(parameters: ExerciseParameters): Promise<any> {
  const response = await openai.chat.completions.create({
    model: "o4-mini",
    reasoning_effort: "medium",
    response_format: zodResponseFormat(ExerciseSchema, "exercises"),
    messages: [
      {
        role: "system",
        content: "Você é um assistente de IA educacional projetado para gerar exercícios com base na entrada do usuário e nos resultados de busca na web. Responda seguindo o schema definido para exercícios. Utilize o conteúdo do parâmetro webContent para gerar exercícios de qualidade, citando as fontes quando disponíveis. Tome cuidado para não criar alternativas muito grandes que possam exceder 120 caracteres."
      },
      {
        role: "user",
        content: JSON.stringify(parameters),
      },
    ],
    max_completion_tokens: 100000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  return JSON.parse(response.choices[0].message?.content ?? "");
}

async function saveExercises(userId: string, parameters: ExerciseParameters, content: any): Promise<string> {
  const uuid = uuidv4();
  const serializedParams = serializeParameters(parameters);
  const savedContent = await prisma.exercises.create({
    data: {
      id: uuid,
      v: 1,
      date: new Date(),
      params: serializedParams as Prisma.InputJsonValue,
      content: content,
      author: {
        connect: { id: userId },
      },
    },
  });
  return savedContent.id;
}

export async function POST(request: Request) {
  const userId = await handleAuthentication(request);
  if (userId instanceof Response) return userId;

  const parameters: ExerciseParameters = await request.json();
  parameters.webContent = [];

  const optimizedQueries = await generateOptimizedQueries(parameters);
  const webContentPromises = optimizedQueries.map(fetchWebContent);
  const webContentResults = await Promise.all(webContentPromises);
  parameters.webContent = webContentResults.flat();

  const exercises = await generateExercises(parameters);
  const savedId = await saveExercises(userId, parameters, exercises);

  return new Response(JSON.stringify({ id: savedId }));
}

export async function GET(request: Request) {
  const userId = await handleAuthentication(request);
  if (userId instanceof Response) return userId;

  const exercises = await prisma.exercises.findMany({
    where: { authorId: userId },
  });

  return new Response(JSON.stringify(exercises));
}

export async function PUT(request: Request) {
  const userId = await handleAuthentication(request);
  if (userId instanceof Response) return userId;

  const formData = await request.formData();
  const parameters: ExerciseParameters = {
    tema: formData.get("tema") as string,
    quantidade: formData.get("quantidade") as string,
    nivel: formData.get("nivel") as string,
    tipos: JSON.parse(formData.get("tipos") as string),
  };

  const files: File[] = formData.getAll("files").filter((file): file is File => file instanceof File);

  const assistant = await createAssistant(userId, parameters.tema);
  const vectorStore = await createVectorStore(userId, parameters.tema);
  await uploadFiles(vectorStore.id, files);
  await updateAssistant(assistant.id, vectorStore.id);

  const thread = await openai.beta.threads.create();
  await sendMessageToThread(thread.id, parameters);
  const run = await createAndWaitForRun(thread.id, assistant.id);

  if (run.status === "completed") {
    const content = await getCompletedRunContent(thread.id);
    const savedId = await saveExercises(userId, parameters, content);
    return new Response(JSON.stringify({ id: savedId }));
  }

  return new Response("Erro interno do servidor", { status: 500 });
}

async function createAssistant(userId: string, tema: string) {
  return await openai.beta.assistants.create({
    name: `${tema}_${userId}`,
    model: "gpt-4.1-mini",
    tools: [{ type: "file_search" }],
    instructions: 'Você é um assistente de IA educacional projetado para gerar exercícios com base na entrada do usuário. Responda com um JSON contendo os exercícios solicitados, seguindo os parâmetros fornecidos. A resposta deve ser um JSON válido, sem quebras de linha ou outros caracteres especiais, e deve incluir um array chamado "questions". Cada item deste array deve conter os seguintes atributos: "question": O texto da pergunta. "type": O tipo de questão, que pode ser "alternativa" ou "dissertativa". Se o tipo for "alternativa", deve conter um objeto "options" com as propriedades "a", "b", "c", e "d", cada uma com o texto da respectiva alternativa. O item também deve conter um "correct_answer" com a letra da alternativa correta e uma "explanation" explicando por que essa resposta está correta. Se o tipo for "dissertativa", deve conter um "answer" com a resposta por extenso. Tome cuidado para não criar alternativas muito grandes que possam exceder 120 caracteres',
  });
}

async function createVectorStore(userId: string, tema: string) {
  return await openai.vectorStores.create({ name: `${tema}_${userId}` });
}

async function uploadFiles(vectorStoreId: string, files: File[]) {
  let fileBatch = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, { files });
  while (fileBatch.status !== "completed") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    fileBatch = await openai.vectorStores.fileBatches.retrieve(vectorStoreId, fileBatch.id);
  }
}

async function updateAssistant(assistantId: string, vectorStoreId: string) {
  return await openai.beta.assistants.update(assistantId, {
    tool_resources: { "file_search": { "vector_store_ids": [vectorStoreId] } }
  });
}

async function sendMessageToThread(threadId: string, parameters: ExerciseParameters) {
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: JSON.stringify(parameters),
  });
}

async function createAndWaitForRun(threadId: string, assistantId: string) {
  const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
  let retrieveRun = await openai.beta.threads.runs.retrieve(run.thread_id, run.id);
  while (retrieveRun.status !== "completed") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    retrieveRun = await openai.beta.threads.runs.retrieve(run.thread_id, run.id);
  }
  return retrieveRun;
}

async function getCompletedRunContent(threadId: string) {
  const messages = await openai.beta.threads.messages.list(threadId);
  const content = (messages as any).body.data[0].content[0].text.value;
  return JSON.parse(content);
}
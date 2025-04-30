import { verifyJWT } from "@/lib/util";
import { Prisma, PrismaClient } from "@prisma/client";
import { generateText, streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ExerciseSchema } from "../exercises/route";

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const prisma = new PrismaClient();
const JINA_URL = process.env.JINA_URL;
const JINA_API_KEY = process.env.JINA_API_KEY;
const SECRET = process.env.SECRET;

async function authenticateUser(request: Request): Promise<string | Response> {
  const token = request.headers.get("Token");
  if (!token) return new Response("Token não encontrado", { status: 401 });
  if (!SECRET) return new Response("Erro interno do servidor", { status: 500 });

  const decoded = await verifyJWT(token, SECRET);
  return typeof decoded === "object"
    ? decoded.id
    : new Response("Token inválido", { status: 401 });
}

async function saveChatMessage(
  userId: string,
  chatId: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (!chatId) throw new Error("Chat ID is required");

  const title = await generateChatTitle(messages); // Function to generate chat title

  const existingChat = await prisma.chat.findUnique({
    where: { id: chatId, authorId: userId },
  });

  if (existingChat) {
    await prisma.chat.update({
      where: { id: chatId },
      data: { content: messages, title }, // Update title
    });
    return chatId;
  }

  await prisma.chat.create({
    data: {
      id: chatId,
      v: 1,
      date: new Date(),
      params: {},
      content: messages,
      title, // Set title
      author: { connect: { id: userId } },
    },
  });
  return chatId;
}

async function generateChatTitle(
  messages: { role: string; content: string }[]
): Promise<string> {
  const model = openai("gpt-4.1-nano");
  const { text } = await generateText({
    system:
      "dado um conjunto de mensagens, gerar um título curto para o chat, nao utilize de markdown nem de '' ou `` para começar e terminar o texto, apenas o texto com pontuação normal, também não coloque sophia no titulo dos textos gerados, coloque apenas sobre o que se trata a conversa",
    model,
    prompt: messages
      .map((m) => `${m.role === "user" ? "Você" : "Sophia"}: ${m.content}`)
      .join("\n"),
  });
  return text;
}

async function handleChatPost(req: Request) {
  const { messages, chat_id } = await req.json();
  const userIdOrResponse = await authenticateUser(req);
  if (typeof userIdOrResponse !== "string") return userIdOrResponse;

  const userId = userIdOrResponse;
  const model = openai("gpt-4.1");

  const result = await streamText({
    system: `**Data Atual:** ${new Date().toISOString().split('T')[0]}

**Objetivo Principal:** Atuar como Sophia, uma assistente educacional interativa e personalizada, para guiar os usuários em um processo de aprendizado eficiente e engajador sobre o tema solicitado.

**Persona:** Sophia - Assistente Educacional
*   **Tom:** Interativo, encorajador, paciente, claro e personalizado.
*   **Foco:** Facilitar o aprendizado ativo, não apenas fornecer respostas diretas.

**Diretrizes Fundamentais:**
1.  **Estimular Pensamento Ativo:** Incentive reflexão, questionamento e exploração de ideias. Evite respostas diretas sempre que possível.
2.  **Estruturação Clara:** Divida tópicos complexos em partes menores e compreensíveis. Verifique a compreensão frequentemente.
3.  **Exercícios Interativos:** Adapte atividades (tipo, quantidade) ao usuário e ao progresso. Use a ferramenta \`createExercises\` quando apropriado, após coletar as preferências do usuário.
4.  **Recursos Visuais:** Utilize links de imagens (obtidos via \`webSearch\`) em Markdown para ilustrar conceitos complexos, quando apropriado.
5.  **Feedback Contínuo:** Ofereça feedback construtivo e reconheça o progresso do usuário.
6.  **Contextualização Prática:** Relacione a teoria com situações do cotidiano ou casos práticos.
7.  **Simplificação Gradual:** Explique conceitos em linguagem acessível e introduza terminologias técnicas progressivamente, com exemplos.
8.  **Adaptação ao Usuário:** Monitore o progresso e ajuste o ritmo, a profundidade e o estilo do conteúdo conforme as necessidades e preferências do usuário.

**Processo de Interação (Ao receber um pedido de ajuda sobre um tema):**
1.  **Coleta de Informações (Sutilmente, sem parecer um questionário):**
    *   Qual é o nível de conhecimento atual do usuário sobre o tema?
    *   Quais tipos de material (texto, vídeos, podcasts) e formato de atividade (múltipla escolha, dissertativo) são preferidos?
    *   Qual é o objetivo de aprendizado específico?
2.  **Ensino:**
    *   Explique conceitos com clareza, conectando-os a cenários práticos.
    *   Crie/proponha atividades interativas (comece com poucas, ex.: 5 por etapa; aumente conforme o progresso, ex.: 15 ao final).
    *   Ofereça links para materiais complementares usando a ferramenta \`webSearch\`.
    *   Pergunte ao usuário se ele se sente pronto para avançar ou precisa de mais explicações/revisão antes de prosseguir.
3.  **Conclusão de Etapa:** Faça uma recapitulação do que foi aprendido e incentive o usuário para o próximo desafio.

Lembre de não ficar perguntando isso o tempo todo, apenas pergunte quando for necessário, e sempre que possível, forneça respostas diretas e claras.

**Regras de Formatação e Uso de Ferramentas:**
*   **Markdown:** SEMPRE formate suas respostas usando Markdown.
*   **LaTeX para Matemática:** SEMPRE use LaTeX para QUALQUER número, fórmula ou expressão matemática (mesmo as simples como 'x' ou 'q = 1'). Envolva a expressão em cifrões duplos: \`$$expressão$$\`. Exemplos: \`$$x^2 + y^2 = z^2$$\`, \`$$5$$\`, \`$$a = b + c$$\`.
*   **Imagens:** Use links de imagens obtidos pela ferramenta \`webSearch\` para exibir imagens com a sintaxe Markdown: \`![alt text](URL_da_imagem)\`.
*   **Ferramenta \`webSearch\`:** Utilize-a proativamente para buscar conteúdo na web, enriquecer suas respostas com informações atualizadas, exemplos e links relevantes. Cite as fontes/links retornados pela busca. Ao pesquisar imagens, use termos diretos (ex: "cachorro", não "imagem de um cachorro").
*   **Ferramenta \`createExercises\`:** Use esta ferramenta para gerar exercícios quando solicitado ou quando julgar apropriado para a prática do usuário. Certifique-se de ter informações sobre tema, quantidade, nível e tipos desejados antes de chamar a ferramenta. Retorne o link gerado pela ferramenta diretamente na sua resposta.

**Restrições:**
*   Responda sempre em Português Brasileiro.
*   Mantenha a persona de Sophia durante toda a interação.
*   Seja paciente e encorajador. Respire fundo e aborde cada problema passo a passo.
`,
    model,
    messages,
    maxTokens: 20000,
    maxSteps: 10,
    temperature: 0.7,
    async onFinish({ text }) {
      messages.push({ role: "assistant", content: text });
      await saveChatMessage(userId, chat_id, messages);
    },
    tools: {
      webSearch: tool({
        description:
          "Buscar conteúdo na web, utilize essa ferramenta para buscar conteúdo na web para complementar suas respostas, não é necessário pedir permissão do usuário para isto, no final de toda resposta referêncie os links que foram retornados pela busca. Utilize SEMPRE que possível essa ferramenta para buscar conteúdo na web, mesmo que o usuário não tenha pedido, pois isso enriquece a experiência do usuário. Quando for procurar por uma imagem pesquise só o nome da coisa pesquisa só cachorro e não imagem de um cachorro",
        parameters: z.object({
          query: z.string().describe("Query para busca na web"),
        }),
        execute: async ({ query }) => fetchWebContent(query),
      }),
      createExercises: tool({
        description:
          "Gerar uma lista de exercicios para o usuário com base nos parametros fornecidos, antes de chamar essa ferramenta, pergunte ao usuário mais informações sobre o que ele deseja, como tema, quantidade, nível e tipos de exercícios, após isso, chame essa ferramenta com os parametros fornecidos, a resposta da ferramenta será um link para umaa página com os exercicios gerados onde o usuário pode responder os exercicios e ver as respostas corretas, tanto de questôes alternativas quanto dissertativas, sempre use essa feramenta para gerar exercicios, no tema dos exercicios você pode ser mais especifico como exercicios de programação onde o usuário recebe um enunciado e deve escrever um código que resolva o problema, ou exercicios de matemática onde o usuário recebe um enunciado e deve responder com um número. Sempre especifique o tema por exemplo matrizes e vetores podem ser para matemática ou programação, dependendo do contexto.",
        parameters: z.object({
          tema: z.string().describe("Tema dos exercícios"),
          quantidade: z.string().describe("Quantidade de exercícios"),
          nivel: z
            .string()
            .describe(
              "Nível dos exercícios (pode ser por dificuldade ou série)"
            ),
          tipos: z
            .array(z.string())
            .describe(
              'Tipos de exercícios, só podem ser "Alternativas" ou "Dissertativas"'
            ),
        }),
        execute: async (params) => {
          const exerciseId = await generateAndSaveExercises(params);
          return `https://aprendacomsophia.com/exercises/${exerciseId}`;
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}

async function handleChatGet(req: Request) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chat_id");
  const userIdOrResponse = await authenticateUser(req);
  if (typeof userIdOrResponse !== "string") return userIdOrResponse;

  const userId = userIdOrResponse;

  if (chatId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId, authorId: userId },
      include: { author: true },
    });

    if (!chat) return new Response("Chat not found", { status: 404 });
    return new Response(
      JSON.stringify({ messages: chat.content, title: chat.title }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const chats = await prisma.chat.findMany({
    where: { authorId: userId },
    orderBy: { date: "desc" },
    select: { id: true, title: true },
  });

  const chatSummaries = chats.map((chat: { id: any; title: any; }) => ({
    id: chat.id,
    title: chat.title,
  }));

  return new Response(JSON.stringify(chatSummaries), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  return handleChatPost(req);
}

export async function GET(req: Request) {
  return handleChatGet(req);
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


interface ExerciseParameters {
  tema: string;
  quantidade: string;
  nivel: string;
  tipos: string[];
  webContent?: any[];
}

// Esta função é a mesma da rota POST, apenas sem a verificação do token
async function generateAndSaveExercises(
  parameters: ExerciseParameters
): Promise<string> {
  const uuid = uuidv4();
  const serializedParams = serializeParameters(parameters);
  const webContentPromises = (await generateOptimizedQueries(parameters)).map(
    fetchWebContent
  );
  const webContentResults = await Promise.all(webContentPromises);
  parameters.webContent = webContentResults.flat();

  const exercises = await generateExercises(parameters);
  const savedContent = await prisma.exercises.create({
    data: {
      id: uuid,
      v: 1,
      date: new Date(),
      params: serializedParams as Prisma.InputJsonValue,
      content: exercises,
    },
  });

  return savedContent.id;
}

type SerializableExerciseParameters = {
  [K in keyof ExerciseParameters]: ExerciseParameters[K] extends (infer U)[]
    ? U extends object
      ? string // Serialize arrays of objects to string
      : ExerciseParameters[K]
    : ExerciseParameters[K];
};

function serializeParameters(
  params: ExerciseParameters
): SerializableExerciseParameters {
  return {
    ...params,
    tipos: params.tipos,
    webContent: params.webContent ? params.webContent : [],
  };
}

async function generateExercises(parameters: ExerciseParameters): Promise<any> {
  const response = await openAI.chat.completions.create({
    model: "o4-mini",
    reasoning_effort: "medium",
    response_format: zodResponseFormat(ExerciseSchema, "exercises"),
    messages: [
      {
        role: "system",
        content:
          "Você é um assistente de IA educacional projetado para gerar exercícios com base na entrada do usuário. Responda com um JSON contendo os exercícios solicitados, seguindo os parâmetros fornecidos. O parâmetro WebContent irá conter links de sites e seus respectivos conteúdos que devem conter exercícios sobre o tema. Utilize esse conteúdo para gerar os exercícios. Dê preferência para exercícios que estejam dentro do WebContent, e coloque juntamente do enunciado deles o seu link original. A resposta deve ser um JSON válido, sem quebras de linha ou outros caracteres especiais, e deve incluir um array chamado 'questions'. Cada item deste array deve conter os seguintes atributos: 'question': O texto da pergunta. 'type': O tipo de questão, que pode ser 'alternativa' ou 'dissertativa'. Se o tipo for 'alternativa', deve conter um objeto 'options' com as propriedades 'a', 'b', 'c', e 'd', cada uma com o texto da respectiva alternativa. O item também deve conter um 'correct_answer' com a letra da alternativa correta e uma 'explanation' explicando por que essa resposta está correta. Se o tipo for 'dissertativa', deve conter um 'answer' com a resposta por extenso. Caso o exercício tenha sua fonte como um dos sites do WebContent, coloque o link original do site na propriedade 'source' do exercício. Tome cuidado para não criar alternativas muito grandes que possam exceder 120 caracteres.",
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

async function generateOptimizedQueries(
  parameters: ExerciseParameters
): Promise<string[]> {
  const query = await openAI.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content:
          "Você é um otimizador de querys. Dado parâmetros, crie 3 querys otimizadas para pesquisas em um mecanismo de busca como Google a respeito do tema. Faça cada query buscar um assunto diferente dentro do mesmo tema. Faça-as serem curtas com no máximo 10 palavras. Responda em português brasileiro. Elas devem estar em um JSON com a propriedade querys que deve conter um array com apenas o texto das querys. Comece sempre com 'Exercícios sobre...' ou 'Questões sobre...' e coloque também o nível de escolaridade, por exemplo: 'Exercícios sobre matemática para ensino fundamental'.",
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

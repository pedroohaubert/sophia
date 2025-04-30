import OpenAI from "openai";
import { verifyJWT } from "@/lib/util";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";


const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Funções auxiliares
const getTokenFromHeaders = (headers: Headers): string | null => headers.get("Token");

const validateToken = async (token: string | null, secret: string): Promise<string> => {
  console.log("Iniciando validação do token");
  if (!token) {
    console.error("Token não encontrado nos headers");
    throw new Error("Token não encontrado");
  }
  try {
    const decoded = await verifyJWT(token, secret);
    if (typeof decoded === "object" && decoded.id) {
      console.log(`Token validado com sucesso para o usuário ID: ${decoded.id}`);
      return decoded.id;
    }
    console.error("Decodificação do token falhou ou ID não encontrado", decoded);
    throw new Error("Token inválido");
  } catch (error) {
    console.error("Erro durante a verificação do JWT:", error);
    throw new Error("Token inválido");
  }
};

const saveCorrectionResult = async (
  uuid: string,
  userId: string,
  text: string,
  parsedContent: any
): Promise<{ id: string }> => {
  console.log(`Tentando salvar resultado da correção para o usuário ${userId} com UUID ${uuid}`);
  try {
    const result = await prisma.correcao.create({
      data: {
        id: uuid,
        v: 1,
        date: new Date(),
        params: { texto: text },
        authorId: userId,
        content: parsedContent,
      },
      select: { id: true } // Seleciona apenas o ID para retornar
    });
    console.log(`Correção salva com sucesso no banco de dados com ID: ${result.id}`);
    return result;
  } catch (error) {
    console.error(`Erro ao salvar correção no banco de dados para UUID ${uuid}:`, error);
    throw new Error("Falha ao salvar o resultado da correção");
  }
};

const Localizacao = z.object({
  sessao: z.string(),
  proximoDe: z.string()
});

const Erro = z.object({
  tipo: z.enum(["gramatica", "ortografia", "pontuacao", "estilo", "precisaoDados"]),
  descricao: z.string()
});

const Correcao = z.object({
  localizacao: Localizacao,
  frase: z.string(),
  erro: Erro,
  sugestao: z.string(),
  status: z.enum(["corrigido", "pendente"])
});

const NotaRevisao = z.object({
  localizacao: Localizacao,
  comentario: z.string(),
  sugestao: z.string()
});

const Categorias = z.object({
  gramatica: z.number(),
  ortografia: z.number(),
  pontuacao: z.number(),
  estilo: z.number(),
  precisaoDados: z.number()
});

const ResumoCorrecao = z.object({
  totalErros: z.number(),
  categorias: Categorias,
  melhoriasSugeridas: z.string()
});

const CorrecaoTextoSchema = z.object({
  resumoCorrecao: ResumoCorrecao,
  correcoes: z.array(Correcao),
  notasRevisao: z.array(NotaRevisao)
});

// Handlers
export async function POST(request: Request) {
  const requestStartTime = Date.now();
  const requestId = uuidv4(); // ID único para rastrear esta requisição nos logs
  console.log(`[${requestId}] Iniciando processamento da requisição POST /api/correcao`);

  try {
    let rawBody: string | undefined;
    let body: any;
    try {
      // Primeiro, tenta ler o corpo como texto para log em caso de erro
      rawBody = await request.text();
      body = JSON.parse(rawBody); // Agora tenta parsear o texto lido
      console.log(`[${requestId}] Corpo da requisição JSON parseado com sucesso.`);
    } catch (jsonError) {
      console.error(`[${requestId}] Erro ao parsear o JSON do corpo da requisição:`, jsonError);
      console.error(`[${requestId}] Corpo da requisição bruto recebido: ${rawBody}`); // Loga o corpo bruto
      throw new Error("Corpo da requisição contém JSON inválido.");
    }

    const token = getTokenFromHeaders(request.headers);
    const secret = process.env.SECRET;

    if (!secret) {
      console.error(`[${requestId}] Variável de ambiente SECRET não configurada.`);
      throw new Error("Erro interno do servidor: configuração ausente.");
    }

    const userId = await validateToken(token, secret);
    console.log(`[${requestId}] Token validado para o usuário ID: ${userId}`);

    const text = body.texto as string;
    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.error(`[${requestId}] Texto para correção ausente ou inválido.`);
        return new Response(JSON.stringify({ error: "Texto para correção é obrigatório." }), { status: 400 });
    }
    console.log(`[${requestId}] Texto recebido para correção (primeiros 100 chars): ${text.substring(0, 100)}...`);

    console.log(`[${requestId}] Iniciando chamada para chat.completions`);
    let completionResponse;
    let content: string | null = null;
    try {
        completionResponse = await openai.chat.completions.create({
            model: "o4-mini",
            reasoning_effort: "medium",
            response_format: zodResponseFormat(CorrecaoTextoSchema, "correcao"),
            messages: [
                {
                    role: "system",
                    content: 'Você é um assistente especialista em revisão e correção de textos acadêmicos e gerais em português brasileiro. Analise o texto fornecido pelo usuário e identifique erros de gramática, ortografia, pontuação, estilo e precisão de dados. Para cada erro, forneça a localização aproximada, a frase original, o tipo e descrição do erro, e uma sugestão de correção. Além disso, inclua notas de revisão para melhorias gerais e um resumo quantitativo dos erros por categoria. A precisão dos dados refere-se à veracidade das informações apresentadas. Sua resposta deve seguir estritamente o schema Zod fornecido.',
                },
                {
                    role: "user",
                    content: text,
                },
            ],
            max_completion_tokens: 100000,
        });

        console.log(`[${requestId}] Chamada para chat.completions bem-sucedida.`);
        content = completionResponse.choices[0].message?.content ?? null;

        if (!content) {
            console.error(`[${requestId}] Resposta da API de chat estava vazia ou nula.`);
            throw new Error("Serviço de correção retornou uma resposta vazia.");
        }
        console.log(`[${requestId}] Resposta bruta do chat recebida (primeiros 200 chars): ${content.substring(0, 200)}...`);

    } catch (error) {
        console.error(`[${requestId}] Erro durante a chamada para chat.completions ou validação Zod:`, error);
        if (error instanceof z.ZodError) {
             console.error(`[${requestId}] Detalhes do erro de validação Zod:`, error.errors);
             throw new Error("Formato de resposta inválido recebido do serviço de correção.");
        }
        throw new Error("Falha ao comunicar com o serviço de correção ou processar a resposta.");
    }

    if (!content) {
        console.error(`[${requestId}] Resposta da API de chat estava vazia ou nula após tentativa de parse pelo Zod.`);
        throw new Error("Serviço de correção retornou uma resposta vazia ou inválida.");
    }
    console.log(`[${requestId}] Objeto de resposta recebido e validado pelo Zod:`, JSON.stringify(content).substring(0, 200) + '...');

    // Faz o parse do content string para um objeto JavaScript antes de salvar
    const parsedContent = JSON.parse(content);

    const savedContent = await saveCorrectionResult(requestId, userId, text, parsedContent);
    console.log(`[${requestId}] Correção salva no banco de dados com ID: ${savedContent.id}`);

    const duration = Date.now() - requestStartTime;
    console.log(`[${requestId}] Requisição POST /api/correcao concluída com sucesso em ${duration}ms.`);

    return new Response(JSON.stringify({ id: savedContent.id }), { status: 200 });

  } catch (error: unknown) {
    const duration = Date.now() - requestStartTime;
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ocorreu";
    let statusCode = 500;

    console.error(`[${requestId}] Erro no processamento da requisição POST /api/correcao após ${duration}ms:`, error);


    if (errorMessage === "Token não encontrado" || errorMessage === "Token inválido") {
      statusCode = 401;
    } else if (errorMessage.includes("obrigatório") || errorMessage.includes("inválido")) {
        statusCode = 400;
    } else if (errorMessage.includes("Timeout")) {
        statusCode = 504;
    } else if (errorMessage.includes("Falha ao salvar") || errorMessage.includes("Falha ao comunicar") || errorMessage.includes("Formato de resposta inválido")) {
        statusCode = 500;
    } else if (errorMessage.includes("configuração ausente")) {
        statusCode = 500;
    } else if (errorMessage.includes("JSON inválido")) {
        statusCode = 400;
    }

    return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode });
  }
}

export async function GET(request: Request) {
   const requestStartTime = Date.now();
   const requestId = uuidv4();
   console.log(`[${requestId}] Iniciando processamento da requisição GET /api/correcao`);

  try {
    const token = getTokenFromHeaders(request.headers);
    const secret = process.env.SECRET;

    if (!secret) {
        console.error(`[${requestId}] Variável de ambiente SECRET não configurada.`);
        throw new Error("Erro interno do servidor: configuração ausente.");
    }

    const userId = await validateToken(token, secret);
    console.log(`[${requestId}] Buscando correções para o usuário ID: ${userId}`);


    const correcoes = await prisma.correcao.findMany({
      where: { authorId: userId },
      orderBy: {
          date: 'desc'
      }
    });
    console.log(`[${requestId}] Encontradas ${correcoes.length} correções para o usuário ${userId}.`);

    const duration = Date.now() - requestStartTime;
    console.log(`[${requestId}] Requisição GET /api/correcao concluída com sucesso em ${duration}ms.`);
    return new Response(JSON.stringify(correcoes), { status: 200 });

  } catch (error: unknown) {
    const duration = Date.now() - requestStartTime;
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    let statusCode = 500;

    console.error(`[${requestId}] Erro no processamento da requisição GET /api/correcao após ${duration}ms:`, error);

    if (errorMessage === "Token não encontrado" || errorMessage === "Token inválido") {
      statusCode = 401;
    } else if (errorMessage.includes("configuração ausente")) {
        statusCode = 500;
    }

    return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode });
  }
}



import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    const parameters = await request.json();

    const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content:
                    "Você é um corretor de questões dissertativas, dados os dados : questao, resposta correta e reposta do usuário, analise se a resposta é verdadeira ou falsa, de uma nota de 1 a 5 e retorne um json com o formato {acertou: boolean, mensagem: string, nota: number} onde acertou é um booleano indicando se a resposta está correta e mensagem é uma string com a mensagem de feedback, o json da resposta  não deve conter /n ou etc, deve ser um json convertível com o metodo JSON.parse. Utilize de linguagem simples e clara para a mensagem de feedback para que desde crianças a adultos possam compreender.",
            },
            {
                role: "user",
                content: JSON.stringify(parameters),
            },
        ],
        temperature: 1,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });
    const content = response.choices[0].message?.content;
    let parsedContent;
    if (content) {
        parsedContent = JSON.parse(content);
    }
    return new Response(JSON.stringify(parsedContent));
}

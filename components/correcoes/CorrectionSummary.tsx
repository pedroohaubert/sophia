import { Card, Badge } from '@nextui-org/react'
import { CardHeader, CardBody } from '@nextui-org/react'

type SummaryProps = {
  summary: {
    totalErros: number
    categorias: Record<string, number>
    melhoriasSugeridas: string
  }
}

export default function CorrectionSummary({ summary }: SummaryProps) {
    if (!summary) {
        return null // Ou um componente de loading/placeholder
    }

    return (
        <Card>
            <CardHeader>
                <h3><strong> Resumo da Correção</strong></h3>
            </CardHeader>
            <CardBody>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <span className="text-2xl font-bold">Total de Erros: {summary.totalErros}</span>
                    <div className="space-x-2 my-4 md:my-0 flex flex-col md:flex-row md:items-end items-start">
                        {Object.entries(summary.categorias).map(([category, count]) => (
                            category !== 'estilo' && (
                                <Badge key={category} color="primary" variant="flat">
                                    <strong className='mx-1'>{category === 'precisaoDados' ? 'precisão dos dados' : category}:</strong> {count}
                                </Badge>
                            )
                        ))}
                    </div>
                </div>
                <div className='py-4 bg-blue-500 text-zinc-50 rounded-lg items-start justify-center px-4 flex flex-col'>
                    <p className='font-semibold'>Melhorias Sugeridas: </p>
                    <p>{summary.melhoriasSugeridas}</p>
                </div>
            </CardBody>
        </Card>)
}

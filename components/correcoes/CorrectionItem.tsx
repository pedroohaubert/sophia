import { Chip, Divider } from '@nextui-org/react'

type CorrectionProps = {
  correction: {
    localizacao: { sessao: string; proximoDe: string }
    frase: string
    erro: { tipo: string; descricao: string }
    sugestao: string
    status: 'corrigido' | 'pendente'
  }
}

export default function CorrectionItem({ correction }: CorrectionProps) {
    if (!correction) {
        return null;
    }

    return (
        <div className="border p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-start">
                <span><strong>Proximo de:</strong> {correction.localizacao?.sessao} - {correction.localizacao?.proximoDe}</span>
                <Chip color={correction.status === 'corrigido' ? 'success' : 'danger'}>
                    {correction.status === 'corrigido' ? 'Corrigido' : 'Pendente'}
                </Chip>
            </div>
            <p className="text-sm mb-2 text-muted-foreground"><strong>Trecho: </strong>{correction.frase}</p>
            <Divider />
            <div className="bg-muted p-2 rounded text-sm">
                <strong>Erro: </strong> {correction.erro?.descricao}
            </div>
            <div className="bg-muted p-2 rounded text-sm">
                <strong>Sugestão:</strong> {correction.sugestao}
            </div>
        </div>
    )
}

import { Button } from "@nextui-org/react";
import { useState, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Link,
} from "@nextui-org/react";

export default function CorrectionsHistory() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [corrections, setCorrections] = useState([]);

    useEffect(() => {
        fetch('/api/correcao', {
            method: 'GET',
            headers: {
                'Token': localStorage.getItem("sophia_token") as string,
            },
        }).then(async (res) => {
            const data = await res.json();
            setCorrections(data);
        });
    }, []);

    return (
        <>
            <Button className="mb-4 mt-4" onPress={onOpen}>Histórico de correções</Button>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalHeader>Histórico de correções</ModalHeader>
                    <ModalBody>
                        {!corrections.length && <p>Nenhuma correção encontrada</p>}
                        {corrections.map((correction: any) => (
                            <p key={correction.id}> <Link href={`/correcoes/${correction.id}`}>Erros:{correction.content?.resumoCorrecao?.totalErros}, Frase: {correction.content?.correcoes?.[0]?.frase} {new Date(correction.date).toLocaleDateString('pt-BR')} </Link></p>
                        ))}
                    </ModalBody>
                    <ModalFooter>
                        <Button color="primary" onPress={onOpenChange}>
                            Fechar
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
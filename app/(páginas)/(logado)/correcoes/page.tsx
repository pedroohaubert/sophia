'use client'

import { useState, useEffect } from "react";
import CorrectionsHistory from "@/components/correcoes/CorrecoesHistory";
import CorrectionsForm from "@/components/correcoes/FormCorrections";

export default function Correcoes() {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [texto, setTexto] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("sophia_token");
        if (!token) {
            window.location.href = "/";
        }
        setToken(token);
    }, []);

    async function handleSubmit() {
        setLoading(true);
        setError("");

        if (!token) {
            setError("Erro de autenticação. Faça login novamente.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/correcao", {
                method: "POST",
                headers: {
                    "Token": token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ texto: texto }),
            });

            if (response.ok) {
                const data = await response.json();
                window.location.href = `/correcoes/${data.id}`;
            } else {
                const errorData = await response.json();
                setError(errorData.message);
            }
        } catch (error) {
            console.error("Erro na chamada fetch:", error);
            setError("Erro ao conectar com o servidor. Verifique sua conexão.");
        }

        setLoading(false);
    }

    return (
        <div className="overflow-x-hidden relative w-full flex flex-col items-center">
            <CorrectionsHistory />
            <CorrectionsForm
                texto={texto}
                setTexto={setTexto}
                loading={loading}
                error={error}
                handleSubmit={handleSubmit}
            />
        </div>
    );
}

import { Divider } from "@nextui-org/react";
import TextInput from "./TextInput";
import SubmitButton from "./SubmitButton";

interface CorrectionsFormProps {
  texto: string;
  setTexto: (value: string) => void;
  loading: boolean;
  error: string;
  handleSubmit: () => void;
}

const CorrectionsForm: React.FC<CorrectionsFormProps> = ({
  texto,
  setTexto,
  loading,
  error,
  handleSubmit
}) => {
  return (
    <main className="md:w-[45vw] mt-8 min-h-fit box-4 px-16 py-14 mb-12">
      <h1 className="text-4xl font-semibold">Corrigir texto</h1>
      <Divider className="my-4 gradient-divider"></Divider>
      <div className="flex flex-col gap-4">
        <TextInput texto={texto} setTexto={setTexto} />
        <SubmitButton loading={loading} handleSubmit={handleSubmit} />
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </main>
  );
};

export default CorrectionsForm;

import React, { useState } from 'react';
import { validateSandboxInput, SandboxValidationResponse } from '../services/fileApi';

const MAX_CHARS = 4096;

const Sandbox: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [output, setOutput] = useState<SandboxValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    setError(null);
    setOutput(null);

    const trimmed = inputText.trim();
    if (!trimmed) {
      setError('Veuillez saisir du texte à valider.');
      return;
    }

    setLoading(true);
    try {
      const resp = await validateSandboxInput(inputText);
      setOutput(resp);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "La validation a échoué. Veuillez réessayer plus tard.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output?.sanitized_text) return;
    try {
      await navigator.clipboard.writeText(output.sanitized_text);
    } catch {
      setError("Impossible de copier dans le presse-papiers. Copiez manuellement.");
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Sandbox de Validation de Contenu
        </h2>
        <p className="text-sm text-gray-600">
          Saisissez du texte ou du code à analyser. Le contenu sera validé et réécrit par un
          modèle local en appliquant les bonnes pratiques de sécurité. La sortie est en lecture seule.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="sandbox-input"
          className="block text-sm font-medium text-gray-700"
        >
          Entrée
        </label>
        <textarea
          id="sandbox-input"
          value={inputText}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) {
              setInputText(e.target.value);
            }
          }}
          rows={8}
          className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Collez ici le texte ou le code à valider..."
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Limite serveur&nbsp;: {MAX_CHARS} caractères</span>
          <span>
            {inputText.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleValidate}
          disabled={loading}
          className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white ${
            loading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
        >
          {loading ? 'Validation en cours...' : 'Valider la saisie'}
        </button>
      </div>

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="sandbox-output"
              className="block text-sm font-medium text-gray-700"
            >
              Sortie validée & sécurisée
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
            >
              Copier
            </button>
          </div>
          <textarea
            id="sandbox-output"
            value={output.sanitized_text}
            readOnly
            rows={8}
            className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono bg-gray-50 text-gray-900"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Modèle&nbsp;: {output.model}</span>
            <span>Longueur d&apos;entrée&nbsp;: {output.input_length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sandbox;


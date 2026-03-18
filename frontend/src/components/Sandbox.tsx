import React, { useState } from 'react';
import Markdown from 'react-markdown';
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Sandbox de Validation de Contenu
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Saisissez du texte ou du code à analyser. Le contenu sera validé et réécrit par un
          modèle local en appliquant les bonnes pratiques de sécurité. La sortie est en lecture seule.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="sandbox-input"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-3 text-sm font-mono bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5d2e8e] focus:border-[#5d2e8e]"
          placeholder="Collez ici le texte ou le code à valider..."
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
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
            loading ? 'bg-[#5d2e8e]/50 cursor-not-allowed' : 'bg-[#3a165d] hover:bg-[#5d2e8e]'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5d2e8e]`}
        >
          {loading ? 'Validation en cours...' : 'Valider la saisie'}
        </button>
      </div>

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="sandbox-output"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
          <div className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-3 text-sm font-mono bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-200 min-h-[12rem] overflow-y-auto overflow-x-hidden [word-break:break-word] [overflow-wrap:anywhere] [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_code]:bg-gray-200 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-900 [&_pre]:text-green-300 [&_pre]:p-3 [&_pre]:rounded [&_pre]:my-2 [&_pre]:whitespace-pre-wrap [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600 dark:[&_blockquote]:text-gray-400">
            <Markdown>{output.sanitized_text}</Markdown>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Modèle&nbsp;: {output.model}</span>
            <span>Longueur d&apos;entrée&nbsp;: {output.input_length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sandbox;


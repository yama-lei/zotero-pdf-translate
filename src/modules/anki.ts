/**
 * AnkiConnect Integration Module
 *
 * This module provides integration with Anki through the AnkiConnect plugin.
 * It allows users to add translated words/sentences to their Anki decks.
 *
 * AnkiConnect API documentation: https://foosoft.net/projects/anki-connect/
 */

import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { getString } from "../utils/locale";
import { getLastTranslateTask, TranslateTask } from "../utils/task";
import { slice } from "../utils/str";

const ANKI_CONNECT_VERSION = 6;
const DEFAULT_ANKI_CONNECT_URL = "http://127.0.0.1:8765";

interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

interface AnkiNoteParams {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
}

/**
 * Send a request to AnkiConnect
 */
async function ankiConnectRequest<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = (getPref("anki.endpoint") as string) || DEFAULT_ANKI_CONNECT_URL;

  const response = await Zotero.HTTP.request("POST", url, {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      version: ANKI_CONNECT_VERSION,
      params,
    }),
    responseType: "json",
    timeout: 5000,
  });

  if (response.status !== 200) {
    throw new Error(`AnkiConnect request failed: HTTP ${response.status}`);
  }

  const data = response.response as AnkiConnectResponse<T>;

  if (data.error) {
    throw new Error(`AnkiConnect error: ${data.error}`);
  }

  return data.result;
}

/**
 * Check if AnkiConnect is available
 */
export async function checkAnkiConnection(): Promise<boolean> {
  try {
    const version = await ankiConnectRequest<number>("version");
    return version >= 6;
  } catch {
    return false;
  }
}

/**
 * Get all deck names from Anki
 */
export async function getAnkiDeckNames(): Promise<string[]> {
  return await ankiConnectRequest<string[]>("deckNames");
}

/**
 * Get all model (note type) names from Anki
 */
export async function getAnkiModelNames(): Promise<string[]> {
  return await ankiConnectRequest<string[]>("modelNames");
}

/**
 * Get field names for a specific model
 */
export async function getAnkiModelFieldNames(
  modelName: string,
): Promise<string[]> {
  return await ankiConnectRequest<string[]>("modelFieldNames", { modelName });
}

/**
 * Add a note to Anki
 */
export async function addAnkiNote(note: AnkiNoteParams): Promise<number> {
  return await ankiConnectRequest<number>("addNote", { note });
}

/**
 * Check if a note can be added (no duplicates)
 */
export async function canAddAnkiNote(note: AnkiNoteParams): Promise<boolean> {
  const result = await ankiConnectRequest<boolean[]>("canAddNotes", {
    notes: [note],
  });
  return result[0];
}

/**
 * Build the Anki note based on translation task and settings
 */
function buildAnkiNote(
  task: TranslateTask,
  isWordMode: boolean,
): AnkiNoteParams {
  const deckName = (getPref("anki.deckName") as string) || "Default";
  const modelName = (getPref("anki.modelName") as string) || "Basic";
  const frontField = (getPref("anki.frontField") as string) || "Front";
  const backField = (getPref("anki.backField") as string) || "Back";
  const tags = ((getPref("anki.tags") as string) || "zotero,translate")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);

  const fields: Record<string, string> = {};

  if (isWordMode) {
    // For word mode, put the whole result (dictionary entry) in back
    fields[frontField] = task.raw;
    fields[backField] = task.result;
  } else {
    // For sentence mode, put original text and translation
    fields[frontField] = task.raw;
    fields[backField] = task.result;
  }

  return {
    deckName,
    modelName,
    fields,
    tags,
  };
}

/**
 * Add current translation to Anki
 */
export async function addToAnki(task?: TranslateTask): Promise<void> {
  task = task || getLastTranslateTask();

  if (!task || !task.raw || !task.result) {
    throw new Error(getString("anki-error-no-translation"));
  }

  // Check if AnkiConnect is available
  const isConnected = await checkAnkiConnection();
  if (!isConnected) {
    throw new Error(getString("anki-error-connection"));
  }

  // Determine if this is word mode (single word) or sentence mode
  const isWordMode = task.raw.trim().split(/\s+/).length === 1;

  // Build the note
  const note = buildAnkiNote(task, isWordMode);

  // Check if note can be added
  const canAdd = await canAddAnkiNote(note);
  if (!canAdd) {
    throw new Error(getString("anki-error-duplicate"));
  }

  // Add the note
  await addAnkiNote(note);
}

/**
 * Add to Anki with user feedback (progress window)
 */
export async function addToAnkiWithFeedback(
  task?: TranslateTask,
): Promise<void> {
  const progressWindow = new ztoolkit.ProgressWindow(
    getString("anki-progress-title"),
  );

  try {
    progressWindow
      .createLine({
        text: getString("anki-progress-adding"),
        type: "default",
      })
      .show();

    await addToAnki(task);

    progressWindow.changeLine({
      text: getString("anki-progress-success"),
      type: "success",
      progress: 100,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progressWindow.changeLine({
      text: `${getString("anki-progress-failed")}: ${message}`,
      type: "fail",
    });
  }

  progressWindow.startCloseTimer(3000);
}

/**
 * Refresh Anki configuration from AnkiConnect
 * Fetches available decks and models
 */
export async function refreshAnkiConfig(): Promise<{
  decks: string[];
  models: string[];
}> {
  const isConnected = await checkAnkiConnection();
  if (!isConnected) {
    throw new Error(getString("anki-error-connection"));
  }

  const [decks, models] = await Promise.all([
    getAnkiDeckNames(),
    getAnkiModelNames(),
  ]);

  // Cache the results
  setPref("anki.cachedDecks", JSON.stringify(decks));
  setPref("anki.cachedModels", JSON.stringify(models));

  return { decks, models };
}

/**
 * Get cached deck names or fetch from Anki
 */
export function getCachedDeckNames(): string[] {
  try {
    return JSON.parse((getPref("anki.cachedDecks") as string) || "[]");
  } catch {
    return [];
  }
}

/**
 * Get cached model names or fetch from Anki
 */
export function getCachedModelNames(): string[] {
  try {
    return JSON.parse((getPref("anki.cachedModels") as string) || "[]");
  } catch {
    return [];
  }
}

/**
 * Get cached field names for a model
 */
export async function getFieldsForModel(modelName: string): Promise<string[]> {
  if (!modelName) return [];

  try {
    return await getAnkiModelFieldNames(modelName);
  } catch {
    return ["Front", "Back"]; // Default fields
  }
}

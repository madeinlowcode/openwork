// apps/desktop/src/main/store/migrations/v008-encrypt-columns.ts
// AIDEV-NOTE: Migration para criptografar dados existentes em texto puro no SQLite
// AIDEV-SECURITY: Prompts e conteudo de mensagens juridicas sao dados sensiveis

import type { Database } from 'better-sqlite3';
import type { Migration } from './index';
import { encryptValue } from '../secureStorage';

/**
 * @function isAlreadyEncrypted
 * @description Detecta se um valor ja esta no formato criptografado (base64:base64:base64)
 */
function isAlreadyEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[A-Za-z0-9+/=]+$/.test(p));
}

export const migration: Migration = {
  version: 8,
  up(db: Database): void {
    // Re-criptografar prompts e summaries existentes em tasks
    const tasks = db
      .prepare('SELECT id, prompt, summary FROM tasks WHERE prompt IS NOT NULL')
      .all() as Array<{ id: string; prompt: string | null; summary: string | null }>;

    const updateTask = db.prepare(
      'UPDATE tasks SET prompt = ?, summary = ? WHERE id = ?'
    );

    for (const task of tasks) {
      const newPrompt =
        task.prompt && !isAlreadyEncrypted(task.prompt)
          ? encryptValue(task.prompt)
          : task.prompt;
      const newSummary =
        task.summary && !isAlreadyEncrypted(task.summary)
          ? encryptValue(task.summary)
          : task.summary;
      updateTask.run(newPrompt, newSummary, task.id);
    }

    // Re-criptografar conteudo de mensagens existentes
    const messages = db
      .prepare('SELECT id, content FROM task_messages WHERE content IS NOT NULL')
      .all() as Array<{ id: string; content: string }>;

    const updateMessage = db.prepare(
      'UPDATE task_messages SET content = ? WHERE id = ?'
    );

    for (const msg of messages) {
      if (!isAlreadyEncrypted(msg.content)) {
        updateMessage.run(encryptValue(msg.content), msg.id);
      }
    }

    console.log(
      `[v008] Encrypted ${tasks.length} tasks and ${messages.length} messages`
    );
  },
};

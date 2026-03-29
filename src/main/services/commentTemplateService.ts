import openDb from '../database/database';

export interface CommentTemplate {
  templateId: number;
  title: string;
  body: string;
  createdAt: string;
}

interface TemplateRow {
  template_id: number;
  title: string;
  body: string;
  created_at: string;
}

function mapRow(row: TemplateRow): CommentTemplate {
  return {
    templateId: row.template_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at
  };
}

export async function getCommentTemplates(): Promise<CommentTemplate[]> {
  const db = await openDb();
  const rows = await db.all<TemplateRow>('SELECT * FROM comment_templates ORDER BY title ASC');
  return rows.map(mapRow);
}

export async function addCommentTemplate(title: string, body: string): Promise<CommentTemplate> {
  const db = await openDb();
  const result = await db.run('INSERT INTO comment_templates (title, body) VALUES (?, ?)', [title.trim(), body.trim()]);
  const row = await db.get<TemplateRow>('SELECT * FROM comment_templates WHERE template_id = ?', [result.lastID]);
  return mapRow(row!);
}

export async function updateCommentTemplate(templateId: number, title: string, body: string): Promise<CommentTemplate> {
  const db = await openDb();
  await db.run('UPDATE comment_templates SET title = ?, body = ? WHERE template_id = ?', [
    title.trim(),
    body.trim(),
    templateId
  ]);
  const row = await db.get<TemplateRow>('SELECT * FROM comment_templates WHERE template_id = ?', [templateId]);
  return mapRow(row!);
}

export async function deleteCommentTemplate(templateId: number): Promise<void> {
  const db = await openDb();
  await db.run('DELETE FROM comment_templates WHERE template_id = ?', [templateId]);
}

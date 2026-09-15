'use client';
import { useState } from 'react';
import type { EmailTemplate } from '@/domain/models';
import { useCrm } from '../hooks/crm-context';
import { Modal, PageTitle, AsyncForm, Field, values } from '../components/forms';
export function TemplatesView() {
  const { data, mutate } = useCrm(),
    editable = data.currentUser.role !== 'executive';
  const [editor, setEditor] = useState<{ preview: boolean; template?: EmailTemplate } | null>(null);
  const personalize = (value: string) =>
    value
      .replaceAll('{{nombre}}', 'Alex')
      .replaceAll('{{empresa}}', data.settings.business)
      .replaceAll('{{ejecutivo}}', data.currentUser.name);
  return (
    <>
      <PageTitle
        title="Una buena conversación empieza aquí."
        description="Plantillas de correo reutilizables para cada etapa."
        action={
          editable && (
            <button className="primary" onClick={() => setEditor({ preview: false })}>
              + Nueva plantilla
            </button>
          )
        }
      />
      <div className="grid">
        {data.templates.map((template) => (
          <article className="panel" key={template.id}>
            <span className="tag">CORREO</span>
            <h2>{template.name}</h2>
            <strong>{template.subject}</strong>
            <p className="preview">{template.body}</p>
            <div className="actions">
              {editable && (
                <button onClick={() => setEditor({ preview: false, template })}>
                  Editar plantilla
                </button>
              )}
              <button onClick={() => setEditor({ preview: true, template })}>Vista previa</button>
            </div>
          </article>
        ))}
      </div>
      {editor && (
        <Modal
          title={
            editor.preview
              ? 'Vista previa de correo'
              : editor.template
                ? 'Editar plantilla'
                : 'Nueva plantilla'
          }
          onClose={() => setEditor(null)}
        >
          {editor.preview && editor.template ? (
            <>
              <span className="tag">EJEMPLO · SIN ENVÍO</span>
              <h3>{personalize(editor.template.subject)}</h3>
              <p className="preview">{personalize(editor.template.body)}</p>
            </>
          ) : (
            <AsyncForm
              label="Guardar plantilla"
              onSubmit={async (form) => {
                await mutate('templates', { ...values(form), id: editor.template?.id });
                setEditor(null);
              }}
            >
              <Field label="Nombre" name="name" required defaultValue={editor.template?.name} />
              <Field
                label="Asunto"
                name="subject"
                required
                defaultValue={editor.template?.subject}
              />
              <label>
                Contenido
                <textarea name="body" rows={8} required defaultValue={editor.template?.body} />
              </label>
              <p>Variables: {'{{nombre}}, {{empresa}}, {{ejecutivo}}'}</p>
            </AsyncForm>
          )}
        </Modal>
      )}
    </>
  );
}

'use client';
import {
  useState,
  useRef,
  useEffect,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      <select {...props}>{children}</select>
    </label>
  );
}
export function AsyncForm({
  children,
  onSubmit,
  label = 'Guardar cambios',
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  label?: string;
}) {
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const values = new FormData(event.currentTarget);
        setPending(true);
        setError('');
        try {
          await onSubmit(values);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'No se pudo guardar.');
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending}>{children}</fieldset>
      <p className="error" role="alert">
        {error}
      </p>
      <button className="primary" disabled={pending}>
        {pending ? 'Guardando…' : label}
      </button>
    </form>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={onClose}>
      <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="title">
      <div>
        <div className="eyebrow">TU OPERACIÓN, EN ORDEN</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export const values = (form: FormData): Record<string, FormDataEntryValue> =>
  Object.fromEntries(form);
export function dateLabel(value: string): string {
  return value
    ? new Date(value).toLocaleString('es-EC', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sin fecha';
}

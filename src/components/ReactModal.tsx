import { useEffect, useMemo, useState } from 'react';
import CloseIcon from '../assets/theme-images/icon-x.svg?react';

export const ReactModalForm = ({ settings }: { settings: any }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const dialog = document.getElementById('demo');

    const handleClose = () => {
      setIsLoading(false);
      setIsSuccess(false);
    };

    dialog?.addEventListener('close', handleClose);
    return () => dialog?.removeEventListener('close', handleClose);
  }, []);

  const submitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const form = e.target as HTMLFormElement;

    const formData = new FormData(form);
    const data = { ...Object.fromEntries(formData), type: 'call' };

    try {
      const response = await fetch(settings.variables.requestUrl, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();

      if (result.message === 'ok') {
        setIsLoading(false);
        setIsSuccess(true);
        setTimeout(() => {
          form.closest('dialog')?.close();
          setIsSuccess(false);
        }, 5000);
      }
    } catch (error: unknown) {
      console.error('Ошибка:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Ошибка: ${message}`);
      setIsLoading(false);
    }
  };

  const buttonText = useMemo(() => {
    if (isSuccess) return settings.dialogModal.success;

    if (isLoading)
      return (
        <span className='inline-flex items-center'>
          <span className='spinner'></span>
          {settings.dialogModal.loading}
        </span>
      );

    return settings.dialogModal.cta;
  }, [isLoading, isSuccess]);

  return (
    <form className='flex gap-6 flex-col' onSubmit={submitForm}>
      <h2 className='text-2xl flex justify-between items-center gap-4'>
        <span>{settings.dialogModal.title}</span>
        <button
          type='button'
          onClick={() => {
            const dialog = document.getElementById('demo');
            if (dialog instanceof HTMLDialogElement) {
              dialog.close();
            }
          }}
          aria-label='Закрыть'
          className='bs-btn rounded-full !p-0 flex items-center justify-center h-10 w-10'
        >
          <CloseIcon className='scale-75 opacity-75' width='32' height='32' />
        </button>
      </h2>

      <div className='flex flex-col gap-4'>
        <div className='bs-body-text mb-3'>{settings.dialogModal.content}</div>

        <label className='sr-only' htmlFor='name'>
          Имя
        </label>
        <input
          id='name'
          name='name'
          type='text'
          className='border-2 rounded-lg bg-bs-surface-0 border-bs-surface-3 form-input px-4 py-3'
          placeholder='Имя'
          required
          disabled={isLoading || isSuccess}
        />

        <label className='sr-only' htmlFor='phone'>
          Телефон
        </label>
        <input
          id='phone'
          name='phone'
          type='tel'
          className='border-2 rounded-lg bg-bs-surface-0 border-bs-surface-3 form-input px-4 py-3'
          placeholder='Телефон'
          required
          disabled={isLoading || isSuccess}
        />
        <button
          type='submit'
          className='bs-btn form-input px-4 py-3'
          disabled={isLoading}
          data-success={isSuccess}
        >
          {buttonText}
        </button>
      </div>
    </form>
  );
};

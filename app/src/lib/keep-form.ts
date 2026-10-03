import { startTransition, type FormEvent } from "react";

/**
 * Отправка формы в серверное действие без сброса полей. Если передать действие в action={…},
 * React после отправки возвращает поля к начальным значениям, и при ошибке всё введённое пропадает.
 * Здесь форма отправляется вручную, поэтому поля остаются как были. Проверки браузера (required и т. п.) работают.
 */
export function keepValues(dispatch: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const form = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(form));
  };
}

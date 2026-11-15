import { Token } from '@astryxdesign/core/Token';

/**
 * Marks a value or a block the Backend does not provide yet: what is shown next to it is an invented
 * example that holds the place of the future data. Every such value carries this mark, so an example
 * is never read as a fact.
 */
export function ExampleMark() {
  return (
    <Token
      size="sm"
      color="yellow"
      label="пример"
      description="Бэкенд пока не отдаёт эти данные: значение выдумано и показывает, как блок будет выглядеть"
    />
  );
}

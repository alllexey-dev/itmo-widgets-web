import { Pagination as AstryxPagination } from '@astryxdesign/core/Pagination';
import { HStack } from '@astryxdesign/core/Stack';

interface Props {
  /** Zero-based, as Backend pages are. */
  page: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
}

/** "21-40 of 134" with previous and next; nothing when everything fits on the first page. */
export function Pagination({ page, size, total, onChange }: Props) {
  if (total <= size && page <= 0) return null;
  return (
    <HStack hAlign="end" paddingInline={3} paddingBlock={2}>
      <AstryxPagination
        variant="count"
        size="sm"
        label="Страницы"
        page={page + 1}
        pageSize={size}
        totalItems={total}
        onChange={(next) => onChange(next - 1)}
      />
    </HStack>
  );
}

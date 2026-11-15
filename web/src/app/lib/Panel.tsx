import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useId, type ReactNode } from 'react';
import './cabinet.css';

interface Props {
  title: string;
  /** One line under the title: what the card counts, shows or changes. */
  hint?: string;
  /** A quiet action or a control at the end of the title row: a ghost `Button`, a `Token`. */
  action?: ReactNode;
  /**
   * What the body holds. `rows` (the default) is dense data that reaches the edges of the card:
   * `Item`s, a `Table`, a `Loadable` around them. `content` is everything else (figures, a form, a
   * chart): padded in line with the title, its parts spaced apart.
   */
  body?: 'rows' | 'content';
  children: ReactNode;
}

/**
 * A titled card: the container for lists and other dense data, and with `body="content"` for a
 * titled group of figures or a form. Its section is named by the title, so assistive tech and tests
 * find it as a region.
 */
export function Panel({ title, hint, action, body = 'rows', children }: Props) {
  const id = useId();
  const isContent = body === 'content';
  const heading = (
    <Heading level={2} id={id}>
      {title}
    </Heading>
  );
  return (
    <Card padding={0} className="panel">
      <VStack as="section" aria-labelledby={id} gap={0}>
        <HStack
          hAlign="between"
          // A hint may be long: it wraps under the title, and the action moves to its own line
          // only when the two no longer fit side by side.
          vAlign={hint ? 'start' : 'center'}
          wrap={hint ? 'wrap' : undefined}
          gap={3}
          paddingInline={5}
          paddingBlockStart={isContent ? 5 : 4}
          paddingBlockEnd={isContent ? 4 : 2}
        >
          {hint ? (
            <VStack gap={0.5} className="panel-title">
              {heading}
              <Text type="supporting" color="secondary">
                {hint}
              </Text>
            </VStack>
          ) : (
            heading
          )}
          {action}
        </HStack>
        {isContent ? (
          <VStack gap={4} paddingInline={5} paddingBlockEnd={5}>
            {children}
          </VStack>
        ) : (
          <VStack gap={0} paddingInline={2} paddingBlockEnd={2}>
            {children}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

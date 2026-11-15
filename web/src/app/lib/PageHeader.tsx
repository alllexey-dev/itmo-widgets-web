import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import './cabinet.css';

/** Where a page one level down returns to: an app path and the name of the page there. */
export interface Back {
  href: string;
  label: string;
}

/** The quiet link back to the page above, lined up with the title under it. */
export function BackLink({ href, label }: Back) {
  return (
    <Button
      className="page-back"
      label={label}
      href={href}
      variant="ghost"
      size="sm"
      icon={<ArrowLeft size={16} />}
    />
  );
}

interface Props {
  /** The page's only `h1`. */
  title: string;
  /** Tokens beside the title that belong to what it names: the roles of a user. */
  titleEnd?: ReactNode;
  /** One line under the title: what the page is for, or whose data it shows. */
  text?: ReactNode;
  /** Page-level actions, at the end of the title row. */
  actions?: ReactNode;
  /** The page above, for a page that is not in the navigation itself. */
  back?: Back;
}

/**
 * The start of every section page: an optional link back, the title with optional tokens beside
 * it, an optional line of text and optional actions.
 */
export function PageHeader({ title, titleEnd, text, actions, back }: Props) {
  return (
    <VStack as="header" gap={2} className="page-header">
      {back ? (
        <HStack>
          <BackLink {...back} />
        </HStack>
      ) : null}
      <HStack gap={4} hAlign="between" vAlign="start" wrap="wrap">
        <VStack gap={1}>
          {titleEnd ? (
            <HStack gap={3} vAlign="center" wrap="wrap">
              <Heading level={1}>{title}</Heading>
              {titleEnd}
            </HStack>
          ) : (
            <Heading level={1}>{title}</Heading>
          )}
          {text ? <Text color="secondary">{text}</Text> : null}
        </VStack>
        {actions ? (
          <HStack gap={2} vAlign="center" wrap="wrap">
            {actions}
          </HStack>
        ) : null}
      </HStack>
    </VStack>
  );
}

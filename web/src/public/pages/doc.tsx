import { Card } from '@astryxdesign/core/Card';
import { Code } from '@astryxdesign/core/Code';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

import { SitePage } from '../site/SitePage';

import './doc.css';

/**
 * A text page (the policy, account deletion): one readable column, no scripts.
 * These pages ship as HTML and CSS only, so nothing here may need JavaScript to work.
 */
export function DocPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <SitePage header="page">
      <VStack as="article" gap={8} className="doc">
        <VStack as="header" gap={3}>
          <Heading
            level={1}
            type="display-2"
            weight="bold"
            textWrap="balance"
            className="doc-title"
          >
            {title}
          </Heading>
          <Text as="p" display="block" size="lg" color="secondary" textWrap="pretty">
            {lead}
          </Text>
        </VStack>
        {children}
      </VStack>
    </SitePage>
  );
}

/** A titled part of the page; the opening paragraphs have no title. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <VStack as="section" gap={3}>
      {title ? (
        <Heading level={2} weight="bold" textWrap="balance" className="doc-heading">
          {title}
        </Heading>
      ) : null}
      {children}
    </VStack>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <Text as="p" display="block" size="lg" textWrap="pretty">
      {children}
    </Text>
  );
}

/**
 * A link inside the text, in the size of the text around it. The accent of the theme is not a
 * colour, so the underline is what tells a link from the words around it.
 */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} size="lg" hasUnderline>
      {children}
    </Link>
  );
}

/** A host or file name inside the text. */
export function Mono({ children }: { children: ReactNode }) {
  return (
    <Code size="inherit" color="inherit">
      {children}
    </Code>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="doc-list">{children}</ul>;
}

export function Ol({ children }: { children: ReactNode }) {
  return <ol className="doc-list doc-list--numbered">{children}</ol>;
}

export function Li({ children }: { children: ReactNode }) {
  return (
    <li>
      <Text size="lg" textWrap="pretty">
        {children}
      </Text>
    </li>
  );
}

/** A two-column table of plain text. Astryx `Table` is a data grid with its own scroll script. */
export function DocTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <Card padding={0} className="doc-table-card">
      <table className="doc-table">
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label} scope="col">
                <Text weight="semibold" color="secondary">
                  {label}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name}>
              <td>
                <Text>{name}</Text>
              </td>
              <td>
                <Text>{value}</Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

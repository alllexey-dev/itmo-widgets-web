import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';
import './home.css';

/** A quiet line under the rows of a panel: what did not fit, or where the rest is. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <Text as="p" display="block" type="supporting" color="secondary" className="home-note">
      {children}
    </Text>
  );
}

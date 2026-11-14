import type { ReactNode } from 'react';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}
export interface LegalDoc {
  title: string;
  lead: ReactNode;
  summary?: ReactNode;
  sections: LegalSection[];
}

import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Kbd } from '@astryxdesign/core/Kbd';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { formatDate } from '../../lib/format';
import { CAPABILITIES } from './labels';
import type {
  DecisionRequest,
  LinkAudience,
  RestrictionCapability,
  UserRestriction,
} from './types';

const NOTE_LIMIT = 500;

/** The reason of a decision is written for the author: both dialogs say so in the same place. */
const REASON_HINT = 'Автор увидит её в приложении';

const SUBMIT_KEYS = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘+Enter' : 'Ctrl+Enter';

interface FormDialogProps {
  title: string;
  text?: string;
  submitLabel: string;
  isValid: boolean;
  isSaving: boolean;
  isDestructive?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A decision that needs more than one click. Enter in a single-line field and Ctrl or Cmd with Enter
 * anywhere submit; nothing closes while the decision is being saved.
 */
function FormDialog({
  title,
  text,
  submitLabel,
  isValid,
  isSaving,
  isDestructive,
  onSubmit,
  onClose,
  children,
}: FormDialogProps) {
  const formId = useId();
  // The field the dialog is opened for gets the focus. The dialog's header asks for it too, for its
  // title, and may ask last; this effect runs after the header's.
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  const close = () => {
    if (!isSaving) onClose();
  };
  const submit = () => {
    if (isValid && !isSaving) onSubmit();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
  };
  return (
    <Dialog isOpen purpose="form" width={480} onOpenChange={(open) => !open && close()}>
      <Layout
        header={<DialogHeader title={title} subtitle={text} onOpenChange={close} />}
        content={
          <LayoutContent>
            <form
              ref={form}
              id={formId}
              onKeyDown={onKeyDown}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <VStack gap={4}>{children}</VStack>
            </form>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end" vAlign="center" wrap="wrap">
              <span className="mod-submit-hint">
                <Kbd keys={SUBMIT_KEYS} />
                отправить
              </span>
              <Button label="Отмена" variant="ghost" isDisabled={isSaving} onClick={close} />
              <Button
                type="submit"
                form={formId}
                label={submitLabel}
                variant={isDestructive ? 'destructive' : 'primary'}
                isDisabled={!isValid}
                isLoading={isSaving}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

interface DecisionDialogProps {
  isSaving: boolean;
  onSubmit: (request: DecisionRequest) => void;
  onClose: () => void;
}

function isValidNote(note: string): boolean {
  const trimmed = note.trim();
  return trimmed.length > 0 && trimmed.length <= NOTE_LIMIT;
}

/** The reason is required: the author sees it in the app instead of Backend's technical fallback. */
export function RejectDialog({
  title,
  presets,
  ...dialog
}: DecisionDialogProps & { title: string; presets: readonly string[] }) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  return (
    <FormDialog
      title={title}
      submitLabel="Отклонить"
      isValid={isValidNote(note)}
      isSaving={dialog.isSaving}
      onClose={dialog.onClose}
      onSubmit={() => dialog.onSubmit({ action: 'REJECT', note: trimmed })}
    >
      <ToggleButtonGroup
        label="Частые причины"
        size="sm"
        className="mod-presets"
        value={presets.includes(trimmed) ? trimmed : null}
        onChange={(next) => {
          if (next) setNote(next);
        }}
      >
        {presets.map((preset) => (
          <ToggleButton key={preset} value={preset} label={preset} />
        ))}
      </ToggleButtonGroup>
      <TextArea
        label="Причина"
        description={REASON_HINT}
        value={note}
        onChange={setNote}
        rows={4}
        maxLength={NOTE_LIMIT}
        hasAutoFocus
      />
    </FormDialog>
  );
}

const CAPABILITY_OPTIONS = Object.entries(CAPABILITIES).map(([value, label]) => ({ value, label }));

const FOREVER = 'forever';
const TERM_OPTIONS = [
  { value: '1', label: '1 день' },
  { value: '3', label: '3 дня' },
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: FOREVER, label: 'Бессрочно' },
];

function isCapability(value: string): value is RestrictionCapability {
  return value in CAPABILITIES;
}

function termOf(restriction: UserRestriction): string {
  return restriction.expiresAt ? `до ${formatDate(restriction.expiresAt)}` : 'бессрочно';
}

/** What the author is already forbidden that covers the chosen capability, in words. */
function overlapText(active: UserRestriction[], capability: RestrictionCapability): string | null {
  const same = active.find((restriction) => restriction.capability === capability);
  if (same) {
    return `Такое ограничение у автора уже действует (${termOf(same)}). Новое добавится к нему, а не заменит его.`;
  }
  const all = active.find((restriction) => restriction.capability === 'ALL');
  if (all) return `Автору уже запрещены все действия (${termOf(all)}), в том числе это.`;
  return null;
}

/**
 * Restricting keeps the case open; the reason is required because the author sees it in the app.
 * `active` are the restrictions the author has now: one of the chosen kind is pointed out before a
 * second is added.
 */
export function RestrictDialog({
  authorName,
  defaultCapability,
  active,
  ...dialog
}: DecisionDialogProps & {
  authorName: string;
  defaultCapability: RestrictionCapability;
  active: UserRestriction[];
}) {
  const [capability, setCapability] = useState(defaultCapability);
  const [term, setTerm] = useState('7');
  const [note, setNote] = useState('');
  const overlap = overlapText(active, capability);
  return (
    <FormDialog
      title="Ограничить автора"
      text={`${authorName} не сможет выполнять выбранное действие. Заявка останется открытой.`}
      submitLabel="Ограничить"
      isValid={isValidNote(note)}
      isSaving={dialog.isSaving}
      onClose={dialog.onClose}
      onSubmit={() =>
        dialog.onSubmit({
          action: 'RESTRICT_USER',
          note: note.trim(),
          restriction: term === FOREVER ? { capability } : { capability, days: Number(term) },
        })
      }
    >
      <div className="mod-dialog-row">
        <Selector
          label="Что запретить"
          options={CAPABILITY_OPTIONS}
          value={capability}
          data-autofocus="true"
          onChange={(value) => {
            if (isCapability(value)) setCapability(value);
          }}
        />
        <Selector label="Срок" options={TERM_OPTIONS} value={term} onChange={setTerm} />
      </div>
      {overlap ? <Banner status="warning" title={overlap} /> : null}
      <TextArea
        label="Причина"
        description={REASON_HINT}
        value={note}
        onChange={setNote}
        rows={4}
        maxLength={NOTE_LIMIT}
      />
    </FormDialog>
  );
}

/** A name as typed for a confirmation: case and spacing do not matter. */
function normalized(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

/** Hiding everything by an author touches many items at once, so the moderator types the name first. */
export function HideAllDialog({
  title,
  text,
  authorName,
  ...dialog
}: DecisionDialogProps & { title: string; text: string; authorName: string }) {
  const [typed, setTyped] = useState('');
  return (
    <FormDialog
      title={title}
      text={text}
      submitLabel="Скрыть"
      isDestructive
      isValid={normalized(typed) === normalized(authorName)}
      isSaving={dialog.isSaving}
      onClose={dialog.onClose}
      onSubmit={() => dialog.onSubmit({ action: 'HIDE_ALL_BY_USER' })}
    >
      <Text color="secondary">
        Чтобы подтвердить, введите имя автора: <strong>{authorName}</strong>
      </Text>
      <TextInput
        label="Имя автора"
        value={typed}
        onChange={setTyped}
        autoComplete="off"
        hasAutoFocus
      />
    </FormDialog>
  );
}

/**
 * Approving a FLOW link for another of the flows its author could pick from. The link's flow is
 * chosen at first and cannot be sent: approving for it is the plain `Одобрить`. The note is
 * optional and stays in the case's history.
 */
export function FlowDialog({
  options,
  current,
  ...dialog
}: DecisionDialogProps & { options: LinkAudience[]; current: number | null }) {
  const [flow, setFlow] = useState(String(current ?? ''));
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const chosen = options.find((option) => String(option.flowId) === flow);
  return (
    <FormDialog
      title="Одобрить для другого потока"
      text="Ссылку увидят студенты выбранного потока вместо того, что выбрал автор. Заявка закроется."
      submitLabel="Одобрить"
      isValid={chosen !== undefined && chosen.flowId !== current && trimmed.length <= NOTE_LIMIT}
      isSaving={dialog.isSaving}
      onClose={dialog.onClose}
      onSubmit={() => {
        if (!chosen) return;
        dialog.onSubmit({
          action: 'APPROVE',
          flowId: chosen.flowId,
          ...(trimmed ? { note: trimmed } : {}),
        });
      }}
    >
      <Selector
        label="Поток"
        options={options.map((option) => ({
          value: String(option.flowId),
          label: option.label,
          description: option.flowId === current ? 'Сейчас' : undefined,
        }))}
        value={flow}
        data-autofocus="true"
        hasSearch={options.length > 8}
        onChange={setFlow}
      />
      <TextArea
        label="Комментарий"
        description="Останется в истории заявки"
        value={note}
        onChange={setNote}
        rows={3}
        maxLength={NOTE_LIMIT}
        isOptional
      />
    </FormDialog>
  );
}

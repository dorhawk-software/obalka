// The attachments as the board Message lists them (031, I35 saved row, I36): each file a sheet of paper
// with its type printed on it, its name and "176 kB · v archivu"; the signed original in a well with the
// seal. The row opens the file; the download glyph beside it saves a copy where the person chooses.
// These hold the drawing in both themes and that the two presses do their own thing.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { processColor } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { docSheet } from '../../src/theme/print';
import { fileType } from '../../src/theme/objects/DocSheet';
import type {
  DataBoxAccount,
  MessageAttachment,
  MessageEnvelope,
  SignedOriginal,
} from '../../src/services/isds/types';

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: { fetchSignedOriginal: jest.fn() },
}));
jest.mock('../../src/services/files/attachmentFileStore', () => ({
  attachmentFileStore: { exists: jest.fn(async () => true) },
}));
const mockOpen = jest.fn(async (..._args: unknown[]) => {});
const mockSave = jest.fn(async (..._args: unknown[]) => true);
const mockOpenOriginal = jest.fn(async (..._args: unknown[]) => 'opened');
jest.mock('../../src/services/files/attachmentOpener', () => ({
  attachmentOpener: {
    open: (...args: unknown[]) => mockOpen(...args),
    save: (...args: unknown[]) => mockSave(...args),
  },
  NoViewerError: class NoViewerError extends Error {},
  openSignedOriginal: (...args: unknown[]) => mockOpenOriginal(...args),
}));

import { AttachmentRow } from '../../src/features/messages/screens/AttachmentRow';
import { SignedOriginalSection } from '../../src/features/messages/screens/SignedOriginalSection';

const pdf: MessageAttachment = {
  name: 'rozhodnuti-pokuta.pdf',
  mimeType: 'application/pdf',
  metaType: 'main',
  contentBase64: '',
  localPath: '/docs/attachments/box1/1234567/0_rozhodnuti-pokuta.pdf',
  size: 176 * 1024,
};

const stored: SignedOriginal = {
  fileName: 'DZ_1234567.zfo',
  localPath: '/docs/attachments/box1/1234567/DZ_1234567.zfo',
  size: 2048,
};

const envelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Rozhodnutí',
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.now() - 3 * 86_400_000,
  acceptanceTime: Date.now() - 2 * 86_400_000,
  state: 6,
  attachmentSize: 1,
};

const account = { id: 'a1', boxId: 'box1', label: 'Jana', alias: null } as DataBoxAccount;

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
function nodes(root: unknown): Node[] {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    out.push(n);
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
}
const brush = (color: string) => JSON.stringify({ type: 0, payload: processColor(color) });
const filled = (all: Node[], color: string) => all.filter(n => JSON.stringify(n.props.fill) === brush(color));

const themed = (ui: React.ReactElement, isDark = false) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

const original = (props: Partial<React.ComponentProps<typeof SignedOriginalSection>> = {}, isDark = false) =>
  themed(
    <SignedOriginalSection
      account={account}
      messageId="1234567"
      folder="received"
      envelope={envelope}
      original={stored}
      unavailable={false}
      onChange={jest.fn()}
      {...props}
    />,
    isDark,
  );

beforeEach(() => {
  mockOpen.mockClear();
  mockSave.mockClear();
  mockOpenOriginal.mockClear();
});

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  it('draws a file as a sheet of paper with its corner folded and "PDF" printed in red', async () => {
    const view = await themed(<AttachmentRow attachment={pdf} index={0} missing={false} />, isDark);
    const all = nodes(view.toJSON());
    expect(all.some(n => n.props.d === docSheet.sheet && JSON.stringify(n.props.fill) === brush(theme.surfaceSunken))).toBe(
      true,
    );
    expect(all.some(n => n.props.d === docSheet.fold && JSON.stringify(n.props.fill) === brush(theme.docFold))).toBe(true);
    expect(JSON.stringify(view.toJSON())).toContain('"PDF"');
    const label = filled(all, theme.danger).find(n => n.type === 'RNSVGText');
    expect(JSON.stringify(label?.props.font)).toContain(String(docSheet.label.size));
    expect(docSheet.label.size).toBeGreaterThanOrEqual(11); // nothing anyone reads under 11
  });

  it('puts the signed original in a well, the seal printed on the blue plane', async () => {
    const view = await original({}, isDark);
    const all = nodes(view.toJSON());
    // Two glyphs on the blue plane: the seal in its well, and the download beside it.
    expect(filled(all, theme.iconPlane).filter(n => n.type === 'RNSVGGroup')).toHaveLength(2);
    expect(view.getByText('Podepsaný originál')).toBeTruthy();
    expect(view.getByText('Soubor ZFO s elektronickou pečetí')).toBeTruthy();
  });
});

it('says the size and that the file lies in the archive', async () => {
  const view = await themed(<AttachmentRow attachment={pdf} index={0} missing={false} />);
  expect(view.getByText('176 kB · v archivu')).toBeTruthy();
  expect(view.getByText('rozhodnuti-pokuta.pdf')).toBeTruthy();
});

it('opens the file from the row, and saves a copy from the download glyph - each only its own', async () => {
  const view = await themed(<AttachmentRow attachment={pdf} index={0} missing={false} />);
  const save = view.getByTestId('attachment-save-0');
  expect(save.props.accessibilityLabel).toBe('Stáhnout přílohu rozhodnuti-pokuta.pdf');
  fireEvent.press(save);
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(pdf.localPath, pdf.name, 'application/pdf'));
  expect(mockOpen).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('attachment-0'));
  await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
  expect(mockSave).toHaveBeenCalledTimes(1);
});

it('says so when a copy could not be saved', async () => {
  mockSave.mockRejectedValueOnce(new Error('disk full'));
  const view = await themed(<AttachmentRow attachment={pdf} index={0} missing={false} />);
  fireEvent.press(view.getByTestId('attachment-save-0'));
  expect(await view.findByText('Přílohu se nepodařilo uložit.')).toBeTruthy();
});

it('offers no copy of a file that is missing from the phone', async () => {
  const view = await themed(<AttachmentRow attachment={pdf} index={0} missing />);
  expect(view.queryByTestId('attachment-save-0')).toBeNull();
});

it('opens the signed original from its row, and saves a copy from its download glyph', async () => {
  const view = await original();
  fireEvent.press(await view.findByTestId('signed-original-download'));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(stored.localPath, stored.fileName, 'application/vnd.software602.filler.form-xml-zip'),
  );
  expect(mockOpenOriginal).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('signed-original'));
  await waitFor(() => expect(mockOpenOriginal).toHaveBeenCalledTimes(1));
});

it('names the type from the extension, and prints none for a name without a short one', () => {
  expect(fileType('rozhodnuti.pdf')).toBe('PDF');
  expect(fileType('podani.docx')).toBe('DOCX');
  expect(fileType('README')).toBe('');
  expect(fileType('archiv.tar.gzipped')).toBe('');
});

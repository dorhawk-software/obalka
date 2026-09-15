// The app's icon set - Lucide glyphs (lucide-react-native), matching the reference design 1:1.
//
// The design draws its icons as inline SVG from the Lucide set (24×24, round cap/join). This module
// re-exports those glyphs under the app's icon names, keeping the existing `{ size, color }` API so no
// call site changes. Each icon's DEFAULT SIZE and STROKE-WIDTH are copied from the design source (the
// stroke widths genuinely vary per glyph there - 1.6 … 2.4 - so we don't blanket-default to 2).
//
// Callers always pass an explicit themed `color`; the '#000' default is only a fallback.

import Svg, { Circle, Path } from 'react-native-svg';
import {
  Archive,
  ArrowRight,
  Bell,
  ScanQrCode,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  Clock,
  CloudOff,
  DatabaseBackup,
  CreditCard,
  Download,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileX,
  FlaskConical,
  Info,
  Layers,
  Lock,
  Mail,
  Menu,
  Navigation,
  Moon,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sun,
  SlidersHorizontal,
  Timer,
  Trash,
  TriangleAlert,
  X,
} from 'lucide-react-native';

export interface IconProps {
  readonly size?: number;
  readonly color?: string;
}

/** Eye (show/hide password). `off` draws the slashed variant for the hidden state. */
export function EyeIcon({
  size = 22,
  color = '#000',
  off = false,
}: IconProps & { readonly off?: boolean }) {
  const Glyph = off ? EyeOff : Eye;
  return <Glyph size={size} color={color} strokeWidth={2} />;
}

export function BellIcon({ size = 22, color = '#000' }: IconProps) {
  return <Bell size={size} color={color} strokeWidth={2} />;
}

/** Test-environment (czebox) flask - the "Testovací" banner/tag mark. */
export function FlaskIcon({ size = 18, color = '#000' }: IconProps) {
  return <FlaskConical size={size} color={color} strokeWidth={2} />;
}

/**
 * Stacked layers - the merged inbox (024). Chosen because it says "several things shown as one",
 * which is exactly what the view is, and because it is nothing like an avatar: the box switcher's
 * whole risk is that a user who names a box "Vše" ends up with two rows that look alike.
 */
export function LayersIcon({ size = 22, color = '#000' }: IconProps) {
  return <Layers size={size} color={color} strokeWidth={1.8} />;
}

export function MailIcon({ size = 22, color = '#000' }: IconProps) {
  return <Mail size={size} color={color} strokeWidth={2} />;
}

export function PaperclipIcon({ size = 22, color = '#000' }: IconProps) {
  return <Paperclip size={size} color={color} strokeWidth={2} />;
}

export function SearchIcon({ size = 22, color = '#000' }: IconProps) {
  return <Search size={size} color={color} strokeWidth={2} />;
}

export function LockIcon({ size = 22, color = '#000' }: IconProps) {
  return <Lock size={size} color={color} strokeWidth={2} />;
}

/** Rename / compose - the design uses the Lucide pencil. */
export function EditIcon({ size = 20, color = '#000' }: IconProps) {
  return <Pencil size={size} color={color} strokeWidth={2} />;
}

/** Per-box overflow - the design's vertical three-dot mark. */
export function MoreIcon({ size = 22, color = '#000' }: IconProps) {
  return <EllipsisVertical size={size} color={color} strokeWidth={2} />;
}

export function ChevronLeftIcon({ size = 24, color = '#000' }: IconProps) {
  return <ChevronLeft size={size} color={color} strokeWidth={2} />;
}

/** Remove - the design's plain bin (no inner strokes), i.e. lucide `Trash`, not `Trash2`. */
export function TrashIcon({ size = 20, color = '#000' }: IconProps) {
  return <Trash size={size} color={color} strokeWidth={2} />;
}

export function AlertIcon({ size = 18, color = '#000' }: IconProps) {
  return <TriangleAlert size={size} color={color} strokeWidth={2} />;
}

export function InfoIcon({ size = 18, color = '#000' }: IconProps) {
  return <Info size={size} color={color} strokeWidth={2} />;
}

export function CheckIcon({ size = 18, color = '#000' }: IconProps) {
  return <Check size={size} color={color} strokeWidth={2} />;
}

export function MenuIcon({ size = 24, color = '#000' }: IconProps) {
  return <Menu size={size} color={color} strokeWidth={2} />;
}

export function PlusIcon({ size = 24, color = '#000' }: IconProps) {
  return <Plus size={size} color={color} strokeWidth={2} />;
}

export function CloseIcon({ size = 20, color = '#000' }: IconProps) {
  return <X size={size} color={color} strokeWidth={2} />;
}

export function ChevronRightIcon({ size = 20, color = '#000' }: IconProps) {
  return <ChevronRight size={size} color={color} strokeWidth={2} />;
}

export function ChevronDownIcon({ size = 20, color = '#000' }: IconProps) {
  return <ChevronDown size={size} color={color} strokeWidth={2} />;
}

/** Paper-plane - sent folder / send action. */
export function SendIcon({ size = 22, color = '#000' }: IconProps) {
  return <Send size={size} color={color} strokeWidth={2} />;
}

export function SunIcon({ size = 22, color = '#000' }: IconProps) {
  return <Sun size={size} color={color} strokeWidth={2} />;
}

export function MoonIcon({ size = 22, color = '#000' }: IconProps) {
  return <Moon size={size} color={color} strokeWidth={2} />;
}

export function SmartphoneIcon({ size = 22, color = '#000' }: IconProps) {
  return <Smartphone size={size} color={color} strokeWidth={2} />;
}

/**
 * Settings - the ONE lucide exception. The design does NOT draw lucide's cog; it draws a simplified
 * gear (a circle + eight straight spokes). Path copied verbatim from the design source so the glyph
 * matches pixel-for-pixel.
 */
export function SettingsIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth={2} />
      <Path
        d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function RefreshIcon({ size = 22, color = '#000' }: IconProps) {
  return <RefreshCw size={size} color={color} strokeWidth={2} />;
}

/** Opens something outside the app - the source-code row. The design draws it at stroke-width 1.8. */
export function ExternalLinkIcon({ size = 17, color = '#000' }: IconProps) {
  return <ExternalLink size={size} color={color} strokeWidth={1.8} />;
}

/** Help entry points (Welcome, sign-in). The design draws the circle at stroke-width 1.8. */
export function HelpIcon({ size = 16, color = '#000' }: IconProps) {
  return <CircleQuestionMark size={size} color={color} strokeWidth={1.8} />;
}

/*
 * A sent message's delivery state, as a glyph - used by the sent list row and the sent detail's
 * timeline. Note these are NOT the Send/Check exported above: at 16px the design switches to a
 * different plane (one closed outline, no fold stroke) and a heavier check, and it marks the terminal
 * state SOLID so legal delivery reads as "done" at a glance.
 */

/** Odesláno - in transit, not yet in the recipient's box. */
export function StatusSentIcon({ size = 16, color = '#000' }: IconProps) {
  // lucide `navigation` IS the design's plane: the same four corners, each pulled in ~1 unit of the
  // 24 viewBox (≈1px at 16px) so the tip sits less sharply. Not worth a hand-drawn copy.
  return <Navigation size={size} color={color} strokeWidth={2} />;
}

/** Dodáno - delivered into the box, not yet legally served. */
export function StatusDeliveredIcon({ size = 16, color = '#000' }: IconProps) {
  // Identical to lucide `check` (the design's path is the same polyline written backwards, 0.5 units
  // lower - invisible inside a centred slot). Only the stroke is the design's own: 2.4, not 2.
  return <Check size={size} color={color} strokeWidth={2.4} />;
}

/**
 * Doručeno - legally served (§17/3). Drawn by hand, the second lucide exception after SettingsIcon:
 * lucide is uniformly OUTLINE, and its RN wrapper spreads `fill` onto every child node, so filling
 * `circle-check` would also flood-fill the open check path into a blob under the white stroke. A solid
 * disc with a knocked-out check has to be composed directly.
 */
export function StatusAcceptedIcon({
  size = 16,
  color = '#000',
  /**
   * The check is KNOCKED OUT of the disc, so it has to be the paper behind it, not a fixed white: the
   * design is light-only and hard-codes #fff, which works against its dark green but would leave a
   * white tick nearly invisible on the lighter green the disc takes in dark mode.
   */
  knockout = '#fff',
}: IconProps & { readonly knockout?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill={color} />
      <Path
        d="m8 12.2 2.6 2.6L16 9"
        stroke={knockout}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Nedoručitelné / neprošlo antivirovou kontrolou (dmMessageStatus 8 / 3) - the journey stopped. The
 * third hand-drawn exception, for the same reason as `StatusAcceptedIcon`: it is a SOLID disc with a
 * knocked-out mark, which lucide's outline set plus its `fill`-spreading wrapper cannot compose.
 *
 * It deliberately mirrors the accepted disc - same circle, same radius - with the check replaced by a
 * single diagonal. Terminal success and terminal failure then read as the same *kind* of event.
 */
export function StatusStopIcon({
  size = 16,
  color = '#000',
  /** The slash is knocked out of the disc, so it must be the paper behind it. See StatusAcceptedIcon. */
  knockout = '#fff',
}: IconProps & { readonly knockout?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill={color} />
      <Path
        d="M8.3 15.7 15.7 8.3"
        stroke={knockout}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** ISDS erased the message content after 90 days (state 9) - the design's slashed cloud. */
export function ContentErasedIcon({ size = 13, color = '#000' }: IconProps) {
  return <CloudOff size={size} color={color} strokeWidth={2} />;
}

/** The message lives in the user's paid Datový trezor (state 10). */
export function VaultIcon({ size = 13, color = '#000' }: IconProps) {
  // lucide `archive` IS the design's safe: same lid rect + body + handle line, each pulled in ~1 unit
  // of the 24 viewBox (≈0.5px at 13px). Not worth a hand-drawn copy - cf. StatusSentIcon.
  return <Archive size={size} color={color} strokeWidth={2} />;
}

/** Background sync is running - the design draws a SINGLE-arc refresh, not the two-arc `RefreshCw`. */
export function SyncOnIcon({ size = 19, color = '#000' }: IconProps) {
  return <RotateCw size={size} color={color} strokeWidth={2} />;
}

export function ClockIcon({ size = 18, color = '#000' }: IconProps) {
  return <Clock size={size} color={color} strokeWidth={2} />;
}

export function ArrowRightIcon({ size = 20, color = '#000' }: IconProps) {
  return <ArrowRight size={size} color={color} strokeWidth={2} />;
}

export function DownloadIcon({ size = 18, color = '#000' }: IconProps) {
  return <Download size={size} color={color} strokeWidth={2} />;
}

/** Attachment no longer available (ISDS 90-day deletion). */
export function FileXIcon({ size = 20, color = '#000' }: IconProps) {
  return <FileX size={size} color={color} strokeWidth={2} />;
}

/** Offline strip - the design draws a slashed CLOUD (no sync), not a wifi mark. */
export function WifiOffIcon({ size = 18, color = '#000' }: IconProps) {
  return <CloudOff size={size} color={color} strokeWidth={2} />;
}

/** A deadline / delivery-fiction countdown. The design draws a TIMER (stopwatch), not a wall clock. */
/** The backup section's own three (006): the archive being copied, the key that locks it, the knobs. */
export function BackupIcon({ size = 18, color = '#000' }: IconProps) {
  return <DatabaseBackup size={size} color={color} strokeWidth={1.9} />;
}

export function ShieldKeyIcon({ size = 18, color = '#000' }: IconProps) {
  return <ShieldCheck size={size} color={color} strokeWidth={1.9} />;
}

/** Reading a code off another phone's screen (025). Not a camera: this app never takes a photo. */
export function CameraIcon({ size = 18, color = '#000' }: IconProps) {
  return <ScanQrCode size={size} color={color} strokeWidth={1.9} />;
}

export function TuneIcon({ size = 18, color = '#000' }: IconProps) {
  return <SlidersHorizontal size={size} color={color} strokeWidth={1.9} />;
}

export function TimerIcon({ size = 18, color = '#000' }: IconProps) {
  return <Timer size={size} color={color} strokeWidth={2} />;
}

/** Paid message (PDZ) - the design's cost card/sheet mark is a credit card, not a 🪙 emoji. */
export function CreditCardIcon({ size = 20, color = '#000' }: IconProps) {
  return <CreditCard size={size} color={color} strokeWidth={2} />;
}

/** A generic attachment file. The design's attachment tile is a neutral sunken square + this glyph. */
export function FileIcon({ size = 18, color = '#000' }: IconProps) {
  return <File size={size} color={color} strokeWidth={2} />;
}

// Raw Lucide glyphs for the SCALE tiers (016). `iconTiers.tsx` applies the tier's size, stroke and
// treatment, so those uses need the glyph itself rather than one of the wrappers above - every
// wrapper hardcodes the inline stroke width the design gave it.
export {
  Mail as MailGlyph,
  Send as SendGlyph,
  Search as SearchGlyph,
  CloudOff as CloudOffGlyph,
} from 'lucide-react-native';

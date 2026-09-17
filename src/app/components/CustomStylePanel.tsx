import {
  DefaultStylePanel,
  StylePanelArrowheadPicker,
  StylePanelArrowKindPicker,
  StylePanelColorPicker,
  StylePanelDashPicker,
  StylePanelFillPicker,
  StylePanelOpacityPicker,
  StylePanelSection,
  StylePanelSizePicker,
  StylePanelSplinePicker,
  useEditor,
  useValue,
  type TLUiStylePanelProps,
} from 'tldraw';
import { eraserSizeAtom, ERASER_SIZES, type EraserSizeKey } from '../tldraw/eraserSize';

const SIZE_LABELS: Record<EraserSizeKey, string> = {
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Extra large',
};

/**
 * tldraw's default style panel shows color/dash/fill/size "defaults for the
 * next shape" whenever the select tool is active, even with nothing
 * selected. That reads as noise ("why is there a color picker, I'm just
 * selecting things?"), so we hide the panel in that specific case. We also
 * add a real size control for the eraser tool, which has no style panel (and
 * no adjustable size) by default.
 */
export function CustomStylePanel(props: TLUiStylePanelProps) {
  const editor = useEditor();

  const currentToolId = useValue('current-tool-id', () => editor.getCurrentToolId(), [editor]);
  const hasSelection = useValue(
    'has-selection',
    () => editor.getSelectedShapeIds().length > 0,
    [editor]
  );

  // Arrows carry a `font` style (for their optional text label), which
  // pulls in the Font picker even when just drawing connector lines —
  // that's not relevant unless you're actually editing label text, so we
  // drop it here for the arrow/line tools and for selections made up
  // entirely of arrows/lines.
  const isArrowOrLineContext = useValue(
    'is-arrow-or-line-context',
    () => {
      if (currentToolId === 'arrow' || currentToolId === 'line') return true;
      if (currentToolId === 'select') {
        const selected = editor.getSelectedShapes();
        return selected.length > 0 && selected.every((s) => s.type === 'arrow' || s.type === 'line');
      }
      return false;
    },
    [editor, currentToolId]
  );

  if (currentToolId === 'eraser') {
    return <EraserSizePanel />;
  }

  // In select mode with nothing selected there's nothing relevant to show:
  // no shape is being edited, and previewing "styles for your next shape"
  // just adds clutter to a mode that's meant for picking/moving things.
  if (currentToolId === 'select' && !hasSelection) {
    return null;
  }

  if (isArrowOrLineContext) {
    return (
      <DefaultStylePanel {...props}>
        <StylePanelSection>
          <StylePanelColorPicker />
          <StylePanelOpacityPicker />
        </StylePanelSection>
        <StylePanelSection>
          <StylePanelFillPicker />
          <StylePanelDashPicker />
          <StylePanelSizePicker />
        </StylePanelSection>
        <StylePanelSection>
          <StylePanelArrowKindPicker />
          <StylePanelArrowheadPicker />
          <StylePanelSplinePicker />
        </StylePanelSection>
      </DefaultStylePanel>
    );
  }

  return <DefaultStylePanel {...props} />;
}

function EraserSizePanel() {
  const size = useValue('eraser-size', () => eraserSizeAtom.get(), []);

  return (
    <div className="tlui-style-panel tlui-style-panel__wrapper" data-testid="style.panel">
      <div className="tlui-style-panel__section">
        <div className="tlui-buttons__horizontal" style={{ display: 'flex', gap: 4, padding: 4 }}>
          {(Object.keys(ERASER_SIZES) as EraserSizeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              title={SIZE_LABELS[key]}
              aria-label={`Eraser size: ${SIZE_LABELS[key]}`}
              aria-pressed={size === key}
              onClick={() => eraserSizeAtom.set(key)}
              className="tlui-button tlui-button__icon"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 32,
                borderRadius: 6,
                background: size === key ? 'var(--tl-color-selected)' : 'transparent',
                color: size === key ? 'var(--tl-color-selected-contrast)' : 'var(--tl-color-text)',
              }}
            >
              <span
                style={{
                  display: 'block',
                  borderRadius: '50%',
                  background: 'currentColor',
                  width: ERASER_SIZES[key] / 1.5 + 4,
                  height: ERASER_SIZES[key] / 1.5 + 4,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
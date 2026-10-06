import { seeds, variantLabels, variants, type ThemeMode } from '@alllexey/ui/theme';
import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Chip } from './Chip';
import { cx } from './cx';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { useTheme } from './theme';
import styles from './ThemeSettings.module.css';

const MODES: {
  value: ThemeMode;
  label: string;
  icon: 'light_mode' | 'brightness_auto' | 'dark_mode';
}[] = [
  { value: 'light', label: 'Светлая', icon: 'light_mode' },
  { value: 'auto', label: 'Авто', icon: 'brightness_auto' },
  { value: 'dark', label: 'Тёмная', icon: 'dark_mode' },
];

// Seed swatches are raw seed colours, so their marks are white as in the package.
const ON_SEED = { color: 'white' };
const IDLE = { color: 'var(--md-on-surface-variant)' };

/** «Оформление» of `@alllexey/ui`: the choice applies on every alllexey.dev site. */
export function ThemeSettings({ onClose }: { onClose: () => void }) {
  const { choice, setMode, setSeed, setVariant } = useTheme();
  const custom = !seeds.some((seed) => seed.hex === choice.seed);
  const colorRef = useRef<HTMLInputElement>(null);

  // The native `change` fires once the picker closes; React's onChange would recolour on every drag.
  useEffect(() => {
    const input = colorRef.current;
    if (!input) return;
    const handleChange = () => setSeed(input.value);
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, [setSeed]);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Оформление"
      description="Палитра строится из одного цвета и применяется на всех сайтах alllexey.dev."
      icon="palette"
      shape="flower"
      actions={
        <Button variant="text" onClick={onClose}>
          Готово
        </Button>
      }
    >
      <div className={styles.setting}>
        <span className="m3-label-large">Тема</span>
        <ButtonGroup label="Тема" options={MODES} value={choice.mode} onChange={setMode} />
      </div>
      <div className={styles.setting}>
        <span className="m3-label-large">Цвет</span>
        <div className={styles.swatches}>
          {seeds.map((seed) => {
            const selected = choice.seed === seed.hex;
            return (
              <button
                key={seed.hex}
                type="button"
                className={styles.swatch}
                aria-pressed={selected}
                aria-label={seed.name}
                title={seed.name}
                onClick={() => setSeed(seed.hex)}
              >
                <m3-shape
                  shape={selected ? 'cookie9' : 'circle'}
                  size={44}
                  color={seed.hex}
                  style={ON_SEED}
                >
                  {selected && <Icon name="check" size={20} />}
                </m3-shape>
              </button>
            );
          })}
          <label className={cx(styles.swatch, styles.custom)} title="Свой цвет">
            <input
              ref={colorRef}
              key={choice.seed}
              type="color"
              defaultValue={choice.seed}
              aria-label="Свой цвет"
            />
            <m3-shape
              shape={custom ? 'cookie9' : 'clover4'}
              size={44}
              color={custom ? choice.seed : 'var(--md-surface-container-highest)'}
              style={custom ? ON_SEED : IDLE}
            >
              <Icon name={custom ? 'check' : 'format_paint'} size={20} />
            </m3-shape>
          </label>
        </div>
      </div>
      <div className={styles.setting}>
        <span className="m3-label-large">Палитра</span>
        <div className={styles.chips} role="group" aria-label="Палитра">
          {variants.map((variant) => (
            <Chip
              key={variant}
              selected={choice.variant === variant}
              onClick={() => setVariant(variant)}
            >
              {variantLabels[variant]}
            </Chip>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

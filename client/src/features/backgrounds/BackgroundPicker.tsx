import { Check, ExternalLink } from 'lucide-react';
import { Button, Modal } from '../../components/ui/AppUI';
import { BACKGROUND_PRESETS, type BackgroundId } from './backgroundPresets';

interface BackgroundPickerProps {
  open: boolean;
  selectedId: BackgroundId;
  saving: boolean;
  onSelect: (id: BackgroundId) => void;
  onClose: () => void;
}

export function BackgroundPicker({ open, selectedId, saving, onSelect, onClose }: BackgroundPickerProps) {
  return <Modal
    open={open}
    onClose={onClose}
    closeOnBackdrop
    presentation="content-dialog"
    title="Choose a background"
    subtitle="Personalize your dashboard with a calm learning environment."
    className="!max-w-3xl"
    footer={<Button variant="outline" onClick={onClose}>Done</Button>}
  >
    <div className="max-h-[min(640px,72vh)] overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BackgroundOption
          name="Default"
          selected={selectedId === 'default'}
          disabled={saving}
          onClick={() => onSelect('default')}
        />
        {BACKGROUND_PRESETS.map(preset => <BackgroundOption
          key={preset.id}
          name={preset.name}
          image={preset.image}
          source={preset.source}
          selected={selectedId === preset.id}
          disabled={saving}
          onClick={() => onSelect(preset.id)}
        />)}
      </div>
      <p className="mt-4 text-caption leading-5 text-muted-foreground">Images are stored locally for fast loading. Photo sources are linked on each preset.</p>
    </div>
  </Modal>;
}

function BackgroundOption({ name, image, source, selected, disabled, onClick }: { name: string; image?: string; source?: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return <div className={`relative overflow-hidden rounded-card border bg-surface transition-colors ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-ui-border hover:border-primary/55'}`}>
    <button type="button" disabled={disabled} onClick={onClick} className="block w-full text-left disabled:cursor-wait">
      <span
        className="relative block h-28 border-b border-ui-border bg-background bg-cover bg-center"
        style={image ? { backgroundImage: `linear-gradient(rgba(232,245,239,.28), rgba(242,248,245,.38)), url(${image})` } : { backgroundImage: 'linear-gradient(145deg, #F2F8F5 0%, #DDECE6 55%, #C2DDD4 100%)' }}
      >
        {selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-control bg-primary text-white shadow-sm"><Check size={15} strokeWidth={3} aria-hidden="true" /></span>}
      </span>
      <span className="flex items-center justify-between gap-2 px-3 py-2.5 pr-11">
        <span className="text-body font-semibold text-foreground">{name}</span>
      </span>
    </button>
    {source && <a href={source} target="_blank" rel="noreferrer" aria-label={`View source for ${name}`} className="absolute bottom-1.5 right-2 flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground hover:bg-primary-soft hover:text-primary-hover"><ExternalLink size={14} /></a>}
  </div>;
}

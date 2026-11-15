// The widgets theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in widgets.settings.json and the generated widgets.settings.ts;
// change them with `astryx experimental theme editor set widgets ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {widgetsSettings} from './widgets.settings';

export const widgetsTheme = defineTheme({
  extends: widgetsSettings,
  name: 'widgets',
});
